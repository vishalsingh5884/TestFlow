import React, { useCallback, useEffect, useMemo, useState } from "react";
import "./Results.css";

const API_BASE = (
  import.meta.env.VITE_API_URL || "/api"
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

function getHeaders() {
  const token = getStoredToken();

  return {
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function ResultIcon({ name, size = 18, strokeWidth = 1.8 }) {
  const props = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true",
    focusable: "false",
    style: { display: "inline-block", flexShrink: 0 },
  };

  switch (name) {
    case "arrow-left":
      return (
        <svg {...props}>
          <path d="M19 12H5" />
          <path d="m11 6-6 6 6 6" />
        </svg>
      );
    case "refresh":
      return (
        <svg {...props}>
          <path d="M20 11a8 8 0 0 0-14.8-3.9L4 9" />
          <path d="M4 4v5h5" />
          <path d="M4 13a8 8 0 0 0 14.8 3.9L20 15" />
          <path d="M20 20v-5h-5" />
        </svg>
      );
    case "check":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="9" />
          <path d="m8 12 2.5 2.5L16 9" />
        </svg>
      );
    case "file":
      return (
        <svg {...props}>
          <path d="M6 3h8l4 4v14H6z" />
          <path d="M14 3v5h5M9 13h6M9 17h6" />
        </svg>
      );
    case "target":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="8" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
        </svg>
      );
    case "trophy":
      return (
        <svg {...props}>
          <path d="M8 4h8v4a4 4 0 0 1-8 0V4Z" />
          <path d="M8 6H4v1a4 4 0 0 0 4 4M16 6h4v1a4 4 0 0 1-4 4" />
          <path d="M12 12v4M8 20h8M9 16h6" />
        </svg>
      );
    case "calendar":
      return (
        <svg {...props}>
          <rect x="4" y="5" width="16" height="15" rx="2" />
          <path d="M8 3v4M16 3v4M4 10h16" />
        </svg>
      );
    case "alert":
      return (
        <svg {...props}>
          <path d="m12 3 9 16H3L12 3Z" />
          <path d="M12 9v4M12 16h.01" />
        </svg>
      );
    default:
      return null;
  }
}

function formatDate(value) {
  if (!value) return "�";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "�";

  return date.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function getScore(result) {
  const score = Number(result?.score);
  if (Number.isFinite(score)) {
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  const correct = Number(result?.correct);
  const total = Number(result?.totalQuestions);

  if (!Number.isFinite(correct) || !Number.isFinite(total) || total <= 0) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round((correct / total) * 100)));
}

function getStatusClass(status) {
  const normalized = String(status || "").trim().toLowerCase();

  if (normalized === "submitted") return "submitted";
  if (normalized === "terminated") return "terminated";
  return "other";
}

function getStatusLabel(status) {
  const normalized = String(status || "").trim().toUpperCase();
  return normalized || "UNKNOWN";
}

function getTestName(result) {
  return (
    result?.subject ||
    result?.title ||
    result?.testName ||
    result?.name ||
    "Online Examination"
  );
}

function ResultDetails({ result }) {
  const total = Number(result?.totalQuestions) || 0;
  const correct = Number(result?.correct) || 0;
  const answered = Number.isFinite(Number(result?.answered))
    ? Number(result.answered)
    : correct;
  const score = getScore(result);
  const statusClass = getStatusClass(result?.status);

  return (
    <>
      <div className="result-details-grid">
        <div className="result-detail-card">
          <ResultIcon name="file" size={18} />
          <span>Questions</span>
          <strong>{total}</strong>
        </div>

        <div className="result-detail-card">
          <ResultIcon name="check" size={18} />
          <span>Correct</span>
          <strong>{correct}</strong>
        </div>

        <div className="result-detail-card">
          <ResultIcon name="target" size={18} />
          <span>Answered</span>
          <strong>{answered}</strong>
        </div>

        <div className="result-detail-card">
          <ResultIcon name="trophy" size={18} />
          <span>Score</span>
          <strong>{score}%</strong>
        </div>
      </div>

      <div className="result-information-card">
        <div className="result-information-heading">
          <h3>Examination Information</h3>
        </div>

        <div className="result-information-grid">
          <div>
            <span>Paper ID</span>
            <strong>{result?.paperId || "�"}</strong>
          </div>
          <div>
            <span>Attempt ID</span>
            <strong>{result?.attemptId || "�"}</strong>
          </div>
          <div>
            <span>Started</span>
            <strong>{formatDate(result?.startedAt)}</strong>
          </div>
          <div>
            <span>Submitted</span>
            <strong>{formatDate(result?.submittedAt)}</strong>
          </div>
        </div>

        {statusClass === "terminated" && (
          <div className="termination-panel">
            <strong>Examination Terminated</strong>
            <span>
              This attempt was terminated and is preserved for records.
            </span>
          </div>
        )}
      </div>
    </>
  );
}

export default function StudentResults({ onBackToDashboard }) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadResults = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError("");

    try {
      const response = await fetch(`${API_BASE}/api/student/results`, {
        cache: "no-store",
        headers: getHeaders(),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data?.message ||
            `Unable to load results (HTTP ${response.status}).`,
        );
      }

      if (!data?.success) {
        throw new Error(
          data?.message || "Unable to load examination results.",
        );
      }

      setResults(Array.isArray(data.results) ? data.results : []);
    } catch (loadError) {
      console.error("Student results loading error:", loadError);
      setResults([]);
      setError(
        loadError?.message ||
          "Unable to load examination results. Make sure the local backend is running.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadResults();
  }, [loadResults]);

  const summary = useMemo(() => {
    const completed = results.length;
    const scores = results
      .map((item) => getScore(item))
      .filter((value) => Number.isFinite(value));

    const average =
      scores.length > 0
        ? Math.round(
            scores.reduce((sum, value) => sum + value, 0) / scores.length,
          )
        : 0;

    return {
      completed,
      average,
      latest: results[0] || null,
    };
  }, [results]);

  const latestScore = getScore(summary.latest);
  const latestStatusClass = getStatusClass(summary.latest?.status);

  return (
    <main className="student-results-page">
      <header className="student-results-header">
        <div>
          <div className="student-results-eyebrow">STUDENT AREA � RESULTS</div>
          <h1>Results</h1>
          <p>Your automatically graded submitted examinations.</p>
        </div>

        {typeof onBackToDashboard === "function" && (
          <button
            type="button"
            className="results-back-button"
            onClick={onBackToDashboard}
          >
            <ResultIcon name="arrow-left" size={15} />
            Dashboard
          </button>
        )}
      </header>

      {error && (
        <div className="results-alert results-alert-error">
          <strong>Unable to load results</strong>
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <section className="results-empty">
          <div className="results-empty-icon">
            <ResultIcon name="refresh" size={32} />
          </div>
          <h2>Loading results...</h2>
          <p>Reading saved submissions from the TestFlow backend.</p>
        </section>
      ) : results.length === 0 ? (
        <section className="results-empty">
          <div className="results-empty-icon">
            <ResultIcon name="file" size={32} />
          </div>
          <h2>No submitted results yet.</h2>
          <p>Complete a test and your result will appear here automatically.</p>
        </section>
      ) : (
        <div className="results-layout">
          <section className="result-hero-card">
            <div className="result-hero-top">
              <div>
                <h2>{getTestName(summary.latest)}</h2>
                <p>Your latest submitted examination result.</p>
              </div>

              <span className={`result-status ${latestStatusClass}`}>
                {getStatusLabel(summary.latest?.status)}
              </span>
            </div>

            <div className="score-display">
              <div
                className="score-ring"
                style={{ "--score": `${latestScore}%` }}
                aria-label={`Score ${latestScore}%`}
              >
                <div>
                  <strong>{latestScore}%</strong>
                  <span>FINAL SCORE</span>
                </div>
              </div>

              <div className="score-copy">
                <h3>Exam Result</h3>
                <p>
                  This score was calculated automatically from the answers saved
                  when you submitted the examination.
                </p>
              </div>
            </div>
          </section>

          <ResultDetails result={summary.latest} />

          <div className="result-actions">
            <button
              type="button"
              className="secondary"
              onClick={() => loadResults(true)}
              disabled={refreshing}
            >
              <ResultIcon name="refresh" size={15} />
              {refreshing ? "Refreshing..." : "Refresh Results"}
            </button>
          </div>

          {results.length > 1 && (
            <section className="result-information-card">
              <div className="result-information-heading">
                <h3>Previous Results</h3>
              </div>

              <div className="result-information-grid">
                {results.slice(1).map((result) => (
                  <div key={result.attemptId || `${result.paperId}-${result.submittedAt}`}>
                    <span>{getTestName(result)}</span>
                    <strong>
                      {getScore(result)}% � {formatDate(result.submittedAt)}
                    </strong>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="result-information-card">
            <div className="result-information-heading">
              <h3>Summary</h3>
            </div>

            <div className="result-information-grid">
              <div>
                <span>Completed Tests</span>
                <strong>{summary.completed}</strong>
              </div>
              <div>
                <span>Average Score</span>
                <strong>{summary.average}%</strong>
              </div>
              <div>
                <span>Latest Score</span>
                <strong>{summary.latest ? `${latestScore}%` : "�"}</strong>
              </div>
              <div>
                <span>Latest Submission</span>
                <strong>{formatDate(summary.latest?.submittedAt)}</strong>
              </div>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}