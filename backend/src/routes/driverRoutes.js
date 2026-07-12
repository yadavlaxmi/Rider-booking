const express = require("express");

const router = express.Router();

const {
  goOnline,
  goOffline,
  getDrivers,
  getActiveDriversHandler,
  getInactiveDriversHandler,
  deleteDriver,
} = require("../controllers/driverController");

router.get("/all", getDrivers);
router.get("/active", getActiveDriversHandler);
router.get("/inactive", getInactiveDriversHandler);
router.post("/online", goOnline);
router.post("/offline", goOffline);
router.delete("/:driverId", deleteDriver);

module.exports = router;