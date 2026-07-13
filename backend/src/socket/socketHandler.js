const {
  publisher,
  subscriber,
} = require("../services/pubSubService");
const jwt = require("jsonwebtoken");
const { createRide, transitionRide, assignNextCandidateDriver, getRideById } = require("../services/rideService");
const { getNearbyActiveDrivers, getDriverDistanceToPoint } = require("../services/geoService");
const { getRouteDetails } = require("../services/mapsService");
const { calculateFare } = require("../services/fareService");

const driverSockets = new Map();
const passengerSockets = new Map();
const MAX_ACCEPT_DISTANCE_KM = Number(process.env.MAX_ACCEPT_DISTANCE_KM || 8);
const REQUEST_TIMEOUT_MS = Number(process.env.RIDE_REQUEST_TIMEOUT_MS || 20000);

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not set");
  }
  return secret;
}

function removeSocketFromMap(socketMap, socketId) {
  for (const [key, value] of socketMap.entries()) {
    if (value === socketId) {
      socketMap.delete(key);
      break;
    }
  }
}

function isFiniteCoordinate(value) {
  return Number.isFinite(Number(value));
}

async function publishRideRequest(ride) {
  await publisher.publish("ride:requests", JSON.stringify(ride));
}

async function tryDispatchNextDriver(io, ride) {
  const reassignedRide = await assignNextCandidateDriver(ride.rideId);
  if (!reassignedRide) {
    const finalRide = await transitionRide({
      rideId: ride.rideId,
      actorRole: "driver",
      actorId: ride.driverId,
      nextStatus: "rejected",
    });

    const passengerSocket = passengerSockets.get(finalRide.passengerId);
    if (passengerSocket) {
      io.to(passengerSocket).emit("ride-rejected", finalRide);
      io.to(passengerSocket).emit("ride-status-updated", finalRide);
      io.to(passengerSocket).emit("ride.rejected", finalRide);
    }
    return finalRide;
  }

  await publishRideRequest(reassignedRide);
  const passengerSocket = passengerSockets.get(reassignedRide.passengerId);
  if (passengerSocket) {
    io.to(passengerSocket).emit("ride-status-updated", reassignedRide);
  }
  return reassignedRide;
}

function scheduleRideTimeout(io, rideId) {
  setTimeout(async () => {
    try {
      const latestRide = await getRideById(rideId);
      if (!latestRide || latestRide.status !== "requested") {
        return;
      }
      await tryDispatchNextDriver(io, latestRide);
    } catch (error) {
      console.error("Ride timeout error:", error.message);
    }
  }, REQUEST_TIMEOUT_MS);
}

async function initializeSocket(io) {
  io.use((socket, next) => {
    try {
      const token =
        socket.handshake?.auth?.token ||
        socket.handshake?.query?.token ||
        null;

      if (!token) {
        return next(new Error("Missing auth token"));
      }

      const decoded = jwt.verify(String(token), getJwtSecret());
      socket.user = {
        id: decoded.sub,
        role: decoded.role,
        email: decoded.email,
        name: decoded.name,
      };
      return next();
    } catch (err) {
      return next(new Error("Invalid auth token"));
    }
  });

  // Subscribe only once
  await subscriber.subscribe("ride:requests", (message) => {
    try {
      console.log("\n==============================");
      console.log("Redis Received:", message);

      const data = JSON.parse(message);

      console.log("Requested Driver:", data.driverId);
      console.log("Registered Drivers:", [
        ...driverSockets.entries(),
      ]);

      const socketId = driverSockets.get(data.driverId);

      console.log("Socket Found:", socketId);

      if (!socketId) {
        console.log("❌ Driver is not online");
        return;
      }

      console.log("✅ Sending ride request to driver");

      io.to(socketId).emit("ride-request", data);
    } catch (err) {
      console.error("Redis Subscribe Error:", err);
    }
  });

  io.on("connection", (socket) => {
    console.log("\n🟢 Connected:", socket.id, socket.user?.id, socket.user?.role);

    /**
     * Driver Online
     */
    socket.on("driver-online", (driverId) => {
      if (socket.user?.role !== "driver") return;
      driverSockets.set(socket.user.id, socket.id);

      console.log("Driver Registered:", socket.user.id);
      console.log("Drivers Map:", [...driverSockets.entries()]);
    });

    /**
     * Passenger Online
     */
    socket.on("passenger-online", (passengerId) => {
      if (socket.user?.role !== "passenger") return;
      passengerSockets.set(socket.user.id, socket.id);

      console.log("Passenger Registered:", socket.user.id);
      console.log("Passengers Map:", [...passengerSockets.entries()]);
    });

    /**
     * Passenger requests ride
     */
    socket.on("request-ride", async (payload) => {
      if (socket.user?.role !== "passenger") return;
      console.log("\n🚖 Ride Request Received");
      console.log(payload);

      try {
        const pickupLatitude = Number(payload.pickupLatitude);
        const pickupLongitude = Number(payload.pickupLongitude);
        const dropLatitude = isFiniteCoordinate(payload.dropLatitude)
          ? Number(payload.dropLatitude)
          : pickupLatitude;
        const dropLongitude = isFiniteCoordinate(payload.dropLongitude)
          ? Number(payload.dropLongitude)
          : pickupLongitude;

        const nearbyDrivers = await getNearbyActiveDrivers(
          pickupLatitude,
          pickupLongitude,
          Number(payload.radius || 10)
        );

        let driverId = payload.driverId;
        if (!driverId) {
          driverId = nearbyDrivers[0]?.driverId;
        }

        if (!driverId) {
          throw new Error("No nearby driver available");
        }

        const route = await getRouteDetails({
          origin: { latitude: pickupLatitude, longitude: pickupLongitude },
          destination: { latitude: dropLatitude, longitude: dropLongitude },
        });
        const fare = calculateFare({
          routeDistanceKm: route.distanceKm,
          estimatedMinutes: route.estimatedMinutes,
        });

        const candidateDriverIds = nearbyDrivers.map((item) => item.driverId);
        if (driverId && !candidateDriverIds.includes(driverId)) {
          candidateDriverIds.unshift(driverId);
        }

        const ride = await createRide({
          passengerId: socket.user.id,
          driverId,
          pickupLatitude,
          pickupLongitude,
          dropLatitude,
          dropLongitude,
          fareEstimate: fare.estimatedFare,
          routeDistanceKm: route.distanceKm,
          estimatedMinutes: route.estimatedMinutes,
          routePolyline: route.polyline,
          routeSteps: route.steps,
          candidateDriverIds,
        });

        await publishRideRequest(ride);
        scheduleRideTimeout(io, ride.rideId);

        console.log("✅ Ride Published to Redis");
        socket.emit("ride-requested", ride);
        socket.emit("ride.requested", ride);
      } catch (err) {
        console.error("Publish Error:", err);
        socket.emit("ride-error", { message: err.message });
      }
    });

    /**
     * Driver Accepted
     */
    socket.on("ride-accepted", async (ride) => {
      if (socket.user?.role !== "driver") return;
      console.log("Ride Accepted:", ride);
      try {
        const driverDistanceKm = await getDriverDistanceToPoint(
          socket.user.id,
          Number(ride.pickupLatitude),
          Number(ride.pickupLongitude)
        );

        if (driverDistanceKm !== null && driverDistanceKm > MAX_ACCEPT_DISTANCE_KM) {
          throw new Error(
            `Driver is too far away to accept this ride. Max ${MAX_ACCEPT_DISTANCE_KM} km allowed`
          );
        }

        const updatedRide = await transitionRide({
          rideId: ride.rideId,
          actorRole: "driver",
          actorId: socket.user.id,
          nextStatus: "accepted",
        });

        const passengerSocket = passengerSockets.get(updatedRide.passengerId);
        if (passengerSocket) {
          io.to(passengerSocket).emit("ride-confirmed", updatedRide);
          io.to(passengerSocket).emit("ride-status-updated", updatedRide);
          io.to(passengerSocket).emit("ride.accepted", updatedRide);
        }
        io.to(socket.id).emit("ride-status-updated", updatedRide);
        io.to(socket.id).emit("ride.accepted", updatedRide);
      } catch (err) {
        socket.emit("ride-error", { message: err.message, rideId: ride.rideId });
      }
    });

    /**
     * Driver Rejected
     */
    socket.on("ride-rejected", async (ride) => {
      if (socket.user?.role !== "driver") return;
      console.log("Ride Rejected:", ride);
      try {
        const rideRecord = await getRideById(ride.rideId);
        if (!rideRecord) {
          throw new Error("Ride not found");
        }
        const updatedRide = await tryDispatchNextDriver(io, rideRecord);
        io.to(socket.id).emit("ride-status-updated", updatedRide);
        if (updatedRide.status === "requested") {
          scheduleRideTimeout(io, updatedRide.rideId);
        }
      } catch (err) {
        socket.emit("ride-error", { message: err.message, rideId: ride.rideId });
      }
    });

    socket.on("ride-update-status", async ({ rideId, status }) => {
      if (socket.user?.role !== "driver") return;

      try {
        const updatedRide = await transitionRide({
          rideId,
          actorRole: "driver",
          actorId: socket.user.id,
          nextStatus: status,
        });

        const passengerSocket = passengerSockets.get(updatedRide.passengerId);
        if (passengerSocket) {
          io.to(passengerSocket).emit("ride-status-updated", updatedRide);
          io.to(passengerSocket).emit("ride.status.updated", updatedRide);
        }
        io.to(socket.id).emit("ride-status-updated", updatedRide);
        io.to(socket.id).emit("ride.status.updated", updatedRide);
      } catch (err) {
        socket.emit("ride-error", { message: err.message, rideId });
      }
    });

    /**
     * Disconnect
     */
    socket.on("disconnect", () => {
      removeSocketFromMap(driverSockets, socket.id);
      removeSocketFromMap(passengerSockets, socket.id);

      console.log("🔴 Disconnected:", socket.id);
    });
  });
}

module.exports = initializeSocket;