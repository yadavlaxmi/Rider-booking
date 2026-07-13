const express = require("express");

const router = express.Router();

const { authenticate, requireRole } = require("../middleware/authMiddleware");

const {
  nearbyDrivers,
} = require("../controllers/passangerController");

router.post("/nearby", authenticate, requireRole("passenger"), nearbyDrivers);

module.exports = router;