const express = require("express");
const cors = require("cors");

const driverRoutes = require("./routes/driverRoutes");
const passengerRoutes = require("./routes/passengerRoutes");
const authRoutes = require("./routes/authRoutes");
const rideRoutes = require("./routes/rideRoutes");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Ride Booking Backend Running",
  });
});

app.use("/auth", authRoutes);
app.use("/drivers", driverRoutes);
app.use("/passengers", passengerRoutes);
app.use("/rides", rideRoutes);

module.exports = app;