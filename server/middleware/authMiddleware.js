
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const User = require("../models/User");

// Verify authentication
const requireAuth = async (req, res, next) => {
  const authorization = req.headers.authorization || "";
  const [scheme, token, extra] = authorization.split(" ");

  if (scheme !== "Bearer" || !token || extra) {
    return res.status(401).json({
      message: "Authentication is required.",
    });
  }

  if (!process.env.JWT_SECRET) {
    return res.status(500).json({
      message: "Authentication is not configured.",
    });
  }

  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({
      message: "Database is currently unavailable.",
    });
  }

  let decoded;

  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ["HS256"],
    });
  } catch (error) {
    return res.status(401).json({
      message: "Your session is invalid or has expired.",
    });
  }

  if (
    !decoded ||
    typeof decoded !== "object" ||
    !mongoose.isValidObjectId(decoded.id)
  ) {
    return res.status(401).json({
      message: "Invalid authentication session.",
    });
  }

  try {
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({
        message: "User account no longer exists.",
      });
    }

    req.user = {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
    };

    next();
  } catch (error) {
    console.error("Authentication error:", error.message);

    return res.status(503).json({
      message: "Unable to verify authentication.",
    });
  }
};

// Check role permissions
const allowRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        message: "Authentication is required.",
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: "You do not have permission to do this.",
      });
    }

    next();
  };
};

module.exports = {
  requireAuth,
  allowRoles,
};
