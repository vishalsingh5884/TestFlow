import React, { useCallback, useEffect, useMemo, useState } from "react";
import "./StudentDashboard.css";

import MyTests from "./MyTests";
import TestHistory from "./TestHistory";
import Results from "./Results";
import Settings from "./Settings";
import Groups from "./Groups";
import Notifications from "./Notifications";
import PrivateMessages from "./PrivateMessages";

const API_URL = (
  import.meta.env.VITE_API_URL ||
  "/api"
).replace(/\/$/, "");

const STUDENT_TOKEN_KEYS = [
  "studentToken",
  "student_token",
  "token",
  "authToken",
  "accessToken",
];

const getStudentToken = () => {
  for (const key of STUDENT_TOKEN_KEYS) {
    const token = localStorage.getItem(key);
    if (token) return token;
  }

  return "";
};

const getStoredStudent = () => {
  try {
    const possibleKeys = [
      "student",
      "studentUser",
      "student_user",
      "user",
      "currentStudent",
    ];

    for (const key of possibleKeys) {
      const raw = localStorage.getItem(key);

      if (!raw) continue;

      const parsed = JSON.parse(raw);

      if (parsed && typeof parsed === "object") {
        return parsed;
      }
    }
  } catch (error) {
    console.warn("Unable to read stored student:", error);
  }

  return null;
};

const getInitialPage = () => {
  const savedPage = localStorage.getItem("studentDashboardPage");

  const allowedPages = [
    "dashboard",
    "my-tests",
    "test-history",
    "results",
    "groups",
    "notifications",
    "private-messages",
    "settings",
  ];

  return allowedPages.includes(savedPage) ? savedPage : "dashboard";
};

const StudentDashboard = ({ onLogout, onStartTest }) => {
  const [activePage, setActivePage] = useState(getInitialPage);

  const [student, setStudent] = useState(getStoredStudent);
  const [loadingStudent, setLoadingStudent] = useState(true);

  const [joinPaperId, setJoinPaperId] = useState("");
  const [joinLoading, setJoinLoading] = useState(false);
  const [joinMessage, setJoinMessage] = useState("");
  const [joinMessageType, setJoinMessageType] = useState("");

  /*
   * IMPORTANT:
   * This list must contain ONLY tests returned by the protected
   * /api/student/tests endpoint.
   *
   * Do NOT populate this from localStorage because cached tests
   * may belong to another student.
   */
  const [onlineTests, setOnlineTests] = useState([]);

  const [testsLoading, setTestsLoading] = useState(true);

  const studentToken = useMemo(() => getStudentToken(), []);

  const authHeaders = useMemo(() => {
    const headers = {
      "Content-Type": "application/json",
    };

    if (studentToken) {
      headers.Authorization = `Bearer ${studentToken}`;
    }

    return headers;
  }, [studentToken]);

  const loadStudentProfile = useCallback(async () => {
    setLoadingStudent(true);

    try {
      const response = await fetch(`${API_URL}/api/auth/student/me`, {
        method: "GET",
        headers: authHeaders,
      });

      if (!response.ok) {
        throw new Error("Unable to load student profile");
      }

      const data = await response.json();

      const profile =
        data?.student ||
        data?.user ||
        data?.data ||
        data;

      if (profile && typeof profile === "object") {
        setStudent(profile);

        try {
          localStorage.setItem("student", JSON.stringify(profile));
        } catch {
          // Ignore localStorage errors.
        }
      }
    } catch (error) {
      console.warn("Student profile request failed:", error);

      /*
       * Stored profile is safe to use for displaying the student's
       * name/email. It is NOT used to determine test access.
       */
      const storedStudent = getStoredStudent();

      if (storedStudent) {
        setStudent(storedStudent);
      }
    } finally {
      setLoadingStudent(false);
    }
  }, [authHeaders]);

  const loadOnlineTests = useCallback(async () => {
    setTestsLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/student/tests`, {
        method: "GET",
        headers: authHeaders,
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const error = new Error(
          data?.message ||
            data?.error ||
            "Unable to load available tests."
        );

        error.status = response.status;

        throw error;
      }

      const tests = Array.isArray(data)
        ? data
        : data?.tests ||
          data?.data ||
          data?.items ||
          [];

      /*
       * The backend is the source of truth.
       *
       * Do not merge this with localStorage.
       * Do not fall back to cached tests.
       */
      setOnlineTests(Array.isArray(tests) ? tests : []);
    } catch (error) {
      console.warn("Unable to load online tests:", error);

      /*
       * SECURITY IMPORTANT:
       *
       * Never use:
       *
       * localStorage.getItem("online_class_tests")
       *
       * as a fallback here.
       *
       * That data is not guaranteed to have been filtered by
       * StudentID and could expose another student's tests.
       */
      setOnlineTests([]);
    } finally {
      setTestsLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => {
    loadStudentProfile();
    loadOnlineTests();
  }, [loadStudentProfile, loadOnlineTests]);

  useEffect(() => {
    localStorage.setItem("studentDashboardPage", activePage);
  }, [activePage]);

  const navigate = useCallback((page) => {
    setActivePage(page);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }, []);

  const handleLogout = async () => {
    try {
      await fetch(`${API_URL}/api/auth/student/logout`, {
        method: "POST",
        headers: authHeaders,
      });
    } catch (error) {
      console.warn("Logout API request failed:", error);
    }

    if (typeof onLogout === "function") {
      onLogout();
    } else {
      STUDENT_TOKEN_KEYS.forEach((key) => {
        localStorage.removeItem(key);
      });

      localStorage.clear();
      window.location.reload();
    }
  };

  const handleJoinTest = async (event) => {
    event.preventDefault();

    const paperId = joinPaperId.trim();

    if (!paperId) {
      setJoinMessageType("error");
      setJoinMessage("Please enter a Paper ID.");
      return;
    }

    if (!/^\d{6}$/.test(paperId)) {
      setJoinMessageType("error");
      setJoinMessage("Paper ID must contain exactly 6 digits.");
      return;
    }

    setJoinLoading(true);
    setJoinMessage("");
    setJoinMessageType("");

    try {
      /*
       * IMPORTANT:
       *
       * This endpoint is protected by the backend.
       * The server must verify whether the logged-in student's
       * StudentID is allowed to access this paper.
       */
      const response = await fetch(
        `${API_URL}/api/student/tests/${encodeURIComponent(paperId)}`,
        {
          method: "GET",
          headers: authHeaders,
        }
      );

      const data = await response.json().catch(() => ({}));

      /*
       * Explicitly handle authorization failure.
       *
       * HTTP 403 means:
       * - Paper exists
       * - Student is authenticated
       * - Student is NOT assigned/allowed to access it
       */
      if (response.status === 403) {
        throw new Error(
          data?.message ||
            "You are not assigned to this test."
        );
      }

      if (response.status === 401) {
        throw new Error(
          data?.message ||
            "Your student session has expired. Please log in again."
        );
      }

      if (response.status === 404) {
        throw new Error(
          data?.message ||
            "Test not found. Please check the Paper ID."
        );
      }

      if (!response.ok) {
        throw new Error(
          data?.message ||
            data?.error ||
            "Unable to access this test."
        );
      }

      const foundTest =
        data?.test ||
        data?.data ||
        data;

      if (!foundTest || typeof foundTest !== "object") {
        throw new Error(
          "The test response was invalid."
        );
      }

      setJoinMessageType("success");

      setJoinMessage(
        data?.message ||
          "Test found successfully. Starting test..."
      );

      /*
       * Only launch the test after the protected server endpoint
       * has successfully returned the test.
       */
      setTimeout(() => {
        if (typeof onStartTest === "function") {
          onStartTest(foundTest);
        } else {
          window.location.href =
            `/test/${encodeURIComponent(paperId)}`;
        }
      }, 600);
    } catch (error) {
      setJoinMessageType("error");

      setJoinMessage(
        error?.message ||
          "Unable to find the test right now."
      );
    } finally {
      setJoinLoading(false);
    }
  };

  const displayName =
    student?.name ||
    student?.fullName ||
    student?.studentName ||
    student?.username ||
    "Student";

  const firstName =
    displayName.split(" ")[0] ||
    "Student";

  const email =
    student?.email ||
    student?.emailAddress ||
    "Student account";

  const initials =
    displayName
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((word) =>
        word.charAt(0).toUpperCase()
      )
      .join("") || "S";

  const navItems = [
    {
      id: "dashboard",
      icon: "�",
      label: "Dashboard",
    },
    {
      id: "my-tests",
      icon: "?",
      label: "My Tests",
    },
    {
      id: "test-history",
      icon: "?",
      label: "Test History",
    },
    {
      id: "results",
      icon: "?",
      label: "Results",
    },
    {
      id: "groups",
      icon: "??",
      label: "Groups",
    },
    {
      id: "notifications",
      icon: "??",
      label: "Notifications",
    },
    {
      id: "private-messages",
      icon: "?",
      label: "Private Messages",
    },
    {
      id: "settings",
      icon: "?",
      label: "Settings",
    },
  ];

  /*
   * This number is based ONLY on the tests returned by the
   * StudentID-filtered backend endpoint.
   */
  const availableTests = testsLoading
    ? "�"
    : onlineTests.length;

  const renderDashboard = () => (
    <>
      <section className="student-hero">
        <div className="hero-copy">
          <div className="hero-eyebrow">
            <span className="eyebrow-dot" />
            STUDENT PORTAL
          </div>

          <h1>
            Welcome back, <span>{firstName}</span>
          </h1>

          <p>
            Stay on top of your tests, track your progress, and keep improving your performance.
          </p>

          <div className="hero-actions">
            <button
              type="button"
              className="primary-btn"
              onClick={() => navigate("my-tests")}
            >
              <span>View My Tests</span>
              <span className="btn-arrow">?</span>
            </button>

            <button
              type="button"
              className="secondary-btn"
              onClick={() => navigate("test-history")}
            >
              Test History
            </button>
          </div>
        </div>

        <div className="hero-visual">
          <div className="hero-circle hero-circle-one" />
          <div className="hero-circle hero-circle-two" />

          <div className="hero-card-floating">
            <div className="floating-icon">?</div>

            <div>
              <strong>Keep learning</strong>
              <span>Your progress matters</span>
            </div>
          </div>

          <div className="hero-big-icon">?</div>
        </div>
      </section>

      <section className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon orange-icon">?</div>

          <div className="stat-content">
            <span className="stat-label">
              Available Tests
            </span>

            <strong>{availableTests}</strong>

            <small>Ready to attempt</small>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon pink-icon">?</div>

          <div className="stat-content">
            <span className="stat-label">
              Tests Completed
            </span>

            <strong>0</strong>

            <small>Keep going</small>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon purple-icon">%</div>

          <div className="stat-content">
            <span className="stat-label">
              Average Score
            </span>

            <strong>�</strong>

            <small>No attempts yet</small>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon green-icon">?</div>

          <div className="stat-content">
            <span className="stat-label">
              Best Score
            </span>

            <strong>�</strong>

            <small>Your highest score</small>
          </div>
        </div>
      </section>

      <section className="dashboard-grid">
        <div className="join-card">
          <div className="section-heading">
            <div className="section-icon orange-gradient">
              +
            </div>

            <div>
              <h2>Join a Test</h2>

              <p>
                Enter the 6-digit Paper ID provided by your teacher.
              </p>
            </div>
          </div>

          <form
            onSubmit={handleJoinTest}
            className="join-form"
          >
            <div className="input-wrapper">
              <span className="input-icon">#</span>

              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="Enter 6-digit Paper ID"
                value={joinPaperId}
                onChange={(event) => {
                  const value = event.target.value
                    .replace(/\D/g, "")
                    .slice(0, 6);

                  setJoinPaperId(value);
                  setJoinMessage("");
                  setJoinMessageType("");
                }}
              />

              <span className="input-counter">
                {joinPaperId.length}/6
              </span>
            </div>

            <button
              type="submit"
              className="join-btn"
              disabled={joinLoading}
            >
              {joinLoading
                ? "Checking..."
                : "Start Test"}

              {!joinLoading && (
                <span>?</span>
              )}
            </button>
          </form>

          {joinMessage && (
            <div
              className={`join-message ${
                joinMessageType === "success"
                  ? "message-success"
                  : "message-error"
              }`}
            >
              <span>
                {joinMessageType === "success"
                  ? "?"
                  : "!"}
              </span>

              {joinMessage}
            </div>
          )}

          <div className="join-note">
            <span>?</span>

            Paper IDs are provided by your teacher or administrator.
          </div>
        </div>

        <div className="quick-card">
          <div className="quick-card-header">
            <div>
              <span className="mini-label">
                QUICK ACCESS
              </span>

              <h2>Continue Learning</h2>
            </div>

            <div className="quick-star">?</div>
          </div>

          <div className="quick-list">
            <button
              type="button"
              onClick={() => navigate("my-tests")}
              className="quick-item"
            >
              <span className="quick-item-icon orange-soft">
                ?
              </span>

              <span className="quick-item-text">
                <strong>My Tests</strong>

                <small>
                  View available tests
                </small>
              </span>

              <span className="quick-arrow">
                ?
              </span>
            </button>

            <button
              type="button"
              onClick={() => navigate("test-history")}
              className="quick-item"
            >
              <span className="quick-item-icon pink-soft">
                ?
              </span>

              <span className="quick-item-text">
                <strong>Test History</strong>

                <small>
                  Review previous attempts
                </small>
              </span>

              <span className="quick-arrow">
                ?
              </span>
            </button>

            <button
              type="button"
              onClick={() => navigate("results")}
              className="quick-item"
            >
              <span className="quick-item-icon purple-soft">
                ?
              </span>

              <span className="quick-item-text">
                <strong>Results</strong>

                <small>
                  Check your performance
                </small>
              </span>

              <span className="quick-arrow">
                ?
              </span>
            </button>
          </div>
        </div>
      </section>

      <section className="how-section">
        <div className="how-heading">
          <span className="mini-label">
            SIMPLE PROCESS
          </span>

          <h2>How it works</h2>

          <p>
            Take your test in just a few simple steps.
          </p>
        </div>

        <div className="steps-grid">
          <div className="step-card">
            <div className="step-number">01</div>

            <div className="step-icon">#</div>

            <h3>Get Paper ID</h3>

            <p>
              Get the 6-digit test Paper ID from your teacher.
            </p>
          </div>

          <div className="step-connector" />

          <div className="step-card">
            <div className="step-number">02</div>

            <div className="step-icon">?</div>

            <h3>Join the Test</h3>

            <p>
              Enter the Paper ID and open your assigned test.
            </p>
          </div>

          <div className="step-connector" />

          <div className="step-card">
            <div className="step-number">03</div>

            <div className="step-icon">?</div>

            <h3>Submit & Review</h3>

            <p>
              Complete the test and check your results afterward.
            </p>
          </div>
        </div>
      </section>

      <section className="info-grid">
        <div className="info-card info-orange">
          <div className="info-icon">?</div>

          <div>
            <h3>Stay Consistent</h3>

            <p>
              Regular practice helps you build confidence and improve your scores.
            </p>
          </div>
        </div>

        <div className="info-card info-pink">
          <div className="info-icon">?</div>

          <div>
            <h3>Focus on Progress</h3>

            <p>
              Use your results and history to understand where you can improve.
            </p>
          </div>
        </div>
      </section>
    </>
  );

  const renderContent = () => {
    if (activePage === "my-tests") {
      return (
        <MyTests
          onStartTest={onStartTest}
          onBackToDashboard={() =>
            navigate("dashboard")
          }
        />
      );
    }

    if (activePage === "test-history") {
      return (
        <TestHistory
          onNavigate={navigate}
        />
      );
    }

    if (activePage === "results") {
      return (
        <Results
          onNavigate={navigate}
        />
      );
    }

    if (activePage === "groups") {
      return <Groups role="student" />;
    }

    if (activePage === "notifications") {
      return <Notifications />;
    }

    if (activePage === "private-messages") {
      return <PrivateMessages />;
    }

    if (activePage === "settings") {
      return (
        <Settings
          student={student}
          onNavigate={navigate}
        />
      );
    }

    return renderDashboard();
  };

  return (
    <div className="student-dashboard">
      <div className="student-bg-decoration decoration-one" />
      <div className="student-bg-decoration decoration-two" />
      <div className="student-bg-decoration decoration-three" />

      <aside className="student-sidebar">
        <div className="brand">
          <div className="brand-mark">
            <span>TF</span>
          </div>

          <div className="brand-copy">
            <strong>TESTFLOW</strong>
            <span>Student Portal</span>
          </div>
        </div>

        <div className="sidebar-divider" />

        <nav className="student-nav">
          <span className="nav-label">
            MENU
          </span>

          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`nav-item ${
                activePage === item.id
                  ? "active"
                  : ""
              }`}
              onClick={() =>
                navigate(item.id)
              }
            >
              <span className="nav-icon">
                {item.icon}
              </span>

              <span>{item.label}</span>

              {activePage === item.id && (
                <span className="active-indicator" />
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-tip">
            <div className="tip-icon">?</div>

            <div>
              <strong>
                Keep learning!
              </strong>

              <p>
                Every test is a step forward.
              </p>
            </div>
          </div>

          <button
            type="button"
            className="logout-btn"
            onClick={handleLogout}
          >
            <span>?</span>
            <span>Logout</span>
          </button>
        </div>
      </aside>

      <main className="student-main">
        <header className="student-topbar">
          <div className="topbar-left">
            <div className="mobile-brand">
              <div className="brand-mark small-mark">
                TF
              </div>

              <strong>TESTFLOW</strong>
            </div>

            <div className="breadcrumb">
              <span>Student</span>

              <span className="breadcrumb-arrow">
                /
              </span>

              <strong>
                {navItems.find(
                  (item) =>
                    item.id === activePage
                )?.label ||
                  "Dashboard"}
              </strong>
            </div>
          </div>

          <div className="topbar-right">
            <button
              type="button"
              className="notification-btn"
              aria-label="Notifications"
              onClick={() => navigate("notifications")}
            >
              ?

              <span className="notification-dot" />
            </button>

            <div className="topbar-profile">
              <div className="avatar">
                {loadingStudent
                  ? "..."
                  : initials}
              </div>

              <div className="profile-text">
                <strong>
                  {displayName}
                </strong>

                <span>{email}</span>
              </div>

              <span className="profile-chevron">
                ?
              </span>
            </div>
          </div>
        </header>

        <div className="student-content">
          {renderContent()}
        </div>

        <footer className="student-footer">
          <span>
            � {new Date().getFullYear()} TESTFLOW
          </span>

          <span className="footer-dot">
            �
          </span>

          <span>
            Built for better learning
          </span>
        </footer>
      </main>
    </div>
  );
};

export default StudentDashboard;
