const mongoose = require("mongoose");

const TRANSACTION_TYPES = [
  "Tuition Payment",
  "Scholarship",
  "Permit Processing",
  "Miscellaneous Fee",
  "Other",
];

const STATUS = {
  WAITING: "waiting",
  CALLED: "called",
  SERVING: "serving",
  SERVED: "served",
  SKIPPED: "skipped",
  PAUSED: "paused",
};

const queueSchema = new mongoose.Schema(
  {
    ticketNumber: {
      type: Number,
      required: true,
    },
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
    },
    transactionType: {
      type: String,
      enum: TRANSACTION_TYPES,
      required: [true, "Transaction type is required"],
    },
    status: {
      type: String,
      enum: Object.values(STATUS),
      default: STATUS.WAITING,
    },
    counter: {
      type: Number,
      default: null,
    },
    servedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    calledAt: { type: Date, default: null },
    servedAt: { type: Date, default: null },
    serviceDate: {
      type: String, // YYYY-MM-DD for grouping daily queues
      default: () => new Date().toISOString().split("T")[0],
    },
    feedback: {
      rating: { type: Number, min: 1, max: 5, default: null },
      comment: { type: String, default: "" },
      submittedAt: { type: Date, default: null },
    },
    pausedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Index for efficient querying
queueSchema.index({ serviceDate: 1, status: 1 });
queueSchema.index({ serviceDate: 1, ticketNumber: 1 });

// Virtual: wait duration in seconds
queueSchema.virtual("waitDuration").get(function () {
  if (!this.servedAt) return null;
  return Math.round((this.servedAt - this.createdAt) / 1000);
});

// Auto-generate ticket number per day
queueSchema.statics.generateTicketNumber = async function (serviceDate) {
  const lastTicket = await this.findOne({ serviceDate }).sort({ ticketNumber: -1 });
  return lastTicket ? lastTicket.ticketNumber + 1 : 1;
};

// Get today's active queue
queueSchema.statics.getTodayQueue = function () {
  const today = new Date().toISOString().split("T")[0];
  return this.find({
    serviceDate: today,
    status: { $in: [STATUS.WAITING, STATUS.CALLED, STATUS.SERVING, STATUS.PAUSED] },
  }).sort({ ticketNumber: 1 });
};

module.exports = mongoose.models.Queue || mongoose.model("Queue", queueSchema);
module.exports.STATUS = STATUS;
module.exports.TRANSACTION_TYPES = TRANSACTION_TYPES;