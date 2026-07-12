const express = require("express");
const cors = require("cors");

const driverRoutes = require("./routes/driverRoutes");
const passengerRoutes = require("./routes/passengerRoutes");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Ride Booking Backend Running",
  });
});

app.use("/drivers", driverRoutes);
app.use("/passengers", passengerRoutes);

module.exports = app;