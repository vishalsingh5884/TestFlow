import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import "./MyTests.css";

const API_BASE = (
  import.meta.env.VITE_API_URL ||
  "http://localhost:5000"
).replace(/\/$/, "");

const STUDENT_TOKEN_KEYS = [
  "studentToken",
  "student_token",
  "token",
  "authToken",
  "accessToken",
  "access_token",
];

/* =========================================================
   TOKEN HELPERS
========================================================= */

function getStoredToken() {
  for (const key of STUDENT_TOKEN_KEYS) {
    const localValue = localStorage.getItem(key);

    if (localValue) {
      return localValue;
    }

    const sessionValue = sessionStorage.getItem(key);

    if (sessionValue) {
      return sessionValue;
    }
  }

  return "";
}

function getHeaders() {
  const token = getStoredToken();

  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...(token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : {}),
  };
}

/* =========================================================
   TEST NORMALIZATION
========================================================= */

function normalizeTest(test) {
  if (!test) {
    return null;
  }

  return {
    paperId: String(
      test.paperId ||
        test.paperID ||
        test.paper_id ||
        test.id ||
        ""
    ),

    subject: String(
      test.subject ||
        test.title ||
        "Online Examination"
    ),

    programmingLanguage: String(
      test.programmingLanguage ||
        ""
    ),

    topics: test.topics || "",

    totalQuestions:
      Number(test.totalQuestions || test.questions?.length) || 0,

    codingQuestions:
      Number(test.codingQuestions) || 0,

    status:
      test.status ||
      "published",

    title:
      test.title ||
      test.subject ||
      "Online Examination",

    duration:
      Number(test.duration) || 30,

    attempt:
      test.attempt || null,

    createdAt:
      test.createdAt || null,

    updatedAt:
      test.updatedAt || null,
  };
}

/* =========================================================
   TOPIC HELPERS
========================================================= */

function formatTopics(topics) {
  if (!topics) {
    return [];
  }

  if (Array.isArray(topics)) {
    return topics
      .map((item) => String(item).trim())
      .filter(Boolean)
      .slice(0, 4);
  }

  return String(topics)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 4);
}

function getTopicsSearchValue(topics) {
  if (!topics) {
    return "";
  }

  if (Array.isArray(topics)) {
    return topics
      .map((item) => String(item))
      .join(" ")
      .toLowerCase();
  }

  return String(topics).toLowerCase();
}

/* =========================================================
   TEST ICON
========================================================= */

function getTestIcon(subject = "") {
  const value = String(subject).toLowerCase();

  if (
    value.includes("python") ||
    value.includes("programming")
  ) {
    return "</>";
  }

  if (
    value.includes("data") ||
    value.includes("algorithm") ||
    value.includes("dsa")
  ) {
    return "❖";
  }

  if (
    value.includes("database") ||
    value.includes("sql")
  ) {
    return "▤";
  }

  if (
    value.includes("web") ||
    value.includes("html") ||
    value.includes("javascript")
  ) {
    return "⌘";
  }

  if (
    value.includes("ai") ||
    value.includes("machine")
  ) {
    return "✦";
  }

  return "T";
}

/* =========================================================
   ATTEMPT STATUS
========================================================= */

function getAttemptStatus(test) {
  const status = String(
    test?.attempt?.status || ""
  ).toUpperCase();

  if (status === "SUBMITTED") {
    return "COMPLETED";
  }

  if (status === "IN_PROGRESS") {
    return "IN PROGRESS";
  }

  if (status === "FLAGGED") {
    return "FLAGGED";
  }

  if (status === "TERMINATED") {
    return "TERMINATED";
  }

  return "AVAILABLE";
}

function isTestDisabled(test) {
  const status = String(
    test?.attempt?.status || ""
  ).toUpperCase();

  return (
    status === "SUBMITTED" ||
    status === "FLAGGED" ||
    status === "TERMINATED"
  );
}

/* =========================================================
   MAIN COMPONENT
========================================================= */

export default function MyTests({
  onStartTest,
  onBackToDashboard,
}) {
  const [tests, setTests] = useState([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [search, setSearch] =
    useState("");

  const [filter, setFilter] =
    useState("ALL");

  const [startingPaperId, setStartingPaperId] =
    useState("");

  /* =======================================================
     API REQUEST
  ======================================================= */

  const apiRequest = useCallback(
    async (path, options = {}) => {
      const response = await fetch(
        `${API_BASE}${path}`,
        {
          cache: "no-store",
          ...options,

          headers: {
            ...getHeaders(),
            ...(options.headers || {}),
          },
        }
      );

      let data = null;

      try {
        data = await response.json();
      } catch {
        data = null;
      }

      if (!response.ok) {
        throw new Error(
          data?.message ||
            data?.error ||
            `Request failed with status ${response.status}`
        );
      }

      return data;
    },
    []
  );

  /* =======================================================
     LOAD AVAILABLE TESTS
  ======================================================= */

  const loadTests = useCallback(
    async () => {
      setLoading(true);
      setError("");

      try {
        const data = await apiRequest(
          "/api/student/tests"
        );

        const availableTests =
          Array.isArray(data?.tests)
            ? data.tests
            : Array.isArray(data)
            ? data
            : [];

        const cleanedTests =
          availableTests
            .map(normalizeTest)
            .filter(Boolean)
            .filter(
              (test, index, array) =>
                array.findIndex(
                  (item) =>
                    item.paperId ===
                    test.paperId
                ) === index
            );

        setTests(cleanedTests);
      } catch (loadError) {
        console.error(
          "My Tests loading error:",
          loadError
        );

        setError(
          loadError?.message ||
            "Unable to load your assigned tests."
        );

        setTests([]);
      } finally {
        setLoading(false);
      }
    },
    [apiRequest]
  );

  /* =======================================================
     INITIAL LOAD
  ======================================================= */

  useEffect(() => {
    loadTests();
  }, [loadTests]);

  /* =======================================================
     SEARCH + FILTER
  ======================================================= */

  const filteredTests = useMemo(() => {
    const searchValue =
      search.trim().toLowerCase();

    return tests.filter((test) => {
      const subject =
        String(
          test.subject || ""
        ).toLowerCase();

      const language =
        String(
          test.programmingLanguage || ""
        ).toLowerCase();

      const topics =
        getTopicsSearchValue(
          test.topics
        );

      const paperId =
        String(
          test.paperId || ""
        ).toLowerCase();

      const matchesSearch =
        !searchValue ||
        subject.includes(searchValue) ||
        language.includes(searchValue) ||
        topics.includes(searchValue) ||
        paperId.includes(searchValue);

      let matchesFilter = true;

      if (filter === "CODING") {
        matchesFilter =
          test.codingQuestions > 0;
      }

      if (filter === "MCQ") {
        matchesFilter =
          test.totalQuestions >
          test.codingQuestions;
      }

      return (
        matchesSearch &&
        matchesFilter
      );
    });
  }, [tests, search, filter]);

  /* =======================================================
     START / RESUME TEST
  ======================================================= */

  const handleStartTest = async (test) => {
    if (!test?.paperId) {
      return;
    }

    if (startingPaperId) {
      return;
    }

    setStartingPaperId(test.paperId);
    setError("");

    try {
      console.log(
        `Loading full test details for Paper ID: ${test.paperId}...`
      );

      const fullTestResponse =
        await apiRequest(
          `/api/student/tests/${encodeURIComponent(
            test.paperId
          )}`
        );

      const fullTest =
        fullTestResponse?.test ||
        fullTestResponse?.paper ||
        fullTestResponse;

      const questionsList =
        Array.isArray(fullTest?.questions)
          ? fullTest.questions
          : Array.isArray(fullTestResponse?.questions)
          ? fullTestResponse.questions
          : [];

      if (!questionsList.length) {
        throw new Error(
          "Unable to load questions for this test. Make sure the paper is created and has questions."
        );
      }

      const response =
        await apiRequest(
          `/api/student/tests/${encodeURIComponent(
            test.paperId
          )}/start`,
          {
            method: "POST",
            body: JSON.stringify({}),
          }
        );

      const attemptId =
        response?.attemptId ||
        response?.attempt?.attemptId ||
        response?.data?.attemptId ||
        response?.attempt?.id ||
        "";

      if (!attemptId) {
        throw new Error(
          response?.message ||
            "The examination attempt could not be created or retrieved from the server."
        );
      }

      localStorage.setItem("attemptId", attemptId);
      localStorage.setItem("studentAttemptId", attemptId);
      localStorage.setItem("examAttemptId", attemptId);

      const testToOpen = {
        ...test,
        ...fullTest,
        attemptId,
        paperId: fullTest?.paperId || test.paperId,
        questions: questionsList,
      };

      if (typeof onStartTest === "function") {
        onStartTest(testToOpen);
        return;
      }

      localStorage.setItem("selectedTest", JSON.stringify(testToOpen));
      localStorage.setItem("active_test", JSON.stringify(testToOpen));

      window.location.href = `/student-test/${encodeURIComponent(test.paperId)}`;
    } catch (startError) {
      console.error("Unable to start/resume test:", startError);

      setError(
        startError?.message ||
          "Unable to start this test. Make sure your account is authorized for this test."
      );
    } finally {
      setStartingPaperId("");
    }
  };

  /* =======================================================
     CLEAR FILTERS
  ======================================================= */

  const clearFilters = () => {
    setSearch("");
    setFilter("ALL");
  };

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div className="my-tests-page">
      {/* =================================================
          PAGE HEADER
      ================================================= */}

      <header className="my-tests-header">
        <div className="my-tests-heading">
          <div className="my-tests-eyebrow">
            STUDENT PORTAL • EXAMINATION CENTRE
          </div>

          <div className="my-tests-title-row">
            <div>
              <h1>My Tests</h1>

              <p>
                View your assigned examinations, review test details and securely
                begin your assessment.
              </p>
            </div>
          </div>
        </div>

        <div className="test-count-card">
          <div className="count-card-top">
            <span>AVAILABLE TESTS</span>

            <div className="count-live-dot" />
          </div>

          <strong>{tests.length}</strong>

          <small>Assigned to your account</small>
        </div>
      </header>

      {/* =================================================
          TOOLBAR
      ================================================= */}

      <section
        className="my-tests-toolbar"
        aria-label="Test search and filters"
      >
        <div className="toolbar-label">
          <span>TEST LIBRARY</span>

          <strong>
            {filteredTests.length}{" "}
            {filteredTests.length === 1
              ? "examination"
              : "examinations"}
          </strong>
        </div>

        <div className="test-search">
          <span className="search-icon" aria-hidden="true">
            🔍
          </span>

          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search subject, topic, language or paper ID..."
            aria-label="Search tests"
          />

          {search && (
            <button
              className="clear-search"
              onClick={() => setSearch("")}
              aria-label="Clear search"
              type="button"
            >
              ×
            </button>
          )}
        </div>

        <div className="test-filters">
          <button
            type="button"
            className={filter === "ALL" ? "active" : ""}
            onClick={() => setFilter("ALL")}
          >
            <span>ALL</span>
            <small>{tests.length}</small>
          </button>

          <button
            type="button"
            className={filter === "MCQ" ? "active" : ""}
            onClick={() => setFilter("MCQ")}
          >
            <span>MCQ</span>
            <small>
              {
                tests.filter(
                  (test) => test.totalQuestions > test.codingQuestions
                ).length
              }
            </small>
          </button>

          <button
            type="button"
            className={filter === "CODING" ? "active" : ""}
            onClick={() => setFilter("CODING")}
          >
            <span>CODING</span>
            <small>
              {tests.filter((test) => test.codingQuestions > 0).length}
            </small>
          </button>
        </div>
      </section>

      {/* =================================================
          ERROR / NOTICE
      ================================================= */}

      {error && (
        <div className="my-tests-error">
          <div className="error-icon">!</div>

          <div>
            <strong>Examination Service Notice</strong>

            <span>{error}</span>
          </div>

          <button type="button" onClick={loadTests}>
            Retry
          </button>
        </div>
      )}

      {/* =================================================
          LOADING
      ================================================= */}

      {loading ? (
        <div className="tests-loading">
          <div className="loading-orbit">
            <div className="loading-spinner" />
          </div>

          <strong>Loading examination library</strong>

          <span>Securely connecting to TESTFLOW</span>
        </div>
      ) : filteredTests.length === 0 ? (
        /* ===============================================
           EMPTY STATE
        =============================================== */

        <div className="empty-tests">
          <div className="empty-icon">
            <span>🔍</span>
          </div>

          <div className="empty-eyebrow">NO MATCHING EXAMINATIONS</div>

          <h2>No tests found</h2>

          <p>
            {tests.length === 0
              ? "There are currently no published examinations available for your account."
              : "No examinations match your current search or filter. Try changing your search criteria."}
          </p>

          {(search || filter !== "ALL") && (
            <button
              type="button"
              className="reset-filter-button"
              onClick={clearFilters}
            >
              Clear Filters
            </button>
          )}
        </div>
      ) : (
        /* ===============================================
           TEST GRID
        =============================================== */

        <div className="tests-grid">
          {filteredTests.map((test) => {
            const topics = formatTopics(test.topics);

            const isStarting = startingPaperId === test.paperId;

            const attemptStatus = getAttemptStatus(test);

            const statusClass = attemptStatus
              .toLowerCase()
              .replace(/\s+/g, "-");

            const disabled =
              Boolean(startingPaperId) || isTestDisabled(test);

            const testType = test.codingQuestions > 0 ? "Mixed" : "MCQ";

            return (
              <article className="test-card" key={test.paperId}>
                {/* =================================
                    CARD HEADER
                ================================= */}

                <div className="test-card-top">
                  <div className="test-card-identity">
                    <div className="test-icon">
                      {getTestIcon(test.subject)}
                    </div>

                    <div className="test-card-code">
                      <span>PAPER ID</span>

                      <strong>{test.paperId}</strong>
                    </div>
                  </div>

                  <div className={`test-status ${statusClass}`}>
                    <span />

                    {attemptStatus}
                  </div>
                </div>

                {/* =================================
                    CARD CONTENT
                ================================= */}

                <div className="test-card-content">
                  <div className="test-label">EXAMINATION</div>

                  <h2>{test.subject}</h2>

                  {test.title && test.title !== test.subject && (
                    <p className="test-title">{test.title}</p>
                  )}

                  {test.programmingLanguage && (
                    <div className="language-line">
                      <span>PROGRAMMING LANGUAGE</span>

                      <strong>{test.programmingLanguage}</strong>
                    </div>
                  )}

                  <div className="test-topic-list">
                    {topics.length > 0 ? (
                      topics.map((topic) => (
                        <span key={topic}>{topic}</span>
                      ))
                    ) : (
                      <span>General Assessment</span>
                    )}
                  </div>
                </div>

                {/* =================================
                    TEST DETAILS
                ================================= */}

                <div className="test-details">
                  <div className="test-detail">
                    <span className="detail-icon">◫</span>

                    <div>
                      <small>QUESTIONS</small>

                      <strong>{test.totalQuestions}</strong>
                    </div>
                  </div>

                  <div className="test-detail">
                    <span className="detail-icon">◈</span>

                    <div>
                      <small>TYPE</small>

                      <strong>{testType}</strong>
                    </div>
                  </div>

                  <div className="test-detail">
                    <span className="detail-icon">◷</span>

                    <div>
                      <small>DURATION</small>

                      <strong>{test.duration} min</strong>
                    </div>
                  </div>
                </div>

                {/* =================================
                    CARD FOOTER
                ================================= */}

                <div className="test-card-footer">
                  <div className="security-info">
                    <span className="security-icon">✓</span>

                    <div>
                      <strong>Secure assessment</strong>

                      <span>AI-proctored environment</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="start-test-button"
                    onClick={() => handleStartTest(test)}
                    disabled={disabled}
                    title={
                      attemptStatus === "FLAGGED"
                        ? "This test attempt has been flagged."
                        : attemptStatus === "TERMINATED"
                        ? "This test attempt has been terminated."
                        : attemptStatus === "COMPLETED"
                        ? "This test has already been completed."
                        : ""
                    }
                  >
                    <span className="button-text">
                      {isStarting
                        ? "STARTING..."
                        : attemptStatus === "IN PROGRESS"
                        ? "RESUME TEST"
                        : attemptStatus === "COMPLETED"
                        ? "COMPLETED"
                        : attemptStatus === "FLAGGED"
                        ? "FLAGGED"
                        : attemptStatus === "TERMINATED"
                        ? "TERMINATED"
                        : "START TEST"}
                    </span>

                    <span className="button-arrow">→</span>
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* =================================================
          PAGE FOOTER
      ================================================= */}

      <footer className="my-tests-footer">
        <div className="footer-security">
          <span className="footer-dot" />

          <div>
            <strong>SECURE EXAMINATION ENVIRONMENT</strong>

            <span>
              Camera & microphone monitoring activates only after starting a test.
            </span>
          </div>
        </div>

        {typeof onBackToDashboard === "function" && (
          <button
            type="button"
            className="back-dashboard-button"
            onClick={onBackToDashboard}
          >
            <span>←</span>
            Dashboard
          </button>
        )}
      </footer>
    </div>
  );
}