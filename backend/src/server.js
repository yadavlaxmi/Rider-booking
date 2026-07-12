// require("dotenv").config();

// const http = require("http");
// const { Server } = require("socket.io");

// const app = require("./app");

// const { connectRedis } = require("./config/redis");

// const server = http.createServer(app);

// const io = new Server(server, {
//   cors: {
//     origin: "*",
//   },
// });

// io.on("connection", (socket) => {
//   console.log("🟢 Client Connected:", socket.id);

//   socket.on("disconnect", () => {
//     console.log("🔴 Client Disconnected");
//   });
// });

// async function startServer() {
//   await connectRedis();

//   server.listen(process.env.PORT, () => {
//     console.log(`🚀 Server Running on Port ${process.env.PORT}`);
//   });
// }

// startServer();

require("dotenv").config();

const http = require("http");
const { Server } = require("socket.io");

const app = require("./app");

const { connectRedis } = require("./config/redis");
const { connectPubSub } = require("./services/pubSubService");

const initializeSocket = require("./socket/socketHandler");

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

async function startServer() {

  await connectRedis();

  await connectPubSub();

  initializeSocket(io);

  server.listen(process.env.PORT, () => {

    console.log(`Server Running ${process.env.PORT}`);

  });

}

startServer();
