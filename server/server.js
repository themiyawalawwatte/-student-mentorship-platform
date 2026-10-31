
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;

// Allowed frontend URLs
const allowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:8080",
  "http://127.0.0.1:8080",
];

// CORS Middleware
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

// Middleware
app.use(express.json());

// API Routes
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/mentors", require("./routes/mentorRoutes"));

// Test API
app.get("/", (req, res) => {
  res.send("Student Mentorship Platform API is running!");
});

// MongoDB Connection
async function connectToDatabase() {
  if (!process.env.MONGO_URI) {
    console.warn("MONGO_URI is missing from .env.");
    return false;
  }

  try {
    await mongoose.connect(process.env.MONGO_URI, {
      dbName: "student_mentorship",
      serverSelectionTimeoutMS: 10000,
    });

    console.log("MongoDB Connected Successfully!");
    console.log("Database: student_mentorship");

    return true;

  } catch (error) {
    console.error("MongoDB Connection Failed:", error.message);
    console.warn(
      "The server will continue running without a database connection."
    );

    return false;
  }
}

// Start Express Server
async function startServer() {
  if (!process.env.JWT_SECRET) {
    console.error("JWT_SECRET is missing from .env. Generate a private secret before starting the API.");
    process.exit(1);
  }

  const dbConnected = await connectToDatabase();

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);

    if (dbConnected) {
      console.log("Database is online and ready!");
    } else {
      console.log(
        "Database is offline, but the API is available for development."
      );
    }
  });
}

startServer();
