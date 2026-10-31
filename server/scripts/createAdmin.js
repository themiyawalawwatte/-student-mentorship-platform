
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { randomBytes } = require("node:crypto");
const readline = require("node:readline/promises");
const path = require("node:path");

require("dotenv").config({
  path: path.join(__dirname, "../.env"),
});

const User = require("../models/User");

async function createAdmin() {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is missing from .env");
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  let email;

  try {
    email = (
      await rl.question("Enter admin email: ")
    ).trim().toLowerCase();
  } finally {
    rl.close();
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Invalid email address.");
  }

  await mongoose.connect(process.env.MONGO_URI, {
    dbName: "student_mentorship",
    serverSelectionTimeoutMS: 10000,
  });

  try {
    const existingUser = await User.findOne({ email });

    if (existingUser) {
      throw new Error(
        "An account with this email already exists."
      );
    }

    const initialPassword = randomBytes(32).toString(
      "base64url"
    );

    const hashedPassword = await bcrypt.hash(
      initialPassword,
      12
    );

    const admin = await User.create({
      name: "Platform Admin",
      email,
      password: hashedPassword,
      role: "admin",
      university: "Platform Administration",
      department: "Administration",
    });

    console.log("\nAdmin created successfully!");
    console.log("Admin Email:", admin.email);
    console.log("Initial Password:", initialPassword);
    console.log(
      "\nSave the password privately. Do not share or commit it."
    );
  } finally {
    await mongoose.disconnect();
  }
}

createAdmin().catch((error) => {
  console.error("Admin setup failed:", error.message);
  process.exitCode = 1;
});
