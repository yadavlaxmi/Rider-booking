const express = require("express");

const router = express.Router();

const {
  nearbyDrivers,
} = require("../controllers/passangerController");

router.post("/nearby", nearbyDrivers);

module.exports = router;