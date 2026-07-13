const {
  createRide,
  transitionRide,
  getRideById,
  getActiveRideForPassenger,
  getActiveRideForDriver,
} = require("../services/rideService");
const { getNearbyActiveDrivers } = require("../services/geoService");
const { getRouteDetails } = require("../services/mapsService");
const { calculateFare } = require("../services/fareService");

function isFiniteNumber(value) {
  return Number.isFinite(value);
}

async function requestRide(req, res) {
  try {
    const passengerId = req.user.id;
    const { pickupLatitude, pickupLongitude, dropLatitude, dropLongitude, radius } = req.body || {};
    let { driverId } = req.body || {};

    const lat = Number(pickupLatitude);
    const lng = Number(pickupLongitude);
    if (!isFiniteNumber(lat) || !isFiniteNumber(lng)) {
      return res.status(400).json({ success: false, message: "pickupLatitude and pickupLongitude are required" });
    }

    const pickup = { latitude: lat, longitude: lng };
    const drop =
      isFiniteNumber(Number(dropLatitude)) && isFiniteNumber(Number(dropLongitude))
        ? { latitude: Number(dropLatitude), longitude: Number(dropLongitude) }
        : pickup;

    const route = await getRouteDetails({ origin: pickup, destination: drop });
    const fare = calculateFare({
      routeDistanceKm: route.distanceKm,
      estimatedMinutes: route.estimatedMinutes,
    });

    const nearbyDrivers = await getNearbyActiveDrivers(
      pickup.latitude,
      pickup.longitude,
      radius === undefined ? 10 : Number(radius)
    );

    if (!driverId) {
      driverId = nearbyDrivers[0]?.driverId;
    }

    if (!driverId) {
      return res.status(400).json({ success: false, message: "No nearby driver available" });
    }

    const ride = await createRide({
      passengerId,
      driverId,
      pickupLatitude: lat,
      pickupLongitude: lng,
      dropLatitude: drop.latitude,
      dropLongitude: drop.longitude,
      fareEstimate: fare.estimatedFare,
      routeDistanceKm: route.distanceKm,
      estimatedMinutes: route.estimatedMinutes,
      routePolyline: route.polyline,
      routeSteps: route.steps,
      candidateDriverIds: nearbyDrivers.map((item) => item.driverId),
    });

    return res.json({ success: true, ride });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
}

async function quoteRide(req, res) {
  try {
    const { pickupLatitude, pickupLongitude, dropLatitude, dropLongitude, radius } = req.body || {};
    const pickup = {
      latitude: Number(pickupLatitude),
      longitude: Number(pickupLongitude),
    };
    const drop = {
      latitude: Number(dropLatitude),
      longitude: Number(dropLongitude),
    };

    if (!isFiniteNumber(pickup.latitude) || !isFiniteNumber(pickup.longitude)) {
      return res.status(400).json({ success: false, message: "pickup coordinates are required" });
    }
    if (!isFiniteNumber(drop.latitude) || !isFiniteNumber(drop.longitude)) {
      return res.status(400).json({ success: false, message: "drop coordinates are required" });
    }

    const nearbyDrivers = await getNearbyActiveDrivers(
      pickup.latitude,
      pickup.longitude,
      radius === undefined ? 10 : Number(radius)
    );
    const selectedDriver = nearbyDrivers[0] || null;

    const route = await getRouteDetails({ origin: pickup, destination: drop });
    const fare = calculateFare({
      routeDistanceKm: route.distanceKm,
      estimatedMinutes: route.estimatedMinutes,
    });

    return res.json({
      success: true,
      quote: {
        ...fare,
        suggestedDriverId: selectedDriver?.driverId || null,
        driverDistanceKm: selectedDriver?.distance ?? null,
        routePolyline: route.polyline,
        routeSteps: route.steps,
      },
    });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
}

async function getRide(req, res) {
  try {
    const ride = await getRideById(req.params.rideId);
    if (!ride) return res.status(404).json({ success: false, message: "Ride not found" });

    // Basic access control
    if (req.user.role === "passenger" && ride.passengerId !== req.user.id) {
      return res.status(403).json({ success: false, message: "Not allowed" });
    }
    if (req.user.role === "driver" && ride.driverId !== req.user.id) {
      return res.status(403).json({ success: false, message: "Not allowed" });
    }

    return res.json({ success: true, ride });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function myActiveRide(req, res) {
  try {
    const ride =
      req.user.role === "driver"
        ? await getActiveRideForDriver(req.user.id)
        : await getActiveRideForPassenger(req.user.id);

    return res.json({ success: true, ride });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function updateRideStatus(req, res) {
  try {
    const { status } = req.body || {};
    if (!status) return res.status(400).json({ success: false, message: "status is required" });

    const ride = await transitionRide({
      rideId: req.params.rideId,
      actorRole: req.user.role,
      actorId: req.user.id,
      nextStatus: String(status),
    });

    return res.json({ success: true, ride });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
}

module.exports = {
  requestRide,
  quoteRide,
  getRide,
  myActiveRide,
  updateRideStatus,
};

