import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { authAPI } from "../services/api";
import Button from "../components/common/Button";
import { useToast } from "../components/common/Toast";
import styles from "./CashierSignup.module.css";
import { Eye, EyeOff, Lock, AtSign, User } from "lucide-react";

export default function CashierSignup() {
  const [form, setForm] = useState({ name: "", username: "", password: "", confirmPassword: "" });
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const { login } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const passwordStrength = (p) => {
    if (!p) return null;
    if (p.length < 6) return { label: "Too short", color: "#f87171", width: "20%" };
    if (p.length < 8) return { label: "Weak", color: "#fb923c", width: "40%" };
    if (!/[0-9]/.test(p) || !/[a-zA-Z]/.test(p)) return { label: "Fair", color: "#facc15", width: "60%" };
    if (p.length >= 10) return { label: "Strong", color: "#4ade80", width: "100%" };
    return { label: "Good", color: "#34d399", width: "80%" };
  };

  const strength = passwordStrength(form.password);
  const passwordsMatch = form.confirmPassword && form.password === form.confirmPassword;
  const passwordsMismatch = form.confirmPassword && form.password !== form.confirmPassword;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.username || !form.password || !form.confirmPassword) {
      addToast("Please fill in all fields.", "warning"); return;
    }
    if (form.password !== form.confirmPassword) {
      addToast("Passwords do not match.", "error"); return;
    }
    if (form.password.length < 6) {
      addToast("Password must be at least 6 characters.", "error"); return;
    }
    setLoading(true);
    try {
      const res = await authAPI.register(form);
      // Auto-login after successful registration
      await login(form.username, form.password);
      addToast(`Welcome, ${res.data.user.name}! Account created.`, "success");
      navigate("/cashier/login");
    } catch (err) {
      addToast(err.response?.data?.message || "Registration failed.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.glow} />
      <div className={styles.glowSecondary} />

      <div className={styles.card}>
        {/* Header */}
        <div className={styles.logoWrap}>
          <span className={styles.logoText}><span className="" style={{color: "#F5A623"}}>Q</span>ampus</span>
        </div>
        <h1 className={styles.title}>Create Account</h1>
        <p className={styles.sub}>Register as a cashier to manage the queue</p>

        <form className={styles.form} onSubmit={handleSubmit}>
          {/* Full Name */}
          <div className={styles.field}>
            <label className={styles.label}>Full Name</label>
            <div className={styles.inputWrap}>
              <span className={styles.inputIcon}><User size={16} /></span>
              <input
                className={styles.input}
                type="text"
                placeholder="e.g. Juan dela Cruz"
                value={form.name}
                onChange={set("name")}
                autoComplete="name"
              />
            </div>
          </div>

          {/* Username */}
          <div className={styles.field}>
            <label className={styles.label}>Username</label>
            <div className={styles.inputWrap}>
              <span className={styles.inputIcon}><AtSign size={16} /></span>
              <input
                className={styles.input}
                type="text"
                placeholder="e.g. cashier_juan"
                value={form.username}
                onChange={set("username")}
                autoComplete="username"
              />
            </div>
            <span className={styles.hint}>Lowercase letters, numbers, and underscores only</span>
          </div>

          {/* Password */}
          <div className={styles.field}>
            <label className={styles.label}>Password</label>
            <div className={styles.inputWrap}>
              <span className={styles.inputIcon}><Lock size={16} /></span>
              <input
                className={styles.input}
                type={showPass ? "text" : "password"}
                placeholder="Min. 6 characters"
                value={form.password}
                onChange={set("password")}
                autoComplete="new-password"
              />
              <button type="button" className={styles.eyeBtn} onClick={() => setShowPass(v => !v)}>
                {showPass ? <EyeOff size={16} color="#E2E8F5" /> : <Eye size={16} color="#E2E8F5" />}
              </button>
            </div>
            {/* Strength bar */}
            {strength && (
              <div className={styles.strengthBar}>
                <div className={styles.strengthTrack}>
                  <div className={styles.strengthFill} style={{ width: strength.width, background: strength.color }} />
                </div>
                <span className={styles.strengthLabel} style={{ color: strength.color }}>{strength.label}</span>
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div className={styles.field}>
            <label className={styles.label}>Confirm Password</label>
            <div className={`${styles.inputWrap} ${passwordsMatch ? styles.inputMatch : passwordsMismatch ? styles.inputMismatch : ""}`}>
              <span className={styles.inputIcon}><Lock size={16} /></span>
              <input
                className={styles.input}
                type={showConfirm ? "text" : "password"}
                placeholder="Re-enter your password"
                value={form.confirmPassword}
                onChange={set("confirmPassword")}
                autoComplete="new-password"
              />
              <button type="button" className={styles.eyeBtn} onClick={() => setShowConfirm(v => !v)}>
                {showConfirm ? <EyeOff size={16} color="#E2E8F5" /> : <Eye size={16} color="#E2E8F5" />}
              </button>
              {passwordsMatch && <span className={styles.matchIcon}>✓</span>}
              {passwordsMismatch && <span className={styles.mismatchIcon}>✗</span>}
            </div>
            {passwordsMismatch && <span className={styles.errorHint}>Passwords do not match</span>}
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            loading={loading}
            disabled={!form.name || !form.username || !form.password || !form.confirmPassword}
            fullWidth
          >
            Create Account →
          </Button>
        </form>

        <div className={styles.footer}>
          Already have an account?{" "}
          <Link to="/cashier/login" className={styles.footerLink}>Sign in</Link>
        </div>
      </div>
    </div>
  );
}