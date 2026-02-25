import { useState, useEffect } from "react";
import { analyticsAPI } from "../services/api";
import { SOCKET_EVENTS } from "../services/socket";
import useSocket from "../hooks/useSocket";
import StatCard from "../components/common/StatCard";
import styles from "./Analytics.module.css";
import { SkipForward, Hourglass, Check, TimerIcon } from "lucide-react";

const RatingBar = ({ star, count, total }) => {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className={styles.ratingRow}>
      <span className={styles.ratingStar}>{star}★</span>
      <div className={styles.ratingBarWrap}>
        <div className={styles.ratingBar} style={{ width: `${pct}%` }} />
      </div>
      <span className={styles.ratingCount}>{count}</span>
    </div>
  );
};

export default function Analytics() {
  const [data, setData] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [todayRes, historyRes] = await Promise.all([
        analyticsAPI.today(),
        analyticsAPI.history(7),
      ]);
      setData(todayRes.data);
      setHistory(historyRes.data.history);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // Live analytics updates
  useSocket({
    rooms: [SOCKET_EVENTS.JOIN_QUEUE_ROOM],
    listeners: {
      [SOCKET_EVENTS.ANALYTICS_UPDATED]: () => fetchData(),
    },
  });

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner} />
        <p>Loading analytics…</p>
      </div>
    );
  }

  const { summary, satisfaction, hourlyBreakdown } = data || {};
  const maxHistory = Math.max(...history.map((h) => h.total), 1);
  const maxHourly = Math.max(...(hourlyBreakdown?.map((h) => h.count) || []), 1);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Analytics & Reports</h1>
        <p className={styles.subtitle}>
          Today — {new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" })}
        </p>
      </div>

      {/* Summary stats */}
      <div className={styles.stats}>
        <StatCard label="Total Served" value={summary?.served ?? 0} accent="#10B981" icon={<Check size={16} />} />
        <StatCard label="Currently Waiting" value={summary?.waiting ?? 0} accent="#F5A623" icon={<Hourglass size={16} />} />
        <StatCard label="Skipped" value={summary?.skipped ?? 0} accent="#EF4444" icon={<SkipForward size={16} />} />
        <StatCard label="Avg Wait" value={`${summary?.avgWaitSeconds ?? 0}s`} accent="#818CF8" icon={<TimerIcon size={16} />} subtitle={`Max: ${summary?.maxWaitSeconds ?? 0}s`} />
      </div>

      <div className={styles.grid}>
        {/* Satisfaction */}
        <div className={styles.card}>
          <h3 className={styles.cardTitle}>Payor Satisfaction</h3>
          {satisfaction?.totalFeedbacks === 0 ? (
            <p className={styles.noData}>No feedback collected yet.</p>
          ) : (
            <>
              <div className={styles.avgRating}>
                <span className={styles.avgNum}>{satisfaction?.avgRating ?? "—"}</span>
                <div>
                  <div className={styles.starsDisplay}>
                    {[1, 2, 3, 4, 5].map((s) => (
                      <span key={s} style={{ color: s <= Math.round(satisfaction?.avgRating || 0) ? "#F5A623" : "var(--border-strong)" }}>★</span>
                    ))}
                  </div>
                  <div className={styles.feedbackCount}>{satisfaction?.totalFeedbacks} reviews</div>
                </div>
              </div>
              <div className={styles.ratingBars}>
                {[5, 4, 3, 2, 1].map((star) => {
                  const found = satisfaction?.ratingBreakdown?.find((r) => r.star === star);
                  return (
                    <RatingBar
                      key={star}
                      star={star}
                      count={found?.count ?? 0}
                      total={satisfaction?.totalFeedbacks ?? 0}
                    />
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Hourly breakdown */}
        <div className={styles.card}>
          <h3 className={styles.cardTitle}>Hourly Traffic Today</h3>
          {(!hourlyBreakdown || hourlyBreakdown.length === 0) ? (
            <p className={styles.noData}>No data yet for today.</p>
          ) : (
            <div className={styles.barChart}>
              {hourlyBreakdown.map((h) => (
                <div key={h.hour} className={styles.barCol}>
                  <div className={styles.barLabel}>{h.count}</div>
                  <div
                    className={styles.bar}
                    style={{ height: `${Math.max((h.count / maxHourly) * 120, 4)}px` }}
                  />
                  <div className={styles.barHour}>{h.hour}:00</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 7-day history */}
      <div className={styles.card}>
        <h3 className={styles.cardTitle}>7-Day History</h3>
        <div className={styles.historyChart}>
          {history.map((day) => (
            <div key={day.date} className={styles.historyCol}>
              <div className={styles.historyBars}>
                <div
                  className={styles.historyBar}
                  style={{ height: `${Math.max((day.served / maxHistory) * 80, 3)}px`, background: "#10B981" }}
                  title={`Served: ${day.served}`}
                />
                <div
                  className={styles.historyBar}
                  style={{ height: `${Math.max((day.skipped / maxHistory) * 80, day.skipped > 0 ? 3 : 0)}px`, background: "#EF4444" }}
                  title={`Skipped: ${day.skipped}`}
                />
              </div>
              <div className={styles.historyDate}>
                {new Date(day.date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </div>
              <div className={styles.historyTotal}>{day.total}</div>
            </div>
          ))}
        </div>
        <div className={styles.legend}>
          <span><span className={styles.dot} style={{ background: "#10B981" }} /> Served</span>
          <span><span className={styles.dot} style={{ background: "#EF4444" }} /> Skipped</span>
        </div>
      </div>
    </div>
  );
}
