const express = require("express");
const router = express.Router();
const {
  joinQueue,
  getQueue,
  getTicket,
  callNext,
  serveTicket,
  skipTicket,
  pauseTicket,
  submitFeedback,
} = require("../controllers/queue.controller");
const { protect } = require("../middleware/auth.middleware");

// Public routes
router.get("/", getQueue);
router.post("/join", joinQueue);
router.get("/:id", getTicket);
router.patch("/:id/pause", pauseTicket);
router.post("/:id/feedback", submitFeedback);

// Protected routes (cashier must be logged in)
router.post("/call-next", protect, callNext);
router.patch("/:id/serve", protect, serveTicket);
router.patch("/:id/skip", protect, skipTicket);

module.exports = router;