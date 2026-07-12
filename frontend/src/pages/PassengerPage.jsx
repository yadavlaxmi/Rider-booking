import { useEffect, useMemo, useState } from "react";
import api from "../services/api";
import socket from "../socket/socket";

function PassengerPage() {
  const [passengerId, setPassengerId] = useState(() => localStorage.getItem("bike-booking-passenger-id") || `passenger-${Math.random().toString(36).slice(2, 8)}`);
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [radius, setRadius] = useState("10");
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [bookingDriverId, setBookingDriverId] = useState("");
  const [bookingNote, setBookingNote] = useState("");
  const [rideStatus, setRideStatus] = useState("");

  const passengerLabel = useMemo(() => passengerId.trim() || "anonymous-passenger", [passengerId]);

  useEffect(() => {
    localStorage.setItem("bike-booking-passenger-id", passengerLabel);

    const registerPassenger = () => {
      socket.emit("passenger-online", passengerLabel);
    };

    registerPassenger();
    socket.on("connect", registerPassenger);

    return () => {
      socket.off("connect", registerPassenger);
    };
  }, [passengerLabel]);

  useEffect(() => {
    const handleRideConfirmed = (ride) => {
      if (ride.passengerId !== passengerLabel) {
        return;
      }

      setRideStatus(`Driver ${ride.driverId} accepted your booking and is coming.`);
      setBookingNote("");
      setBookingDriverId("");
    };

    const handleRideRejected = (ride) => {
      if (ride.passengerId !== passengerLabel) {
        return;
      }

      setRideStatus(`Driver ${ride.driverId} rejected your ride request.`);
      setBookingNote("");
      setBookingDriverId("");
    };

    socket.on("ride-confirmed", handleRideConfirmed);
    socket.on("ride-rejected", handleRideRejected);

    return () => {
      socket.off("ride-confirmed", handleRideConfirmed);
      socket.off("ride-rejected", handleRideRejected);
    };
  }, [passengerLabel]);

  const findDrivers = async () => {
    try {
      if (!latitude || !longitude) {
        setBookingNote("Latitude and longitude are required.");
        return;
      }

      setLoading(true);
      setBookingNote("");

      const res = await api.post("/passengers/nearby", {
        latitude: Number(latitude),
        longitude: Number(longitude),
        radius: Number(radius),
      });

      setDrivers(res.data.drivers || []);
      setBookingNote(`Found ${res.data.total || 0} active drivers nearby.`);
    } catch (error) {
      setDrivers([]);
      setBookingNote(error.response?.data?.message || "Could not find drivers");
    } finally {
      setLoading(false);
    }
  };

  const bookDriver = (driver) => {
    if (!latitude || !longitude) {
      setBookingNote("Enter pickup latitude and longitude before booking.");
      return;
    }

    const ride = {
      rideId: `${passengerLabel}-${driver.driverId}-${Date.now()}`,
      passengerId: passengerLabel,
      driverId: driver.driverId,
      pickupLatitude: Number(latitude),
      pickupLongitude: Number(longitude),
      status: "requested",
      createdAt: new Date().toISOString(),
    };

    socket.emit("request-ride", ride);
    setBookingDriverId(driver.driverId);
    setBookingNote(`Ride request sent to ${driver.driverId}. Waiting for driver confirmation.`);
    setRideStatus("");
  };

  return (
    <div className="page-shell">
      <section className="hero-card">
        <div className="hero-copy">
          <p className="eyebrow">Passenger Booking</p>
          <h1>Find nearby active drivers and book one</h1>
          <p className="hero-text">
            Search Redis for active drivers near a coordinate, send a ride request,
            and wait for the driver to accept or reject in real time.
          </p>
        </div>

        <div className="hero-stats">
          <div className="stat-card stat-card--active">
            <span>Passenger ID</span>
            <strong>{passengerLabel}</strong>
          </div>
          <div className="stat-card">
            <span>Nearby</span>
            <strong>{drivers.length}</strong>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Search</p>
            <h2>Nearby active drivers</h2>
          </div>
          <button className="ghost-button" onClick={findDrivers} type="button" disabled={loading}>
            {loading ? "Searching..." : "Find drivers"}
          </button>
        </div>

        <div className="form-grid form-grid--three">
          <label>
            <span>Passenger ID</span>
            <input
              value={passengerId}
              onChange={(event) => setPassengerId(event.target.value)}
              placeholder="passenger-001"
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

          <label>
            <span>Radius (km)</span>
            <input
              value={radius}
              onChange={(event) => setRadius(event.target.value)}
              placeholder="10"
            />
          </label>
        </div>

        {bookingNote ? <div className="feedback-banner">{bookingNote}</div> : null}
        {rideStatus ? <div className="feedback-banner">{rideStatus}</div> : null}
      </section>

      <section className="panel panel-list">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Results</p>
            <h2>{drivers.length} nearby drivers</h2>
          </div>
          <button className="ghost-button" onClick={() => setDrivers([])} type="button">
            Clear
          </button>
        </div>

        {drivers.length === 0 ? (
          <div className="empty-state">No nearby active drivers yet.</div>
        ) : (
          <div className="driver-grid">
            {drivers.map((driver) => {
              const isBooking = bookingDriverId === driver.driverId;

              return (
                <article className="driver-card" key={driver.driverId}>
                  <div className="driver-card__top">
                    <div>
                      <h3>{driver.driverId}</h3>
                      <p>Active driver</p>
                    </div>
                    <span className="status-pill status-pill--active">active</span>
                  </div>

                  <div className="driver-meta">
                    <span>Lat: {driver.latitude}</span>
                    <span>Lng: {driver.longitude}</span>
                    <span>
                      Distance: {driver.distance === null || driver.distance === undefined ? "-" : `${Number(driver.distance).toFixed(2)} km`}
                    </span>
                  </div>

                  <div className="card-actions">
                    <button
                      className="primary-button"
                      type="button"
                      onClick={() => bookDriver(driver)}
                      disabled={isBooking}
                    >
                      {isBooking ? "Booking..." : "Book ride"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

export default PassengerPage;
