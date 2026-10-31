
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

const User = require("../models/User");
const { requireAuth } = require("../middleware/authMiddleware");

const router = express.Router();

const databaseReady = () =>
  mongoose.connection.readyState === 1;

// Return safe user information
const sanitizeUser = (user) => ({
  id: String(user._id),
  name: user.name,
  email: user.email,
  role: user.role,
  university: user.university || "",
  department: user.department || "",
  expertise: user.expertise || "",
  availability: user.availability || "Not specified",
  bio: user.bio || "",
});

// Create JWT
const createToken = (user) =>
  jwt.sign(
    {
      id: String(user._id),
      email: user.email,
      name: user.name,
      role: user.role,
    },
    process.env.JWT_SECRET,
    {
      algorithm: "HS256",
      expiresIn: "1d",
    }
  );

// ========================================
// REGISTER STUDENT OR MENTOR
// ========================================

router.post("/register", async (req, res) => {
  try {
    if (!process.env.JWT_SECRET) {
      return res.status(500).json({
        message: "Authentication is not configured.",
      });
    }

    if (!databaseReady()) {
      return res.status(503).json({
        message: "Database unavailable.",
      });
    }

    const {
      name,
      email,
      password,
      role,
      university,
      department,
    } = req.body || {};

    if (
      typeof name !== "string" ||
      !name.trim() ||
      name.trim().length > 100 ||
      typeof email !== "string" ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
      typeof password !== "string" ||
      password.length < 8 ||
      Buffer.byteLength(password, "utf8") > 72 ||
      !["student", "mentor"].includes(role)
    ) {
      return res.status(400).json({
        message: "Invalid registration details.",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await User.findOne({
      email: normalizedEmail,
    });

    if (existingUser) {
      return res.status(409).json({
        message: "Email already registered.",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role,
      university:
        typeof university === "string"
          ? university.trim()
          : "",
      department:
        typeof department === "string"
          ? department.trim()
          : "",
    });

    return res.status(201).json({
      message: "Registration successful!",
      token: createToken(user),
      user: sanitizeUser(user),
    });
  } catch (error) {
    console.error("Registration error:", error.message);

    if (error.code === 11000) {
      return res.status(409).json({
        message: "Email already registered.",
      });
    }

    return res.status(500).json({
      message: "Registration failed.",
    });
  }
});

// ========================================
// LOGIN (STUDENT, MENTOR, ADMIN)
// ========================================

router.post("/login", async (req, res) => {
  try {
    if (!process.env.JWT_SECRET) {
      return res.status(500).json({
        message: "Authentication is not configured.",
      });
    }

    if (!databaseReady()) {
      return res.status(503).json({
        message: "Database unavailable.",
      });
    }

    const { email, password } = req.body || {};

    if (
      typeof email !== "string" ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
      typeof password !== "string" ||
      !password
    ) {
      return res.status(400).json({
        message: "Please enter a valid email and password.",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const user = await User.findOne({
      email: normalizedEmail,
    }).select("+password");

    if (!user) {
      return res.status(401).json({
        message: "Invalid email or password.",
      });
    }

    const passwordMatches = await bcrypt.compare(
      password,
      user.password
    );

    if (!passwordMatches) {
      return res.status(401).json({
        message: "Invalid email or password.",
      });
    }

    return res.status(200).json({
      message: "Login successful!",
      token: createToken(user),
      user: sanitizeUser(user),
    });
  } catch (error) {
    console.error("Login error:", error.message);

    return res.status(500).json({
      message: "Login failed.",
    });
  }
});

// ========================================
// GET LOGGED-IN USER
// ========================================

router.get("/me", requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        message: "User not found.",
      });
    }

    return res.status(200).json({
      user: sanitizeUser(user),
    });
  } catch (error) {
    return res.status(500).json({
      message: "Unable to load profile.",
    });
  }
});

// ========================================
// UPDATE OWN PROFILE
// ========================================

router.patch("/profile", requireAuth, async (req, res) => {
  try {
    if (!databaseReady()) {
      return res.status(503).json({
        message: "Database unavailable.",
      });
    }

    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        message: "User not found.",
      });
    }

    const allowedFields = [
      "name",
      "university",
      "department",
    ];

    if (user.role === "mentor") {
      allowedFields.push(
        "expertise",
        "availability",
        "bio"
      );
    }

    const maxLengths = {
      name: 100,
      university: 150,
      department: 150,
      expertise: 500,
      availability: 200,
      bio: 2000,
    };

    const updates = {};

    for (const field of allowedFields) {
      if (
        !Object.prototype.hasOwnProperty.call(
          req.body || {},
          field
        )
      ) {
        continue;
      }

      const value = req.body[field];

      if (typeof value !== "string") {
        return res.status(400).json({
          message: `${field} must be text.`,
        });
      }

      const trimmed = value.trim();

      if (field === "name" && !trimmed) {
        return res.status(400).json({
          message: "Name cannot be empty.",
        });
      }

      if (trimmed.length > maxLengths[field]) {
        return res.status(400).json({
          message: `${field} is too long.`,
        });
      }

      updates[field] = trimmed;
    }

    Object.assign(user, updates);

    await user.save();

    return res.status(200).json({
      message: "Profile updated successfully!",
      token: createToken(user),
      user: sanitizeUser(user),
    });
  } catch (error) {
    console.error("Profile update error:", error.message);

    return res.status(500).json({
      message: "Profile update failed.",
    });
  }
});

module.exports = router;
