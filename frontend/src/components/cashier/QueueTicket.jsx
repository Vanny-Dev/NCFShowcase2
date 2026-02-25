import Button from "../common/Button";
import styles from "./QueueTicket.module.css";

const AUTO_CALL_NEXT = import.meta.env.VITE_AUTO_CALL_NEXT === "true";

const STATUS_LABELS = {
  waiting: { label: "Waiting", color: "#F5A623" },
  called:  { label: "Called",  color: "#10B981" },
  serving: { label: "Serving", color: "#10B981" },
  served:  { label: "Served",  color: "#38BDF8" },
  skipped: { label: "Skipped", color: "#EF4444" },
};

const QueueTicket = ({ ticket, position, onServe, onSkip, showActions = true }) => {
  const statusInfo = STATUS_LABELS[ticket.status] || STATUS_LABELS.waiting;
  const isCalled = ticket.status === "called" || ticket.status === "serving";
  const waitMinutes = Math.round((Date.now() - new Date(ticket.createdAt).getTime()) / 60000);

  return (
    <div className={`${styles.ticket} ${isCalled ? styles.called : ""}`}>
      {/* Ticket number */}
      <div className={styles.number} style={{ color: statusInfo.color, borderColor: `${statusInfo.color}30`, background: `${statusInfo.color}10` }}>
        #{String(ticket.ticketNumber).padStart(3, "0")}
      </div>

      {/* Info */}
      <div className={styles.info}>
        <div className={styles.name}>{ticket.name}</div>
        <div className={styles.meta}>
          <span className={styles.txType}>{ticket.transactionType}</span>
          <span className={styles.dot}>·</span>
          <span className={styles.time}>{waitMinutes}m waiting</span>
        </div>
      </div>

      {/* Position */}
      {position && (
        <div className={styles.pos}>
          <span className={styles.posNum}>#{position}</span>
          <span className={styles.posLabel}>in line</span>
        </div>
      )}

      {/* Status badge */}
      <span className={styles.badge} style={{ color: statusInfo.color, background: `${statusInfo.color}15`, borderColor: `${statusInfo.color}30` }}>
        {isCalled && <span className={styles.pulseDot} style={{ background: statusInfo.color }} />}
        {statusInfo.label}
      </span>

      {/* Actions */}
      {showActions && (
        <div className={styles.actions}>
          {/* Only show Serve button when AUTO_CALL_NEXT is false */}
          {isCalled && onServe && !AUTO_CALL_NEXT && (
            <Button variant="success" size="sm" onClick={() => onServe(ticket._id)}>✓ Serve</Button>
          )}
          {(isCalled || ticket.status === "waiting") && onSkip && (
            <Button variant="danger" size="sm" onClick={() => onSkip(ticket._id)}>Skip</Button>
          )}
        </div>
      )}
    </div>
  );
};

export default QueueTicket;