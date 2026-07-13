const express = require("express");
const { authenticate } = require("../middleware/authMiddleware");
const { requestRide, quoteRide, getRide, myActiveRide, updateRideStatus } = require("../controllers/rideController");
const { requireRole } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/me/active", authenticate, myActiveRide);
router.get("/:rideId", authenticate, getRide);

router.post("/quote", authenticate, requireRole("passenger"), quoteRide);
router.post("/request", authenticate, requireRole("passenger"), requestRide);
router.post("/:rideId/status", authenticate, updateRideStatus);

module.exports = router;

