const { createClient } = require("redis");

const redisClient = createClient({
  url: process.env.REDIS_URL,
});

redisClient.on("connect", () => {
  console.log("✅ Redis Connected");
});

redisClient.on("error", (err) => {
  console.log("Redis Error:", err.message);
});

async function connectRedis() {
  await redisClient.connect();
}

module.exports = {
  redisClient,
  connectRedis,
};