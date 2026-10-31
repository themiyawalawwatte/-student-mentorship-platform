const mongoose = require("mongoose");

const mentorshipRequestSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      unique: true,
    },
    mentorId: {
      type: String,
      required: true,
    },
    mentorName: {
      type: String,
      required: true,
    },
    mentorEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    studentName: {
      type: String,
      required: true,
      trim: true,
    },
    studentEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    message: {
      type: String,
      default: "I would like to request mentorship support.",
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("MentorshipRequest", mentorshipRequestSchema);