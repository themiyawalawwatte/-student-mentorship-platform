
const express = require("express");
const mongoose = require("mongoose");

const User = require("../models/User");
const MentorshipRequest = require("../models/MentorshipRequest");

const {
  requireAuth,
  allowRoles,
} = require("../middleware/authMiddleware");

const router = express.Router();

// Temporary offline storage for existing request operations
const requests = [];

// Check database connection
const isDatabaseConnected = () =>
  mongoose.connection.readyState === 1;


// ========================================
// 1. GET ALL REGISTERED MENTORS
// ========================================

router.get("/", async (req, res) => {
  try {
    if (!isDatabaseConnected()) {
      return res.status(503).json({
        message: "Mentor directory unavailable. Database is offline.",
      });
    }

    const users = await User.find({
      role: "mentor",
    })
      .select(
        "name university department expertise availability bio"
      )
      .sort({ name: 1 })
      .lean();

    const mentors = users.map((mentor) => ({
      id: mentor._id.toString(),
      name: mentor.name,
      role: "Mentor",
      university: mentor.university || "",
      department: mentor.department || "",
      expertise: mentor.expertise || "",
      availability: mentor.availability || "Not specified",
      bio: mentor.bio || "",
    }));

    return res.status(200).json(mentors);

  } catch (error) {
    console.error("Error loading mentors:", error.message);

    return res.status(500).json({
      message: "Unable to load mentor profiles.",
    });
  }
});


// ========================================
// 2. GET CONNECTED STUDENTS COUNT
// ========================================

router.get("/connections/count", async (req, res) => {
  try {
    if (isDatabaseConnected()) {
      const students = await MentorshipRequest.distinct(
        "studentEmail",
        { status: "approved" }
      );

      return res.status(200).json({
        count: students.length,
      });
    }

    const connectedStudents = new Set(
      requests
        .filter((request) => request.status === "approved")
        .map((request) => request.studentEmail.toLowerCase())
    );

    return res.status(200).json({
      count: connectedStudents.size,
    });

  } catch (error) {
    return res.status(500).json({
      message: "Unable to load connection count.",
    });
  }
});


// ========================================
// 3. GET MENTORSHIP REQUESTS
// ========================================

router.get("/requests", requireAuth, async (req, res) => {
  try {
    const allRequests = isDatabaseConnected()
      ? await MentorshipRequest.find()
          .sort({ createdAt: -1 })
          .lean()
      : requests;

    const visibleRequests =
      req.user.role === "admin"
        ? allRequests
        : allRequests.filter((request) =>
            req.user.role === "mentor"
              ? request.mentorEmail === req.user.email
              : request.studentEmail === req.user.email
          );

    return res.status(200).json(visibleRequests);

  } catch (error) {
    console.error("Request loading error:", error.message);

    return res.status(500).json({
      message: "Unable to load mentorship requests.",
    });
  }
});


// ========================================
// 4. SEND MENTORSHIP REQUEST
// ========================================

router.post(
  "/request",
  requireAuth,
  allowRoles("student", "admin"),
  async (req, res) => {
    const { mentorId, message } = req.body;

    if (
      typeof mentorId !== "string" ||
      !mongoose.isValidObjectId(mentorId)
    ) {
      return res.status(400).json({
        message: "A valid mentor ID is required.",
      });
    }

    if (!isDatabaseConnected()) {
      return res.status(503).json({
        message: "Database unavailable. Please try again later.",
      });
    }

    try {
      // Find registered mentor in MongoDB
      const mentor = await User.findOne({
        _id: mentorId,
        role: "mentor",
      }).select("name email");

      if (!mentor) {
        return res.status(404).json({
          message: "Selected mentor was not found.",
        });
      }

      const now = new Date().toISOString();

      const requestData = {
        id: `req-${Date.now()}-${Math.random()
          .toString(16)
          .slice(2, 8)}`,

        mentorId: mentor._id.toString(),
        mentorName: mentor.name,
        mentorEmail: mentor.email,

        studentName: req.user.name,
        studentEmail: req.user.email,

        message:
          typeof message === "string" && message.trim()
            ? message.trim()
            : "I would like to request mentorship support.",

        status: "pending",

        createdAt: now,
        updatedAt: now,
      };

      // Save request permanently to MongoDB
      const newRequest = await MentorshipRequest.create(
        requestData
      );

      return res.status(201).json({
        message: "Mentorship request sent successfully.",
        request: newRequest,
      });

    } catch (error) {
      console.error(
        "Mentorship request error:",
        error.message
      );

      return res.status(500).json({
        message: "Unable to save mentorship request.",
      });
    }
  }
);


// ========================================
// 5. APPROVE OR REJECT REQUEST
// ========================================

router.patch(
  "/requests/:id/status",
  requireAuth,
  allowRoles("mentor", "admin"),
  async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    if (!["pending", "approved", "rejected"].includes(status)) {
      return res.status(400).json({
        message: "Invalid status value.",
      });
    }

    try {
      const existingRequest = isDatabaseConnected()
        ? await MentorshipRequest.findOne({ id }).lean()
        : requests.find((item) => item.id === id);

      if (!existingRequest) {
        return res.status(404).json({
          message: "Request not found.",
        });
      }

      // Only assigned mentor or admin can update
      if (
        req.user.role !== "admin" &&
        existingRequest.mentorEmail !== req.user.email
      ) {
        return res.status(403).json({
          message: "You can only update requests assigned to you.",
        });
      }

      let request;

      if (isDatabaseConnected()) {
        request = await MentorshipRequest.findOneAndUpdate(
          { id },
          {
            status,
            updatedAt: new Date(),
          },
          {
            returnDocument: "after",
            runValidators: true,
          }
        );
      } else {
        request = requests.find((item) => item.id === id);

        if (request) {
          request.status = status;
          request.updatedAt = new Date().toISOString();
        }
      }

      return res.status(200).json({
        message: `Request marked as ${status}.`,
        request,
      });

    } catch (error) {
      console.error("Status update error:", error.message);

      return res.status(500).json({
        message: "Unable to update request status.",
      });
    }
  }
);


// ========================================
// 6. DELETE MENTORSHIP REQUEST
// ========================================

router.delete(
  "/requests/:id",
  requireAuth,
  allowRoles("student", "admin"),
  async (req, res) => {
    const { id } = req.params;

    try {
      const existingRequest = isDatabaseConnected()
        ? await MentorshipRequest.findOne({ id }).lean()
        : requests.find((item) => item.id === id);

      if (!existingRequest) {
        return res.status(404).json({
          message: "Request not found.",
        });
      }

      // Only owner or admin can delete
      if (
        req.user.role !== "admin" &&
        existingRequest.studentEmail !== req.user.email
      ) {
        return res.status(403).json({
          message: "You can only delete your own requests.",
        });
      }

      // Only pending requests can be deleted
      if (existingRequest.status !== "pending") {
        return res.status(400).json({
          message: "Only pending requests can be deleted.",
        });
      }

      let removedRequest;

      if (isDatabaseConnected()) {
        removedRequest =
          await MentorshipRequest.findOneAndDelete({ id });
      } else {
        const index = requests.findIndex(
          (item) => item.id === id
        );

        if (index !== -1) {
          [removedRequest] = requests.splice(index, 1);
        }
      }

      if (!removedRequest) {
        return res.status(404).json({
          message: "Request not found.",
        });
      }

      return res.status(200).json({
        message: "Request deleted successfully.",
        request: removedRequest,
      });

    } catch (error) {
      console.error("Delete request error:", error.message);

      return res.status(500).json({
        message: "Unable to delete request.",
      });
    }
  }
);


// Export router
module.exports = router;
