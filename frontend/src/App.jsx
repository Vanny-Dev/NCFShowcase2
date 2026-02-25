import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { ToastProvider } from "./components/common/Toast";
import Navbar from "./components/common/Navbar";
import ProtectedRoute from "./components/common/ProtectedRoute";
import HomePage from "./pages/Home";
import CashierLogin from "./pages/CashierLogin";
import CashierDashboard from "./pages/CashierDashboard";
import Analytics from "./pages/Analytics";
import NotFound from "./pages/NotFound";
import CashierSignup from "./pages/CashierSignup";

// ── Page titles ───────────────────────────────────────────────────────────────
const TITLES = {
  "/": "Qampus — NCF Queuing System",
  "/home": "Qampus — NCF Queuing System",
  "/cashier": "Dashboard — Qampus",
  "/cashier/analytics": "Analytics — Qampus",
  "/cashier/login": "Login — Qampus",
  "/cashier/signup": "Sign Up — Qampus",
};

const TitleUpdater = () => {
  const location = useLocation();
  useEffect(() => {
    document.title = TITLES[location.pathname] || "Qampus";
  }, [location.pathname]);
  return null;
};

// ── Smooth page transition ────────────────────────────────────────────────────
const PageTransition = ({ children }) => {
  const location = useLocation();
  const [displayLocation, setDisplayLocation] = useState(location);
  const [visible, setVisible] = useState(true);
  const prevKey = useRef(location.key);

  useEffect(() => {
    if (location.key === prevKey.current) return;
    prevKey.current = location.key;

    // Fade out
    setVisible(false);

    const swap = setTimeout(() => {
      // Swap page content then fade in
      setDisplayLocation(location);
      setVisible(true);
    }, 300);

    return () => clearTimeout(swap);
  }, [location]);

  return (
    <div
      style={{
        opacity: visible ? 1 : 0,
        transition: "opacity 0.3s ease",
        willChange: "opacity",
      }}
    >
      <Routes location={displayLocation}>
        {children}
      </Routes>
    </div>
  );
};

// ── Auth-aware routes ─────────────────────────────────────────────────────────
const HomeRoute = () => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <Navigate to="/cashier" replace /> : <HomePage />;
};

const LoginRoute = ({ fallback }) => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <Navigate to="/cashier" replace /> : (fallback || <CashierLogin />);
};

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <TitleUpdater />
        <Navbar />
        <PageTransition>
          <Route path="/" element={<HomeRoute />} />
          <Route path="/home" element={<HomeRoute />} />
          <Route path="/cashier/login" element={<LoginRoute />} />
          <Route
            path="/cashier/signup"
            element={
              import.meta.env.VITE_ALLOW_SIGNUP === "true"
                ? <LoginRoute fallback={<CashierSignup />} />
                : <NotFound />
            }
          />
          <Route
            path="/cashier"
            element={
              <ProtectedRoute>
                <CashierDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/cashier/analytics"
            element={
              <ProtectedRoute>
                <Analytics />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<NotFound />} />
        </PageTransition>
      </ToastProvider>
    </AuthProvider>
  );
}