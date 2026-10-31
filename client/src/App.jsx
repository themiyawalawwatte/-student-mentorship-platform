
import { useEffect, useMemo, useState } from "react";
import "./App.css";

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000";

const getAuthHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("mentor-token") || ""}`,
});

const initialForm = {
  name: "",
  email: "",
  password: "",
  role: "student",
  university: "",
  department: "",
};

const createProfileForm = (user) => ({
  name: user?.name || "",
  university: user?.university || "",
  department: user?.department || "",
  expertise: user?.expertise || "",
  availability: user?.availability || "",
  bio: user?.bio || "",
});

function App() {
  const [mode, setMode] = useState("login");
  const [authPage, setAuthPage] = useState(false);
  const [form, setForm] = useState(initialForm);

  const [user, setUser] = useState(() => {
    try {
      const savedUser = localStorage.getItem("mentor-user");
      return savedUser ? JSON.parse(savedUser) : null;
    } catch {
      return null;
    }
  });

  const [profileForm, setProfileForm] = useState(() =>
    createProfileForm(user)
  );

  const [authMessage, setAuthMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const [connectedStudents, setConnectedStudents] = useState(null);
  const [mentors, setMentors] = useState([]);
  const [requests, setRequests] = useState([]);

  const [mentorsLoading, setMentorsLoading] = useState(false);
  const [mentorsError, setMentorsError] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDepartment, setSelectedDepartment] =
    useState("All");

  // ========================================
  // LOAD CONNECTED STUDENT COUNT
  // ========================================

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/mentors/connections/count`)
      .then((response) => {
        if (!response.ok) {
          throw new Error("Unable to load connection count");
        }
        return response.json();
      })
      .then((data) => setConnectedStudents(data.count))
      .catch(() => setConnectedStudents(null));
  }, []);

  // ========================================
  // LOAD MENTORS AND REQUESTS
  // ========================================

  useEffect(() => {
    if (!user) {
      setMentors([]);
      setRequests([]);
      return;
    }

    let cancelled = false;

    const loadData = async () => {
      setMentorsLoading(true);
      setMentorsError("");

      try {
        const [mentorsRes, requestsRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/mentors`),
          fetch(`${API_BASE_URL}/api/mentors/requests`, {
            headers: getAuthHeaders(),
          }),
        ]);

        if (!mentorsRes.ok) {
          throw new Error("Unable to load mentors.");
        }

        const mentorData = await mentorsRes.json();

        if (!cancelled) {
          setMentors(
            Array.isArray(mentorData) ? mentorData : []
          );
        }

        if (requestsRes.ok) {
          const requestData = await requestsRes.json();

          if (!cancelled) {
            setRequests(
              Array.isArray(requestData) ? requestData : []
            );
          }
        } else if (!cancelled) {
          setRequests([]);
        }
      } catch (error) {
        console.error("Failed to load data:", error);

        if (!cancelled) {
          setMentorsError(error.message);
        }
      } finally {
        if (!cancelled) {
          setMentorsLoading(false);
        }
      }
    };

    loadData();

    return () => {
      cancelled = true;
    };
  }, [user]);

  // ========================================
  // SEARCH AND FILTER MENTORS
  // ========================================

  const departments = useMemo(() => {
    const uniqueDepartments = mentors
      .map((mentor) => mentor.department)
      .filter(Boolean);

    return ["All", ...new Set(uniqueDepartments)];
  }, [mentors]);

  const filteredMentors = useMemo(() => {
    const search = searchTerm.toLowerCase();

    return mentors.filter((mentor) => {
      const name = (mentor.name || "").toLowerCase();
      const expertise = (mentor.expertise || "").toLowerCase();
      const department = (mentor.department || "").toLowerCase();

      const matchesSearch =
        name.includes(search) ||
        expertise.includes(search) ||
        department.includes(search);

      const matchesDepartment =
        selectedDepartment === "All" ||
        mentor.department === selectedDepartment;

      return matchesSearch && matchesDepartment;
    });
  }, [mentors, searchTerm, selectedDepartment]);

  // ========================================
  // REQUEST FILTERING
  // ========================================

  const mentorRequests = useMemo(() => {
    if (!user) return [];

    if (user.role === "admin") {
      return requests;
    }

    return requests.filter(
      (request) =>
        request.mentorEmail === user.email ||
        request.mentorName === user.name
    );
  }, [requests, user]);

  const studentRequests = useMemo(() => {
    if (!user) return [];

    return requests.filter(
      (request) => request.studentEmail === user.email
    );
  }, [requests, user]);

  const totalMentors = mentors.length;

  const pendingRequests = requests.filter(
    (request) => request.status === "pending"
  ).length;

  const approvedRequests = requests.filter(
    (request) => request.status === "approved"
  ).length;

  // ========================================
  // FORM HANDLERS
  // ========================================

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleProfileChange = (event) => {
    const { name, value } = event.target;

    setProfileForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const openRegistration = (role) => {
    setForm({
      ...initialForm,
      role,
    });

    setMode("register");
    setAuthMessage("");
    setAuthPage(true);
  };

  // ========================================
  // LOGIN AND REGISTRATION
  // ========================================

  const handleSubmit = async (event) => {
    event.preventDefault();

    setIsLoading(true);
    setAuthMessage("");

    try {
      const endpoint =
        mode === "login"
          ? "/api/auth/login"
          : "/api/auth/register";

      const payload =
        mode === "login"
          ? {
              email: form.email,
              password: form.password,
            }
          : form;

      const response = await fetch(
        `${API_BASE_URL}${endpoint}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Authentication failed"
        );
      }

      localStorage.setItem(
        "mentor-user",
        JSON.stringify(data.user)
      );

      localStorage.setItem(
        "mentor-token",
        data.token || ""
      );

      setUser(data.user);
      setProfileForm(createProfileForm(data.user));

      setAuthMessage(data.message || "Success!");
      setForm(initialForm);
    } catch (error) {
      setAuthMessage(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // ========================================
  // LOGOUT
  // ========================================

  const handleLogout = () => {
    localStorage.removeItem("mentor-user");
    localStorage.removeItem("mentor-token");

    setUser(null);
    setProfileForm(createProfileForm(null));
    setAuthMessage("");
    setMode("login");
    setAuthPage(false);
  };

  // ========================================
  // UPDATE PROFILE
  // ========================================

  const handleProfileUpdate = async (event) => {
    event.preventDefault();

    setIsSavingProfile(true);
    setAuthMessage("");

    try {
      const payload = {
        name: profileForm.name,
        university: profileForm.university,
        department: profileForm.department,
      };

      // Include mentor-only profile details
      if (user.role === "mentor") {
        payload.expertise = profileForm.expertise;
        payload.availability = profileForm.availability;
        payload.bio = profileForm.bio;
      }

      const response = await fetch(
        `${API_BASE_URL}/api/auth/profile`,
        {
          method: "PATCH",
          headers: {
            ...getAuthHeaders(),
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Unable to update profile"
        );
      }

      localStorage.setItem(
        "mentor-user",
        JSON.stringify(data.user)
      );

      if (data.token) {
        localStorage.setItem(
          "mentor-token",
          data.token
        );
      }

      setUser(data.user);
      setProfileForm(createProfileForm(data.user));

      setAuthMessage(
        data.message || "Profile updated successfully!"
      );
    } catch (error) {
      setAuthMessage(error.message);
    } finally {
      setIsSavingProfile(false);
    }
  };

  // ========================================
  // REQUEST MENTORSHIP
  // ========================================

  const handleRequestMentorship = async (mentorId) => {
    if (!user) return;

    setAuthMessage("");

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/mentors/request`,
        {
          method: "POST",
          headers: {
            ...getAuthHeaders(),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            mentorId,
            message: `Hello, I would like mentorship support in ${
              user.department || "my studies"
            }.`,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Unable to send request"
        );
      }

      const refreshed = await fetch(
        `${API_BASE_URL}/api/mentors/requests`,
        {
          headers: getAuthHeaders(),
        }
      );

      if (refreshed.ok) {
        setRequests(await refreshed.json());
      }

      setAuthMessage(data.message);
    } catch (error) {
      setAuthMessage(error.message);
    }
  };

  // ========================================
  // APPROVE OR REJECT REQUEST
  // ========================================

  const handleRequestDecision = async (
    requestId,
    status
  ) => {
    setAuthMessage("");

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/mentors/requests/${requestId}/status`,
        {
          method: "PATCH",
          headers: {
            ...getAuthHeaders(),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Unable to update request status"
        );
      }

      const refreshed = await fetch(
        `${API_BASE_URL}/api/mentors/requests`,
        {
          headers: getAuthHeaders(),
        }
      );

      if (refreshed.ok) {
        setRequests(await refreshed.json());
      }

      setAuthMessage(data.message);

      // Refresh connection count
      if (status === "approved") {
        const countResponse = await fetch(
          `${API_BASE_URL}/api/mentors/connections/count`
        );

        if (countResponse.ok) {
          const countData = await countResponse.json();
          setConnectedStudents(countData.count);
        }
      }
    } catch (error) {
      setAuthMessage(error.message);
    }
  };

  // ========================================
  // DELETE REQUEST
  // ========================================

  const handleDeleteRequest = async (requestId) => {
    setAuthMessage("");

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/mentors/requests/${requestId}`,
        {
          method: "DELETE",
          headers: getAuthHeaders(),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Unable to delete request"
        );
      }

      const refreshed = await fetch(
        `${API_BASE_URL}/api/mentors/requests`,
        {
          headers: getAuthHeaders(),
        }
      );

      if (refreshed.ok) {
        setRequests(await refreshed.json());
      }

      setAuthMessage(data.message);
    } catch (error) {
      setAuthMessage(error.message);
    }
  };

  // ========================================
  // USER INTERFACE
  // ========================================

  return (
    <div className="page-shell">
      {/* HEADER */}
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand-wrap">
            <div className="brand-mark">S</div>

            <div className="brand-text">
              <span>Student Mentorship</span>
              <small>PLATFORM</small>
            </div>
          </div>

          {!user && (
            <button
              type="button"
              className="header-login"
              onClick={() => {
                setMode("login");
                setAuthMessage("");
                setAuthPage(true);
              }}
            >
              Log in
            </button>
          )}
        </div>
      </header>

      <main
        className={
          user
            ? "dashboard-page"
            : authPage
            ? "auth-page"
            : "landing-page"
        }
      >
        {!user ? (
          authPage ? (
            // =====================================
            // LOGIN AND REGISTRATION PAGE
            // =====================================
            <section className="auth-screen">
              <div className="auth-intro">
                <button
                  type="button"
                  className="back-home"
                  onClick={() => setAuthPage(false)}
                >
                  <span aria-hidden="true">←</span>
                  {" "}Back to home
                </button>

                <p className="eyebrow">
                  A little guidance goes a long way
                </p>

                <h1>
                  {mode === "login"
                    ? "Welcome back."
                    : "Make your next move."}
                </h1>

                <p className="auth-intro-copy">
                  {mode === "login"
                    ? "Sign in to pick up where you left off with your mentorship journey."
                    : "Create an account to find a mentor or share what you know."}
                </p>
              </div>

              <div className="auth-card">
                <div className="toggle-row">
                  <button
                    type="button"
                    className={
                      mode === "login"
                        ? "toggle active"
                        : "toggle"
                    }
                    onClick={() => {
                      setMode("login");
                      setAuthMessage("");
                    }}
                  >
                    Login
                  </button>

                  <button
                    type="button"
                    className={
                      mode === "register"
                        ? "toggle active"
                        : "toggle"
                    }
                    onClick={() => {
                      setMode("register");
                      setAuthMessage("");
                    }}
                  >
                    Register
                  </button>
                </div>

                <form
                  className="auth-form"
                  onSubmit={handleSubmit}
                >
                  {mode === "register" && (
                    <>
                      <label>
                        Full Name
                        <input
                          type="text"
                          name="name"
                          value={form.name}
                          onChange={handleChange}
                          placeholder="Enter your name"
                          required
                        />
                      </label>

                      <label>
                        Register As
                        <select
                          name="role"
                          value={form.role}
                          onChange={handleChange}
                        >
                          <option value="student">
                            Student
                          </option>
                          <option value="mentor">
                            Mentor
                          </option>
                        </select>
                      </label>

                      <div className="two-col">
                        <label>
                          University
                          <input
                            type="text"
                            name="university"
                            value={form.university}
                            onChange={handleChange}
                            placeholder="University"
                          />
                        </label>

                        <label>
                          Department
                          <input
                            type="text"
                            name="department"
                            value={form.department}
                            onChange={handleChange}
                            placeholder="Department"
                          />
                        </label>
                      </div>
                    </>
                  )}

                  <label>
                    Email
                    <input
                      type="email"
                      name="email"
                      value={form.email}
                      onChange={handleChange}
                      placeholder="you@example.com"
                      required
                    />
                  </label>

                  <label>
                    Password
                    <input
                      type="password"
                      name="password"
                      value={form.password}
                      onChange={handleChange}
                      placeholder="Minimum 8 characters"
                      minLength={8}
                      required
                    />
                  </label>

                  {authMessage && (
                    <div className="status-box">
                      {authMessage}
                    </div>
                  )}

                  <button
                    type="submit"
                    className="primary-btn"
                    disabled={isLoading}
                  >
                    {isLoading
                      ? "Please wait..."
                      : mode === "login"
                      ? "Login"
                      : "Create Account"}
                  </button>
                </form>
              </div>
            </section>
          ) : (
            // =====================================
            // LANDING PAGE
            // =====================================
            <>
              <section className="hero-section">
                <div className="hero-copy">
                  <p className="hero-kicker">
                    STUDENT MENTORSHIP PLATFORM
                  </p>

                  <h1>
                    Good guidance can change what comes next.
                  </h1>

                  <p className="hero-description">
                    Find someone who has been there before,
                    get help with your goals, and take your
                    next step with a little more confidence.
                  </p>

                  <div className="hero-actions">
                    <button
                      type="button"
                      className="primary-btn hero-btn"
                      onClick={() =>
                        openRegistration("student")
                      }
                    >
                      Apply for Mentorship
                      <span aria-hidden="true"> →</span>
                    </button>

                    <button
                      type="button"
                      className="secondary-btn hero-btn"
                      onClick={() =>
                        openRegistration("mentor")
                      }
                    >
                      Become a Mentor
                      <span aria-hidden="true"> →</span>
                    </button>
                  </div>

                  <p className="hero-note">
                    A welcoming place to learn, share,
                    and grow together.
                  </p>
                </div>
              </section>

              <section
                className="connection-impact"
                aria-label="Mentorship connections"
              >
                <div className="connection-impact-copy">
                  <p className="eyebrow">
                    A stronger start, together
                  </p>
                  <h2>
                    Every connection starts with a
                    conversation.
                  </h2>
                </div>

                <div className="connection-stat">
                  <strong>
                    {connectedStudents ?? "—"}
                  </strong>
                  <span>
                    students connected with mentors
                  </span>
                </div>
              </section>
            </>
          )
        ) : (
          // =====================================
          // USER DASHBOARD
          // =====================================
          <section className="dashboard">
            <div className="dashboard-header">
              <div>
                <p className="eyebrow">
                  Welcome back
                </p>
                <h2>{user.name}</h2>
              </div>

              <button
                type="button"
                className="logout-btn"
                onClick={handleLogout}
              >
                Logout
              </button>
            </div>

            <div className="dashboard-hero">
              <div className="hero-copy">
                <span className="eyebrow accent">
                  Mentorship overview
                </span>

                <h3>
                  Support designed for your academic
                  growth.
                </h3>

                <p>
                  Stay connected with mentors, track
                  your outstanding requests, and keep
                  moving toward your academic goals.
                </p>
              </div>

              <div className="hero-badges">
                <span>Learning</span>
                <span>Guidance</span>
                <span>Focus</span>
              </div>
            </div>

            {/* PROFILE STATISTICS */}

            <div className="stats-grid">
              <div className="stat-card">
                <span>Role</span>
                <strong>{user.role}</strong>
              </div>

              <div className="stat-card">
                <span>University</span>
                <strong>
                  {user.university || "Not added"}
                </strong>
              </div>

              <div className="stat-card">
                <span>Department</span>
                <strong>
                  {user.department || "Not added"}
                </strong>
              </div>
            </div>

            {/* MENTORSHIP SUMMARY */}

            <div className="stats-grid summary-grid">
              <div className="stat-card summary-card">
                <span>Total mentors</span>
                <strong>{totalMentors}</strong>
              </div>

              <div className="stat-card summary-card">
                <span>Pending</span>
                <strong>{pendingRequests}</strong>
              </div>

              <div className="stat-card summary-card">
                <span>Approved</span>
                <strong>{approvedRequests}</strong>
              </div>
            </div>

            {/* EDITABLE PROFILE */}

            <div
              className="profile-panel"
              id="profile-section"
            >
              <div className="section-header">
                <h3>
                  {user.role === "mentor"
                    ? "My Mentor Profile"
                    : "Profile"}
                </h3>
              </div>

              <form
                className="profile-form"
                onSubmit={handleProfileUpdate}
              >
                <label>
                  Name
                  <input
                    type="text"
                    name="name"
                    value={profileForm.name}
                    onChange={handleProfileChange}
                    maxLength={100}
                    required
                  />
                </label>

                <div className="two-col">
                  <label>
                    University
                    <input
                      type="text"
                      name="university"
                      value={profileForm.university}
                      onChange={handleProfileChange}
                      maxLength={150}
                    />
                  </label>

                  <label>
                    Department
                    <input
                      type="text"
                      name="department"
                      value={profileForm.department}
                      onChange={handleProfileChange}
                      maxLength={150}
                    />
                  </label>
                </div>

                {/* MENTOR-SPECIFIC FIELDS */}

                {user.role === "mentor" && (
                  <>
                    <label>
                      Areas of Expertise
                      <input
                        type="text"
                        name="expertise"
                        value={profileForm.expertise}
                        onChange={handleProfileChange}
                        placeholder="React, Python, Career Guidance"
                        maxLength={500}
                      />
                    </label>

                    <label>
                      Availability
                      <input
                        type="text"
                        name="availability"
                        value={profileForm.availability}
                        onChange={handleProfileChange}
                        placeholder="Mon and Wed, 4 PM - 6 PM"
                        maxLength={200}
                      />
                    </label>

                    <label>
                      Biography
                      <textarea
                        name="bio"
                        value={profileForm.bio}
                        onChange={handleProfileChange}
                        placeholder="Tell students about your experience and the guidance you offer..."
                        rows={4}
                        maxLength={2000}
                      />
                    </label>
                  </>
                )}

                <button
                  type="submit"
                  className="primary-btn small-btn"
                  disabled={isSavingProfile}
                >
                  {isSavingProfile
                    ? "Saving..."
                    : "Save Profile"}
                </button>
              </form>
            </div>

            {/* DASHBOARD NAVIGATION */}

            <div className="dashboard-panel">
              <h3>Go to</h3>

              <nav
                className="dashboard-actions"
                aria-label="Dashboard sections"
              >
                <a href="#profile-section">
                  Profile
                </a>

                {(user.role === "student" ||
                  user.role === "admin") && (
                  <>
                    <a href="#available-mentors">
                      Browse mentors
                    </a>

                    <a href="#my-requests">
                      My requests
                    </a>
                  </>
                )}

                {(user.role === "mentor" ||
                  user.role === "admin") && (
                  <a href="#incoming-requests">
                    Incoming requests
                  </a>
                )}
              </nav>
            </div>

            {/* AVAILABLE MENTORS */}

            {(user.role === "student" ||
              user.role === "admin") && (
              <div
                className="mentor-section"
                id="available-mentors"
              >
                <div className="section-header">
                  <h3>Available Mentors</h3>
                </div>

                <div className="filter-row">
                  <input
                    type="text"
                    placeholder="Search by name, skill, department"
                    value={searchTerm}
                    onChange={(event) =>
                      setSearchTerm(event.target.value)
                    }
                  />

                  <select
                    value={selectedDepartment}
                    onChange={(event) =>
                      setSelectedDepartment(
                        event.target.value
                      )
                    }
                  >
                    {departments.map((department) => (
                      <option
                        key={department}
                        value={department}
                      >
                        {department}
                      </option>
                    ))}
                  </select>
                </div>

                {mentorsLoading && (
                  <p className="empty-state">
                    Loading mentors...
                  </p>
                )}

                {mentorsError && (
                  <p className="empty-state">
                    {mentorsError}
                  </p>
                )}

                {!mentorsLoading &&
                  !mentorsError &&
                  filteredMentors.length === 0 && (
                    <p className="empty-state">
                      No mentors found.
                    </p>
                  )}

                <div className="mentor-grid">
                  {filteredMentors.map((mentor) => (
                    <article
                      key={mentor.id}
                      className="mentor-card"
                    >
                      <div className="mentor-topline">
                        <span className="mentor-badge">
                          Mentor
                        </span>

                        <span className="mentor-availability">
                          {mentor.availability ||
                            "Not specified"}
                        </span>
                      </div>

                      <h4>{mentor.name}</h4>

                      <p className="mentor-meta">
                        {mentor.department ||
                          "Department not specified"}
                        {" · "}
                        {mentor.university ||
                          "University not specified"}
                      </p>

                      <p className="mentor-expertise">
                        {mentor.expertise ||
                          "Expertise not added yet"}
                      </p>

                      <p className="mentor-bio">
                        {mentor.bio ||
                          "No biography added yet."}
                      </p>

                      <button
                        type="button"
                        className="mentor-button"
                        onClick={() =>
                          handleRequestMentorship(
                            mentor.id
                          )
                        }
                      >
                        Request Mentorship
                      </button>
                    </article>
                  ))}
                </div>
              </div>
            )}

            {/* INCOMING REQUESTS */}

            {(user.role === "mentor" ||
              user.role === "admin") && (
              <div
                className="request-section"
                id="incoming-requests"
              >
                <div className="section-header">
                  <h3>
                    {user.role === "admin"
                      ? "All Mentorship Requests"
                      : "Incoming Requests"}
                  </h3>
                </div>

                {mentorRequests.length === 0 ? (
                  <p className="empty-state">
                    No mentorship requests available.
                  </p>
                ) : (
                  <ul className="request-list">
                    {mentorRequests.map((request) => (
                      <li
                        key={request.id}
                        className="request-item"
                      >
                        <div>
                          <strong>
                            {request.studentName}
                          </strong>

                          <p>
                            {request.studentEmail}
                            {" · "}
                            {request.mentorName}
                          </p>

                          <p>{request.message}</p>
                        </div>

                        <div className="request-actions">
                          <span className="request-status">
                            {request.status}
                          </span>

                          {request.status === "pending" && (
                            <>
                              <button
                                type="button"
                                className="small-action success"
                                onClick={() =>
                                  handleRequestDecision(
                                    request.id,
                                    "approved"
                                  )
                                }
                              >
                                Approve
                              </button>

                              <button
                                type="button"
                                className="small-action danger"
                                onClick={() =>
                                  handleRequestDecision(
                                    request.id,
                                    "rejected"
                                  )
                                }
                              >
                                Reject
                              </button>
                            </>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* STUDENT REQUESTS */}

            {(user.role === "student" ||
              user.role === "admin") && (
              <div
                className="request-section"
                id="my-requests"
              >
                <div className="section-header">
                  <h3>My Mentorship Requests</h3>
                </div>

                {studentRequests.length === 0 ? (
                  <p className="empty-state">
                    No mentorship requests yet.
                  </p>
                ) : (
                  <ul className="request-list">
                    {studentRequests.map((request) => (
                      <li
                        key={request.id}
                        className="request-item"
                      >
                        <div>
                          <strong>
                            {request.mentorName}
                          </strong>

                          <p>{request.message}</p>
                        </div>

                        <div className="request-actions">
                          <span className="request-status">
                            {request.status}
                          </span>

                          {request.status === "pending" && (
                            <button
                              type="button"
                              className="small-action danger"
                              onClick={() =>
                                handleDeleteRequest(
                                  request.id
                                )
                              }
                            >
                              Delete request
                            </button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {authMessage && (
              <div className="status-box dashboard-status">
                {authMessage}
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

export default App;
