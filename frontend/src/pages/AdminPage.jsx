import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import api from "../services/api";
import { getCurrentUser } from "../services/session";

function DriverList({ title, drivers }) {
  return (
    <section className="panel panel-list">
      <div className="panel-header">
        <div>
          <p className="eyebrow">{title}</p>
          <h2>{drivers.length} drivers</h2>
        </div>
      </div>
      {drivers.length === 0 ? (
        <div className="empty-state">No {title.toLowerCase()} drivers.</div>
      ) : (
        <div className="driver-grid">
          {drivers.map((driver) => (
            <article className="driver-card" key={driver.driverId}>
              <div className="driver-card__top">
                <div>
                  <h3>{driver.driverId}</h3>
                  <p>{driver.status}</p>
                </div>
                <span className={`status-pill status-pill--${driver.status}`}>{driver.status}</span>
              </div>
              <div className="driver-meta">
                <span>Lat: {driver.latitude}</span>
                <span>Lng: {driver.longitude}</span>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function AdminPage() {
  const user = getCurrentUser();
  const [activeDrivers, setActiveDrivers] = useState([]);
  const [inactiveDrivers, setInactiveDrivers] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const loadDrivers = async () => {
    try {
      setLoading(true);
      setError("");
      const [active, inactive] = await Promise.all([
        api.get("/drivers/active"),
        api.get("/drivers/inactive"),
      ]);
      setActiveDrivers(active.data.data || []);
      setInactiveDrivers(inactive.data.data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Could not load driver lists");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role === "admin") {
      loadDrivers();
    }
  }, [user?.role]);

  if (user?.role !== "admin") return <Navigate to="/auth" replace />;

  return (
    <div className="page-shell">
      <section className="hero-card">
        <div className="hero-copy">
          <p className="eyebrow">Admin dashboard</p>
          <h1>Driver availability</h1>
          <p className="hero-text">Only admin accounts can view all active and inactive drivers.</p>
        </div>
        <button className="ghost-button" onClick={loadDrivers} type="button" disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </section>
      {error ? <div className="feedback-banner">{error}</div> : null}
      <div className="dashboard-grid">
        <DriverList title="Active" drivers={activeDrivers} />
        <DriverList title="Inactive" drivers={inactiveDrivers} />
      </div>
    </div>
  );
}

export default AdminPage;
