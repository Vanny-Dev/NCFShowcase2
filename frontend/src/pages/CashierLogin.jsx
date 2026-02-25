import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { authAPI } from "../services/api";
import Button from "../components/common/Button";
import { useToast } from "../components/common/Toast";
import styles from "./CashierLogin.module.css";

export default function CashierLogin() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [error, setError] = useState("");
  const { login } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!username || !password) return;
    setError("");
    setLoading(true);
    try {
      await login(username, password);
      addToast("Welcome back! Dashboard loaded.", "success");
      navigate("/cashier");
    } catch (err) {
      setError(err.response?.data?.message || "Invalid username or password.");
    } finally {
      setLoading(false);
    }
  };

  const handleSeed = async () => {
    setSeeding(true);
    try {
      await authAPI.seed();
      addToast("Default cashier created: cashier1 / cashier123", "info", 6000);
    } catch (err) {
      addToast(err.response?.data?.message || "Seed failed.", "error");
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.glow} />
      <div className={styles.card}>
        <div className={styles.logoWrap}>
          <span className={styles.logoText}><span className="" style={{color: "#F5A623"}}>Q</span>ampus</span>
        </div>
        <h1 className={styles.title}>Cashier Portal</h1>
        <p className={styles.sub}>Sign in to manage the queue</p>

        <form className={styles.form} onSubmit={handleLogin}>
          <div className={styles.field}>
            <label className={styles.label}>Username</label>
            <input
              className={`${styles.input} ${error ? styles.inputError : ""}`}
              type="text"
              placeholder="cashier1"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Password</label>
            <input
              className={`${styles.input} ${error ? styles.inputError : ""}`}
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>

          {/* Inline error message */}
          {error && (
            <div className={styles.errorBox}>
              <span className={styles.errorIcon}>⚠️</span>
              {error}
            </div>
          )}

          <Button type="submit" variant="primary" size="lg" loading={loading} disabled={!username || !password} fullWidth>
            Sign In
          </Button>
        </form>

        {/* <div className={styles.devNote}>
          <p>First time? Create a default account:</p>
          <Button variant="ghost" size="sm" onClick={handleSeed} loading={seeding}>
            Seed Default Cashier (Dev)
          </Button>
        </div> */}

        {import.meta.env.VITE_ALLOW_SIGNUP === "true" && (
          <div className={styles.signupRow}>
            Don't have an account?{" "}
            <Link to="/cashier/signup" className={styles.signupLink}>Create one</Link>
          </div>
        )}
      </div>
    </div>
  );
}