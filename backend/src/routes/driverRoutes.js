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

router.get("/all", authenticate, requireRole("admin"), getDrivers);
router.get("/active", authenticate, requireRole("admin"), getActiveDriversHandler);
router.get("/inactive", authenticate, requireRole("admin"), getInactiveDriversHandler);

router.post("/online", authenticate, requireRole("driver"), goOnline);
router.post("/offline", authenticate, requireRole("driver"), goOffline);
router.delete("/:driverId", authenticate, requireRole("driver"), deleteDriver);

module.exports = router;
