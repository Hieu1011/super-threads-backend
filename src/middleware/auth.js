const jwt = require("jsonwebtoken");
const database = require("../config/database-factory");

// JWT Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      error: "Access token required",
      code: "TOKEN_REQUIRED",
    });
  }

  jwt.verify(
    token,
    process.env.JWT_SECRET || "fallback-secret",
    (err, user) => {
      if (err) {
        return res.status(403).json({
          error: "Invalid or expired token",
          code: "TOKEN_INVALID",
        });
      }

      req.user = user;
      next();
    }
  );
};

// WebSocket Authentication
const authenticateWebSocket = async (token) => {
  try {
    if (!token) {
      throw new Error("No token provided");
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "fallback-secret"
    );

    // Verify user exists in database
    const result = await database.query(
      "SELECT id, email, username, display_name, avatar, verified FROM users WHERE id = $1",
      [decoded.userId]
    );

    const user = result.rows ? result.rows[0] : result[0];

    if (!user) {
      throw new Error("User not found");
    }

    return {
      userId: user.id,
      email: user.email,
      username: user.username,
      displayName: user.display_name,
      avatar: user.avatar,
      verified: user.verified,
    };
  } catch (error) {
    throw new Error(`Authentication failed: ${error.message}`);
  }
};

// Generate JWT token
const generateToken = (user) => {
  const payload = {
    userId: user.id,
    email: user.email,
    username: user.username,
  };

  return jwt.sign(payload, process.env.JWT_SECRET || "fallback-secret", {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
};

// Validate password strength
const validatePassword = (password) => {
  if (password.length < 6) {
    return { valid: false, message: "Password must be at least 6 characters" };
  }

  if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
    return {
      valid: false,
      message:
        "Password must contain at least one uppercase letter, one lowercase letter, and one number",
    };
  }

  return { valid: true };
};

// Validate email format
const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

module.exports = {
  authenticateToken,
  authenticateWebSocket,
  generateToken,
  validatePassword,
  validateEmail,
};
