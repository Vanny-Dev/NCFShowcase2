const Queue = require("../models/Queue.model");
const { STATUS } = require("../models/Queue.model");

// GET /api/analytics/today
const getTodayAnalytics = async (req, res, next) => {
  try {
    const today = new Date().toISOString().split("T")[0];

    const [waiting, called, served, skipped, feedbacks, avgWaitData, hourlyData] =
      await Promise.all([
        Queue.countDocuments({ serviceDate: today, status: STATUS.WAITING }),
        Queue.countDocuments({ serviceDate: today, status: { $in: [STATUS.CALLED, STATUS.SERVING] } }),
        Queue.countDocuments({ serviceDate: today, status: STATUS.SERVED }),
        Queue.countDocuments({ serviceDate: today, status: STATUS.SKIPPED }),
        Queue.find({
          serviceDate: today,
          "feedback.rating": { $ne: null },
        }).select("feedback"),
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
          { $group: { _id: null, avg: { $avg: "$waitSeconds" }, max: { $max: "$waitSeconds" } } },
        ]),
        // Hourly breakdown
        Queue.aggregate([
          { $match: { serviceDate: today } },
          {
            $group: {
              _id: { $hour: "$createdAt" },
              count: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 } },
        ]),
      ]);

    const avgRating =
      feedbacks.length > 0
        ? (feedbacks.reduce((sum, f) => sum + f.feedback.rating, 0) / feedbacks.length).toFixed(1)
        : null;

    const ratingBreakdown = [5, 4, 3, 2, 1].map((star) => ({
      star,
      count: feedbacks.filter((f) => f.feedback.rating === star).length,
    }));

    res.status(200).json({
      date: today,
      summary: {
        waiting,
        called,
        served,
        skipped,
        total: waiting + called + served + skipped,
        avgWaitSeconds: avgWaitData[0] ? Math.round(avgWaitData[0].avg) : 0,
        maxWaitSeconds: avgWaitData[0] ? Math.round(avgWaitData[0].max) : 0,
      },
      satisfaction: {
        avgRating: avgRating ? parseFloat(avgRating) : null,
        totalFeedbacks: feedbacks.length,
        ratingBreakdown,
      },
      hourlyBreakdown: hourlyData.map((h) => ({ hour: h._id, count: h.count })),
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/analytics/history?days=7
const getHistory = async (req, res, next) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const dates = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      dates.push(d.toISOString().split("T")[0]);
    }

    const results = await Promise.all(
      dates.map(async (date) => {
        const [total, served, skipped] = await Promise.all([
          Queue.countDocuments({ serviceDate: date }),
          Queue.countDocuments({ serviceDate: date, status: STATUS.SERVED }),
          Queue.countDocuments({ serviceDate: date, status: STATUS.SKIPPED }),
        ]);
        return { date, total, served, skipped };
      })
    );

    res.status(200).json({ history: results });
  } catch (error) {
    next(error);
  }
};

module.exports = { getTodayAnalytics, getHistory };