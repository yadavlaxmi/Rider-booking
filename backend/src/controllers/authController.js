const { createUser, verifyUserPassword, getUserById } = require("../services/userService");
const { signToken } = require("../middleware/authMiddleware");

async function signup(req, res) {
  try {
    const { role, email, name, password } = req.body || {};
    const user = await createUser({ role, email, name, password });

    const token = signToken({
      sub: user.id,
      role: user.role,
      email: user.email,
      name: user.name,
    });

    return res.json({ success: true, token, user });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
}

async function login(req, res) {
  try {
    const { email, password } = req.body || {};
    const user = await verifyUserPassword({ email, password });

    if (!user) {
      return res.status(401).json({ success: false, message: "Invalid email or password" });
    }

    const token = signToken({
      sub: user.id,
      role: user.role,
      email: user.email,
      name: user.name,
    });

    return res.json({ success: true, token, user });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
}

async function me(req, res) {
  try {
    const user = await getUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const { passwordHash, ...safe } = user;
    return res.json({ success: true, user: safe });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  signup,
  login,
  me,
};

