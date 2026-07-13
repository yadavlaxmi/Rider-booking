const {
  addDriverLocation,
  getAllDrivers,
  getActiveDrivers,
  getDriverLocation,
  getInactiveDrivers,
  removeDriver,
  setDriverInactive,
} = require("../services/geoService");

function isValidLatitude(value) {
  return Number.isFinite(value) && value >= -85.05112878 && value <= 85.05112878;
}

function isValidLongitude(value) {
  return Number.isFinite(value) && value >= -180 && value <= 180;
}

async function goOnline(req, res) {
  try {
    const { latitude, longitude } = req.body;
    const driverId = req.user?.id;

    const parsedLatitude = Number(latitude);
    const parsedLongitude = Number(longitude);

    if (!driverId || latitude === undefined || longitude === undefined) {
      return res.status(400).json({
        success: false,
        message: "latitude and longitude are required",
      });
    }

    if (!isValidLatitude(parsedLatitude) || !isValidLongitude(parsedLongitude)) {
      return res.status(400).json({
        success: false,
        message:
          "latitude must be between -85.05112878 and 85.05112878, and longitude must be between -180 and 180",
      });
    }

    await addDriverLocation(driverId, parsedLatitude, parsedLongitude);

    const location = await getDriverLocation(driverId);

    res.json({
      success: true,
      message: "Driver is now online",
      data: location,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

async function goOffline(req, res) {
  try {
    const driverId = req.user?.id;

    if (!driverId) {
      return res.status(400).json({
        success: false,
        message: "driverId is required",
      });
    }

    await setDriverInactive(driverId);

    res.json({
      success: true,
      message: "Driver is now offline",
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

async function getDrivers(req, res) {
  try {
    const drivers = await getAllDrivers();

    res.json({
      success: true,
      count: drivers.length,
      data: drivers,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

async function getActiveDriversHandler(req, res) {
  try {
    const drivers = await getActiveDrivers();

    res.json({
      success: true,
      count: drivers.length,
      data: drivers,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

async function getInactiveDriversHandler(req, res) {
  try {
    const drivers = await getInactiveDrivers();

    res.json({
      success: true,
      count: drivers.length,
      data: drivers,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

async function deleteDriver(req, res) {
  try {
    const { driverId } = req.params;

    if (req.user?.id !== driverId) {
      return res.status(403).json({ success: false, message: "You can only delete your own driver account" });
    }

    await removeDriver(driverId);

    res.json({
      success: true,
      message: "Driver removed",
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

module.exports = {
  goOnline,
  goOffline,
  getDrivers,
  getActiveDriversHandler,
  getInactiveDriversHandler,
  deleteDriver,
};