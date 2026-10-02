import { useEffect, useState } from "react";
import "./StudentDashboard.css";

import MyTests from "./MyTests.jsx";
import TestHistory from "./TestHistory.jsx";
import Results from "./Results.jsx";
import Settings from "./Settings.jsx";

const API_URL =
  import.meta.env.VITE_API_URL || "https://testflow-pkbi.onrender.com";

const TEST_STORAGE_KEY = "online_class_tests";

function StudentDashboard({ onLogout, onStartTest }) {
  const [student, setStudent] = useState(null);
  const [paperId, setPaperId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [studentPage, setStudentPage] = useState("dashboard");
  const [selectedResult, setSelectedResult] = useState(null);

  const getToken = () =>
    localStorage.getItem("student_token") ||
    sessionStorage.getItem("student_token") ||
    localStorage.getItem("access_token") ||
    sessionStorage.getItem("access_token") ||
    "";

  useEffect(() => {
    loadStudent();
  }, []);

  const loadStudent = async () => {
    const token = getToken();

    if (!token) return;

    try {
      const response = await fetch(`${API_URL}/api/auth/student/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      let data = {};

      try {
        data = await response.json();
      } catch {
        // Safe fallback for non-JSON responses
      }

      if (response.ok && data.user) {
        setStudent(data.user);
      }
    } catch (err) {
      console.error("Student profile error:", err);
    }
  };

  const findLocalTest = (id) => {
    try {
      const tests = JSON.parse(
        localStorage.getItem(TEST_STORAGE_KEY) || "[]"
      );

      if (!Array.isArray(tests)) return null;

      return (
        tests.find(
          (test) =>
            String(test?.paperId).trim() === String(id).trim()
        ) || null
      );
    } catch (err) {
      console.error("Local test storage error:", err);
      return null;
    }
  };

  const openTest = (test) => {
    if (!test) {
      setError("Unable to open this examination.");
      return;
    }

    localStorage.setItem("active_test", JSON.stringify(test));

    if (onStartTest) {
      onStartTest(test);
    }
  };

  const handleJoinTest = async (event) => {
    event.preventDefault();

    const id = paperId.trim();

    if (!id) {
      return setError("Please enter a Paper ID.");
    }

    if (!/^\d{6}$/.test(id)) {
      return setError("Paper ID must be a 6-digit number.");
    }

    setLoading(true);
    setError("");

    const token = getToken();

    try {
      const response = await fetch(`${API_URL}/api/student/tests/${id}`, {
        headers: token
          ? {
              Authorization: `Bearer ${token}`,
            }
          : {},
      });

      let data = {};

      try {
        data = await response.json();
      } catch {
        // Safe fallback if server returns non-JSON error
      }

      if (response.ok && data.test) {
        openTest(data.test);
        return;
      }

      if (response.status !== 404) {
        setError(data.message || "Unable to load this test.");
        return;
      }
    } catch (err) {
      console.warn(
        "Backend test lookup failed; checking local storage."
      );
    } finally {
      setLoading(false);
    }

    const localTest = findLocalTest(id);

    if (!localTest) {
      return setError(
        "Invalid Paper ID. Please check the ID and try again."
      );
    }

    if (
      localTest.status &&
      localTest.status !== "published"
    ) {
      return setError("This test has not been published yet.");
    }

    openTest(localTest);
  };

  const handleLogout = async () => {
    const token = getToken();

    try {
      if (token) {
        await fetch(`${API_URL}/api/auth/student/logout`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      }
    } catch (err) {
      console.error("Logout error:", err);
    }

    [
      "student_token",
      "access_token",
      "user_type",
      "active_test",
    ].forEach((key) => {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    });

    if (onLogout) {
      onLogout();
    }
  };

  const navigateStudentPage = (page) => {
    const normalized = String(page || "dashboard").toLowerCase();

    if (["dashboard"].includes(normalized)) {
      setStudentPage("dashboard");
    } else if (
      ["my-tests", "mytests", "my tests"].includes(normalized)
    ) {
      setStudentPage("my-tests");
    } else if (
      [
        "test-history",
        "testhistory",
        "history",
        "test history",
      ].includes(normalized)
    ) {
      setStudentPage("test-history");
    } else if (
      ["results", "result"].includes(normalized)
    ) {
      setStudentPage("results");
    } else if (
      ["settings", "setting"].includes(normalized)
    ) {
      setStudentPage("settings");
    } else {
      setStudentPage("dashboard");
    }
  };

  const handleViewResult = (result) => {
    setSelectedResult(result || null);
    setStudentPage("results");
  };

  const handleReviewTest = (result) => {
    const candidate =
      result?.test ||
      result?.paper ||
      result?.exam ||
      null;

    if (candidate && onStartTest) {
      return onStartTest(candidate);
    }

    const id =
      result?.paperId ||
      result?.paperID ||
      result?.test?.paperId ||
      result?.paper?.paperId;

    if (!id || !onStartTest) return;

    const found = findLocalTest(id);

    if (found) {
      onStartTest(found);
    }
  };

  const displayName =
    student?.name ||
    localStorage.getItem("student_name") ||
    "Student";

  const firstName = displayName.split(" ")[0];

  const initials = firstName
    .charAt(0)
    .toUpperCase();

  const nav = [
    ["dashboard", "⌂", "Dashboard"],
    ["my-tests", "📋", "My Tests"],
    ["test-history", "🕒", "Test History"],
    ["results", "📊", "Results"],
    ["settings", "⚙", "Settings"],
  ];

  return (
    <div className="student-dashboard">
      <div className="student-bg">
        <div className="bg-orb orb-one" />
        <div className="bg-orb orb-two" />
        <div className="bg-grid" />
      </div>

      {/* =====================================================
          SIDEBAR
      ====================================================== */}

      <aside className="student-sidebar">
        <div className="sidebar-brand">
          <div className="brand-icon">T</div>

          <div>
            <div className="brand-name">
              TEST<span>FLOW</span>
            </div>

            <div className="brand-caption">
              Student Portal
            </div>
          </div>
        </div>

        <nav className="student-nav">
          {nav.map(([page, icon, label]) => (
            <button
              key={page}
              className={`nav-item ${
                studentPage === page ? "active" : ""
              }`}
              type="button"
              onClick={() => navigateStudentPage(page)}
            >
              <span className="nav-icon">{icon}</span>
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="help-card">
            <div className="help-icon">?</div>

            <div>
              <strong>Need help?</strong>
              <p>Contact your administrator</p>
            </div>
          </div>

          <button
            className="logout-button"
            onClick={handleLogout}
            type="button"
          >
            <span>↪</span>
            Logout
          </button>
        </div>
      </aside>

      {/* =====================================================
          MAIN
      ====================================================== */}

      <main className="student-main">
        <header className="student-topbar">
          <div className="mobile-brand">
            <div className="brand-icon">T</div>

            <div className="brand-name">
              TEST<span>FLOW</span>
            </div>
          </div>

          <div className="topbar-right">
            <button
              className="notification-button"
              type="button"
              aria-label="Notifications"
            >
              <span>🔔</span>
              <i />
            </button>

            <div
              className="profile"
              role="button"
              tabIndex={0}
              onClick={() =>
                navigateStudentPage("settings")
              }
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" ||
                  event.key === " "
                ) {
                  event.preventDefault();
                  navigateStudentPage("settings");
                }
              }}
              aria-label="Open Settings"
            >
              <div className="profile-avatar">
                {initials}
              </div>

              <div className="profile-info">
                <strong>{displayName}</strong>
                <span>Student</span>
              </div>

              <span className="profile-arrow">▾</span>
            </div>
          </div>
        </header>

        <div className="dashboard-content">
          {studentPage === "settings" && (
            <Settings
              onBackToDashboard={() =>
                navigateStudentPage("dashboard")
              }
            />
          )}

          {studentPage === "my-tests" && (
            <MyTests
              onStartTest={onStartTest}
              onBackToDashboard={() =>
                navigateStudentPage("dashboard")
              }
            />
          )}

          {studentPage === "test-history" && (
            <TestHistory
              onNavigate={navigateStudentPage}
              onViewResult={handleViewResult}
            />
          )}

          {studentPage === "results" && (
            <Results
              result={selectedResult}
              onBackToDashboard={() =>
                navigateStudentPage("dashboard")
              }
              onReviewTest={handleReviewTest}
            />
          )}

          {studentPage === "dashboard" && (
            <>
              <section className="welcome-section">
                <div className="welcome-content">
                  <div className="welcome-label">
                    STUDENT DASHBOARD
                  </div>

                  <h1>
                    Welcome back,
                    <span> {firstName}!</span>
                  </h1>

                  <p>
                    Ready to challenge yourself? Enter your
                    Paper ID to start an examination.
                  </p>
                </div>

                <div className="welcome-decoration">
                  <div className="floating-card card-one">
                    <span>✓</span>
                    Secure
                  </div>

                  <div className="floating-card card-two">
                    <span>AI</span>
                    Powered
                  </div>

                  <div className="hero-circle">
                    <span>TF</span>
                  </div>
                </div>
              </section>

              <section className="stats-grid">
                <div className="stat-card">
                  <div className="stat-icon blue">
                    📋
                  </div>

                  <div>
                    <span className="stat-label">
                      AVAILABLE TESTS
                    </span>

                    <strong>1</strong>

                    <small>
                      Ready to attempt
                    </small>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-icon purple">
                    🕒
                  </div>

                  <div>
                    <span className="stat-label">
                      TESTS COMPLETED
                    </span>

                    <strong>0</strong>

                    <small>
                      Keep going
                    </small>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-icon green">
                    %
                  </div>

                  <div>
                    <span className="stat-label">
                      AVERAGE SCORE
                    </span>

                    <strong>—</strong>

                    <small>
                      No results yet
                    </small>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-icon orange">
                    ★
                  </div>

                  <div>
                    <span className="stat-label">
                      BEST SCORE
                    </span>

                    <strong>—</strong>

                    <small>
                      Complete a test
                    </small>
                  </div>
                </div>
              </section>

              <section className="main-grid">
                <div className="join-test-card">
                  <div className="section-heading">
                    <div className="section-icon">
                      ↗
                    </div>

                    <div>
                      <h2>
                        Join an Examination
                      </h2>

                      <p>
                        Enter the Paper ID provided by your
                        administrator.
                      </p>
                    </div>
                  </div>

                  <form
                    className="join-form"
                    onSubmit={handleJoinTest}
                  >
                    <label htmlFor="paper-id">
                      Paper ID
                    </label>

                    <div className="paper-input">
                      <span className="input-symbol">
                        #
                      </span>

                      <input
                        id="paper-id"
                        type="text"
                        inputMode="numeric"
                        value={paperId}
                        onChange={(e) => {
                          setPaperId(
                            e.target.value.replace(
                              /\D/g,
                              ""
                            )
                          );
                          setError("");
                        }}
                        placeholder="e.g. 887155"
                        maxLength={6}
                        autoComplete="off"
                      />
                    </div>

                    {error && (
                      <div className="error-message">
                        <span>!</span>
                        {error}
                      </div>
                    )}

                    <button
                      className="start-button"
                      type="submit"
                      disabled={loading}
                    >
                      {loading
                        ? "Opening Test..."
                        : "Continue to Test"}

                      <span>→</span>
                    </button>
                  </form>

                  <div className="security-note">
                    <span>✓</span>

                    <div>
                      <strong>
                        Your answers are protected
                      </strong>

                      <p>
                        Correct answers and solutions are
                        never sent to your browser.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="how-card">
                  <div className="how-header">
                    <div>
                      <span className="mini-label">
                        QUICK GUIDE
                      </span>

                      <h2>
                        How it works
                      </h2>
                    </div>

                    <div className="guide-icon">
                      ✧
                    </div>
                  </div>

                  <div className="steps">
                    <div className="step">
                      <div className="step-number">
                        01
                      </div>

                      <div>
                        <strong>
                          Get your Paper ID
                        </strong>

                        <p>
                          Your administrator will provide a
                          unique ID.
                        </p>
                      </div>
                    </div>

                    <div className="step-line" />

                    <div className="step">
                      <div className="step-number">
                        02
                      </div>

                      <div>
                        <strong>
                          Enter the Paper ID
                        </strong>

                        <p>
                          Enter it above to load your
                          examination.
                        </p>
                      </div>
                    </div>

                    <div className="step-line" />

                    <div className="step">
                      <div className="step-number">
                        03
                      </div>

                      <div>
                        <strong>
                          Complete your test
                        </strong>

                        <p>
                          Answer each question and submit
                          when finished.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <section className="info-grid">
                <div className="info-card">
                  <div className="info-card-icon">
                    ◈
                  </div>

                  <div>
                    <strong>
                      AI-Powered Tests
                    </strong>

                    <p>
                      Questions are generated using
                      intelligent AI technology and configured
                      by your administrator.
                    </p>
                  </div>
                </div>

                <div className="info-card">
                  <div className="info-card-icon">
                    ◉
                  </div>

                  <div>
                    <strong>
                      Secure Examination
                    </strong>

                    <p>
                      Your examination data and answers are
                      securely processed by the test system.
                    </p>
                  </div>
                </div>

                <div className="info-card">
                  <div className="info-card-icon">
                    ✓
                  </div>

                  <div>
                    <strong>
                      Instant Results
                    </strong>

                    <p>
                      Once submitted, your score can be
                      calculated automatically.
                    </p>
                  </div>
                </div>
              </section>

              <footer className="student-footer">
                <span>TESTFLOW</span>

                <span>
                  Secure Online Examination Platform
                </span>

                <span>
                  © 2026
                </span>
              </footer>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

export default StudentDashboard;

