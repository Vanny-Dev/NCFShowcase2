import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import styles from "./Navbar.module.css";
import { LogIn, HomeIcon, LayoutDashboard, Activity, LogOut } from "lucide-react";
import Logo from "../../assets/Logo.png";

const Navbar = () => {
  const { user, logout, isAuthenticated } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/");
    setMenuOpen(false);
  };

  const isActive = (path) =>
    location.pathname === path || location.pathname.startsWith(path + "/");

  const closeMenu = () => setMenuOpen(false);

  return (
    <nav className={styles.nav}>
      {/* Logo */}
      <Link to="/" className={styles.logo} onClick={closeMenu}>
        <span className={styles.calledPulse} />
        <span className={styles.logoImageContainer}>
          <img style={{width: 40, height: 40}} src={Logo} alt="Qampus Logo" className={styles.logoImage} />
        </span>
        <div className={styles.divider} />
        
        <span className={styles.logoText}><span className="" style={{color: "#F5A623"}}>Q</span>ampus</span>
        <span className={styles.badge}>NCF</span>
      </Link>

      {/* Desktop links */}
      <div className={styles.desktopLinks}>
        {/* Only show Home when NOT logged in */}
        {!isAuthenticated && (
          <Link
            to="/"
            className={`${styles.link} ${isActive("/") && !isActive("/cashier") ? styles.active : ""}`}
          >
            Home
          </Link>
        )}
        {isAuthenticated ? (
          <>
            <Link to="/cashier" className={`${styles.link} ${isActive("/cashier") && !isActive("/cashier/analytics") ? styles.active : ""}`}>
              Dashboard
            </Link>
            <Link to="/cashier/analytics" className={`${styles.link} ${isActive("/cashier/analytics") ? styles.active : ""}`}>
              Analytics
            </Link>
            <div className={styles.divider} />
            <span className={styles.userName}>{user?.name}</span>
            <button className={styles.logoutBtn} onClick={handleLogout}>
              Sign Out
            </button>
          </>
        ) : (
          <Link to="/cashier/login" className={styles.cashierBtn}>
            Cashier Login
          </Link>
        )}
      </div>

      {/* Hamburger button — mobile only */}
      <button
        className={`${styles.hamburger} ${menuOpen ? styles.hamburgerOpen : ""}`}
        onClick={() => setMenuOpen((o) => !o)}
        aria-label="Toggle menu"
      >
        <span />
        <span />
        <span />
      </button>

      {/* Mobile drawer */}
      {menuOpen && (
        <>
          <div className={styles.backdrop} onClick={closeMenu} />
          <div className={styles.drawer}>
            <div className={styles.drawerHeader}>
              <span className={styles.drawerLogo}>Menu</span>
              <button className={styles.drawerClose} onClick={closeMenu}>✕</button>
            </div>
            <div className={styles.drawerLinks}>
              {/* Only show Home when NOT logged in */}
              {!isAuthenticated && (
                <Link
                  to="/"
                  className={`${styles.drawerLink} ${isActive("/") && !isActive("/cashier") ? styles.drawerActive : ""}`}
                  onClick={closeMenu}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", justifyContent: "center" }}>
                    <HomeIcon size={18} />
                    Home
                  </div>
                </Link>
              )}
              {isAuthenticated ? (
                <>
                  <Link
                    to="/cashier"
                    className={`${styles.drawerLink} ${isActive("/cashier") && !isActive("/cashier/analytics") ? styles.drawerActive : ""}`}
                    onClick={closeMenu}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", justifyContent: "center" }}>
                      <LayoutDashboard size={18} />
                      Dashboard
                    </div>
                  </Link>
                  <Link
                    to="/cashier/analytics"
                    className={`${styles.drawerLink} ${isActive("/cashier/analytics") ? styles.drawerActive : ""}`}
                    onClick={closeMenu}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", justifyContent: "center" }}>
                      <Activity size={18} />
                      Analytics
                    </div>
                  </Link>
                  <div className={styles.drawerDivider} />
                  <div className={styles.drawerUser}>Signed in as <strong>{user?.name}</strong></div>
                  <button className={styles.drawerLogout} onClick={handleLogout}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", justifyContent: "center" }}>
                      <LogOut size={18} />
                      Sign Out
                    </div>
                  </button>
                </>
              ) : (
                <Link to="/cashier/login" className={styles.drawerCashierBtn} onClick={closeMenu}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", justifyContent: "center" }}>
                    <LogIn size={18} />
                    Login
                  </div>
                </Link>
              )}
            </div>
          </div>
        </>
      )}
    </nav>
  );
};

export default Navbar;