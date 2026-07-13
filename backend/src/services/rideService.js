const { redisClient } = require("../config/redis");

const OPEN_RIDES_KEY = "rides:open";

function rideKey(rideId) {
  return `ride:${rideId}`;
}

function passengerRidesKey(passengerId) {
  return `rides:passenger:${passengerId}`;
}

function driverRidesKey(driverId) {
  return `rides:driver:${driverId}`;
}

function activeRidePassengerKey(passengerId) {
  return `activeRide:passenger:${passengerId}`;
}

function activeRideDriverKey(driverId) {
  return `activeRide:driver:${driverId}`;
}

function nowIso() {
  return new Date().toISOString();
}

function generateRideId(passengerId) {
  return `ride-${passengerId}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function isActiveStatus(status) {
  return ["requested", "accepted", "arrived", "started"].includes(status);
}

function canTransition(from, to) {
  const allowed = new Map([
    ["requested", new Set(["accepted", "rejected", "cancelled"])],
    ["accepted", new Set(["arrived", "cancelled"])],
    ["arrived", new Set(["started", "cancelled"])],
    ["started", new Set(["completed", "cancelled"])],
    ["rejected", new Set([])],
    ["completed", new Set([])],
    ["cancelled", new Set([])],
  ]);

  return allowed.get(from)?.has(to) || false;
}

async function getRideById(rideId) {
  const data = await redisClient.hGetAll(rideKey(rideId));
  if (!data || !data.rideId) return null;

  return {
    rideId: data.rideId,
    passengerId: data.passengerId,
    driverId: data.driverId,
    status: data.status,
    pickupLatitude: data.pickupLatitude === undefined ? null : Number(data.pickupLatitude),
    pickupLongitude: data.pickupLongitude === undefined ? null : Number(data.pickupLongitude),
    dropLatitude: data.dropLatitude ? Number(data.dropLatitude) : null,
    dropLongitude: data.dropLongitude ? Number(data.dropLongitude) : null,
    fareEstimate: data.fareEstimate ? Number(data.fareEstimate) : null,
    routeDistanceKm: data.routeDistanceKm ? Number(data.routeDistanceKm) : null,
    estimatedMinutes: data.estimatedMinutes ? Number(data.estimatedMinutes) : null,
    routePolyline: data.routePolyline ? JSON.parse(data.routePolyline) : [],
    routeSteps: data.routeSteps ? JSON.parse(data.routeSteps) : [],
    candidateDriverIds: data.candidateDriverIds ? JSON.parse(data.candidateDriverIds) : [],
    currentCandidateIndex: data.currentCandidateIndex ? Number(data.currentCandidateIndex) : 0,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

async function createRide({
  passengerId,
  driverId,
  pickupLatitude,
  pickupLongitude,
  dropLatitude,
  dropLongitude,
  fareEstimate,
  routeDistanceKm,
  estimatedMinutes,
  routePolyline,
  routeSteps,
  candidateDriverIds,
}) {
  const rideId = generateRideId(passengerId);
  const createdAt = nowIso();

  const ride = {
    rideId,
    passengerId,
    driverId,
    status: "requested",
    pickupLatitude: String(pickupLatitude),
    pickupLongitude: String(pickupLongitude),
    dropLatitude: dropLatitude === undefined || dropLatitude === null ? "" : String(dropLatitude),
    dropLongitude: dropLongitude === undefined || dropLongitude === null ? "" : String(dropLongitude),
    fareEstimate: fareEstimate === undefined || fareEstimate === null ? "" : String(fareEstimate),
    routeDistanceKm: routeDistanceKm === undefined || routeDistanceKm === null ? "" : String(routeDistanceKm),
    estimatedMinutes: estimatedMinutes === undefined || estimatedMinutes === null ? "" : String(estimatedMinutes),
    routePolyline: JSON.stringify(routePolyline || []),
    routeSteps: JSON.stringify(routeSteps || []),
    candidateDriverIds: JSON.stringify(candidateDriverIds || [driverId]),
    currentCandidateIndex: "0",
    createdAt,
    updatedAt: createdAt,
  };

  // Enforce one active ride per passenger and per driver.
  // We keep this simple for MVP: if either already has an active ride, block.
  const [passengerActive, driverActive] = await Promise.all([
    redisClient.get(activeRidePassengerKey(passengerId)),
    redisClient.get(activeRideDriverKey(driverId)),
  ]);
  if (passengerActive) throw new Error("Passenger already has an active ride");
  if (driverActive) throw new Error("Driver already has an active ride");

  const tx = redisClient.multi();
  tx.hSet(rideKey(rideId), ride);
  tx.sAdd(OPEN_RIDES_KEY, rideId);
  tx.rPush(passengerRidesKey(passengerId), rideId);
  tx.rPush(driverRidesKey(driverId), rideId);
  tx.set(activeRidePassengerKey(passengerId), rideId);
  tx.set(activeRideDriverKey(driverId), rideId);
  await tx.exec();

  return getRideById(rideId);
}

async function transitionRide({ rideId, actorRole, actorId, nextStatus }) {
  const ride = await getRideById(rideId);
  if (!ride) throw new Error("Ride not found");

  // Authorization rules for MVP:
  // - Driver can accept/reject/arrive/start/complete only for rides assigned to them
  // - Passenger can cancel only for their own ride
  if (actorRole === "driver" && ride.driverId !== actorId) {
    throw new Error("Driver not allowed for this ride");
  }
  if (actorRole === "passenger" && ride.passengerId !== actorId) {
    throw new Error("Passenger not allowed for this ride");
  }

  if (!canTransition(ride.status, nextStatus)) {
    throw new Error(`Invalid transition ${ride.status} -> ${nextStatus}`);
  }

  if (nextStatus === "accepted" || nextStatus === "rejected") {
    if (actorRole !== "driver") throw new Error("Only driver can accept/reject");
  }
  if (nextStatus === "cancelled") {
    // both can cancel in MVP
    if (actorRole !== "driver" && actorRole !== "passenger") throw new Error("Not allowed");
  }
  if (["arrived", "started", "completed"].includes(nextStatus) && actorRole !== "driver") {
    throw new Error("Only driver can update trip progress");
  }

  const updatedAt = nowIso();
  await redisClient.hSet(rideKey(rideId), { status: nextStatus, updatedAt });

  if (!isActiveStatus(nextStatus)) {
    const tx = redisClient.multi();
    tx.sRem(OPEN_RIDES_KEY, rideId);
    tx.del(activeRidePassengerKey(ride.passengerId));
    tx.del(activeRideDriverKey(ride.driverId));
    await tx.exec();
  }

  return getRideById(rideId);
}

async function getActiveRideForPassenger(passengerId) {
  const rideId = await redisClient.get(activeRidePassengerKey(passengerId));
  if (!rideId) return null;
  return getRideById(rideId);
}

async function getActiveRideForDriver(driverId) {
  const rideId = await redisClient.get(activeRideDriverKey(driverId));
  if (!rideId) return null;
  return getRideById(rideId);
}

async function assignNextCandidateDriver(rideId) {
  const ride = await getRideById(rideId);
  if (!ride) {
    throw new Error("Ride not found");
  }
  if (ride.status !== "requested") {
    return null;
  }

  const nextIndex = ride.currentCandidateIndex + 1;
  const nextDriverId = ride.candidateDriverIds[nextIndex];
  if (!nextDriverId) {
    return null;
  }

  const existingDriverRide = await redisClient.get(activeRideDriverKey(nextDriverId));
  if (existingDriverRide) {
    await redisClient.hSet(rideKey(rideId), {
      currentCandidateIndex: String(nextIndex),
      updatedAt: nowIso(),
    });
    return assignNextCandidateDriver(rideId);
  }

  const tx = redisClient.multi();
  tx.del(activeRideDriverKey(ride.driverId));
  tx.set(activeRideDriverKey(nextDriverId), rideId);
  tx.hSet(rideKey(rideId), {
    driverId: nextDriverId,
    currentCandidateIndex: String(nextIndex),
    updatedAt: nowIso(),
  });
  tx.rPush(driverRidesKey(nextDriverId), rideId);
  await tx.exec();

  return getRideById(rideId);
}

module.exports = {
  createRide,
  transitionRide,
  assignNextCandidateDriver,
  getRideById,
  getActiveRideForPassenger,
  getActiveRideForDriver,
};

