require("dotenv").config();
const express = require("express");
const http = require("http");
const cors = require("cors");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

// ─── Socket.io ───────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = [
  ...( process.env.CLIENT_URL ? [process.env.CLIENT_URL] : [] ),
  process.env.CLIENT_URL || "http://localhost:5173",
  "http://localhost:5173",
  "http://localhost:3000",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:3000",
];

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile, curl) or matching origins
      if (!origin || ALLOWED_ORIGINS.includes(origin)) {
        callback(null, true);
      } else {
        callback(null, true); // Allow all during development
      }
    },
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
  },
  transports: ["websocket", "polling"],
  allowEIO3: true,
});

// Track active windows: { windowNumber: { socketId, cashierName } }
const activeWindows = new Map();

const broadcastActiveWindows = () => {
  const windows = {};
  activeWindows.forEach((info, windowNum) => {
    windows[windowNum] = info.cashierName;
  });
  io.emit("windows:updated", { activeWindows: windows });
};

io.on("connection", (socket) => {
  // Global room — payors + all cashiers see waiting queue updates
  socket.on("join:queue-room", () => socket.join("queue:global"));

  // Per-counter room — only the cashier on that counter sees their called/served updates
  socket.on("join:counter-room", (counter) => socket.join(`counter:${counter}`));
  socket.on("leave:counter-room", (counter) => socket.leave(`counter:${counter}`));

  // Cashier claims a window
  socket.on("claim:window", ({ windowNum, cashierName }) => {
    // Release any previously held window by this socket
    activeWindows.forEach((info, num) => {
      if (info.socketId === socket.id) activeWindows.delete(num);
    });
    // Claim the new window
    activeWindows.set(windowNum, { socketId: socket.id, cashierName });
    socket.join(`counter:${windowNum}`);
    broadcastActiveWindows();
  });

  // Cashier releases their window (manual switch or disconnect)
  socket.on("release:window", ({ windowNum }) => {
    const info = activeWindows.get(windowNum);
    if (info && info.socketId === socket.id) {
      activeWindows.delete(windowNum);
      socket.leave(`counter:${windowNum}`);
      broadcastActiveWindows();
    }
  });

  // On disconnect, release any window this socket held
  socket.on("disconnect", () => {
    activeWindows.forEach((info, num) => {
      if (info.socketId === socket.id) {
        activeWindows.delete(num);
      }
    });
    broadcastActiveWindows();
  });

  // Per-ticket room — payor tracks their own ticket
  socket.on("join:ticket-room", (id) => socket.join(`ticket:${id}`));
  socket.on("leave:ticket-room", (id) => socket.leave(`ticket:${id}`));

  // Send current active windows to the newly connected socket
  const windows = {};
  activeWindows.forEach((info, windowNum) => {
    windows[windowNum] = info.cashierName;
  });
  socket.emit("windows:updated", { activeWindows: windows });
});

// Expose active windows via REST (for initial load)
app.get("/api/windows/active", (req, res) => {
  const windows = {};
  activeWindows.forEach((info, windowNum) => {
    windows[windowNum] = info.cashierName;
  });
  res.json({ activeWindows: windows });
});

const emit = {
  // Broadcast waiting queue changes to everyone
  queueUpdated: (data) => io.to("queue:global").emit("queue:updated", data),
  // Notify the payor's ticket room + global queue + the specific counter room
  ticketCalled: (ticketId, counter, data) => {
    io.to(`ticket:${ticketId}`).emit("ticket:called", data);
    io.to(`counter:${counter}`).emit("counter:updated", data);
    io.to("queue:global").emit("queue:updated", data);
  },
  ticketServed: (ticketId, counter, data) => {
    io.to(`ticket:${ticketId}`).emit("ticket:served", data);
    io.to(`counter:${counter}`).emit("counter:updated", data);
    io.to("queue:global").emit("queue:updated", data);
  },
  ticketSkipped: (ticketId, counter, data) => {
    io.to(`ticket:${ticketId}`).emit("ticket:skipped", data);
    io.to(`counter:${counter}`).emit("counter:updated", data);
    io.to("queue:global").emit("queue:updated", data);
  },
  analyticsUpdated: (data) => io.to("queue:global").emit("analytics:updated", data),
};

// ─── MongoDB ──────────────────────────────────────────────────────────────────
mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/qampus")
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => { console.error("❌ MongoDB error:", err.message); process.exit(1); });

// ─── User Model ───────────────────────────────────────────────────────────────
const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  username: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, minlength: 6, select: false },
  role: { type: String, enum: ["cashier", "admin"], default: "cashier" },
  counter: { type: Number, default: 1 },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});
userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

const User = mongoose.models.User || mongoose.model("User", userSchema);

// ─── Queue Model ──────────────────────────────────────────────────────────────
const TRANSACTION_TYPES = ["Tuition Payment", "Scholarship", "Permit Processing", "Miscellaneous Fee", "Other"];
const STATUS = { WAITING: "waiting", CALLED: "called", SERVING: "serving", SERVED: "served", SKIPPED: "skipped", PAUSED: "paused" };

const queueSchema = new mongoose.Schema({
  ticketNumber: { type: Number, required: true },
  name: { type: String, required: true, trim: true },
  transactionType: { type: String, enum: TRANSACTION_TYPES, required: true },
  status: { type: String, enum: Object.values(STATUS), default: STATUS.WAITING },
  counter: { type: Number, default: null },
  servedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  calledAt: { type: Date, default: null },
  servedAt: { type: Date, default: null },
  serviceDate: { type: String, default: () => new Date().toISOString().split("T")[0] },
  feedback: {
    rating: { type: Number, min: 1, max: 5, default: null },
    comment: { type: String, default: "" },
    submittedAt: { type: Date, default: null },
  },
  pausedAt: { type: Date, default: null },
}, { timestamps: true });

queueSchema.index({ serviceDate: 1, status: 1 });
const Queue = mongoose.models.Queue || mongoose.model("Queue", queueSchema);

const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });

// All active waiting/paused tickets (global — for payors to see their position)
const getTodayQueue = () =>
  Queue.find({ serviceDate: today(), status: { $in: [STATUS.WAITING, STATUS.CALLED, STATUS.SERVING] } })
    .sort({ ticketNumber: 1 });

// Waiting tickets only (unassigned — any cashier can grab these)
const getWaitingQueue = () =>
  Queue.find({ serviceDate: today(), status: { $in: [STATUS.WAITING] } })
    .sort({ ticketNumber: 1 });

// Tickets assigned to a specific counter (called/serving by that counter)
const getCounterQueue = (counter) =>
  Queue.find({ serviceDate: today(), counter, status: { $in: [STATUS.CALLED, STATUS.SERVING] } })
    .sort({ ticketNumber: 1 });

const generateTicketNumber = async () => {
  const last = await Queue.findOne({ serviceDate: today() }).sort({ ticketNumber: -1 });
  return last ? last.ticketNumber + 1 : 1;
};

const getAnalyticsSnapshot = async () => {
  const d = today();
  const [waiting, called, served, skipped, avgData] = await Promise.all([
    Queue.countDocuments({ serviceDate: d, status: STATUS.WAITING }),
    Queue.countDocuments({ serviceDate: d, status: { $in: [STATUS.CALLED, STATUS.SERVING] } }),
    Queue.countDocuments({ serviceDate: d, status: STATUS.SERVED }),
    Queue.countDocuments({ serviceDate: d, status: STATUS.SKIPPED }),
    Queue.aggregate([
      { $match: { serviceDate: d, status: STATUS.SERVED, servedAt: { $ne: null } } },
      { $project: { w: { $divide: [{ $subtract: ["$servedAt", "$createdAt"] }, 1000] } } },
      { $group: { _id: null, avg: { $avg: "$w" } } },
    ]),
  ]);
  return { waiting, called, served, skipped, avgWaitSeconds: avgData[0] ? Math.round(avgData[0].avg) : 0 };
};

// ─── App Middleware ───────────────────────────────────────────────────────────
app.use(cors({
  origin: (origin, callback) => callback(null, true), // Allow all during development
  credentials: true,
  methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));
app.use(express.json());

const protect = async (req, res, next) => {
  try {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith("Bearer ")) return res.status(401).json({ message: "Unauthorized. No token." });
    const decoded = jwt.verify(auth.split(" ")[1], process.env.JWT_SECRET || "qampus_secret");
    const user = await User.findById(decoded.id);
    if (!user || !user.isActive) return res.status(401).json({ message: "Unauthorized." });
    req.user = user;
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") return res.status(401).json({ message: "Token expired." });
    return res.status(401).json({ message: "Invalid token." });
  }
};

const signToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET || "qampus_secret", { expiresIn: process.env.JWT_EXPIRES_IN || "8h" });

// ─── Auth Routes ──────────────────────────────────────────────────────────────
app.post("/api/auth/login", async (req, res, next) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ message: "Username and password required." });
    const user = await User.findOne({ username }).select("+password");
    if (!user || !(await user.comparePassword(password))) return res.status(401).json({ message: "Invalid credentials." });
    if (!user.isActive) return res.status(403).json({ message: "Account deactivated." });
    res.json({ message: "Login successful", token: signToken(user._id), user: user.toJSON() });
  } catch (err) { next(err); }
});

app.get("/api/auth/me", protect, (req, res) => res.json({ user: req.user }));

app.post("/api/auth/register", async (req, res, next) => {
  try {
    if (process.env.ALLOW_SIGNUP !== "true") return res.status(403).json({ message: "Registration is currently closed." });
    const { name, username, password, confirmPassword, counter } = req.body;
    if (!name || !username || !password) return res.status(400).json({ message: "Name, username, and password are required." });
    if (password !== confirmPassword) return res.status(400).json({ message: "Passwords do not match." });
    if (password.length < 6) return res.status(400).json({ message: "Password must be at least 6 characters." });
    const existing = await User.findOne({ username: username.toLowerCase() });
    if (existing) return res.status(409).json({ message: "Username already taken." });
    const user = await User.create({
      name: name.trim(),
      username: username.toLowerCase().trim(),
      password,
      role: "cashier",
      counter: counter || 1,
    });
    res.status(201).json({ message: "Account created successfully!", token: signToken(user._id), user: user.toJSON() });
  } catch (err) { next(err); }
});

app.post("/api/auth/seed", async (req, res, next) => {
  try {
    if (process.env.NODE_ENV === "production") return res.status(403).json({ message: "Not in production." });
    const existing = await User.findOne({ username: "cashier1" });
    if (existing) return res.json({ message: "Default cashier already exists.", user: existing });
    const user = await User.create({ name: "Cashier One", username: "cashier1", password: "cashier123", role: "cashier", counter: 1 });
    res.status(201).json({ message: "Created! Username: cashier1 | Password: cashier123", user });
  } catch (err) { next(err); }
});

// ─── Queue Routes ─────────────────────────────────────────────────────────────
app.get("/api/queue", async (req, res, next) => {
  try { res.json({ queue: await getTodayQueue() }); }
  catch (err) { next(err); }
});

app.post("/api/queue/join", async (req, res, next) => {
  try {
    const { name, transactionType } = req.body;
    if (!name || !transactionType) return res.status(400).json({ message: "Name and transaction type required." });
    const ticketNumber = await generateTicketNumber();
    const ticket = await Queue.create({ ticketNumber, name: name.trim(), transactionType, serviceDate: today() });
    const [queue, waitingQueue] = await Promise.all([getTodayQueue(), getWaitingQueue()]);
    // Always emit BOTH queue (for payors) AND waitingQueue (for cashiers)
    emit.queueUpdated({ queue, waitingQueue });
    emit.analyticsUpdated(await getAnalyticsSnapshot());
    res.status(201).json({ message: "Joined queue!", ticket });
  } catch (err) { next(err); }
});

// Get tickets currently assigned to a specific counter (cashier's own view)
app.get("/api/queue/counter/:counter", protect, async (req, res, next) => {
  try {
    const counter = parseInt(req.params.counter);
    const [counterQueue, waitingQueue] = await Promise.all([
      getCounterQueue(counter),
      getWaitingQueue(),
    ]);
    res.json({ counterQueue, waitingQueue });
  } catch (err) { next(err); }
});

app.get("/api/queue/:id", async (req, res, next) => {
  try {
    const ticket = await Queue.findById(req.params.id);
    if (!ticket) return res.status(404).json({ message: "Ticket not found." });
    const ahead = await Queue.countDocuments({ serviceDate: today(), status: STATUS.WAITING, ticketNumber: { $lt: ticket.ticketNumber } });
    res.json({ ticket, position: ahead + 1 });
  } catch (err) { next(err); }
});

app.post("/api/queue/call-next", protect, async (req, res, next) => {
  try {
    const counter = req.body.counter || req.user.counter;
    // Block if this cashier already has an active ticket at their window
    const alreadyServing = await Queue.findOne({
      serviceDate: today(),
      counter,
      status: { $in: [STATUS.CALLED, STATUS.SERVING] },
    });
    if (alreadyServing) return res.status(400).json({ message: "Finish serving the current payor before calling the next one." });
    const nextTicket = await Queue.findOne({ serviceDate: today(), status: STATUS.WAITING }).sort({ ticketNumber: 1 });
    if (!nextTicket) return res.status(404).json({ message: "No waiting tickets." });
    nextTicket.status = STATUS.CALLED;
    nextTicket.calledAt = new Date();
    nextTicket.counter = counter;
    nextTicket.servedBy = req.user._id;
    await nextTicket.save();
    const [globalQueue, counterQueue, waitingQueue] = await Promise.all([
      getTodayQueue(),
      getCounterQueue(counter),
      getWaitingQueue(),
    ]);
    // Notify the payor + update counter room + update global waiting
    emit.ticketCalled(nextTicket._id.toString(), counter, {
      ticket: nextTicket,
      queue: globalQueue,
      counterQueue,       // only tickets for this counter
      waitingQueue,       // updated waiting list for all cashiers
      message: `Ticket #${String(nextTicket.ticketNumber).padStart(3, "0")} — Please proceed to Cashier Window ${counter}`,
    });
    emit.analyticsUpdated(await getAnalyticsSnapshot());
    res.json({ message: "Next payor called.", ticket: nextTicket, counterQueue });
  } catch (err) { next(err); }
});

app.patch("/api/queue/:id/serve", protect, async (req, res, next) => {
  try {
    const ticket = await Queue.findById(req.params.id);
    if (!ticket) return res.status(404).json({ message: "Ticket not found." });
    const counter = ticket.counter || req.user.counter;
    ticket.status = STATUS.SERVED;
    ticket.servedAt = new Date();
    await ticket.save();
    const [globalQueue, counterQueue, waitingQueue] = await Promise.all([
      getTodayQueue(), getCounterQueue(counter), getWaitingQueue(),
    ]);
    emit.ticketServed(ticket._id.toString(), counter, { ticket, queue: globalQueue, counterQueue, waitingQueue });
    emit.analyticsUpdated(await getAnalyticsSnapshot());
    res.json({ message: "Served.", ticket, counterQueue });
  } catch (err) { next(err); }
});

app.patch("/api/queue/:id/skip", protect, async (req, res, next) => {
  try {
    const ticket = await Queue.findById(req.params.id);
    if (!ticket) return res.status(404).json({ message: "Ticket not found." });
    const counter = ticket.counter || req.user.counter;
    ticket.status = STATUS.SKIPPED;
    await ticket.save();
    const [globalQueue, counterQueue, waitingQueue] = await Promise.all([
      getTodayQueue(), getCounterQueue(counter), getWaitingQueue(),
    ]);
    emit.ticketSkipped(ticket._id.toString(), counter, { ticket, queue: globalQueue, counterQueue, waitingQueue });
    emit.analyticsUpdated(await getAnalyticsSnapshot());
    res.json({ message: "Skipped.", ticket, counterQueue });
  } catch (err) { next(err); }
});



app.post("/api/queue/:id/feedback", async (req, res, next) => {
  try {
    const { rating, comment } = req.body;
    if (!rating || rating < 1 || rating > 5) return res.status(400).json({ message: "Rating must be 1–5." });
    const ticket = await Queue.findById(req.params.id);
    if (!ticket) return res.status(404).json({ message: "Ticket not found." });
    if (ticket.feedback.rating) return res.status(400).json({ message: "Feedback already submitted." });
    ticket.feedback = { rating, comment: comment || "", submittedAt: new Date() };
    await ticket.save();
    res.json({ message: "Feedback submitted!", ticket });
  } catch (err) { next(err); }
});

// ─── Analytics Routes ─────────────────────────────────────────────────────────
app.get("/api/analytics/today", protect, async (req, res, next) => {
  try {
    const d = today();
    const [waiting, called, served, skipped, feedbacks, avgData, hourly] = await Promise.all([
      Queue.countDocuments({ serviceDate: d, status: STATUS.WAITING }),
      Queue.countDocuments({ serviceDate: d, status: { $in: [STATUS.CALLED, STATUS.SERVING] } }),
      Queue.countDocuments({ serviceDate: d, status: STATUS.SERVED }),
      Queue.countDocuments({ serviceDate: d, status: STATUS.SKIPPED }),
      Queue.find({ serviceDate: d, "feedback.rating": { $ne: null } }).select("feedback"),
      Queue.aggregate([
        { $match: { serviceDate: d, status: STATUS.SERVED, servedAt: { $ne: null } } },
        { $project: { w: { $divide: [{ $subtract: ["$servedAt", "$createdAt"] }, 1000] } } },
        { $group: { _id: null, avg: { $avg: "$w" }, max: { $max: "$w" } } },
      ]),
      Queue.aggregate([
        { $match: { serviceDate: d } },
        { $group: { _id: { $hour: "$createdAt" }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
    ]);
    const avgRating = feedbacks.length > 0
      ? (feedbacks.reduce((s, f) => s + f.feedback.rating, 0) / feedbacks.length).toFixed(1)
      : null;
    const ratingBreakdown = [5,4,3,2,1].map((star) => ({
      star, count: feedbacks.filter((f) => f.feedback.rating === star).length,
    }));
    res.json({
      date: d,
      summary: {
        waiting, called, served, skipped,
        total: waiting + called + served + skipped,
        avgWaitSeconds: avgData[0] ? Math.round(avgData[0].avg) : 0,
        maxWaitSeconds: avgData[0] ? Math.round(avgData[0].max) : 0,
      },
      satisfaction: { avgRating: avgRating ? parseFloat(avgRating) : null, totalFeedbacks: feedbacks.length, ratingBreakdown },
      hourlyBreakdown: hourly.map((h) => ({ hour: h._id, count: h.count })),
    });
  } catch (err) { next(err); }
});

app.get("/api/analytics/history", protect, async (req, res, next) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const dates = Array.from({ length: days }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (days - 1 - i));
      return d.toISOString().split("T")[0];
    });
    const history = await Promise.all(dates.map(async (date) => {
      const [total, served, skipped] = await Promise.all([
        Queue.countDocuments({ serviceDate: date }),
        Queue.countDocuments({ serviceDate: date, status: STATUS.SERVED }),
        Queue.countDocuments({ serviceDate: date, status: STATUS.SKIPPED }),
      ]);
      return { date, total, served, skipped };
    }));
    res.json({ history });
  } catch (err) { next(err); }
});

// ─── Health & Error ───────────────────────────────────────────────────────────
app.get("/api/health", (_req, res) => res.json({ status: "ok", app: "Qampus" }));

app.use((err, _req, res, _next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ message: err.message || "Internal Server Error" });
});

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Qampus running on http://localhost:${PORT}`);
  console.log(`📡 Socket.io ready`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || "development"}`);
});