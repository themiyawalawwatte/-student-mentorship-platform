
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    password: {
      type: String,
      required: true,
      select: false,
    },

    role: {
      type: String,
      enum: ["student", "mentor", "admin"],
      required: true,
    },

    university: {
      type: String,
      default: "",
      trim: true,
      maxlength: 150,
    },

    department: {
      type: String,
      default: "",
      trim: true,
      maxlength: 150,
    },

    expertise: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
    },

    availability: {
      type: String,
      default: "Not specified",
      trim: true,
      maxlength: 200,
    },

    bio: {
      type: String,
      default: "",
      trim: true,
      maxlength: 2000,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("User", userSchema);
