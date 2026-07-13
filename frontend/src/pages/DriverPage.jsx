import { useEffect, useMemo, useState } from "react";
import api from "../services/api";
import socket from "../socket/socket";
import { connectSocket } from "../socket/socket";
import RouteMap from "../components/RouteMap";

function DriverPage() {
  const [driverId, setDriverId] = useState(() => {
    const userRaw = localStorage.getItem("bike-booking-user");
    try {
      const user = userRaw ? JSON.parse(userRaw) : null;
      return user?.role === "driver" ? user.id : "";
    } catch {
      return "";
    }
  });
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [activeDrivers, setActiveDrivers] = useState([]);
  const [inactiveDrivers, setInactiveDrivers] = useState([]);
  const [incomingRides, setIncomingRides] = useState([]);
  const [currentRide, setCurrentRide] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState("");

  const totalDrivers = useMemo(
    () => activeDrivers.length + inactiveDrivers.length,
    [activeDrivers.length, inactiveDrivers.length]
  );
  const currentDriverLocation = useMemo(
    () => activeDrivers.find((driver) => driver.driverId === driverId) || null,
    [activeDrivers, driverId]
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
    const loadActiveRide = async () => {
      try {
        const res = await api.get("/rides/me/active");
        const ride = res.data?.ride || null;
        setCurrentRide(ride);
        if (ride?.status === "requested") {
          setIncomingRides([ride]);
        }
      } catch (error) {
        setCurrentRide(null);
      }
    };

    loadDrivers();
    loadActiveRide();
  }, []);

  useEffect(() => {
    const trimmedDriverId = driverId.trim();

    if (!trimmedDriverId) {
      return undefined;
    }

    const registerDriver = () => {
      connectSocket();
      socket.emit("driver-online", trimmedDriverId);
    };

    registerDriver();
    socket.on("connect", registerDriver);

    return () => {
      socket.off("connect", registerDriver);
    };
  }, [driverId]);

  useEffect(() => {
    const describeRideStatus = (ride) => {
      switch (ride.status) {
        case "requested":
          return `New booking request from ${ride.passengerId}.`;
        case "accepted":
          return `You accepted the booking for passenger ${ride.passengerId}.`;
        case "rejected":
          return `You rejected the booking for passenger ${ride.passengerId}.`;
        case "arrived":
          return `You have arrived for passenger ${ride.passengerId}.`;
        case "started":
          return `Ride for passenger ${ride.passengerId} has started.`;
        case "completed":
          return `Ride for passenger ${ride.passengerId} has completed.`;
        case "cancelled":
          return `Ride for passenger ${ride.passengerId} was cancelled.`;
        default:
          return `Ride status: ${ride.status}`;
      }
    };

    const handleRideRequest = (ride) => {
      console.log("🔥 RIDE RECEIVED", ride);

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

      setCurrentRide(ride);
      setFeedback(describeRideStatus(ride));
    };

    const handleRideConfirmed = (ride) => {
      setCurrentRide(ride);
      setFeedback(describeRideStatus(ride));
      setIncomingRides((current) => current.filter((item) => item.rideId !== ride.rideId));
    };

    const handleRideRejected = (ride) => {
      setCurrentRide(null);
      setFeedback(describeRideStatus(ride));
      setIncomingRides((current) => current.filter((item) => item.rideId !== ride.rideId));
    };

    const handleRideStatusUpdated = (ride) => {
      if (ride.driverId !== driverId.trim()) {
        return;
      }

      if (["completed", "cancelled", "rejected"].includes(ride.status)) {
        setCurrentRide(null);
      } else {
        setCurrentRide(ride);
      }
      setFeedback(describeRideStatus(ride));
      if (ride.status !== "requested") {
        setIncomingRides((current) => current.filter((item) => item.rideId !== ride.rideId));
      }
    };

    const handleRideError = (payload) => {
      setFeedback(payload?.message || "Ride action failed");
    };

    socket.on("ride-request", handleRideRequest);
    socket.on("ride-confirmed", handleRideConfirmed);
    socket.on("ride-rejected", handleRideRejected);
    socket.on("ride-status-updated", handleRideStatusUpdated);
    socket.on("ride-error", handleRideError);

    return () => {
      socket.off("ride-request", handleRideRequest);
      socket.off("ride-confirmed", handleRideConfirmed);
      socket.off("ride-rejected", handleRideRejected);
      socket.off("ride-status-updated", handleRideStatusUpdated);
      socket.off("ride-error", handleRideError);
    };
  }, [driverId]);

  const goOnline = async () => {
    try {
      if (!latitude || !longitude) {
        setFeedback("Latitude and longitude are required.");
        return;
      }

      setSaving(true);
      setFeedback("");

      const res = await api.post("/drivers/online", {
        latitude: Number(latitude),
        longitude: Number(longitude),
      });

      connectSocket();
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
        latitude: Number(driver.latitude),
        longitude: Number(driver.longitude),
      });

      if (driver.driverId === driverId) {
        connectSocket();
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
    if (!accepted) {
      setCurrentRide(null);
    }
    setFeedback(accepted ? "Accepting ride..." : "Rejecting ride...");
  };

  const updateCurrentRideStatus = async (status) => {
    if (!currentRide?.rideId) {
      return;
    }
    setSaving(true);
    socket.emit("ride-update-status", { rideId: currentRide.rideId, status });
    setFeedback(`Updating ride to ${status}...`);
    setTimeout(() => setSaving(false), 400);
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
          <div className="stat-card">
            <span>Ride</span>
            <strong>{currentRide?.status || "none"}</strong>
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
              readOnly
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
        {currentRide ? (
          <div className="feedback-banner">
            Current ride: `{currentRide.rideId}` for passenger `{currentRide.passengerId}` is `{currentRide.status}`.
          </div>
        ) : null}
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

      {currentRide ? (
        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Current ride</p>
              <h2>{currentRide.status}</h2>
            </div>
            <span className="status-pill status-pill--active">{currentRide.rideId}</span>
          </div>

          <div className="driver-meta">
            <span>Passenger: {currentRide.passengerId}</span>
            <span>Pickup: {currentRide.pickupLatitude}, {currentRide.pickupLongitude}</span>
            <span>Drop: {currentRide.dropLatitude}, {currentRide.dropLongitude}</span>
            <span>Fare: {currentRide.fareEstimate ? `Rs ${currentRide.fareEstimate}` : "-"}</span>
          </div>

          <div className="card-actions">
            <button
              className="primary-button"
              type="button"
              disabled={saving || currentRide.status !== "accepted"}
              onClick={() => updateCurrentRideStatus("arrived")}
            >
              Mark Arrived
            </button>
            <button
              className="primary-button"
              type="button"
              disabled={saving || currentRide.status !== "arrived"}
              onClick={() => updateCurrentRideStatus("started")}
            >
              Start Ride
            </button>
            <button
              className="primary-button"
              type="button"
              disabled={saving || currentRide.status !== "started"}
              onClick={() => updateCurrentRideStatus("completed")}
            >
              Complete Ride
            </button>
            <button
              className="secondary-button"
              type="button"
              disabled={saving || ["completed", "cancelled", "rejected"].includes(currentRide.status)}
              onClick={() => updateCurrentRideStatus("cancelled")}
            >
              Cancel Ride
            </button>
          </div>
        </section>
      ) : null}

      <RouteMap
        title="Driver direction"
        pickup={
          currentRide
            ? { latitude: currentRide.pickupLatitude, longitude: currentRide.pickupLongitude }
            : null
        }
        drop={
          currentRide && currentRide.dropLatitude !== null && currentRide.dropLongitude !== null
            ? { latitude: currentRide.dropLatitude, longitude: currentRide.dropLongitude }
            : null
        }
        driver={
          currentDriverLocation
            ? { latitude: currentDriverLocation.latitude, longitude: currentDriverLocation.longitude }
            : null
        }
        polyline={currentRide?.routePolyline || []}
      />

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
