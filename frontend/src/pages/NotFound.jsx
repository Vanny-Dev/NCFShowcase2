import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import styles from "./NotFound.module.css";

export default function NotFound() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const handleGoBack = () => {
    navigate(isAuthenticated ? "/cashier" : "/", { replace: true });
  };

  return (
    <div className={styles.page}>
      <div className={styles.glow} />
      <div className={styles.content}>
        <div className={styles.code}>404</div>
        <h1 className={styles.title}>Page not found</h1>
        <p className={styles.sub}>
          The page you're looking for doesn't exist or was moved.
        </p>
        <button className={styles.btn} onClick={handleGoBack}>
          ← Go back
        </button>
      </div>
    </div>
  );
}