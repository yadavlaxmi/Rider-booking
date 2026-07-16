const { redisClient } = require("../config/redis");

const DRIVER_LOCATION_KEY = "drivers:locations";
const ACTIVE_DRIVERS_KEY = "drivers:active";

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function calculateDistanceKm(pointA, pointB) {
  const earthRadiusKm = 6371;
  const deltaLat = toRadians(pointB.latitude - pointA.latitude);
  const deltaLng = toRadians(pointB.longitude - pointA.longitude);
  const lat1 = toRadians(pointA.latitude);
  const lat2 = toRadians(pointB.latitude);

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(deltaLng / 2) *
      Math.sin(deltaLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

function normalizeGeoSearchMember(item) {
  if (typeof item === "string") {
    return item;
  }

  return (
    item?.member ??
    item?.value ??
    item?.name ??
    item?.driverId ??
    item?.id ??
    null
  );
}

function normalizeGeoSearchDistance(item) {
  if (typeof item === "string") {
    return null;
  }

  const distance =
    item?.distance ??
    item?.dist ??
    item?.score ??
    item?.value?.distance ??
    item?.value?.dist ??
    null;

  if (distance === null || distance === undefined) {
    return null;
  }

  return Number(distance);
}

async function getActiveDriverIds() {
  return redisClient.sMembers(ACTIVE_DRIVERS_KEY);
}

async function setDriverActive(driverId) {
  await redisClient.sAdd(ACTIVE_DRIVERS_KEY, driverId);
}

async function setDriverInactive(driverId) {
  await redisClient.sRem(ACTIVE_DRIVERS_KEY, driverId);
}

/**
 * Store Driver
 */
async function addDriverLocation(driverId, latitude, longitude) {
  await redisClient.geoAdd(DRIVER_LOCATION_KEY, {
    longitude,
    latitude,
    member: driverId,
  });

  await setDriverActive(driverId);
}

async function removeDriver(driverId) {
  await Promise.all([
    redisClient.zRem(DRIVER_LOCATION_KEY, driverId),
    redisClient.sRem(ACTIVE_DRIVERS_KEY, driverId),
  ]);
}

async function getDriverIds() {
  return redisClient.zRange(DRIVER_LOCATION_KEY, 0, -1);
}

async function getDriverLocation(driverId) {
  const position = await redisClient.geoPos(DRIVER_LOCATION_KEY, driverId);

  if (!position || !position[0]) {
    return null;
  }

  const { longitude, latitude } = position[0];

  return {
    driverId,
    latitude: Number(latitude),
    longitude: Number(longitude),
  };
}

async function getDriversByIds(driverIds, statusResolver = null) {
  const drivers = await Promise.all(
    driverIds.map(async (driverId) => {
      const location = await getDriverLocation(driverId);

      if (!location) {
        return null;
      }

      return {
        ...location,
        status: statusResolver ? statusResolver(driverId) : undefined,
      };
    })
  );

  return drivers.filter(Boolean);
}

async function getAllDrivers() {
  const [allDriverIds, activeDriverIds] = await Promise.all([
    getDriverIds(),
    getActiveDriverIds(),
  ]);

  const activeSet = new Set(activeDriverIds);

  return getDriversByIds(allDriverIds, (driverId) =>
    activeSet.has(driverId) ? "active" : "inactive"
  );
}

async function getActiveDrivers() {
  const activeDriverIds = await getActiveDriverIds();

  return getDriversByIds(activeDriverIds, () => "active");
}

async function getInactiveDrivers() {
  const [allDriverIds, activeDriverIds] = await Promise.all([
    getDriverIds(),
    getActiveDriverIds(),
  ]);

  const activeSet = new Set(activeDriverIds);
  const inactiveDriverIds = allDriverIds.filter(
    (driverId) => !activeSet.has(driverId)
  );

  return getDriversByIds(inactiveDriverIds, () => "inactive");
}

/**
 * Find Nearby Drivers
 */
async function getNearbyDrivers(latitude, longitude) {
  const drivers = await redisClient.geoSearchWith(
    DRIVER_LOCATION_KEY,
    {
      latitude,
      longitude,
    },
    {
      radius: 10,
      unit: "km",
    },
    ["WITHDIST"]
  );

  return drivers;
}

async function getNearbyActiveDrivers(latitude, longitude, radius = 10) {
  const nearbyDrivers = await redisClient.geoSearchWith(
    DRIVER_LOCATION_KEY,
    {
      latitude,
      longitude,
    },
    {
      radius,
      unit: "km",
    },
    ["WITHDIST"]
  );

  const activeDriverIds = new Set(await getActiveDriverIds());

  const nearbyActiveDriverIds = nearbyDrivers
    .map((item) => normalizeGeoSearchMember(item))
    .filter((driverId) => driverId && activeDriverIds.has(driverId));

  const drivers = await Promise.all(
    nearbyActiveDriverIds.map(async (driverId) => {
      const location = await getDriverLocation(driverId);
      const matchedItem = nearbyDrivers.find(
        (item) => normalizeGeoSearchMember(item) === driverId
      );

      return {
        ...location,
        status: "active",
        distance: normalizeGeoSearchDistance(matchedItem),
      };
    })
  );

  return drivers
    .filter(Boolean)
    .sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));
}

async function getDriverDistanceToPoint(driverId, latitude, longitude) {
  const location = await getDriverLocation(driverId);
  if (!location) {
    return null;
  }

  return calculateDistanceKm(location, { latitude, longitude });
}

module.exports = {
  addDriverLocation,
  setDriverActive,
  setDriverInactive,
  removeDriver,
  getDriverIds,
  getDriverLocation,
  getDriversByIds,
  getAllDrivers,
  getActiveDrivers,
  getInactiveDrivers,
  getNearbyDrivers,
  getNearbyActiveDrivers,
  calculateDistanceKm,
  getDriverDistanceToPoint,
};
