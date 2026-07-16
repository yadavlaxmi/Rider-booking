require("dotenv").config();

const { connectRedis, redisClient } = require("../config/redis");
const { createUser } = require("../services/userService");

async function createAdmin() {
  const { ADMIN_EMAIL, ADMIN_NAME, ADMIN_PASSWORD, ADMIN_SIGNUP_KEY } = process.env;

  if (!ADMIN_EMAIL || !ADMIN_NAME || !ADMIN_PASSWORD || !ADMIN_SIGNUP_KEY) {
    throw new Error(
      "Set ADMIN_EMAIL, ADMIN_NAME, ADMIN_PASSWORD, and ADMIN_SIGNUP_KEY in backend/.env first"
    );
  }

  await connectRedis();
  const user = await createUser({
    role: "admin",
    email: ADMIN_EMAIL,
    name: ADMIN_NAME,
    password: ADMIN_PASSWORD,
    adminSignupKey: ADMIN_SIGNUP_KEY,
  });

  console.log(`Admin created: ${user.email}`);
}

createAdmin()
  .catch((error) => {
    console.error(`Could not create admin: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (redisClient.isOpen) await redisClient.quit();
  });
