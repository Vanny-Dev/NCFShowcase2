import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useEffect } from "react";
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

// Updates document title based on current route
const TITLES = {
  "/": "Qampus",
  "/home": "Qampus",
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

// Redirects authenticated cashiers away from the payor home page
const HomeRoute = () => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <Navigate to="/cashier" replace /> : <HomePage />;
};

// Redirects authenticated cashiers away from login/signup pages
const LoginRoute = ({ fallback }) => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <Navigate to="/cashier" replace /> : (fallback || <CashierLogin />);
};

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <TitleUpdater />
        <Navbar />
        <Routes>
          <Route path="/" element={<HomeRoute />} />
          <Route path="/home" element={<HomeRoute />} />
          <Route path="/cashier/login" element={<LoginRoute />} />
          <Route path="/cashier/signup" element={<LoginRoute fallback={<CashierSignup />} />} />
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
        </Routes>
      </ToastProvider>
    </AuthProvider>
  );
}