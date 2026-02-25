import styles from "./Button.module.css";

const Button = ({
  children,
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  icon = null,
  onClick,
  type = "button",
  fullWidth = false,
  className = "",
}) => {
  return (
    <button
      type={type}
      className={`${styles.btn} ${styles[variant]} ${styles[size]} ${fullWidth ? styles.fullWidth : ""} ${className}`}
      onClick={onClick}
      disabled={disabled || loading}
    >
      {loading ? (
        <span className={styles.spinner} />
      ) : (
        <>
          {icon && <span className={styles.icon}>{icon}</span>}
          {children}
        </>
      )}
    </button>
  );
};

export default Button;
