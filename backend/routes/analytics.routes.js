const express = require("express");
const router = express.Router();
const { getTodayAnalytics, getHistory } = require("../controllers/analytics.controller");
const { protect } = require("../middleware/auth.middleware");

router.get("/today", protect, getTodayAnalytics);
router.get("/history", protect, getHistory);

module.exports = router;