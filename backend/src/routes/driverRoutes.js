const express = require("express");

const router = express.Router();

const { authenticate, requireRole } = require("../middleware/authMiddleware");

const {
  goOnline,
  goOffline,
  getDrivers,
  getActiveDriversHandler,
  getInactiveDriversHandler,
  deleteDriver,
} = require("../controllers/driverController");

router.get("/all", authenticate, getDrivers);
router.get("/active", authenticate, getActiveDriversHandler);
router.get("/inactive", authenticate, getInactiveDriversHandler);

router.post("/online", authenticate, requireRole("driver"), goOnline);
router.post("/offline", authenticate, requireRole("driver"), goOffline);
router.delete("/:driverId", authenticate, requireRole("driver"), deleteDriver);

module.exports = router;