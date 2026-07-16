const { createClient } = require("redis");

const publisher = createClient({
  url: process.env.REDIS_URL,
});

const subscriber = createClient({
  url: process.env.REDIS_URL,
});

publisher.on("error", (error) => {
  console.error("Redis publisher error:", error.message);
});

subscriber.on("error", (error) => {
  console.error("Redis subscriber error:", error.message);
});

async function connectPubSub() {
  await publisher.connect();
  await subscriber.connect();

  console.log("✅ Redis Pub/Sub Connected");
}

module.exports = {
  publisher,
  subscriber,
  connectPubSub,
};
