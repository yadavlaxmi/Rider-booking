const bcrypt = require("bcryptjs");
const { redisClient } = require("../config/redis");

function nowIso() {
  return new Date().toISOString();
}

function userKey(userId) {
  return `user:${userId}`;
}

function emailIndexKey(emailLower) {
  return `users:by_email:${emailLower}`;
}

function sanitizeUser(user) {
  if (!user) return null;
  // Never return passwordHash
  const { passwordHash, ...safe } = user;
  return safe;
}

async function getUserById(userId) {
  const data = await redisClient.hGetAll(userKey(userId));
  if (!data || !data.id) return null;
  return {
    id: data.id,
    role: data.role,
    email: data.email,
    name: data.name,
    passwordHash: data.passwordHash,
    createdAt: data.createdAt,
  };
}

async function getUserByEmail(email) {
  const emailLower = String(email || "").trim().toLowerCase();
  if (!emailLower) return null;
  const userId = await redisClient.get(emailIndexKey(emailLower));
  if (!userId) return null;
  return getUserById(userId);
}

function generateUserId(role) {
  return `${role}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

async function createUser({ role, email, name, password }) {
  const normalizedRole = String(role || "").trim().toLowerCase();
  if (normalizedRole !== "driver" && normalizedRole !== "passenger") {
    throw new Error("role must be driver or passenger");
  }

  const emailLower = String(email || "").trim().toLowerCase();
  if (!emailLower || !emailLower.includes("@")) {
    throw new Error("Valid email is required");
  }

  const trimmedName = String(name || "").trim();
  if (!trimmedName) {
    throw new Error("name is required");
  }

  const pwd = String(password || "");
  if (pwd.length < 6) {
    throw new Error("password must be at least 6 characters");
  }

  const existing = await redisClient.get(emailIndexKey(emailLower));
  if (existing) {
    throw new Error("Email already registered");
  }

  const id = generateUserId(normalizedRole);
  const passwordHash = await bcrypt.hash(pwd, 10);

  await redisClient.hSet(userKey(id), {
    id,
    role: normalizedRole,
    email: emailLower,
    name: trimmedName,
    passwordHash,
    createdAt: nowIso(),
  });

  await redisClient.set(emailIndexKey(emailLower), id);

  const user = await getUserById(id);
  return sanitizeUser(user);
}

async function verifyUserPassword({ email, password }) {
  const user = await getUserByEmail(email);
  if (!user) return null;

  const ok = await bcrypt.compare(String(password || ""), user.passwordHash || "");
  if (!ok) return null;

  return sanitizeUser(user);
}

module.exports = {
  createUser,
  getUserById,
  getUserByEmail,
  verifyUserPassword,
};

