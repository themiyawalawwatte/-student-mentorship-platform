const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");

process.env.JWT_SECRET = "mentor-route-test-secret";

const express = require("express");
const jwt = require("jsonwebtoken");
const authRoutes = require("../routes/authRoutes");
const mentorRoutes = require("../routes/mentorRoutes");

const app = express();
app.use(express.json());
app.use("/api/auth", authRoutes);
app.use("/api/mentors", mentorRoutes);

let server;
let baseUrl;

before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, "127.0.0.1", resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  server.closeAllConnections();
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

const createToken = (email, name, role) =>
  jwt.sign({ email, name, role }, process.env.JWT_SECRET, { expiresIn: "1h" });

const apiRequest = async (path, options = {}) => {
  const response = await fetch(`${baseUrl}${path}`, options);
  return { status: response.status, body: await response.json() };
};

const jsonHeaders = (token) => ({
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/json",
});

test("mentor request routes enforce authentication, ownership, and roles", async () => {
  const anonymousResponse = await apiRequest("/api/mentors/requests");
  assert.equal(anonymousResponse.status, 401);

  const studentToken = createToken("student-a@test.invalid", "Student A", "student");
  const otherStudentToken = createToken("student-b@test.invalid", "Student B", "student");
  const unassignedMentorToken = createToken("other@test.invalid", "Other Mentor", "mentor");
  const assignedMentorToken = createToken("maya.chen@mentor.com", "Maya Chen", "mentor");

  const created = await apiRequest("/api/mentors/request", {
    method: "POST",
    headers: jsonHeaders(studentToken),
    body: JSON.stringify({
      mentorId: "m-101",
      studentName: "Forged Name",
      studentEmail: "forged@test.invalid",
    }),
  });

  assert.equal(created.status, 201);
  assert.equal(created.body.request.studentName, "Student A");
  assert.equal(created.body.request.studentEmail, "student-a@test.invalid");

  const otherStudentRequests = await apiRequest("/api/mentors/requests", {
    headers: jsonHeaders(otherStudentToken),
  });
  assert.deepEqual(otherStudentRequests.body, []);

  const studentApproval = await apiRequest(
    `/api/mentors/requests/${created.body.request.id}/status`,
    {
      method: "PATCH",
      headers: jsonHeaders(studentToken),
      body: JSON.stringify({ status: "approved" }),
    }
  );
  assert.equal(studentApproval.status, 403);

  const unassignedApproval = await apiRequest(
    `/api/mentors/requests/${created.body.request.id}/status`,
    {
      method: "PATCH",
      headers: jsonHeaders(unassignedMentorToken),
      body: JSON.stringify({ status: "approved" }),
    }
  );
  assert.equal(unassignedApproval.status, 403);

  const assignedApproval = await apiRequest(
    `/api/mentors/requests/${created.body.request.id}/status`,
    {
      method: "PATCH",
      headers: jsonHeaders(assignedMentorToken),
      body: JSON.stringify({ status: "approved" }),
    }
  );
  assert.equal(assignedApproval.status, 200);
  assert.equal(assignedApproval.body.request.status, "approved");

  const approvedDelete = await apiRequest(
    `/api/mentors/requests/${created.body.request.id}`,
    { method: "DELETE", headers: jsonHeaders(studentToken) }
  );
  assert.equal(approvedDelete.status, 400);

  const profileUpdate = await apiRequest("/api/auth/profile", {
    method: "PATCH",
    headers: jsonHeaders(studentToken),
    body: JSON.stringify({ email: "admin@mentor.com", name: "Impersonation" }),
  });
  assert.equal(profileUpdate.status, 403);
});