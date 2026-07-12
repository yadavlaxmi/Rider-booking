const {
  publisher,
  subscriber,
} = require("../services/pubSubService");

const driverSockets = new Map();
const passengerSockets = new Map();

async function initializeSocket(io) {

  await subscriber.subscribe("ride:requests", (message) => {

    const data = JSON.parse(message);

    const socketId = driverSockets.get(data.driverId);

    if (socketId) {

      io.to(socketId).emit("ride-request", data);

    }

  });

  io.on("connection", (socket) => {

    console.log("Connected:", socket.id);

    /**
     * Driver joins
     */
    socket.on("driver-online", (driverId) => {

      driverSockets.set(driverId, socket.id);

      console.log("Driver Registered:", driverId);

    });

    /**
     * Passenger joins
     */
    socket.on("passenger-online", (passengerId) => {

      passengerSockets.set(passengerId, socket.id);

    });

    /**
     * Passenger requests ride
     */
    socket.on("request-ride", async (ride) => {

      await publisher.publish(
        "ride:requests",
        JSON.stringify(ride)
      );

    });

    /**
     * Driver accepts ride
     */
    socket.on("ride-accepted", (ride) => {

      const passengerSocket =
        passengerSockets.get(ride.passengerId);

      if (passengerSocket) {

        io.to(passengerSocket).emit(
          "ride-confirmed",
          ride
        );

      }

    });

    socket.on("disconnect", () => {

      console.log("Disconnected");

    });

  });

}

module.exports = initializeSocket;