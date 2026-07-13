import { Routes, Route, Link, Navigate } from "react-router-dom";
import DriverPage from "./pages/DriverPage";
import PassengerPage from "./pages/PassengerPage";
import AuthPage from "./pages/AuthPage";
import "./App.css";

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
        </div>
      </header>

      <Routes>
        <Route path="/" element={<Navigate to="/auth" />} />

        <Route path="/auth" element={<AuthPage />} />
        <Route path="/driver" element={<DriverPage />} />

        <Route path="/passenger" element={<PassengerPage />} />
      </Routes>
    </div>
  );
}

export default App;