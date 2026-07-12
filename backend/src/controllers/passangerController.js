const { getNearbyActiveDrivers } = require("../services/geoService");

function isValidLatitude(value) {
  return Number.isFinite(value) && value >= -85.05112878 && value <= 85.05112878;
}

function isValidLongitude(value) {
  return Number.isFinite(value) && value >= -180 && value <= 180;
}

async function nearbyDrivers(req, res) {
  try {
    const { latitude, longitude, radius } = req.body;

    const parsedLatitude = Number(latitude);
    const parsedLongitude = Number(longitude);
    const parsedRadius = radius === undefined ? 10 : Number(radius);

    if (latitude === undefined || longitude === undefined) {
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

    if (!Number.isFinite(parsedRadius) || parsedRadius <= 0) {
      return res.status(400).json({
        success: false,
        message: "radius must be a positive number",
      });
    }

    const drivers = await getNearbyActiveDrivers(
      parsedLatitude,
      parsedLongitude,
      parsedRadius
    );

    res.json({
      success: true,
      total: drivers.length,
      drivers,
    });

  } catch (err) {
    console.log(err);

    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
}

module.exports = {
  nearbyDrivers,
};