const {
  publisher,
  subscriber,
} = require("../services/pubSubService");
const jwt = require("jsonwebtoken");
const { transitionRide, assignNextCandidateDriver, getRideById } = require("../services/rideService");
const { getDriverDistanceToPoint } = require("../services/geoService");

const driverSockets = new Map(); // Map of driverId -> Set of socketIds
const passengerSockets = new Map(); // Map of passengerId -> Set of socketIds
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
  for (const [key, set] of socketMap.entries()) {
    if (set instanceof Set && set.has(socketId)) {
      set.delete(socketId);
      if (set.size === 0) {
        socketMap.delete(key);
      }
      break;
    }
  }
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

    console.log("Passenger Map:", [...passengerSockets.entries()].map(([k, s]) => [k, [...s]]));
    console.log("Ride Passenger:", finalRide.passengerId);
    
    io.to(finalRide.passengerId).emit("ride-rejected", finalRide);
    io.to(finalRide.passengerId).emit("ride-status-updated", finalRide);
    io.to(finalRide.passengerId).emit("ride.rejected", finalRide);
    return finalRide;
  }

  await publishRideRequest(reassignedRide);
  io.to(reassignedRide.passengerId).emit("ride-status-updated", reassignedRide);
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
      scheduleRideTimeout(io, data.rideId);

      console.log("Requested Driver:", data.driverId);
      console.log("Registered Drivers:", [
        ...driverSockets.entries(),
      ].map(([k, s]) => [k, [...s]]));

      const driverSet = driverSockets.get(data.driverId);
      const isOnline = driverSet && driverSet.size > 0;

      console.log("Sockets Found:", driverSet ? [...driverSet] : null);

      if (!isOnline) {
        console.log("❌ Driver is not online");
        return;
      }

      console.log("✅ Sending ride request to driver");

      io.to(data.driverId).emit("ride-request", data);
    } catch (err) {
      console.error("Redis Subscribe Error:", err);
    }
  });

  io.on("connection", (socket) => {
    console.log("\n🟢 Connected:", socket.id, socket.user?.id, socket.user?.role);

    if (socket.user?.id) {
      socket.join(socket.user.id);
    }

    /**
     * Driver Online
     */
    socket.on("driver-online", (driverId) => {
      if (socket.user?.role !== "driver") return;
      socket.join(socket.user.id);

      if (!driverSockets.has(socket.user.id)) {
        driverSockets.set(socket.user.id, new Set());
      }
      driverSockets.get(socket.user.id).add(socket.id);

      console.log("Driver Registered:", socket.user.id);
      console.log("Drivers Map:", [...driverSockets.entries()].map(([k, s]) => [k, [...s]]));
    });

    /**
     * Passenger Online
     */
    socket.on("passenger-online", (passengerId) => {
      if (socket.user?.role !== "passenger") return;
      socket.join(socket.user.id);

      if (!passengerSockets.has(socket.user.id)) {
        passengerSockets.set(socket.user.id, new Set());
      }
      passengerSockets.get(socket.user.id).add(socket.id);

      console.log("Passenger Registered:", socket.user.id);
      console.log("Passengers Map:", [...passengerSockets.entries()].map(([k, s]) => [k, [...s]]));
    });

    /**
     * Driver Accepted
     */
    socket.on("ride-accepted", async (ride) => {
       console.log("==============");
       console.log("RIDE ACCEPT EVENT RECEIVED");
       console.log(ride);
       console.log(socket.user);

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

        io.to(updatedRide.passengerId).emit("ride-confirmed", updatedRide);
        io.to(updatedRide.passengerId).emit("ride-status-updated", updatedRide);
        io.to(updatedRide.passengerId).emit("ride.accepted", updatedRide);

        io.to(updatedRide.driverId).emit("ride-status-updated", updatedRide);
        io.to(updatedRide.driverId).emit("ride.accepted", updatedRide);
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
        if (rideRecord.driverId !== socket.user.id) {
          throw new Error("Driver not allowed for this ride");
        }
        const updatedRide = await tryDispatchNextDriver(io, rideRecord);
        io.to(socket.user.id).emit("ride-status-updated", updatedRide);
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

        io.to(updatedRide.passengerId).emit("ride-status-updated", updatedRide);
        io.to(updatedRide.passengerId).emit("ride.status.updated", updatedRide);

        io.to(updatedRide.driverId).emit("ride-status-updated", updatedRide);
        io.to(updatedRide.driverId).emit("ride.status.updated", updatedRide);
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
      console.log("Drivers Map:", [...driverSockets.entries()].map(([k, s]) => [k, [...s]]));
      console.log("Reason:", socket.reason);
    });
  });
}

module.exports = initializeSocket;
