import { useEffect, useMemo, useState } from "react";
import api from "../services/api";
import socket from "../socket/socket";
import { connectSocket } from "../socket/socket";
import MapPicker from "../components/MapPicker";
import RouteMap from "../components/RouteMap";
import { getCurrentUser } from "../services/session";

function PassengerPage() {
  const [passengerId] = useState(() => {
    const user = getCurrentUser();
    return user?.role === "passenger" ? user.id : "";
  });
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [dropLatitude, setDropLatitude] = useState("");
  const [dropLongitude, setDropLongitude] = useState("");
  const [radius, setRadius] = useState("10");
  const [drivers, setDrivers] = useState([]);
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(false);
  const [bookingDriverId, setBookingDriverId] = useState("");
  const [bookingNote, setBookingNote] = useState("");
  const [rideStatus, setRideStatus] = useState("");
  const [activeRide, setActiveRide] = useState(null);

  const passengerLabel = useMemo(() => passengerId.trim() || "anonymous-passenger", [passengerId]);

  useEffect(() => {
    const loadActiveRide = async () => {
      try {
        const res = await api.get("/rides/me/active");
        setActiveRide(res.data?.ride || null);
      } catch {
        setActiveRide(null);
      }
    };

    loadActiveRide();
  }, []);

  useEffect(() => {
    const registerPassenger = () => {
      connectSocket();
      socket.emit("passenger-online", passengerLabel);
    };

    registerPassenger();
    socket.on("connect", registerPassenger);

    return () => {
      socket.off("connect", registerPassenger);
    };
  }, [passengerLabel]);

  useEffect(() => {
    socket.onAny((event, data) => {
    console.log("SOCKET EVENT =>", event, data);
  });

    const describeRideStatus = (ride) => {
      switch (ride.status) {
        case "requested":
          return `Ride request sent to ${ride.driverId}. Waiting for driver response.`;
        case "accepted":
          return `Your ride is booked. Driver ${ride.driverId} accepted and is coming.`;
        case "rejected":
          return `Driver ${ride.driverId} rejected your ride request.`;
        case "arrived":
          return `Driver ${ride.driverId} has arrived at your pickup point.`;
        case "started":
          return `Your ride with ${ride.driverId} has started.`;
        case "completed":
          return `Your ride with ${ride.driverId} is completed.`;
        case "cancelled":
          return `Your ride with ${ride.driverId} was cancelled.`;
        default:
          return `Ride status: ${ride.status}`;
      }
    };

    const handleRideRequested = (ride) => {
      setActiveRide(ride);
      setBookingDriverId(ride.driverId);
      setBookingNote(describeRideStatus(ride));
      setRideStatus("");
    };

    const handleRideConfirmed = (ride) => {
      if (ride.passengerId !== passengerLabel) {
        return;
      }

      setActiveRide(ride);
      setRideStatus(describeRideStatus(ride));
      setBookingNote("");
    };

    const handleRideRejected = (ride) => {
      if (ride.passengerId !== passengerLabel) {
        return;
      }

      setActiveRide(null);
      setRideStatus(describeRideStatus(ride));
      setBookingNote("");
      setBookingDriverId("");
    };

    const handleRideStatusUpdated = (ride) => {
      if (ride.passengerId !== passengerLabel) {
        return;
      }
      if (["completed", "cancelled", "rejected"].includes(ride.status)) {
        setActiveRide(null);
        setBookingDriverId("");
      } else {
        setActiveRide(ride);
        setBookingDriverId(ride.driverId);
      }
      setRideStatus(describeRideStatus(ride));
    };

    const handleRideError = (payload) => {
      setBookingNote(payload?.message || "Ride request failed");
      setBookingDriverId("");
    };

    socket.on("ride-request", handleRideRequested);
    socket.on("ride-confirmed", handleRideConfirmed);
    socket.on("ride-rejected", handleRideRejected);
    socket.on("ride-status-updated", handleRideStatusUpdated);
    socket.on("ride-error", handleRideError);

    return () => {
      socket.off("ride-request", handleRideRequested);
      socket.off("ride-confirmed", handleRideConfirmed);
      socket.off("ride-rejected", handleRideRejected);
      socket.off("ride-status-updated", handleRideStatusUpdated);
      socket.off("ride-error", handleRideError);
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

       console.log("Nearby Drivers =>", res.data.drivers);

      setDrivers(res.data.drivers || []);
      setBookingNote(`Found ${res.data.total || 0} active drivers nearby.`);
    } catch (error) {
      setDrivers([]);
      setBookingNote(error.response?.data?.message || "Could not find drivers");
    } finally {
      setLoading(false);
    }
  };

  const getQuote = async () => {
    try {
      if (!latitude || !longitude || !dropLatitude || !dropLongitude) {
        setBookingNote("Pickup and drop coordinates are required for quote.");
        return;
      }

      setLoading(true);
      setBookingNote("");

      const res = await api.post("/rides/quote", {
        pickupLatitude: Number(latitude),
        pickupLongitude: Number(longitude),
        dropLatitude: Number(dropLatitude),
        dropLongitude: Number(dropLongitude),
        radius: Number(radius),
      });

      setQuote(res.data?.quote || null);
      const suggestedDriver = res.data?.quote?.suggestedDriverId;
      setBookingNote(
        suggestedDriver
          ? `Estimated fare ready. Suggested driver: ${suggestedDriver}.`
          : "Estimated fare ready, but no active driver is suggested yet."
      );
    } catch (error) {
      setQuote(null);
      setBookingNote(error.response?.data?.message || "Could not calculate fare");
    } finally {
      setLoading(false);
    }
  };

 const bookDriver = async (driver) => {
  try {
    if (!latitude || !longitude) {
      setBookingNote("Enter pickup latitude and longitude before booking.");
      return;
    }

    const res = await api.post("/rides/request", {
      pickupLatitude: Number(latitude),
      pickupLongitude: Number(longitude),
      dropLatitude: Number(dropLatitude),
      dropLongitude: Number(dropLongitude),
      driverId: driver.driverId || quote?.suggestedDriverId,
      radius: Number(radius),
    });

    const ride = res.data.ride;

    setActiveRide(ride);
    setBookingDriverId(ride.driverId);

    setBookingNote(
      `Ride request sent to ${ride.driverId}. Waiting for driver confirmation.`
    );
  } catch (err) {
    setBookingNote(err.response?.data?.message || "Booking failed");
  }
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
          <div className="stat-card">
            <span>Active ride</span>
            <strong>{activeRide?.status || "none"}</strong>
          </div>
          <div className="stat-card">
            <span>Fare</span>
            <strong>{quote?.estimatedFare ? `Rs ${quote.estimatedFare}` : "-"}</strong>
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
            <input value={passengerId} readOnly placeholder="passenger-001" />
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

          <label>
            <span>Drop Latitude</span>
            <input
              value={dropLatitude}
              onChange={(event) => setDropLatitude(event.target.value)}
              placeholder="28.6500"
            />
          </label>

          <label>
            <span>Drop Longitude</span>
            <input
              value={dropLongitude}
              onChange={(event) => setDropLongitude(event.target.value)}
              placeholder="77.2300"
            />
          </label>
        </div>

        <div className="card-actions" style={{ marginTop: 16 }}>
          <button className="primary-button" onClick={findDrivers} type="button" disabled={loading}>
            {loading ? "Searching..." : "Find drivers"}
          </button>
          <button className="secondary-button" onClick={getQuote} type="button" disabled={loading}>
            {loading ? "Calculating..." : "Get fare quote"}
          </button>
          <button
            className="ghost-button"
            onClick={() => bookDriver({ driverId: quote?.suggestedDriverId || "" })}
            type="button"
            disabled={loading || Boolean(activeRide) || !quote}
          >
            Book suggested driver
          </button>
        </div>

        {bookingNote ? <div className="feedback-banner">{bookingNote}</div> : null}
        {rideStatus ? <div className="feedback-banner">{rideStatus}</div> : null}
        {activeRide ? (
          <div className="feedback-banner">
            Current ride: `{activeRide.rideId}` with `{activeRide.driverId}` is `{activeRide.status}`.
          </div>
        ) : null}
        {quote ? (
          <div className="feedback-banner">
            Estimated fare: Rs {quote.estimatedFare} for {quote.routeDistanceKm} km, about {quote.estimatedMinutes} min.
          </div>
        ) : null}
      </section>

      <div className="dashboard-grid">
        <MapPicker
          title="Pickup selector"
          latitude={latitude}
          longitude={longitude}
          onSelect={({ latitude: nextLat, longitude: nextLng }) => {
            setLatitude(String(nextLat));
            setLongitude(String(nextLng));
          }}
        />
        <MapPicker
          title="Drop selector"
          latitude={dropLatitude}
          longitude={dropLongitude}
          onSelect={({ latitude: nextLat, longitude: nextLng }) => {
            setDropLatitude(String(nextLat));
            setDropLongitude(String(nextLng));
          }}
        />
      </div>

      <RouteMap
        title="Passenger route"
        pickup={latitude && longitude ? { latitude, longitude } : null}
        drop={dropLatitude && dropLongitude ? { latitude: dropLatitude, longitude: dropLongitude } : null}
        polyline={activeRide?.routePolyline?.length ? activeRide.routePolyline : quote?.routePolyline || []}
      />

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
              const isRecommended = driver.driverId === quote?.suggestedDriverId || driver === drivers[0];

              return (
                <article className="driver-card" key={driver.driverId}>
                  <div className="driver-card__top">
                    <div>
                      <h3>{driver.driverId}</h3>
                      <p>{isRecommended ? "Recommended nearest driver" : "Active driver"}</p>
                    </div>
                    <span className="status-pill status-pill--active">
                      {isRecommended ? "recommended" : "active"}
                    </span>
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
                      disabled={isBooking || Boolean(activeRide)}
                    >
                      {activeRide ? "Ride active" : isBooking ? "Booking..." : isRecommended ? "Book recommended" : "Book ride"}
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
