const jwt = require("jsonwebtoken");

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not set");
  }
  return secret;
}

function signToken(payload) {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: "7d" });
}

function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const [, token] = header.split(" ");

    if (!token) {
      return res.status(401).json({ success: false, message: "Missing bearer token" });
    }

    const decoded = jwt.verify(token, getJwtSecret());

    req.user = {
      id: decoded.sub,
      role: decoded.role,
      email: decoded.email,
      name: decoded.name,
    };

    return next();
  } catch (err) {
    return res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
}

function requireRole(role) {
  return function requireRoleMiddleware(req, res, next) {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }
    if (req.user.role !== role) {
      return res.status(403).json({ success: false, message: `Requires role ${role}` });
    }
    return next();
  };
}

module.exports = {
  authenticate,
  requireRole,
  signToken,
};

