import { Navigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "calc(100vh - 60px)", color: "var(--text-secondary)" }}>
        Authenticating…
      </div>
    );
  }

  return isAuthenticated ? children : <Navigate to="/cashier/login" replace />;
};

export default ProtectedRoute;
