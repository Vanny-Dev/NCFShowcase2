const Queue = require("../models/Queue.model");
const { STATUS } = require("../models/Queue.model");
const {
  emitQueueUpdated,
  emitTicketCalled,
  emitTicketServed,
  emitTicketSkipped,
  emitAnalyticsUpdated,
} = require("../socket");

// Helper: fetch today's active queue and emit update
const refreshAndEmit = async (io) => {
  const queue = await Queue.getTodayQueue();
  emitQueueUpdated({ queue });
  return queue;
};

// Helper: get analytics snapshot
const getAnalyticsSnapshot = async () => {
  const today = new Date().toISOString().split("T")[0];
  const [waiting, called, served, skipped, avgWaitData] = await Promise.all([
    Queue.countDocuments({ serviceDate: today, status: STATUS.WAITING }),
    Queue.countDocuments({ serviceDate: today, status: { $in: [STATUS.CALLED, STATUS.SERVING] } }),
    Queue.countDocuments({ serviceDate: today, status: STATUS.SERVED }),
    Queue.countDocuments({ serviceDate: today, status: STATUS.SKIPPED }),
    Queue.aggregate([
      {
        $match: {
          serviceDate: today,
          status: STATUS.SERVED,
          servedAt: { $ne: null },
        },
      },
      {
        $project: {
          waitSeconds: {
            $divide: [{ $subtract: ["$servedAt", "$createdAt"] }, 1000],
          },
        },
      },
      { $group: { _id: null, avg: { $avg: "$waitSeconds" } } },
    ]),
  ]);

  return {
    waiting,
    called,
    served,
    skipped,
    avgWaitSeconds: avgWaitData[0] ? Math.round(avgWaitData[0].avg) : 0,
  };
};

// POST /api/queue/join  — Public (payor joins queue)
const joinQueue = async (req, res, next) => {
  try {
    const { name, transactionType } = req.body;

    if (!name || !transactionType) {
      return res.status(400).json({ message: "Name and transaction type are required." });
    }

    const today = new Date().toISOString().split("T")[0];
    const ticketNumber = await Queue.generateTicketNumber(today);

    const ticket = await Queue.create({
      ticketNumber,
      name: name.trim(),
      transactionType,
      serviceDate: today,
    });

    // Emit queue update to all connected clients
    await refreshAndEmit(req.io);
    emitAnalyticsUpdated(await getAnalyticsSnapshot());

    res.status(201).json({
      message: "Successfully joined the queue!",
      ticket,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/queue  — Public (everyone can view the queue)
const getQueue = async (req, res, next) => {
  try {
    const queue = await Queue.getTodayQueue();
    res.status(200).json({ queue });
  } catch (error) {
    next(error);
  }
};

// GET /api/queue/:id  — Public (payor checks their ticket)
const getTicket = async (req, res, next) => {
  try {
    const ticket = await Queue.findById(req.params.id);
    if (!ticket) return res.status(404).json({ message: "Ticket not found." });

    // Get position in queue
    const today = new Date().toISOString().split("T")[0];
    const aheadCount = await Queue.countDocuments({
      serviceDate: today,
      status: STATUS.WAITING,
      ticketNumber: { $lt: ticket.ticketNumber },
    });

    res.status(200).json({ ticket, position: aheadCount + 1 });
  } catch (error) {
    next(error);
  }
};

// POST /api/queue/call-next  — Cashier only
const callNext = async (req, res, next) => {
  try {
    const today = new Date().toISOString().split("T")[0];

    // Find the next waiting ticket (not paused)
    const nextTicket = await Queue.findOne({
      serviceDate: today,
      status: STATUS.WAITING,
    }).sort({ ticketNumber: 1 });

    if (!nextTicket) {
      return res.status(404).json({ message: "No waiting tickets in queue." });
    }

    nextTicket.status = STATUS.CALLED;
    nextTicket.calledAt = new Date();
    nextTicket.counter = req.user.counter;
    nextTicket.servedBy = req.user._id;
    await nextTicket.save();

    const queue = await refreshAndEmit(req.io);
    emitTicketCalled(nextTicket._id.toString(), {
      ticket: nextTicket,
      queue,
      message: `Ticket #${String(nextTicket.ticketNumber).padStart(3, "0")} — Please proceed to Counter ${req.user.counter}`,
    });
    emitAnalyticsUpdated(await getAnalyticsSnapshot());

    res.status(200).json({ message: "Next payor called.", ticket: nextTicket });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/queue/:id/serve  — Cashier only
const serveTicket = async (req, res, next) => {
  try {
    const ticket = await Queue.findById(req.params.id);
    if (!ticket) return res.status(404).json({ message: "Ticket not found." });
    if (![STATUS.CALLED, STATUS.SERVING].includes(ticket.status)) {
      return res.status(400).json({ message: "Ticket is not in called/serving state." });
    }

    ticket.status = STATUS.SERVED;
    ticket.servedAt = new Date();
    await ticket.save();

    const queue = await refreshAndEmit(req.io);
    emitTicketServed(ticket._id.toString(), { ticket, queue });
    emitAnalyticsUpdated(await getAnalyticsSnapshot());

    res.status(200).json({ message: "Ticket marked as served.", ticket });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/queue/:id/skip  — Cashier only
const skipTicket = async (req, res, next) => {
  try {
    const ticket = await Queue.findById(req.params.id);
    if (!ticket) return res.status(404).json({ message: "Ticket not found." });
    if (![STATUS.CALLED, STATUS.WAITING, STATUS.PAUSED].includes(ticket.status)) {
      return res.status(400).json({ message: "Ticket cannot be skipped in its current state." });
    }

    ticket.status = STATUS.SKIPPED;
    await ticket.save();

    const queue = await refreshAndEmit(req.io);
    emitTicketSkipped(ticket._id.toString(), { ticket, queue });
    emitAnalyticsUpdated(await getAnalyticsSnapshot());

    res.status(200).json({ message: "Ticket skipped.", ticket });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/queue/:id/pause  — Public (payor pauses own ticket)
const pauseTicket = async (req, res, next) => {
  try {
    const { pause } = req.body; // true = pause, false = resume
    const ticket = await Queue.findById(req.params.id);
    if (!ticket) return res.status(404).json({ message: "Ticket not found." });

    if (pause) {
      if (ticket.status !== STATUS.WAITING) {
        return res.status(400).json({ message: "Only waiting tickets can be paused." });
      }
      ticket.status = STATUS.PAUSED;
      ticket.pausedAt = new Date();
    } else {
      if (ticket.status !== STATUS.PAUSED) {
        return res.status(400).json({ message: "Ticket is not paused." });
      }
      ticket.status = STATUS.WAITING;
      ticket.pausedAt = null;
    }

    await ticket.save();
    await refreshAndEmit(req.io);

    res.status(200).json({ message: pause ? "Ticket paused." : "Ticket resumed.", ticket });
  } catch (error) {
    next(error);
  }
};

// POST /api/queue/:id/feedback  — Public
const submitFeedback = async (req, res, next) => {
  try {
    const { rating, comment } = req.body;
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ message: "Rating must be between 1 and 5." });
    }

    const ticket = await Queue.findById(req.params.id);
    if (!ticket) return res.status(404).json({ message: "Ticket not found." });
    if (ticket.status !== STATUS.SERVED) {
      return res.status(400).json({ message: "Feedback can only be submitted after being served." });
    }
    if (ticket.feedback.rating) {
      return res.status(400).json({ message: "Feedback already submitted." });
    }

    ticket.feedback = { rating, comment: comment || "", submittedAt: new Date() };
    await ticket.save();

    res.status(200).json({ message: "Feedback submitted. Thank you!", ticket });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  joinQueue,
  getQueue,
  getTicket,
  callNext,
  serveTicket,
  skipTicket,
  pauseTicket,
  submitFeedback,
};