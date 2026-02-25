import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../contexts/AuthContext";
import { queueAPI, windowsAPI } from "../services/api";
import { connectSocket, SOCKET_EVENTS } from "../services/socket";
import useCashierQueue from "../hooks/useCashierQueue";
import QueueTicket from "../components/cashier/QueueTicket";
import StatCard from "../components/common/StatCard";
import Button from "../components/common/Button";
import { useToast } from "../components/common/Toast";
import styles from "./CashierDashboard.module.css";
import { Hourglass, Check, List, Ticket, Megaphone } from "lucide-react";

const TOTAL_WINDOWS = 5;
const AUTO_CALL_NEXT = import.meta.env.VITE_AUTO_CALL_NEXT === "true";

export default function CashierDashboard() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [callingNext, setCallingNext] = useState(false);

  const [activeWindows, setActiveWindows] = useState({});
  const [counter, setCounter] = useState(null);

  // ── Init windows & auto-assign ─────────────────────────────
  useEffect(() => {
    const init = async () => {
      try {
        const res = await windowsAPI.getActive();
        const current = res.data.activeWindows || {};
        setActiveWindows(current);

        const taken = Object.keys(current).map(Number);
        const available = Array.from({ length: TOTAL_WINDOWS }, (_, i) => i + 1)
          .filter((n) => !taken.includes(n));

        if (available.length > 0) {
          const assigned = available[0];
          setCounter(assigned);
          claimWindow(assigned);
        } else {
          addToast("All windows are currently occupied!", "warning");
          setCounter(1);
        }
      } catch (err) {
        console.error("Failed to fetch active windows:", err);
        setCounter(1);
      }
    };

    init();

    const socket = connectSocket();
    const handleWindowsUpdated = ({ activeWindows: aw }) => {
      setActiveWindows(aw || {});
    };

    socket.on(SOCKET_EVENTS.WINDOWS_UPDATED, handleWindowsUpdated);

    return () => {
      socket.off(SOCKET_EVENTS.WINDOWS_UPDATED, handleWindowsUpdated);
      if (counter) releaseWindow(counter);
    };
  }, []);

  // ── Claim & Release window ────────────────────────────────
  const claimWindow = useCallback((windowNum) => {
    const socket = connectSocket();
    socket.emit(SOCKET_EVENTS.CLAIM_WINDOW, {
      windowNum,
      cashierName: user?.name || "Cashier",
    });
  }, [user]);

  const releaseWindow = useCallback((windowNum) => {
    const socket = connectSocket();
    socket.emit(SOCKET_EVENTS.RELEASE_WINDOW, { windowNum });
  }, []);

  const handleCounterChange = (newWindow) => {
    const num = Number(newWindow);
    if (counter) releaseWindow(counter);
    setCounter(num);
    claimWindow(num);
    addToast(`Switched to Window ${num}`, "info");
  };

  const { counterQueue, waitingQueue, loading } = useCashierQueue(counter);

  // ── Queue Actions ─────────────────────────────────────────
  const handleCallNext = async () => {
    setCallingNext(true);
    try {
      // If AUTO_CALL_NEXT is enabled and there's a current ticket, serve it first
      if (AUTO_CALL_NEXT && counterQueue.length > 0) {
        const currentTicket = counterQueue[0];
        await queueAPI.serve(currentTicket._id);
        addToast(`Ticket #${String(currentTicket.ticketNumber).padStart(3, "0")} marked as served.`, "success");
        
        // If no one is waiting, we're done
        if (waitingQueue.length === 0) {
          return;
        }
      }
      
      // Then call the next ticket (only if there are waiting tickets)
      if (waitingQueue.length > 0) {
        const res = await queueAPI.callNext(counter);
        const t = res.data.ticket;
        addToast(
          `Called #${String(t.ticketNumber).padStart(3, "0")} — ${t.name} → Window ${counter}`,
          "success"
        );
      }
    } catch (err) {
      addToast(err.response?.data?.message || "No waiting tickets.", "warning");
    } finally {
      setCallingNext(false);
    }
  };

  const handleServe = async (id) => {
    try {
      await queueAPI.serve(id);
      addToast("Marked as served.", "success");
    } catch {
      addToast("Error serving ticket.", "error");
    }
  };

  const handleSkip = async (id) => {
    try {
      await queueAPI.skip(id);
      addToast("Ticket skipped.", "info");
    } catch {
      addToast("Error skipping ticket.", "error");
    }
  };

  const isWindowTaken = (n) =>
    activeWindows[n] !== undefined &&
    activeWindows[n] !== (user?.name || "Cashier");

  // Loading state
  if (counter === null) {
    return (
      <div className={styles.page}>
        <div className={styles.loadingState}>Assigning your window…</div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {/* HEADER */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Cashier Dashboard</h1>
          <div className={styles.subtitleRow}>
            <span className={styles.subtitleName}>{user?.name}</span>
            <span className={styles.subtitleSep}>·</span>
            <span className={styles.subtitleLabel}>Window</span>

            <select
              className={styles.counterSelect}
              value={counter}
              onChange={(e) => handleCounterChange(e.target.value)}
            >
              {Array.from({ length: TOTAL_WINDOWS }, (_, i) => i + 1).map((n) => {
                const taken = isWindowTaken(n);
                const occupant = activeWindows[n];
                return (
                  <option key={n} value={n} disabled={taken}>
                    {taken ? `Window ${n} (${occupant})` : `Window ${n}`}
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        <div className={styles.headerRight}>
          <div className={styles.activeCounter}>
            <span className={styles.counterDot} />
            Window {counter} Active
          </div>

          <div className={styles.callNextWrap}>
            <Button
              variant="primary"
              size="lg"
              onClick={handleCallNext}
              loading={callingNext}
              disabled={
                AUTO_CALL_NEXT
                  ? counterQueue.length === 0 && waitingQueue.length === 0 // Disabled only when no one to serve
                  : waitingQueue.length === 0 || counterQueue.length > 0  // Original logic for manual mode
              }
              icon={<Megaphone size={16} />}
            >
              {AUTO_CALL_NEXT && counterQueue.length > 0
                ? waitingQueue.length === 0
                  ?  " Finish"
                  : " Call Next"
                : "Call Next"}
            </Button>

            {!AUTO_CALL_NEXT && counterQueue.length > 0 && (
              <span className={styles.callNextHint}>
                Finish serving current payor first
              </span>
            )}
          </div>
        </div>
      </div>

      {/* WINDOWS STATUS BAR */}
      <div className={styles.windowsBar}>
        {Array.from({ length: TOTAL_WINDOWS }, (_, i) => i + 1).map((n) => {
          const occupant = activeWindows[n];
          const isMe = n === counter;
          const isTaken = !!occupant;
          return (
            <div
              key={n}
              className={`${styles.windowChip} ${
                isMe
                  ? styles.windowChipMe
                  : isTaken
                  ? styles.windowChipTaken
                  : styles.windowChipFree
              }`}
            >
              <span className={styles.windowChipDot} />
              <span>W{n}</span>
              {isTaken && (
                <span className={styles.windowChipName}>
                  {isMe ? "You" : occupant.split(" ")[0]}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* STATS */}
      <div className={styles.stats}>
        <StatCard
          label="Now Serving"
          value={counterQueue.length}
          accent="#10B981"
          icon={<Check size={16} />}
          subtitle={`Tickets at Window ${counter}`}
        />
        <StatCard
          label="Waiting"
          value={waitingQueue.length}
          accent="#F5A623"
          icon={<Hourglass size={16} />}
          subtitle="In queue"
        />
      </div>

      {/* NOW SERVING */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <span className={styles.sectionDot} style={{ background: "#10B981" }} />
          Now Serving at Window {counter}
        </h2>

        <div className={styles.list}>
          {counterQueue.length === 0 && !loading && (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>
                <List size={24} />
              </div>
              <p>No tickets at Window {counter}. Press <b>Call Next</b>.</p>
            </div>
          )}

          {counterQueue.map((ticket) => (
            <QueueTicket
              key={ticket._id}
              ticket={ticket}
              onServe={handleServe}
              onSkip={handleSkip}
            />
          ))}
        </div>
      </section>

      {/* WAITING QUEUE */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <span className={styles.sectionDot} style={{ background: "#F5A623" }} />
          Waiting Queue ({waitingQueue.length})
          <span className={styles.sectionHint}>
            — shared pool, any window can call next
          </span>
        </h2>

        <div className={styles.list}>
          {loading && <p className={styles.empty}>Loading queue…</p>}

          {!loading && waitingQueue.length === 0 && (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>
                <Ticket size={24} />
              </div>
              <p>No one waiting right now</p>
            </div>
          )}

          {waitingQueue.map((ticket, i) => (
            <QueueTicket
              key={ticket._id}
              ticket={ticket}
              position={i + 1}
              onSkip={handleSkip}
            />
          ))}
        </div>
      </section>
    </div>
  );
}