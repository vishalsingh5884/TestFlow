import React, { useEffect, useMemo, useState } from "react";
import "./TestHistory.css";

/*
=========================================================
LOCAL TESTFLOW BACKEND
=========================================================
*/
const API_BASE = (
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

function getStoredToken() {
  for (const key of STUDENT_TOKEN_KEYS) {
    const localValue = localStorage.getItem(key);
    if (localValue) return localValue;

    const sessionValue = sessionStorage.getItem(key);
    if (sessionValue) return sessionValue;
  }

  return "";
}

/* =========================================================
   DATE
========================================================= */

function formatDate(value) {
  if (!value) {
    return "�";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "�";
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/* =========================================================
   TIME
========================================================= */

function formatTime(value) {
  if (!value) {
    return "�";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "�";
  }

  return date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/* =========================================================
   DURATION
========================================================= */

function formatDuration(start, end) {
  if (!start || !end) {
    return "�";
  }

  const startTime = new Date(start).getTime();
  const endTime = new Date(end).getTime();

  if (
    Number.isNaN(startTime) ||
    Number.isNaN(endTime) ||
    endTime < startTime
  ) {
    return "�";
  }

  const totalMinutes = Math.round((endTime - startTime) / 60000);

  if (totalMinutes < 1) {
    return "< 1 min";
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes} min`;
}

/* =========================================================
   STATUS
========================================================= */

function normalizeStatus(status) {
  const value = String(status || "")
    .trim()
    .toUpperCase();

  if (
    value === "SUBMITTED" ||
    value === "COMPLETED" ||
    value === "COMPLETED_SUCCESSFULLY"
  ) {
    return "COMPLETED";
  }

  if (value === "FLAGGED" || value === "TERMINATED") {
    return "TERMINATED";
  }

  if (
    value === "IN_PROGRESS" ||
    value === "IN PROGRESS" ||
    value === "STARTED"
  ) {
    return "IN PROGRESS";
  }

  return value || "UNKNOWN";
}

function getStatusClass(status) {
  const normalized = normalizeStatus(status);

  if (normalized === "COMPLETED") {
    return "completed";
  }

  if (normalized === "TERMINATED") {
    return "terminated";
  }

  if (normalized === "IN PROGRESS") {
    return "in-progress";
  }

  return "unknown";
}

function getStatusIcon(status) {
  const normalized = normalizeStatus(status);

  if (normalized === "COMPLETED") {
    return "?";
  }

  if (normalized === "TERMINATED") {
    return "!";
  }

  return "�";
}

/* =========================================================
   HISTORY RESPONSE NORMALIZER
========================================================= */

function normalizeHistoryPayload(payload) {
  if (!payload) {
    return [];
  }

  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload.attempts)) {
    return payload.attempts;
  }

  if (Array.isArray(payload.history)) {
    return payload.history;
  }

  if (Array.isArray(payload.testHistory)) {
    return payload.testHistory;
  }

  if (Array.isArray(payload.data)) {
    return payload.data;
  }

  if (Array.isArray(payload.data?.attempts)) {
    return payload.data.attempts;
  }

  if (Array.isArray(payload.data?.history)) {
    return payload.data.history;
  }

  if (Array.isArray(payload.data?.testHistory)) {
    return payload.data.testHistory;
  }

  return [];
}

/* =========================================================
   NORMALIZE ONE ATTEMPT
========================================================= */

function normalizeAttempt(item) {
  const status = normalizeStatus(item?.status);

  const endDate =
    item?.submittedAt ||
    item?.terminatedAt ||
    item?.completedAt ||
    item?.endedAt ||
    null;

  const totalQuestions =
    Number(
      item?.totalQuestions ??
        item?.questionsCount ??
        item?.total ??
        item?.totalMarks ??
        0
    ) || 0;

  let obtainedMarks = null;

  if (item?.obtainedMarks !== undefined && item?.obtainedMarks !== null) {
    obtainedMarks = Number(item.obtainedMarks);
  } else if (
    item?.marksObtained !== undefined &&
    item?.marksObtained !== null
  ) {
    obtainedMarks = Number(item.marksObtained);
  } else if (item?.earnedMarks !== undefined && item?.earnedMarks !== null) {
    obtainedMarks = Number(item.earnedMarks);
  } else if (item?.marks !== undefined && item?.marks !== null) {
    obtainedMarks = Number(item.marks);
  } else if (item?.correct !== undefined && item?.correct !== null) {
    obtainedMarks = Number(item.correct);
  } else if (
    item?.correctAnswers !== undefined &&
    item?.correctAnswers !== null
  ) {
    obtainedMarks = Number(item.correctAnswers);
  } else if (
    item?.score !== undefined &&
    item?.score !== null &&
    totalQuestions > 0
  ) {
    const scoreNumber = Number(item.score);

    if (!Number.isNaN(scoreNumber) && scoreNumber >= 0 && scoreNumber <= 100) {
      obtainedMarks = Math.round((scoreNumber / 100) * totalQuestions);
    }
  }

  if (obtainedMarks !== null && Number.isNaN(obtainedMarks)) {
    obtainedMarks = null;
  }

  let percentage = null;

  if (item?.percentage !== undefined && item?.percentage !== null) {
    percentage = Number(item.percentage);
  } else if (item?.percent !== undefined && item?.percent !== null) {
    percentage = Number(item.percent);
  } else if (item?.score !== undefined && item?.score !== null) {
    percentage = Number(item.score);
  } else if (obtainedMarks !== null && totalQuestions > 0) {
    percentage = (obtainedMarks / totalQuestions) * 100;
  }

  if (percentage !== null && Number.isNaN(percentage)) {
    percentage = null;
  }

  const startedAt =
    item?.startedAt ||
    item?.startTime ||
    item?.createdAt ||
    null;

  const violation =
    item?.violation?.message ||
    item?.violation?.type ||
    item?.violationMessage ||
    item?.terminationReason ||
    item?.reason ||
    null;

  return {
    attemptId:
      item?.attemptId ||
      item?.id ||
      `${item?.paperId || "test"}-${startedAt || Date.now()}`,

    paperId:
      item?.paperId ||
      item?.paperID ||
      item?.testId ||
      "�",

    subject:
      item?.subject ||
      item?.testName ||
      item?.name ||
      item?.title ||
      "Online Examination",

    totalQuestions,

    obtainedMarks,

    percentage,

    startedAt,

    endedAt: endDate,

    status,

    violation,
  };
}

/* =========================================================
   MAIN COMPONENT
========================================================= */

export default function TestHistory({ onNavigate, onViewResult }) {
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  /* =======================================================
     LOAD HISTORY
  ======================================================= */

  const loadHistory = async () => {
    setLoading(true);
    setError("");

    try {
      const token = getStoredToken();

      if (!token) {
        throw new Error(
          "Your student session has expired. Please log in again."
        );
      }

      const response = await fetch(
        `${API_BASE}/api/student/test-history`,
        {
          method: "GET",
          cache: "no-store",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      let payload = {};
      try {
        payload = await response.json();
      } catch {
        payload = {};
      }

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(
            "Test History API route was not found on the local backend. Restart server.js on /api."
          );
        }

        if (response.status === 401 || response.status === 403) {
          throw new Error(
            "Your student session is no longer valid. Please log in again."
          );
        }

        throw new Error(
          payload?.message ||
            `Server returned status ${response.status}: Unable to load test history.`
        );
      }

      if (payload?.success === false) {
        throw new Error(
          payload?.message || "Unable to load your test history."
        );
      }

      const history = normalizeHistoryPayload(payload)
        .map(normalizeAttempt)
        .sort((a, b) => {
          const aTime = a.startedAt
            ? new Date(a.startedAt).getTime()
            : 0;
          const bTime = b.startedAt
            ? new Date(b.startedAt).getTime()
            : 0;

          return bTime - aTime;
        });

      setAttempts(history);
    } catch (requestError) {
      console.error("Test history error:", requestError);
      setAttempts([]);
      setError(
        requestError?.message || "Unable to load your test history."
      );
    } finally {
      setLoading(false);
    }
  };

  /* =======================================================
     INITIAL LOAD
  ======================================================= */

  useEffect(() => {
    loadHistory();
  }, []);

  /* =======================================================
     SEARCH + FILTER
  ======================================================= */

  const filteredAttempts = useMemo(() => {
    const query = search.trim().toLowerCase();

    return attempts.filter((item) => {
      const normalizedStatus = normalizeStatus(item.status);

      const matchesStatus =
        statusFilter === "ALL" ||
        normalizedStatus === statusFilter;

      const matchesSearch =
        !query ||
        String(item.subject)
          .toLowerCase()
          .includes(query) ||
        String(item.paperId)
          .toLowerCase()
          .includes(query) ||
        String(item.attemptId)
          .toLowerCase()
          .includes(query);

      return matchesStatus && matchesSearch;
    });
  }, [attempts, search, statusFilter]);

  /* =======================================================
     NAVIGATION
  ======================================================= */

  function handleNavigation(page) {
    if (typeof onNavigate === "function") {
      onNavigate(page);
    }
  }

  /* =======================================================
     VIEW RESULT
  ======================================================= */

  function handleResult(item) {
    if (typeof onViewResult === "function") {
      onViewResult(item);
      return;
    }

    if (typeof onNavigate === "function") {
      onNavigate("results");
    }
  }

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div className="history-page">
      <div className="history-background" />

      <main className="history-main">
        {/* HEADER */}
        <header className="history-header">
          <div className="history-title-area">
            <div className="history-eyebrow">STUDENT PORTAL</div>
            <h1>Test History</h1>
            <p>View your previous examinations and results.</p>
          </div>

          <button
            className="history-dashboard-button"
            onClick={() => handleNavigation("dashboard")}
            type="button"
          >
            <span>?</span>
            Dashboard
          </button>
        </header>

        {/* HISTORY PANEL */}
        <section className="history-panel">
          {/* TOOLBAR */}
          <div className="history-toolbar">
            <div className="history-toolbar-title">
              <div className="toolbar-title-row">
                <h2>Examination History</h2>
                <span className="record-count">
                  {filteredAttempts.length}
                </span>
              </div>
              <p>Your recent test attempts</p>
            </div>

            <div className="history-controls">
              <div className="history-search">
                <span className="search-icon">?</span>
                <input
                  type="text"
                  value={search}
                  onChange={(event) =>
                    setSearch(event.target.value)
                  }
                  placeholder="Search test or paper ID"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value)
                }
              >
                <option value="ALL">All Status</option>
                <option value="COMPLETED">Completed</option>
                <option value="TERMINATED">Terminated</option>
                <option value="IN PROGRESS">In Progress</option>
              </select>
            </div>
          </div>

          {/* LOADING */}
          {loading && (
            <div className="history-state">
              <div className="history-loader" />
              <h3>Loading test history...</h3>
              <p>Fetching your examination records.</p>
            </div>
          )}

          {/* ERROR */}
          {!loading && error && (
            <div className="history-state error-state">
              <div className="state-large-icon">!</div>
              <h3>Unable to load history</h3>
              <p>{error}</p>
              <button onClick={loadHistory} type="button">
                Try Again
              </button>
            </div>
          )}

          {/* EMPTY */}
          {!loading &&
            !error &&
            filteredAttempts.length === 0 && (
              <div className="history-state">
                <div className="state-large-icon">?</div>
                <h3>No test history found</h3>
                <p>
                  Your examination attempts will appear here.
                </p>
                <button
                  onClick={() =>
                    handleNavigation("my-tests")
                  }
                  type="button"
                >
                  Browse My Tests ?
                </button>
              </div>
            )}

          {/* TABLE */}
          {!loading &&
            !error &&
            filteredAttempts.length > 0 && (
              <div className="history-table-wrap">
                <table className="history-table">
                  <thead>
                    <tr>
                      <th className="test-column">TEST</th>
                      <th className="paper-column">PAPER ID</th>
                      <th>DATE</th>
                      <th>TIME</th>
                      <th className="center-column">
                        QUESTIONS
                      </th>
                      <th>SCORE</th>
                      <th>DURATION</th>
                      <th>STATUS</th>
                      <th className="action-column">
                        ACTION
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredAttempts.map((item) => {
                      const status = normalizeStatus(item.status);
                      const statusClass =
                        getStatusClass(status);

                      return (
                        <tr key={item.attemptId}>
                          {/* TEST */}
                          <td className="test-column">
                            <div className="test-cell">
                              <div className="test-avatar">
                                {String(item.subject)
                                  .charAt(0)
                                  .toUpperCase()}
                              </div>
                              <div className="test-info">
                                <strong
                                  title={item.subject}
                                >
                                  {item.subject}
                                </strong>
                                <span>
                                  Online Examination
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* PAPER ID */}
                          <td className="paper-column">
                            <span
                              className="paper-id"
                              title={item.paperId}
                            >
                              {item.paperId}
                            </span>
                          </td>

                          {/* DATE */}
                          <td>
                            <span className="table-primary">
                              {formatDate(item.startedAt)}
                            </span>
                          </td>

                          {/* TIME */}
                          <td>
                            <span className="table-muted">
                              {formatTime(item.startedAt)}
                            </span>
                          </td>

                          {/* QUESTIONS */}
                          <td className="center-column">
                            <span className="question-count">
                              {item.totalQuestions || "�"}
                            </span>
                          </td>

                          {/* SCORE */}
                          <td>
                            {item.percentage !== null &&
                            item.percentage !== undefined ? (
                              <div className="score-cell">
                                <strong>
                                  {Number(
                                    item.percentage
                                  ).toFixed(0)}
                                  %
                                </strong>

                                {item.obtainedMarks !==
                                  null &&
                                  item.totalQuestions > 0 && (
                                    <span>
                                      {item.obtainedMarks}/
                                      {item.totalQuestions}
                                    </span>
                                  )}
                              </div>
                            ) : (
                              <span className="table-muted">
                                �
                              </span>
                            )}
                          </td>

                          {/* DURATION */}
                          <td>
                            <span className="table-muted">
                              {formatDuration(
                                item.startedAt,
                                item.endedAt
                              )}
                            </span>
                          </td>

                          {/* STATUS */}
                          <td>
                            <span
                              className={`status-badge ${statusClass}`}
                            >
                              <i>
                                {getStatusIcon(status)}
                              </i>
                              {status}
                            </span>
                          </td>

                          {/* ACTION */}
                          <td className="action-column">
                            {status === "COMPLETED" && (
                              <button
                                className="view-button"
                                onClick={() =>
                                  handleResult(item)
                                }
                                type="button"
                              >
                                View Result
                                <span>?</span>
                              </button>
                            )}

                            {status === "TERMINATED" && (
                              <span
                                className="terminated-text"
                                title={item.violation || ""}
                              >
                                Terminated
                              </span>
                            )}

                            {status === "IN PROGRESS" && (
                              <span className="table-muted">
                                In progress
                              </span>
                            )}

                            {status === "UNKNOWN" && (
                              <span className="table-muted">
                                �
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
        </section>

        {/* FOOTER */}
        <footer className="history-footer">
          <span>?? TESTFLOW Secure Student Portal</span>
          <span>
            Examination records are securely maintained.
          </span>
        </footer>
      </main>
    </div>
  );
}
