import styles from "./StatCard.module.css";

const StatCard = ({ label, value, accent = "#F5A623", icon, subtitle }) => {
  return (
    <div className={styles.card} style={{ "--accent-color": accent, "--accent-glow": `${accent}15` }}>
      <div className={styles.top}>
        {icon && (
          <div className={styles.iconWrap} style={{ background: `${accent}18`, color: accent }}>
            {icon}
          </div>
        )}
        <div className={styles.value} style={{ color: accent }}>{value}</div>
      </div>
      <div className={styles.label}>{label}</div>
      {subtitle && <div className={styles.subtitle}>{subtitle}</div>}
    </div>
  );
};

export default StatCard;
