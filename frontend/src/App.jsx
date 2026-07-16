import { Routes, Route, Link, Navigate } from "react-router-dom";
import DriverPage from "./pages/DriverPage";
import PassengerPage from "./pages/PassengerPage";
import AuthPage from "./pages/AuthPage";
import AdminPage from "./pages/AdminPage";
import { getCurrentUser } from "./services/session";
import "./App.css";

function RoleRoute({ role, children }) {
  return getCurrentUser()?.role === role ? children : <Navigate to="/auth" replace />;
}

function App() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Bike Booking Redis Demo</p>
          <h1>Live Booking System</h1>
        </div>

        <div className="tab-switcher">
          <Link className="tab-button" to="/auth">
            Auth
          </Link>
          <Link className="tab-button" to="/driver">
            Driver
          </Link>

          <Link className="tab-button" to="/passenger">
            Passenger
          </Link>
          <Link className="tab-button" to="/admin">
            Admin
          </Link>
        </div>
      </header>

      <Routes>
        <Route path="/" element={<Navigate to="/auth" />} />

        <Route path="/auth" element={<AuthPage />} />
        <Route path="/driver" element={<RoleRoute role="driver"><DriverPage /></RoleRoute>} />

        <Route path="/passenger" element={<RoleRoute role="passenger"><PassengerPage /></RoleRoute>} />
        <Route path="/admin" element={<RoleRoute role="admin"><AdminPage /></RoleRoute>} />
      </Routes>
    </div>
  );
}

export default App;
