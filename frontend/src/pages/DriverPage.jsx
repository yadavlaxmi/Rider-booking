import { useEffect, useMemo, useState } from "react";
import api from "../services/api";
import socket from "../socket/socket";

function DriverPage() {
  const [driverId, setDriverId] = useState(() => localStorage.getItem("bike-booking-driver-id") || "");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [activeDrivers, setActiveDrivers] = useState([]);
  const [inactiveDrivers, setInactiveDrivers] = useState([]);
  const [incomingRides, setIncomingRides] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState("");

  const totalDrivers = useMemo(
    () => activeDrivers.length + inactiveDrivers.length,
    [activeDrivers.length, inactiveDrivers.length]
  );

  const loadDrivers = async () => {
    try {
      setLoading(true);
      setFeedback("");

      const [activeRes, inactiveRes] = await Promise.all([
        api.get("/drivers/active"),
        api.get("/drivers/inactive"),
      ]);

      setActiveDrivers(activeRes.data.data || []);
      setInactiveDrivers(inactiveRes.data.data || []);
    } catch (error) {
      setFeedback(error.response?.data?.message || "Could not load drivers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDrivers();
  }, []);

  useEffect(() => {
    const trimmedDriverId = driverId.trim();

    if (!trimmedDriverId) {
      return undefined;
    }

    localStorage.setItem("bike-booking-driver-id", trimmedDriverId);

    const registerDriver = () => {
      socket.emit("driver-online", trimmedDriverId);
    };

    registerDriver();
    socket.on("connect", registerDriver);

    return () => {
      socket.off("connect", registerDriver);
    };
  }, [driverId]);

  useEffect(() => {
    const handleRideRequest = (ride) => {
      setIncomingRides((current) => {
        const nextRides = current.filter((item) => item.rideId !== ride.rideId);
        return [
          {
            ...ride,
            receivedAt: new Date().toISOString(),
          },
          ...nextRides,
        ];
      });

      setFeedback(`New booking request from ${ride.passengerId} for ${ride.driverId}`);
    };

    const handleRideConfirmed = (ride) => {
      setFeedback(`Passenger ${ride.passengerId} confirmed that driver ${ride.driverId} accepted.`);
      setIncomingRides((current) => current.filter((item) => item.rideId !== ride.rideId));
    };

    const handleRideRejected = (ride) => {
      setFeedback(`Ride request for passenger ${ride.passengerId} was rejected.`);
      setIncomingRides((current) => current.filter((item) => item.rideId !== ride.rideId));
    };

    socket.on("ride-request", handleRideRequest);
    socket.on("ride-confirmed", handleRideConfirmed);
    socket.on("ride-rejected", handleRideRejected);

    return () => {
      socket.off("ride-request", handleRideRequest);
      socket.off("ride-confirmed", handleRideConfirmed);
      socket.off("ride-rejected", handleRideRejected);
    };
  }, []);

  const goOnline = async () => {
    try {
      if (!driverId || !latitude || !longitude) {
        setFeedback("Driver ID, latitude, and longitude are required.");
        return;
      }

      setSaving(true);
      setFeedback("");

      const res = await api.post("/drivers/online", {
        driverId: driverId.trim(),
        latitude: Number(latitude),
        longitude: Number(longitude),
      });

      localStorage.setItem("bike-booking-driver-id", driverId.trim());
      socket.emit("driver-online", driverId.trim());
      setFeedback(res.data.message || "Driver marked active.");
      setDriverId(driverId.trim());
      setLatitude("");
      setLongitude("");
      await loadDrivers();
    } catch (error) {
      setFeedback(error.response?.data?.message || "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  const goOffline = async (selectedDriverId) => {
    try {
      setSaving(true);
      setFeedback("");

      const res = await api.post("/drivers/offline", {
        driverId: selectedDriverId,
      });

      if (selectedDriverId === driverId) {
        setIncomingRides([]);
      }

      setFeedback(res.data.message || "Driver marked inactive.");
      await loadDrivers();
    } catch (error) {
      setFeedback(error.response?.data?.message || "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  const activateDriver = async (driver) => {
    try {
      setSaving(true);
      setFeedback("");

      const res = await api.post("/drivers/online", {
        driverId: driver.driverId,
        latitude: Number(driver.latitude),
        longitude: Number(driver.longitude),
      });

      if (driver.driverId === driverId) {
        socket.emit("driver-online", driver.driverId);
      }

      setFeedback(res.data.message || "Driver activated.");
      await loadDrivers();
    } catch (error) {
      setFeedback(error.response?.data?.message || "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  const deleteDriver = async (selectedDriverId) => {
    try {
      setSaving(true);
      setFeedback("");

      const res = await api.delete(`/drivers/${selectedDriverId}`);

      setIncomingRides((current) => current.filter((ride) => ride.driverId !== selectedDriverId));
      setFeedback(res.data.message || "Driver removed.");
      await loadDrivers();
    } catch (error) {
      setFeedback(error.response?.data?.message || "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  const respondToRide = (ride, accepted) => {
    socket.emit(accepted ? "ride-accepted" : "ride-rejected", ride);
    setIncomingRides((current) => current.filter((item) => item.rideId !== ride.rideId));
    setFeedback(
      accepted
        ? `You accepted the booking for passenger ${ride.passengerId}.`
        : `You rejected the booking for passenger ${ride.passengerId}.`
    );
  };

  const DriverList = ({
    title,
    items,
    emptyText,
    actionLabel,
    onAction,
    secondaryActionLabel,
    onSecondaryAction,
  }) => (
    <section className="panel panel-list">
      <div className="panel-header">
        <div>
          <p className="eyebrow">{title}</p>
          <h2>{items.length} drivers</h2>
        </div>
        <button className="ghost-button" onClick={loadDrivers} type="button">
          Refresh
        </button>
      </div>

      {items.length === 0 ? (
        <div className="empty-state">{emptyText}</div>
      ) : (
        <div className="driver-grid">
          {items.map((driver) => (
            <article className="driver-card" key={driver.driverId}>
              <div className="driver-card__top">
                <div>
                  <h3>{driver.driverId}</h3>
                  <p>{driver.status || title.toLowerCase()}</p>
                </div>
                <span
                  className={`status-pill ${
                    driver.status === "active"
                      ? "status-pill--active"
                      : "status-pill--inactive"
                  }`}
                >
                  {driver.status || "unknown"}
                </span>
              </div>

              <div className="driver-meta">
                <span>Lat: {driver.latitude}</span>
                <span>Lng: {driver.longitude}</span>
              </div>

              <div className="card-actions">
                {onAction ? (
                  <button
                    className="primary-button"
                    type="button"
                    onClick={() => onAction(driver)}
                    disabled={saving}
                  >
                    {actionLabel}
                  </button>
                ) : null}

                {onSecondaryAction ? (
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => onSecondaryAction(driver.driverId)}
                    disabled={saving}
                  >
                    {secondaryActionLabel}
                  </button>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );

  return (
    <div className="page-shell">
      <section className="hero-card">
        <div className="hero-copy">
          <p className="eyebrow">Driver Control Center</p>
          <h1>Active and inactive drivers from Redis</h1>
          <p className="hero-text">
            Create a driver, mark it active or inactive, and respond to ride requests.
            The dashboard refreshes automatically and keeps the status lists in sync.
          </p>
        </div>

        <div className="hero-stats">
          <div className="stat-card">
            <span>Total</span>
            <strong>{totalDrivers}</strong>
          </div>
          <div className="stat-card stat-card--active">
            <span>Active</span>
            <strong>{activeDrivers.length}</strong>
          </div>
          <div className="stat-card stat-card--inactive">
            <span>Inactive</span>
            <strong>{inactiveDrivers.length}</strong>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Add driver</p>
            <h2>Bring a driver online</h2>
          </div>
          <button className="ghost-button" onClick={loadDrivers} type="button">
            {loading ? "Loading..." : "Sync Redis"}
          </button>
        </div>

        <div className="form-grid">
          <label>
            <span>Driver ID</span>
            <input
              value={driverId}
              onChange={(event) => setDriverId(event.target.value)}
              placeholder="driver_001"
            />
          </label>

          <label>
            <span>Latitude</span>
            <input
              value={latitude}
              onChange={(event) => setLatitude(event.target.value)}
              placeholder="28.6200"
            />
          </label>

          <label>
            <span>Longitude</span>
            <input
              value={longitude}
              onChange={(event) => setLongitude(event.target.value)}
              placeholder="77.2100"
            />
          </label>

          <div className="form-actions">
            <button
              className="primary-button"
              onClick={goOnline}
              type="button"
              disabled={saving}
            >
              {saving ? "Saving..." : "Go Online"}
            </button>
            <button
              className="secondary-button"
              onClick={() => {
                setDriverId("");
                setLatitude("");
                setLongitude("");
                setFeedback("");
              }}
              type="button"
            >
              Clear
            </button>
          </div>
        </div>

        {feedback ? <div className="feedback-banner">{feedback}</div> : null}
      </section>

      <section className="panel panel-list">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Bookings</p>
            <h2>Incoming ride requests</h2>
          </div>
          <span className="status-pill status-pill--active">{incomingRides.length} pending</span>
        </div>

        {incomingRides.length === 0 ? (
          <div className="empty-state">No incoming ride requests yet.</div>
        ) : (
          <div className="driver-grid">
            {incomingRides.map((ride) => (
              <article className="driver-card" key={ride.rideId || `${ride.passengerId}-${ride.driverId}`}>
                <div className="driver-card__top">
                  <div>
                    <h3>Passenger {ride.passengerId}</h3>
                    <p>Requested driver {ride.driverId}</p>
                  </div>
                  <span className="status-pill status-pill--active">booked</span>
                </div>

                <div className="driver-meta">
                  <span>Pickup: {ride.pickupLatitude}, {ride.pickupLongitude}</span>
                  <span>Requested: {ride.createdAt ? new Date(ride.createdAt).toLocaleTimeString() : "now"}</span>
                </div>

                <div className="card-actions">
                  <button className="primary-button" type="button" onClick={() => respondToRide(ride, true)}>
                    Accept ride
                  </button>
                  <button className="secondary-button" type="button" onClick={() => respondToRide(ride, false)}>
                    Reject ride
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <div className="dashboard-grid">
        <DriverList
          title="Active drivers"
          items={activeDrivers}
          emptyText="No active drivers in Redis yet."
          actionLabel="Set Offline"
          onAction={(driver) => goOffline(driver.driverId)}
          secondaryActionLabel="Delete"
          onSecondaryAction={deleteDriver}
        />

        <DriverList
          title="Inactive drivers"
          items={inactiveDrivers}
          emptyText="No inactive drivers found."
          actionLabel="Set Online"
          onAction={activateDriver}
          secondaryActionLabel="Delete"
          onSecondaryAction={deleteDriver}
        />
      </div>
    </div>
  );
}

export default DriverPage;
