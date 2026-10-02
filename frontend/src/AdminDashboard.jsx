import { useCallback, useEffect, useMemo, useState } from "react";
import "./AdminDashboard.css";
import AdminStudents from "./AdminStudents";
import AdminSettings from "./AdminSettings";
import "./CreateTest.css";
import AdminAdmins from "./AdminAdmins";
import Groups from "./Groups";
import Notifications from "./Notifications";
import PrivateMessages from "./PrivateMessages";

const API_URL = (
  import.meta.env.VITE_API_URL || "/api"
).replace(/\/$/, "");

function getAdminToken() {
  return (
    localStorage.getItem("access_token") ||
    sessionStorage.getItem("access_token") ||
    localStorage.getItem("adminToken") ||
    sessionStorage.getItem("adminToken") ||
    localStorage.getItem("admin_token") ||
    sessionStorage.getItem("admin_token") ||
    localStorage.getItem("token") ||
    sessionStorage.getItem("token") ||
    localStorage.getItem("authToken") ||
    sessionStorage.getItem("authToken") ||
    localStorage.getItem("accessToken") ||
    sessionStorage.getItem("accessToken") ||
    ""
  );
}

function getAdminAuthHeaders(includeJson = false) {
  const token = getAdminToken();
  return {
    Accept: "application/json",
    ...(includeJson ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/* =========================================================
   HELPERS
========================================================= */

function asArray(data, key) {
  if (Array.isArray(data)) return data;
  if (key && Array.isArray(data?.[key])) return data[key];
  if (key && Array.isArray(data?.test?.[key])) return data.test[key];
  if (key && Array.isArray(data?.paper?.[key])) return data.paper[key];
  return [];
}

function formatDate(value) {
  if (!value) return "�";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "�";

  return date.toLocaleString([], {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function relativeTime(value) {
  if (!value) return "�";

  const time = new Date(value).getTime();

  if (!Number.isFinite(time)) return "�";

  const seconds = Math.max(
    0,
    Math.floor((Date.now() - time) / 1000),
  );

  if (seconds < 60) return `${seconds}s ago`;

  const minutes = Math.floor(seconds / 60);

  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);

  if (hours < 24) return `${hours}h ago`;

  return `${Math.floor(hours / 24)}d ago`;
}

function testName(test) {
  const values = [
    test?.subject,
    test?.title,
    test?.name,
    test?.testName,
    test?.examName,
    test?.courseName,
  ];

  const name = values.find(
    (value) =>
      typeof value === "string" &&
      value.trim() &&
      ![
        "untitled test",
        "untitled",
        "online examination",
      ].includes(value.trim().toLowerCase()),
  );

  return name?.trim() || `Test ${test?.paperId || ""}`.trim();
}

function statusClass(status) {
  const value = String(status || "draft").toLowerCase();

  if (
    ["published", "active", "submitted"].includes(value)
  ) {
    return "active-status";
  }

  if (
    ["scheduled", "in_progress", "in-progress"].includes(value)
  ) {
    return "scheduled-status";
  }

  return "draft-status";
}

function numberValue(value, fallback = 0) {
  const number = Number(value);

  return Number.isFinite(number) && number >= 0
    ? number
    : fallback;
}

/* =========================================================
   CREATE TEST VIEW
========================================================= */

function toDatetimeLocal(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 16);
  const pad = (number) => String(number).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function normalizeEditorQuestion(question, index, fallbackSubject, fallbackLanguage) {
  return {
    id: question?.id || `question-${Date.now()}-${index}`,
    number: Number(question?.number) || index + 1,
    question: question?.question || question?.text || "",
    type: question?.type || "MCQ",
    difficulty: question?.difficulty || "Medium",
    topic: question?.topic || fallbackSubject || "General",
    options: Array.isArray(question?.options) ? [...question.options] : ["", "", "", ""],
    correctAnswer: question?.correctAnswer || question?.answer || "",
    explanation: question?.explanation || "",
    language: question?.language || fallbackLanguage || "Python",
    starterCode: question?.starterCode || "",
    testCases: Array.isArray(question?.testCases) ? [...question.testCases] : [],
  };
}

function CreateTestView({ onBack, onCreated, editPaperId }) {
  const [form, setForm] = useState({
    title: "",
    subject: "",
    topics: "",
    description: "",
    duration: 30,

    totalQuestions: 10,
    mcqQuestions: 10,
    codingQuestions: 0,

    easyQuestions: 3,
    mediumQuestions: 5,
    hardQuestions: 2,

    difficulty: "Mixed",
    testType: "MCQ",

    programmingLanguage: "Python",

    startDate: "",
    endDate: "",
    instructions: "",
    accessStudentIds: [],
  });

  const [questions, setQuestions] = useState([]);
  const [generatedPaperId, setGeneratedPaperId] = useState(null);
  const [availableStudents, setAvailableStudents] = useState([]);
  const [studentSearch, setStudentSearch] = useState("");

  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [generating, setGenerating] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const loadStudents = async () => {
      try {
        const response = await fetch(`${API_URL}/api/admin/students`, {
          cache: "no-store",
          headers: getAdminAuthHeaders(),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data?.success) return;
        if (!cancelled) setAvailableStudents(Array.isArray(data.students) ? data.students : []);
      } catch (err) {
        console.error("Load students for test access error:", err);
      }
    };
    loadStudents();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!editPaperId) return;

    let cancelled = false;
    const loadDraft = async () => {
      try {
        setError("");
        setMessage("");
        const response = await fetch(`${API_URL}/api/admin/tests/${encodeURIComponent(editPaperId)}`, {
          cache: "no-store",
          headers: getAdminAuthHeaders(),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data?.success || !data?.test) {
          throw new Error(data?.message || `Unable to load draft. HTTP ${response.status}`);
        }
        if (cancelled) return;
        const test = data.test;
        setGeneratedPaperId(String(test.paperId));
        setForm({
          title: test.title || test.subject || "",
          subject: test.subject || "",
          topics: Array.isArray(test.topics) ? test.topics.join(", ") : (test.topics || ""),
          description: test.description || "",
          duration: Number(test.duration) || 30,
          totalQuestions: Number(test.totalQuestions) || test.questions?.length || 1,
          mcqQuestions: Number(test.mcqQuestions ?? test.questionTypes?.mcq) || 0,
          codingQuestions: Number(test.codingQuestions ?? test.questionTypes?.coding) || 0,
          easyQuestions: Number(test.easyQuestions ?? test.difficultyDistribution?.easy) || 0,
          mediumQuestions: Number(test.mediumQuestions ?? test.difficultyDistribution?.medium) || 0,
          hardQuestions: Number(test.hardQuestions ?? test.difficultyDistribution?.hard) || 0,
          difficulty: test.difficulty || "Mixed",
          testType: test.testType || "MCQ",
          programmingLanguage: test.programmingLanguage || "Python",
          startDate: toDatetimeLocal(test.startDate),
          endDate: toDatetimeLocal(test.endDate),
          instructions: test.instructions || "",
          accessStudentIds: Array.isArray(test.accessStudentIds) ? test.accessStudentIds.map(String) : [],
        });
        setQuestions((Array.isArray(test.questions) ? test.questions : []).map((question, index) =>
          normalizeEditorQuestion(question, index, test.subject, test.programmingLanguage),
        ));
        setMessage(`Draft ${test.paperId} loaded.`);
      } catch (err) {
        if (!cancelled) {
          console.error("Load draft error:", err);
          setError(err.message || "Unable to load draft.");
        }
      }
    };
    loadDraft();
    return () => { cancelled = true; };
  }, [editPaperId]);

  const updateField = (field, value) => {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  /* ---------------------------------------------------------
     QUESTION COUNTS
  --------------------------------------------------------- */

  const totalQuestions = numberValue(
    form.totalQuestions,
  );

  const mcqQuestions = numberValue(
    form.mcqQuestions,
  );

  const codingQuestions = numberValue(
    form.codingQuestions,
  );

  const easyQuestions = numberValue(
    form.easyQuestions,
  );

  const mediumQuestions = numberValue(
    form.mediumQuestions,
  );

  const hardQuestions = numberValue(
    form.hardQuestions,
  );

  const questionTypeTotal =
    mcqQuestions + codingQuestions;

  const difficultyTotal =
    easyQuestions +
    mediumQuestions +
    hardQuestions;

  const questionCountValid =
    questionTypeTotal === totalQuestions;

  const difficultyValid =
    difficultyTotal === totalQuestions;

  /* ---------------------------------------------------------
     WHEN TOTAL QUESTIONS CHANGES
  --------------------------------------------------------- */

  const handleTotalQuestionsChange = (value) => {
    const total = Math.max(
      1,
      numberValue(value, 1),
    );

    setForm((previous) => {
      const currentCoding = Math.min(
        numberValue(previous.codingQuestions),
        total,
      );

      const currentMcq = Math.max(
        0,
        total - currentCoding,
      );

      let easy = numberValue(
        previous.easyQuestions,
      );

      let medium = numberValue(
        previous.mediumQuestions,
      );

      let hard = numberValue(
        previous.hardQuestions,
      );

      const difficultySum =
        easy + medium + hard;

      if (difficultySum !== total) {
        easy = Math.floor(total * 0.3);
        medium = Math.floor(total * 0.5);
        hard =
          total -
          easy -
          medium;
      }

      return {
        ...previous,
        totalQuestions: total,
        mcqQuestions: currentMcq,
        codingQuestions: currentCoding,
        easyQuestions: easy,
        mediumQuestions: medium,
        hardQuestions: hard,
      };
    });
  };

  /* ---------------------------------------------------------
     GENERATE EDITABLE AI PAPER
  --------------------------------------------------------- */

  const generateAIPaper = async () => {
    setError("");
    setMessage("");

    if (!String(form.title || "").trim()) {
      setError(
        "Enter the test title before generating the AI paper.",
      );
      return;
    }

    if (!form.subject.trim()) {
      setError(
        "Enter the subject before generating the AI paper.",
      );
      return;
    }

    if (!questionCountValid) {
      setError(
        `MCQ Questions + Coding Questions must equal Total Questions (${totalQuestions}).`,
      );
      return;
    }

    if (!difficultyValid) {
      setError(
        `Easy + Medium + Hard must equal Total Questions (${totalQuestions}).`,
      );
      return;
    }

    try {
      setGenerating(true);

      const response = await fetch(
        `${API_URL}/api/admin/tests/generate`,
        {
          method: "POST",
          headers: getAdminAuthHeaders(true),
          body: JSON.stringify({
            title: String(form.title || "").trim(),
            subject: String(form.subject || "").trim(),
            description: String(form.description || "").trim(),
            topics: String(form.topics || form.subject || "").trim(),

            totalQuestions,
            mcqQuestions,
            codingQuestions,

            easyQuestions,
            mediumQuestions,
            hardQuestions,

            difficulty: form.difficulty,
            testType: form.testType,

            programmingLanguage:
              form.programmingLanguage,
            duration: Number(form.duration),
            startDate: form.startDate || null,
            endDate: form.endDate || null,
            instructions: String(form.instructions || "").trim(),
            accessStudentIds: Array.isArray(form.accessStudentIds) ? form.accessStudentIds : [],
            ...((editPaperId || generatedPaperId) ? { paperId: editPaperId || generatedPaperId } : {}),
          }),
        },
      );

      const data = await response
        .json()
        .catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data?.message ||
            data?.error ||
            `AI generation endpoint returned HTTP ${response.status}`,
        );
      }

      const generatedQuestions = asArray(
        data,
        "questions",
      );

      const returnedPaperId = data?.test?.paperId || data?.paperId || editPaperId || null;
      if (returnedPaperId) {
        setGeneratedPaperId(String(returnedPaperId));
      }

      if (!generatedQuestions.length) {
        throw new Error(
          "The AI endpoint returned no questions.",
        );
      }

      setQuestions(
        generatedQuestions.map((question, index) =>
          normalizeEditorQuestion(
            { ...question, type: question.type || (index < mcqQuestions ? "MCQ" : "CODING") },
            index,
            form.subject,
            form.programmingLanguage,
          ),
        ),
      );

      setMessage(
        "AI paper generated. You can now edit every question before publishing.",
      );
    } catch (err) {
      console.error(
        "AI question generation error:",
        err,
      );

      setQuestions([]);
      setError(
        err?.message ||
          "AI paper generation failed. Check the server console and Gemini connection."
      );
    } finally {
      setGenerating(false);
    }
  };

  /* ---------------------------------------------------------
     QUESTION EDITOR
  --------------------------------------------------------- */

  const updateQuestion = (
    questionIndex,
    field,
    value,
  ) => {
    setQuestions((previous) =>
      previous.map((question, index) =>
        index === questionIndex
          ? {
              ...question,
              [field]: value,
            }
          : question,
      ),
    );
  };

  const updateOption = (
    questionIndex,
    optionIndex,
    value,
  ) => {
    setQuestions((previous) =>
      previous.map((question, index) => {
        if (index !== questionIndex) {
          return question;
        }

        const options = Array.isArray(
          question.options,
        )
          ? [...question.options]
          : ["", "", "", ""];

        options[optionIndex] = value;

        return {
          ...question,
          options,
        };
      }),
    );
  };

  const removeQuestion = (questionIndex) => {
    setQuestions((previous) =>
      previous.filter(
        (_, index) => index !== questionIndex,
      ),
    );
  };

  const addQuestion = () => {
    setQuestions((previous) => [
      ...previous,
      {
        id: `manual-${Date.now()}`,
        question: "",
        type: "MCQ",
        difficulty: "Medium",
        topic: form.subject,
        options: ["", "", "", ""],
        correctAnswer: "",
        explanation: "",
        language:
          form.programmingLanguage,
        starterCode: "",
        testCases: [],
      },
    ]);
  };

  /* ---------------------------------------------------------
     PAYLOAD
  --------------------------------------------------------- */

  const buildPayload = (status) => ({
    title: String(form.title || "").trim(),
    subject: String(form.subject || "").trim(),
    topics: String(form.topics || form.subject || "").trim(),
    description: String(form.description || "").trim(),

    duration: Number(form.duration),

    totalQuestions: totalQuestions,

    mcqQuestions: mcqQuestions,

    codingQuestions: codingQuestions,

    difficultyDistribution: {
      easy: easyQuestions,
      medium: mediumQuestions,
      hard: hardQuestions,
    },

    difficulty: form.difficulty,

    testType: form.testType,

    programmingLanguage:
      String(form.programmingLanguage || "Python"),

    startDate:
      form.startDate || null,

    endDate:
      form.endDate || null,

    instructions:
      String(form.instructions || "").trim(),

    accessStudentIds: Array.isArray(form.accessStudentIds)
      ? form.accessStudentIds.map(String)
      : [],

    status,

    questions,
  });

  /* ---------------------------------------------------------
     SAVE TEST
  --------------------------------------------------------- */

  const saveTest = async (status) => {
    setError("");
    setMessage("");

    if (!form.title.trim()) {
      setError("Please enter a test title.");
      return;
    }

    if (!String(form.subject || "").trim()) {
      setError("Please enter a subject.");
      return;
    }

    if (Number(form.duration) <= 0) {
      setError(
        "Duration must be greater than 0 minutes.",
      );
      return;
    }

    if (totalQuestions <= 0) {
      setError(
        "Total Questions must be greater than 0.",
      );
      return;
    }

    if (!questionCountValid) {
      setError(
        `MCQ Questions (${mcqQuestions}) + Coding Questions (${codingQuestions}) must equal Total Questions (${totalQuestions}).`,
      );
      return;
    }

    if (!difficultyValid) {
      setError(
        `Easy (${easyQuestions}) + Medium (${mediumQuestions}) + Hard (${hardQuestions}) must equal Total Questions (${totalQuestions}).`,
      );
      return;
    }

    if (
      status === "published" &&
      questions.length !== totalQuestions
    ) {
      setError(
        `Before publishing, the paper should contain exactly ${totalQuestions} questions. Currently it contains ${questions.length}.`,
      );
      return;
    }

    try {
      if (status === "published") {
        setPublishing(true);
      } else {
        setSaving(true);
      }

      const effectivePaperId = editPaperId || generatedPaperId;
      const isEditingExistingTest = Boolean(effectivePaperId);
      const isPublishing = status === "published";
      let response;
      let data = {};

      if (isEditingExistingTest) {
        response = await fetch(
          `${API_URL}/api/admin/tests/${encodeURIComponent(effectivePaperId)}/sync`,
          {
            method: "PUT",
            headers: getAdminAuthHeaders(true),
            body: JSON.stringify(buildPayload("draft")),
          },
        );
        data = await response.json().catch(() => ({}));
        if (!response.ok || data?.success === false) {
          throw new Error(data?.message || data?.error || `Unable to synchronize test. HTTP ${response.status}`);
        }

        if (isPublishing) {
          response = await fetch(
            `${API_URL}/api/admin/tests/${encodeURIComponent(effectivePaperId)}/publish`,
            { method: "POST", headers: getAdminAuthHeaders() },
          );
          data = await response.json().catch(() => ({}));
          if (!response.ok || data?.success === false) {
            throw new Error(data?.message || data?.error || `Unable to publish test. HTTP ${response.status}`);
          }
        }
      } else {
        if (!questions.length) {
          throw new Error("Generate the AI paper before saving a new draft.");
        }
        throw new Error("Generate the AI paper first so the backend can assign a Paper ID.");
      }

      setMessage(
        isEditingExistingTest && isPublishing
          ? "Test published successfully."
          : "Draft saved successfully.",
      );

      if (onCreated) {
        await onCreated();
      }

      if (status === "published") {
        setTimeout(() => {
          onBack();
        }, 900);
      }
    } catch (err) {
      console.error(
        "Save test error:",
        err,
      );

      setError(
        err.message ||
          "Unable to save the test.",
      );
    } finally {
      setSaving(false);
      setPublishing(false);
    }
  };

  return (
    <div className="create-test-page">
      <header className="admin-header create-test-header">
        <div className="header-content">
          <p className="admin-header-label">
            TEST MANAGEMENT
          </p>

          <h1>{editPaperId ? "Edit Draft Test" : "Create a Test"}</h1>

          <p className="admin-header-subtitle">
            Build, configure, generate and edit
            your examination before publishing.
          </p>
        </div>
      </header>

      {error && (
        <div className="create-test-alert create-test-alert-error">
          <span>!</span>

          <div>
            <strong>
              Test configuration
            </strong>

            <p>{error}</p>
          </div>
        </div>
      )}

      {message && (
        <div className="create-test-alert create-test-alert-success">
          <span>?</span>

          <div>
            <strong>
              TestFlow
            </strong>

            <p>{message}</p>
          </div>
        </div>
      )}

      <form
        className="create-test-layout"
        onSubmit={(event) => {
          event.preventDefault();
          saveTest("draft");
        }}
      >
        <section className="create-test-main-card">
          <div className="create-test-section-heading">
            <div className="create-test-section-icon">
              ?
            </div>

            <div>
              <h2>Test Details</h2>

              <p>
                Define the basic information students
                will see.
              </p>
            </div>
          </div>

          <div className="create-test-form-grid">
            <div className="create-test-field create-test-field-full">
              <label htmlFor="test-title">
                Test Title <span>*</span>
              </label>

              <input
                id="test-title"
                type="text"
                placeholder="e.g. Data Structures Mid-Term"
                value={form.title}
                onChange={(event) =>
                  updateField(
                    "title",
                    event.target.value,
                  )
                }
              />
            </div>

            <div className="create-test-field">
              <label htmlFor="test-subject">
                Subject <span>*</span>
              </label>

              <input
                id="test-subject"
                type="text"
                placeholder="e.g. Data Structures"
                value={form.subject}
                onChange={(event) =>
                  updateField(
                    "subject",
                    event.target.value,
                  )
                }
              />
            </div>

            <div className="create-test-field">
              <label htmlFor="test-topics">
                Topics <span>*</span>
              </label>

              <input
                id="test-topics"
                type="text"
                placeholder="e.g. Arrays, Linked Lists, Trees"
                value={form.topics}
                onChange={(event) =>
                  updateField(
                    "topics",
                    event.target.value,
                  )
                }
              />

              <small>
                Topics the AI should use when creating the paper.
              </small>
            </div>

            <div className="create-test-field">
              <label htmlFor="test-type">
                Question Type
              </label>

              <select
                id="test-type"
                value={form.testType}
                onChange={(event) =>
                  updateField(
                    "testType",
                    event.target.value,
                  )
                }
              >
                <option value="MCQ">
                  Multiple Choice
                </option>

                <option value="CODING">
                  Coding
                </option>

                <option value="MIXED">
                  Mixed
                </option>

                <option value="TRUE_FALSE">
                  True / False
                </option>
              </select>
            </div>

            <div className="create-test-field create-test-field-full">
              <label htmlFor="test-description">
                Description
              </label>

              <textarea
                id="test-description"
                rows="4"
                placeholder="Write a short description about this examination..."
                value={form.description}
                onChange={(event) =>
                  updateField(
                    "description",
                    event.target.value,
                  )
                }
              />
            </div>
          </div>
        </section>

        <section className="create-test-main-card">
          <div className="create-test-section-heading">
            <div className="create-test-section-icon">
              #
            </div>

            <div>
              <h2>
                Question Configuration
              </h2>

              <p>
                Enter the exact number of questions
                required for this paper.
              </p>
            </div>
          </div>

          <div className="create-test-form-grid">
            <div className="create-test-field">
              <label htmlFor="total-questions">
                Total Questions
                <span>*</span>
              </label>

              <input
                id="total-questions"
                type="number"
                min="1"
                step="1"
                value={form.totalQuestions}
                onChange={(event) =>
                  handleTotalQuestionsChange(
                    event.target.value,
                  )
                }
              />

              <small>
                Maximum number of questions in
                this paper.
              </small>
            </div>

            <div className="create-test-field">
              <label htmlFor="mcq-questions">
                MCQ Questions
              </label>

              <input
                id="mcq-questions"
                type="number"
                min="0"
                step="1"
                max={totalQuestions}
                value={form.mcqQuestions}
                onChange={(event) =>
                  updateField(
                    "mcqQuestions",
                    event.target.value,
                  )
                }
              />

              <small>
                Number of multiple-choice questions.
              </small>
            </div>

            <div className="create-test-field">
              <label htmlFor="coding-questions">
                Coding Questions
              </label>

              <input
                id="coding-questions"
                type="number"
                min="0"
                step="1"
                max={totalQuestions}
                value={form.codingQuestions}
                onChange={(event) =>
                  updateField(
                    "codingQuestions",
                    event.target.value,
                  )
                }
              />

              <small>
                Number of programming questions.
              </small>
            </div>

            <div className="create-test-field">
              <label htmlFor="programming-language">
                Programming Language
              </label>

              <select
                id="programming-language"
                value={
                  form.programmingLanguage
                }
                onChange={(event) =>
                  updateField(
                    "programmingLanguage",
                    event.target.value,
                  )
                }
              >
                <option value="Python">
                  Python
                </option>

                <option value="C++">
                  C++
                </option>

                <option value="C">
                  C
                </option>

                <option value="Java">
                  Java
                </option>

                <option value="JavaScript">
                  JavaScript
                </option>

                <option value="TypeScript">
                  TypeScript
                </option>

                <option value="C#">
                  C#
                </option>

                <option value="Go">
                  Go
                </option>

                <option value="Rust">
                  Rust
                </option>

                <option value="Kotlin">
                  Kotlin
                </option>
              </select>

              <small>
                Applies to coding questions.
              </small>
            </div>
          </div>

          <div
            style={{
              marginTop: "18px",
              padding: "14px 16px",
              borderRadius: "12px",
              border: `1px solid ${
                questionCountValid
                  ? "rgba(88, 164, 108, 0.22)"
                  : "rgba(190, 83, 83, 0.28)"
              }`,
              background: questionCountValid
                ? "rgba(69, 139, 91, 0.07)"
                : "rgba(139, 42, 57, 0.08)",
              color: questionCountValid
                ? "#8bd2a0"
                : "#e3b0a9",
              fontSize: "12px",
              fontWeight: 700,
            }}
          >
            {questionCountValid ? (
              <>
                ? Question count is valid:
                {" "}
                {mcqQuestions} MCQ +{" "}
                {codingQuestions} Coding ={" "}
                {totalQuestions} Total
              </>
            ) : (
              <>
                ? Question count mismatch:
                {" "}
                {mcqQuestions} MCQ +{" "}
                {codingQuestions} Coding ={" "}
                {questionTypeTotal}, but Total
                Questions is{" "}
                {totalQuestions}.
              </>
            )}
          </div>
        </section>

        <section className="create-test-main-card">
          <div className="create-test-section-heading">
            <div className="create-test-section-icon">
              ?
            </div>

            <div>
              <h2>
                Difficulty Distribution
              </h2>

              <p>
                Enter how many Easy, Medium and Hard
                questions the paper should contain.
              </p>
            </div>
          </div>

          <div className="create-test-form-grid">
            <div className="create-test-field">
              <label htmlFor="easy-questions">
                Easy Questions
              </label>

              <input
                id="easy-questions"
                type="number"
                min="0"
                step="1"
                value={form.easyQuestions}
                onChange={(event) =>
                  updateField(
                    "easyQuestions",
                    event.target.value,
                  )
                }
              />
            </div>

            <div className="create-test-field">
              <label htmlFor="medium-questions">
                Medium Questions
              </label>

              <input
                id="medium-questions"
                type="number"
                min="0"
                step="1"
                value={form.mediumQuestions}
                onChange={(event) =>
                  updateField(
                    "mediumQuestions",
                    event.target.value,
                  )
                }
              />
            </div>

            <div className="create-test-field">
              <label htmlFor="hard-questions">
                Hard Questions
              </label>

              <input
                id="hard-questions"
                type="number"
                min="0"
                step="1"
                value={form.hardQuestions}
                onChange={(event) =>
                  updateField(
                    "hardQuestions",
                    event.target.value,
                  )
                }
              />
            </div>

            <div className="create-test-field">
              <label htmlFor="overall-difficulty">
                Overall Difficulty
              </label>

              <select
                id="overall-difficulty"
                value={form.difficulty}
                onChange={(event) =>
                  updateField(
                    "difficulty",
                    event.target.value,
                  )
                }
              >
                <option value="Easy">
                  Easy
                </option>

                <option value="Medium">
                  Medium
                </option>

                <option value="Hard">
                  Hard
                </option>

                <option value="Mixed">
                  Mixed
                </option>
              </select>
            </div>
          </div>

          <div
            style={{
              marginTop: "18px",
              padding: "14px 16px",
              borderRadius: "12px",
              border: `1px solid ${
                difficultyValid
                  ? "rgba(88, 164, 108, 0.22)"
                  : "rgba(190, 83, 83, 0.28)"
              }`,
              background: difficultyValid
                ? "rgba(69, 139, 91, 0.07)"
                : "rgba(139, 42, 57, 0.08)",
              color: difficultyValid
                ? "#8bd2a0"
                : "#e3b0a9",
              fontSize: "12px",
              fontWeight: 700,
            }}
          >
            {difficultyValid ? (
              <>
                ? Difficulty distribution is valid:
                {" "}
                {easyQuestions} Easy +{" "}
                {mediumQuestions} Medium +{" "}
                {hardQuestions} Hard ={" "}
                {totalQuestions}
              </>
            ) : (
              <>
                ? Difficulty mismatch:
                {" "}
                {easyQuestions} +{" "}
                {mediumQuestions} +{" "}
                {hardQuestions} ={" "}
                {difficultyTotal}, but Total
                Questions is{" "}
                {totalQuestions}.
              </>
            )}
          </div>
        </section>

        <section className="create-test-main-card create-test-schedule-card">
          <div className="create-test-section-heading">
            <div className="create-test-section-icon">
              ?
            </div>

            <div>
              <h2>Schedule</h2>

              <p>
                Optionally control when students can
                access the test.
              </p>
            </div>
          </div>

          <div className="create-test-form-grid">
            <div className="create-test-field">
              <label htmlFor="test-start">
                Start Date & Time
              </label>

              <input
                id="test-start"
                type="datetime-local"
                value={form.startDate}
                onChange={(event) =>
                  updateField(
                    "startDate",
                    event.target.value,
                  )
                }
              />
            </div>

            <div className="create-test-field">
              <label htmlFor="test-end">
                End Date & Time
              </label>

              <input
                id="test-end"
                type="datetime-local"
                value={form.endDate}
                onChange={(event) =>
                  updateField(
                    "endDate",
                    event.target.value,
                  )
                }
              />
            </div>

            <div className="create-test-field create-test-field-full">
              <label htmlFor="test-instructions">
                Student Instructions
              </label>

              <textarea
                id="test-instructions"
                rows="5"
                placeholder="Add instructions students should read before starting..."
                value={form.instructions}
                onChange={(event) =>
                  updateField(
                    "instructions",
                    event.target.value,
                  )
                }
              />
            </div>
          </div>
        </section>

        <section className="create-test-main-card">
          <div className="create-test-section-heading">
            <div className="create-test-section-icon">?</div>
            <div>
              <h2>Student Access</h2>
              <p>Select which StudentIDs can access this test. Leave everyone unselected to allow all students.</p>
            </div>
          </div>

          <div className="create-test-form-grid">
            <div className="create-test-field create-test-field-full">
              <label htmlFor="student-access-search">Search Students</label>
              <input
                id="student-access-search"
                type="text"
                placeholder="Search by StudentID, name or email..."
                value={studentSearch}
                onChange={(event) => setStudentSearch(event.target.value)}
              />
            </div>

            <div className="create-test-field create-test-field-full">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", marginBottom: "10px" }}>
                <strong>Allowed Students</strong>
                <button
                  type="button"
                  className="result-secondary-button"
                  onClick={() => {
                    const selectableStudentIds = availableStudents
                      .map((student) => String(student.studentId || "").trim())
                      .filter(Boolean);
                    const allSelected = selectableStudentIds.length > 0 &&
                      selectableStudentIds.every((studentId) => form.accessStudentIds.includes(studentId));
                    updateField("accessStudentIds", allSelected ? [] : selectableStudentIds);
                  }}
                  disabled={!availableStudents.some((student) => String(student.studentId || "").trim())}
                >
                  {availableStudents.some((student) => String(student.studentId || "").trim()) &&
                  availableStudents
                    .map((student) => String(student.studentId || "").trim())
                    .filter(Boolean)
                    .every((studentId) => form.accessStudentIds.includes(studentId))
                    ? "Clear All"
                    : "Select All"}
                </button>
              </div>

              {availableStudents.length === 0 ? (
                <div className="empty-state">No students are currently available.</div>
              ) : (
                <div style={{ maxHeight: "260px", overflowY: "auto", border: "1px solid rgba(91, 33, 38, 0.15)", borderRadius: "10px", padding: "8px" }}>
                  {availableStudents
                    .filter((student) => {
                      const query = studentSearch.trim().toLowerCase();
                      if (!query) return true;
                      return [student.studentId, student.name, student.email].some((value) => String(value || "").toLowerCase().includes(query));
                    })
                    .map((student) => {
                      const studentId = String(student.studentId || "").trim();
                      const hasStudentId = Boolean(studentId);
                      const checked = hasStudentId && form.accessStudentIds.includes(studentId);
                      return (
                        <label
                          key={student.id || studentId || student.email}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "10px",
                            padding: "9px 8px",
                            cursor: hasStudentId ? "pointer" : "default",
                            opacity: hasStudentId ? 1 : 0.65,
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={!hasStudentId}
                            onChange={() => {
                              if (!hasStudentId) return;
                              updateField(
                                "accessStudentIds",
                                checked
                                  ? form.accessStudentIds.filter((id) => id !== studentId)
                                  : [...form.accessStudentIds, studentId],
                              );
                            }}
                          />
                          <span>
                            <strong>{hasStudentId ? studentId : "ID not generated"}</strong> � {student.name || "Unknown Student"}
                            {student.email ? ` (${student.email})` : ""}
                          </span>
                        </label>
                      );
                    })}
                </div>
              )}

              <small style={{ display: "block", marginTop: "10px" }}>
                {form.accessStudentIds.length === 0
                  ? "All students can access this test."
                  : `${form.accessStudentIds.length} StudentID${form.accessStudentIds.length === 1 ? "" : "s"} selected.`}
                {availableStudents.some((student) => !String(student.studentId || "").trim()) && (
                  <span style={{ display: "block", marginTop: "4px" }}>Students without a generated StudentID cannot be assigned yet. They must generate their ID from Student Settings first.</span>
                )}
              </small>
            </div>
          </div>
        </section>

        <section className="create-test-main-card">
          <div className="create-test-section-heading">
            <div className="create-test-section-icon">
              ?
            </div>

            <div>
              <h2>
                AI Question Paper
              </h2>

              <p>
                Generate questions and review or edit
                them before publishing.
              </p>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "15px",
              padding: "18px",
              borderRadius: "14px",
              border:
                "1px solid rgba(215, 173, 88, 0.14)",
              background:
                "rgba(255,255,255,0.018)",
            }}
          >
            <div>
              <strong
                style={{
                  display: "block",
                  color: "#eee2d1",
                  fontSize: "13px",
                  marginBottom: "5px",
                }}
              >
                Generate Editable Paper
              </strong>

              <span
                style={{
                  color: "#76636c",
                  fontSize: "10px",
                }}
              >
                {totalQuestions} questions �{" "}
                {mcqQuestions} MCQ �{" "}
                {codingQuestions} Coding �{" "}
                {form.difficulty}
              </span>
            </div>

            <button
              type="button"
              className="result-primary-button"
              onClick={generateAIPaper}
              disabled={generating}
            >
              {generating
                ? "Generating..."
                : "? Generate with AI"}
            </button>
          </div>
        </section>

        {questions.length > 0 && (
          <section className="create-test-main-card">
            <div className="create-test-section-heading">
              <div className="create-test-section-icon">
                ?
              </div>

              <div>
                <h2>
                  Edit Question Paper
                </h2>

                <p>
                  Admin has full control. Edit AI-generated
                  questions before saving or publishing.
                </p>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "12px",
                marginBottom: "18px",
                padding: "12px 15px",
                borderRadius: "10px",
                background:
                  "rgba(215, 173, 88, 0.055)",
                border:
                  "1px solid rgba(215, 173, 88, 0.12)",
              }}
            >
              <span
                style={{
                  color: "#b8a5ac",
                  fontSize: "11px",
                }}
              >
                Paper contains{" "}
                <strong
                  style={{
                    color: "#f0d18c",
                  }}
                >
                  {questions.length}
                </strong>{" "}
                questions
              </span>

              <button
                type="button"
                className="result-primary-button"
                onClick={addQuestion}
              >
                + Add Question
              </button>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "18px",
              }}
            >
              {questions.map(
                (question, index) => {
                  const isCoding =
                    String(
                      question.type ||
                        "",
                    ).toUpperCase() ===
                    "CODING";

                  return (
                    <article
                      key={
                        question.id ||
                        index
                      }
                      style={{
                        padding: "18px",
                        borderRadius: "14px",
                        border:
                          "1px solid rgba(215, 173, 88, 0.12)",
                        background:
                          "rgba(0,0,0,0.12)",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent:
                            "space-between",
                          gap: "12px",
                          marginBottom:
                            "15px",
                        }}
                      >
                        <strong
                          style={{
                            color:
                              "#f0d18c",
                            fontSize:
                              "12px",
                          }}
                        >
                          QUESTION{" "}
                          {index + 1}
                        </strong>

                        <button
                          type="button"
                          onClick={() =>
                            removeQuestion(
                              index,
                            )
                          }
                          style={{
                            border:
                              "1px solid rgba(190,83,83,.22)",
                            borderRadius:
                              "8px",
                            padding:
                              "6px 9px",
                            background:
                              "rgba(139,42,57,.10)",
                            color:
                              "#dca39b",
                            cursor:
                              "pointer",
                            fontSize:
                              "10px",
                          }}
                        >
                          Remove
                        </button>
                      </div>

                      <div
                        className="create-test-form-grid"
                      >
                        <div className="create-test-field create-test-field-full">
                          <label>
                            Question
                          </label>

                          <textarea
                            rows="4"
                            placeholder="Write or edit the question..."
                            value={
                              question.question ||
                              ""
                            }
                            onChange={(
                              event,
                            ) =>
                              updateQuestion(
                                index,
                                "question",
                                event
                                  .target
                                  .value,
                              )
                            }
                          />
                        </div>

                        <div className="create-test-field">
                          <label>
                            Question Type
                          </label>

                          <select
                            value={
                              question.type ||
                              "MCQ"
                            }
                            onChange={(
                              event,
                            ) =>
                              updateQuestion(
                                index,
                                "type",
                                event
                                  .target
                                  .value,
                              )
                            }
                          >
                            <option value="MCQ">
                              MCQ
                            </option>

                            <option value="CODING">
                              Coding
                            </option>

                            <option value="TRUE_FALSE">
                              True / False
                            </option>
                          </select>
                        </div>

                        <div className="create-test-field">
                          <label>
                            Difficulty
                          </label>

                          <select
                            value={
                              question.difficulty ||
                              "Medium"
                            }
                            onChange={(
                              event,
                            ) =>
                              updateQuestion(
                                index,
                                "difficulty",
                                event
                                  .target
                                  .value,
                              )
                            }
                          >
                            <option value="Easy">
                              Easy
                            </option>

                            <option value="Medium">
                              Medium
                            </option>

                            <option value="Hard">
                              Hard
                            </option>
                          </select>
                        </div>

                        <div className="create-test-field">
                          <label>
                            Topic
                          </label>

                          <input
                            type="text"
                            value={
                              question.topic ||
                              ""
                            }
                            onChange={(
                              event,
                            ) =>
                              updateQuestion(
                                index,
                                "topic",
                                event
                                  .target
                                  .value,
                              )
                            }
                          />
                        </div>

                        {isCoding && (
                          <div className="create-test-field">
                            <label>
                              Programming Language
                            </label>

                            <select
                              value={
                                question.language ||
                                form.programmingLanguage
                              }
                              onChange={(
                                event,
                              ) =>
                                updateQuestion(
                                  index,
                                  "language",
                                  event
                                    .target
                                    .value,
                                )
                              }
                            >
                              <option value="Python">
                                Python
                              </option>

                              <option value="C++">
                                C++
                              </option>

                              <option value="C">
                                C
                              </option>

                              <option value="Java">
                                Java
                              </option>

                              <option value="JavaScript">
                                JavaScript
                              </option>

                              <option value="TypeScript">
                                TypeScript
                              </option>

                              <option value="C#">
                                C#
                              </option>

                              <option value="Go">
                                Go
                              </option>

                              <option value="Rust">
                                Rust
                              </option>
                            </select>
                          </div>
                        )}

                        {!isCoding && (
                          <>
                            <div className="create-test-field">
                              <label>
                                Option A
                              </label>

                              <input
                                type="text"
                                value={
                                  question
                                    .options?.[0] ||
                                  ""
                                }
                                onChange={(
                                  event,
                                ) =>
                                  updateOption(
                                    index,
                                    0,
                                    event
                                      .target
                                      .value,
                                  )
                                }
                              />
                            </div>

                            <div className="create-test-field">
                              <label>
                                Option B
                              </label>

                              <input
                                type="text"
                                value={
                                  question
                                    .options?.[1] ||
                                  ""
                                }
                                onChange={(
                                  event,
                                ) =>
                                  updateOption(
                                    index,
                                    1,
                                    event
                                      .target
                                      .value,
                                  )
                                }
                              />
                            </div>

                            <div className="create-test-field">
                              <label>
                                Option C
                              </label>

                              <input
                                type="text"
                                value={
                                  question
                                    .options?.[2] ||
                                  ""
                                }
                                onChange={(
                                  event,
                                ) =>
                                  updateOption(
                                    index,
                                    2,
                                    event
                                      .target
                                      .value,
                                  )
                                }
                              />
                            </div>

                            <div className="create-test-field">
                              <label>
                                Option D
                              </label>

                              <input
                                type="text"
                                value={
                                  question
                                    .options?.[3] ||
                                  ""
                                }
                                onChange={(
                                  event,
                                ) =>
                                  updateOption(
                                    index,
                                    3,
                                    event
                                      .target
                                      .value,
                                  )
                                }
                              />
                            </div>

                            <div className="create-test-field create-test-field-full">
                              <label>
                                Correct Answer
                              </label>

                              <input
                                type="text"
                                placeholder="Enter the correct option / answer"
                                value={
                                  question.correctAnswer ||
                                  ""
                                }
                                onChange={(
                                  event,
                                ) =>
                                  updateQuestion(
                                    index,
                                    "correctAnswer",
                                    event
                                      .target
                                      .value,
                                  )
                                }
                              />
                            </div>
                          </>
                        )}

                        {isCoding && (
                          <div className="create-test-field create-test-field-full">
                            <label>
                              Starter Code
                            </label>

                            <textarea
                              rows="6"
                              placeholder="Optional starter code..."
                              value={
                                question.starterCode ||
                                ""
                              }
                              onChange={(
                                event,
                              ) =>
                                updateQuestion(
                                  index,
                                  "starterCode",
                                  event
                                    .target
                                    .value,
                                )
                              }
                            />
                          </div>
                        )}

                        <div className="create-test-field create-test-field-full">
                          <label>
                            Explanation
                          </label>

                          <textarea
                            rows="3"
                            placeholder="Optional explanation / solution..."
                            value={
                              question.explanation ||
                              ""
                            }
                            onChange={(
                              event,
                            ) =>
                              updateQuestion(
                                index,
                                "explanation",
                                event
                                  .target
                                  .value,
                              )
                            }
                          />
                        </div>
                      </div>
                    </article>
                  );
                },
              )}
            </div>
          </section>
        )}

        <section className="create-test-preview-card">
          <div className="preview-top">
            <div>
              <p>
                LIVE PREVIEW
              </p>

              <h2>
                {form.title.trim() ||
                  "Your Test Title"}
              </h2>
            </div>

            <span className="preview-draft-badge">
              DRAFT
            </span>
          </div>

          <div className="preview-meta">
            <span>
              ?{" "}
              {String(form.subject || "").trim() ||
                "Subject"}
            </span>

            <span>
              ? {form.duration || 0} min
            </span>

            <span>
              ? {totalQuestions} questions
            </span>

            <span>
              ? {form.difficulty}
            </span>

            <span>
              MCQ {mcqQuestions}
            </span>

            <span>
              Coding {codingQuestions}
            </span>

            {codingQuestions > 0 && (
              <span>
                &lt;/&gt;{" "}
                {form.programmingLanguage}
              </span>
            )}
          </div>

          <div
            style={{
              display: "flex",
              gap: "10px",
              flexWrap: "wrap",
              marginTop: "14px",
              paddingTop: "14px",
              borderTop:
                "1px solid rgba(255,247,232,.07)",
            }}
          >
            <span>
              Easy: {easyQuestions}
            </span>

            <span>
              Medium: {mediumQuestions}
            </span>

            <span>
              Hard: {hardQuestions}
            </span>
          </div>
        </section>

        <div
          className="create-test-actions"
          style={{
            justifyContent:
              "flex-end",
            gap: "12px",
          }}
        >
          <button
            type="button"
            className="create-test-cancel-button"
            onClick={onBack}
            disabled={
              saving || publishing
            }
          >
            Cancel
          </button>

          <button
            type="button"
            className="create-test-cancel-button"
            disabled={
              saving || publishing
            }
            onClick={() =>
              saveTest("draft")
            }
          >
            {saving ? (
              <>
                <span className="create-test-spinner" />
                Saving...
              </>
            ) : (
              <>
                Save Draft
              </>
            )}
          </button>

          <button
            type="button"
            className="create-test-submit-button"
            disabled={
              saving ||
              publishing ||
              !questionCountValid ||
              !difficultyValid
            }
            onClick={() =>
              saveTest("published")
            }
          >
            {publishing ? (
              <>
                <span className="create-test-spinner" />
                Publishing...
              </>
            ) : (
              <>
                Publish Test
                <span>?</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

/* =========================================================
   ADMIN DASHBOARD
========================================================= */

function AdminDashboard({ onLogout }) {
  const [adminProfile, setAdminProfile] =
    useState({
      adminName: "Administrator",
      adminEmail:
        localStorage.getItem("admin_email") ||
        "admin@testflow.com",
      isPrimary: false,
    });

  const adminEmail =
    adminProfile.adminEmail;

  const [page, setPage] =
    useState("dashboard");

  const [editingPaperId, setEditingPaperId] = useState(null);

  const [dashboard, setDashboard] =
    useState(null);

  const [tests, setTests] =
    useState([]);

  const [students, setStudents] =
    useState([]);

  const [results, setResults] =
    useState([]);

  const [questions, setQuestions] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState("");

  const [lastUpdated, setLastUpdated] =
    useState(null);

  const fetchJson = useCallback(
    async (endpoint) => {
      const token = getAdminToken();

      if (!token) {
        throw new Error("Admin authentication token not found. Please log in again.");
      }

      const response = await fetch(
        `${API_URL}${endpoint}`,
        {
          method: "GET",
          cache: "no-store",
          headers: getAdminAuthHeaders(),
        },
      );

      const data = await response
        .json()
        .catch(() => ({}));

      if (response.status === 401) {
        throw new Error("Admin authentication failed. Please log in again.");
      }

      if (response.status === 403) {
        throw new Error(
          data?.message ||
            "You do not have permission to access this admin resource.",
        );
      }

      if (!response.ok) {
        throw new Error(
          data?.message ||
            `${endpoint} returned HTTP ${response.status}`,
        );
      }

      return data;
    },
    [],
  );

  const loadDashboard =
    useCallback(
      async (isRefresh = false) => {
        try {
          setError("");

          if (isRefresh) {
            setRefreshing(true);
          } else {
            setLoading(true);
          }

          const [
            data,
            settingsData,
          ] = await Promise.all([
            fetchJson(
              "/api/admin/dashboard",
            ),

            fetchJson(
              "/api/admin/settings",
            ).catch(() => null),
          ]);

          if (
            settingsData?.success &&
            settingsData.settings
          ) {
            setAdminProfile({
              adminName:
                settingsData.currentAdmin?.name ||
                settingsData.settings.adminName ||
                "Administrator",

              adminEmail:
                settingsData.currentAdmin?.email ||
                settingsData.settings.adminEmail ||
                "admin@testflow.com",

              isPrimary:
                settingsData.currentAdmin?.isPrimary === true,
            });
          }

          if (!data?.success) {
            throw new Error(
              data?.message ||
                "Admin dashboard data is unavailable.",
            );
          }

          setDashboard(data);
          setLastUpdated(
            new Date(),
          );
        } catch (err) {
          console.error(
            "Admin dashboard loading error:",
            err,
          );

          setError(
            err.message ||
              "Unable to load admin dashboard.",
          );
        } finally {
          setLoading(false);
          setRefreshing(false);
        }
      },
      [fetchJson],
    );

  const loadPageData =
    useCallback(
      async (targetPage) => {
        if (
          targetPage === "dashboard" ||
          targetPage === "create-test" ||
          targetPage === "settings" ||
          targetPage === "manage-admins"
        ) {
          if (targetPage === "dashboard") {
            await loadDashboard();
          }
          return;
        }

        const endpoints = {
          tests: [
            "/api/admin/tests",
            "tests",
          ],

          students: [
            "/api/admin/students",
            "students",
          ],

          results: [
            "/api/admin/results",
            "results",
          ],

          questions: [
            "/api/admin/questions",
            "questions",
          ],
        };

        const [
          endpoint,
          key,
        ] =
          endpoints[targetPage] ||
          [];

        if (!endpoint) return;

        try {
          setError("");
          setLoading(true);

          const data =
            await fetchJson(
              endpoint,
            );

          if (!data?.success) {
            throw new Error(
              data?.message ||
                `Unable to load ${targetPage}.`,
            );
          }

          const items = asArray(
            data,
            key,
          );

          if (
            targetPage ===
            "tests"
          ) {
            setTests(items);
          }

          if (
            targetPage ===
            "students"
          ) {
            setStudents(items);
          }

          if (
            targetPage ===
            "results"
          ) {
            setResults(items);
          }

          if (
            targetPage ===
            "questions"
          ) {
            setQuestions(items);
          }

          setLastUpdated(
            new Date(),
          );
        } catch (err) {
          console.error(
            `Admin ${targetPage} loading error:`,
            err,
          );

          setError(
            err.message ||
              `Unable to load ${targetPage}.`,
          );
        } finally {
          setLoading(false);
        }
      },
      [fetchJson, loadDashboard],
    );

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const navigate =
    useCallback(
      (target) => {
        setError("");
        setPage(target);

        if (
          target !==
          "create-test"
        ) {
          loadPageData(target);
        }
      },
      [loadPageData],
    );

  const handleCreateTest =
    () => {
      setEditingPaperId(null);
      navigate("create-test");
    };

  const handleEditDraft = (paperId) => {
    setEditingPaperId(String(paperId));
    setPage("create-test");
    setError("");
  };

  const handleTestCreated =
    async () => {
      await loadPageData(
        "tests",
      );
    };

  const stats =
    dashboard?.stats || {};

  const dashboardTests =
    Array.isArray(
      dashboard?.recentTests,
    )
      ? dashboard.recentTests
      : [];

  const recentActivity =
    Array.isArray(
      dashboard?.recentActivity,
    )
      ? dashboard.recentActivity
      : [];

  const totalStudents =
    Number(
      stats.students ??
        dashboard?.studentsCount ??
        0,
    );

  const totalTests =
    Number(
      stats.tests ??
        dashboard?.testsCount ??
        0,
    );

  const totalAttempts =
    Number(
      stats.attempts ??
        dashboard?.attemptsCount ??
        0,
    );

  const activeTests =
    Number(
      stats.activeTests ??
        dashboard?.activeTests ??
        0,
    );

  const visibleTests =
    useMemo(() => {
      const source =
        dashboardTests.length
          ? dashboardTests
          : tests;

      return [...source]
        .sort(
          (a, b) =>
            new Date(
              b.createdAt ||
                b.created_at ||
                0,
            ).getTime() -
            new Date(
              a.createdAt ||
                a.created_at ||
                0,
            ).getTime(),
        )
        .slice(0, 6);
    }, [
      dashboardTests,
      tests,
    ]);

  const questionSubjects =
    useMemo(() => {
      const map = new Map();

      questions.forEach(
        (item) => {
          const subject =
            item.subject ||
            item.title ||
            "Uncategorized";

          map.set(
            subject,
            (map.get(subject) ||
              0) + 1,
          );
        },
      );

      return [
        ...map.entries(),
      ].sort(
        (a, b) =>
          b[1] - a[1],
      );
    }, [questions]);

  if (
    loading &&
    !dashboard &&
    page ===
      "dashboard"
  ) {
    return (
      <main className="admin-dashboard">
        <div className="admin-loading">
          <div className="loading-mark">
            T
          </div>

          <h2>
            Loading Admin Dashboard
          </h2>

          <p>
            Reading real data from
            the TestFlow backend�
          </p>
        </div>
      </main>
    );
  }

  /* =========================================================
     DASHBOARD
  ========================================================= */

  const renderDashboard =
    () => (
      <>
        <header className="admin-header">
          <div className="header-content">
            <p className="admin-header-label">
              ADMINISTRATION
            </p>

            <h1>Dashboard</h1>

            <p className="admin-header-subtitle">
              Live information from your
              TestFlow backend.
            </p>
          </div>

          <div className="admin-header-actions">
            <button
              className={`notification-button ${
                refreshing
                  ? "refreshing"
                  : ""
              }`}
              onClick={() =>
                loadDashboard(true)
              }
              title="Refresh dashboard"
              type="button"
            >
              ?
            </button>

            <div className="header-admin">
              <div className="header-admin-avatar">
                A
              </div>

              <div>
                <strong>
                  {
                    adminProfile.adminName
                  }
                </strong>

                <small>
                  {adminEmail}
                </small>
              </div>
            </div>
          </div>
        </header>

        <div className="admin-stat-grid">
          <article className="admin-stat-card students-card">
            <div className="stat-icon students-icon">
              ?????
            </div>

            <div className="stat-content">
              <p>
                Total Students
              </p>

              <h2>
                {totalStudents.toLocaleString()}
              </h2>

              <span>
                Registered accounts
              </span>
            </div>
          </article>

          <article className="admin-stat-card tests-card">
            <div className="stat-icon tests-icon">
              ??
            </div>

            <div className="stat-content">
              <p>Total Tests</p>

              <h2>
                {totalTests.toLocaleString()}
              </h2>

              <span>
                Persisted examinations
              </span>
            </div>
          </article>

          <article className="admin-stat-card attempts-card">
            <div className="stat-icon attempts-icon">
              ??
            </div>

            <div className="stat-content">
              <p>
                Total Attempts
              </p>

              <h2>
                {totalAttempts.toLocaleString()}
              </h2>

              <span>
                All examination attempts
              </span>
            </div>
          </article>

          <article className="admin-stat-card active-card">
            <div className="stat-icon active-icon">
              ?
            </div>

            <div className="stat-content">
              <p>
                Active Tests
              </p>

              <h2>
                {String(
                  activeTests,
                ).padStart(
                  2,
                  "0",
                )}
              </h2>

              <span>
                Published tests
              </span>
            </div>
          </article>
        </div>

        <div className="admin-content-grid">
          <section className="dashboard-panel">
            <div className="panel-header">
              <div>
                <h2>
                  Recent Tests
                </h2>

                <p>
                  Tests currently stored
                  in TestFlow.
                </p>
              </div>

              <button
                className="view-all-button"
                onClick={() =>
                  navigate("tests")
                }
                type="button"
              >
                View All ?
              </button>
            </div>

            <div className="test-list">
              {visibleTests.length ===
              0 ? (
                <div className="empty-state">
                  No tests have been
                  created yet.
                </div>
              ) : (
                visibleTests.map(
                  (
                    test,
                    index,
                  ) => {
                    const name =
                      testName(
                        test,
                      );

                    const paperId =
                      test.paperId ||
                      test.paper_id ||
                      test.id ||
                      `test-${index}`;

                    const questionsCount =
                      Number(
                        test.questionCount ??
                          test.questions
                            ?.length ??
                          test.totalQuestions ??
                          0,
                      );

                    const totalQuestions =
                      Number(
                        test.totalQuestions ??
                          questionsCount,
                      );

                    const attempts =
                      Number(
                        test.attempts ??
                          test.attemptCount ??
                          0,
                      );

                    const status =
                      String(
                        test.status ||
                          "draft",
                      ).toLowerCase();

                    return (
                      <div
                        className="test-row"
                        key={paperId}
                      >
                        <div className="test-row-icon">
                          {name
                            .charAt(
                              0,
                            )
                            .toUpperCase()}
                        </div>

                        <div className="test-info">
                          <strong>
                            {name}
                          </strong>

                          <span>
                            Paper ID{" "}
                            {
                              paperId
                            }{" "}
                            �{" "}
                            {
                              questionsCount
                            }
                            /
                            {
                              totalQuestions
                            }{" "}
                            questions �{" "}
                            {
                              attempts
                            }{" "}
                            attempts
                          </span>
                        </div>

                        <span
                          className={`status ${statusClass(
                            status,
                          )}`}
                        >
                          {
                            status
                          }
                        </span>
                      </div>
                    );
                  },
                )
              )}
            </div>
          </section>

          <section className="dashboard-panel quick-actions-panel">
            <div className="panel-header">
              <div>
                <h2>
                  Quick Actions
                </h2>

                <p>
                  Work with your real
                  platform data.
                </p>
              </div>
            </div>

            <div className="quick-actions">
              <button
                onClick={
                  handleCreateTest
                }
                type="button"
              >
                <span className="quick-icon">
                  +
                </span>

                <div>
                  <strong>
                    Create Test
                  </strong>

                  <small>
                    Generate a new
                    examination
                  </small>
                </div>

                <b>?</b>
              </button>

              <button
                onClick={() =>
                  navigate("tests")
                }
                type="button"
              >
                <span className="quick-icon">
                  ?
                </span>

                <div>
                  <strong>
                    Manage Tests
                  </strong>

                  <small>
                    View every persisted
                    test
                  </small>
                </div>

                <b>?</b>
              </button>

              <button
                onClick={() =>
                  navigate(
                    "students",
                  )
                }
                type="button"
              >
                <span className="quick-icon">
                  ?????
                </span>

                <div>
                  <strong>
                    Manage Students
                  </strong>

                  <small>
                    View registered
                    students
                  </small>
                </div>

                <b>?</b>
              </button>

              <button
                onClick={() =>
                  navigate(
                    "results",
                  )
                }
                type="button"
              >
                <span className="quick-icon">
                  ??
                </span>

                <div>
                  <strong>
                    View Results
                  </strong>

                  <small>
                    Inspect submitted
                    examinations
                  </small>
                </div>

                <b>?</b>
              </button>

              <button
                onClick={() =>
                  navigate(
                    "questions",
                  )
                }
                type="button"
              >
                <span className="quick-icon">
                  ?
                </span>

                <div>
                  <strong>
                    Question Bank
                  </strong>

                  <small>
                    View generated
                    questions
                  </small>
                </div>

                <b>?</b>
              </button>
            </div>
          </section>
        </div>

        <section className="dashboard-panel activity-panel">
          <div className="panel-header">
            <div>
              <h2>
                Recent Activity
              </h2>

              <p>
                Latest events from
                persisted TestFlow data.
              </p>
            </div>
          </div>

          <div className="activity-list">
            {recentActivity.length ===
            0 ? (
              <div className="empty-state">
                No activity recorded yet.
              </div>
            ) : (
              recentActivity
                .slice(0, 8)
                .map(
                  (
                    item,
                    index,
                  ) => (
                    <div
                      className="activity-item"
                      key={
                        item.id ||
                        index
                      }
                    >
                      <div className="activity-dot" />

                      <div className="activity-content">
                        <strong>
                          {
                            item.title ||
                            "Activity"
                          }
                        </strong>

                        <p>
                          {
                            item.description ||
                            "TestFlow activity recorded."
                          }
                        </p>
                      </div>

                      <span>
                        {relativeTime(
                          item.timestamp,
                        )}
                      </span>
                    </div>
                  ),
                )
            )}
          </div>
        </section>
      </>
    );

  /* =========================================================
     TESTS
  ========================================================= */

  const renderTests = () => {
    const drafts = tests.filter((test) => String(test.status || "draft").toLowerCase() === "draft");
    const published = tests.filter((test) => String(test.status || "").toLowerCase() === "published");

    const renderTable = (items, emptyText) => (
      <div className="admin-table-wrap">
        {items.length === 0 ? (
          <div className="empty-state">{emptyText}</div>
        ) : (
          <table className="admin-table">
            <thead><tr><th>Paper ID</th><th>Test Name</th><th>Questions</th><th>Attempts</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead>
            <tbody>
              {items.map((test, index) => (
                <tr key={test.paperId || test.id || index}>
                  <td>{test.paperId || test.id || "�"}</td>
                  <td>{testName(test)}</td>
                  <td>{Number(test.questionCount ?? test.questions?.length ?? 0)}/{Number(test.totalQuestions ?? test.questionCount ?? test.questions?.length ?? 0)}</td>
                  <td>{Number(test.attempts ?? test.attemptCount ?? 0)}</td>
                  <td><span className={`status ${statusClass(test.status)}`}>{String(test.status || "draft")}</span></td>
                  <td>{formatDate(test.createdAt || test.created_at)}</td>
                  <td>
                    {String(test.status || "draft").toLowerCase() === "draft" ? (
                      <button type="button" className="result-primary-button" onClick={() => handleEditDraft(test.paperId)}>Open / Edit</button>
                    ) : (
                      <button type="button" className="create-test-cancel-button" onClick={() => handleEditDraft(test.paperId)}>View</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    );

    return (
      <section className="dashboard-panel page-panel">
        <div className="panel-header">
          <div><h2>Tests</h2><p>{tests.length} real tests loaded from the backend.</p></div>
          <button className="result-primary-button" onClick={handleCreateTest} type="button">+ Create Test</button>
        </div>
        <div style={{ marginBottom: "28px" }}>
          <div className="panel-header" style={{ marginBottom: "12px" }}><div><h3>Draft Tests</h3><p>{drafts.length} saved draft{drafts.length === 1 ? "" : "s"}. Open a draft to load the complete saved paper.</p></div></div>
          {renderTable(drafts, "No saved drafts found.")}
        </div>
        <div>
          <div className="panel-header" style={{ marginBottom: "12px" }}><div><h3>Published Tests</h3><p>{published.length} published test{published.length === 1 ? "" : "s"}.</p></div></div>
          {renderTable(published, "No published tests found.")}
        </div>
      </section>
    );
  };

  /* =========================================================
     STUDENTS
  ========================================================= */

  const renderStudents =
    () => (
      <AdminStudents
        onBack={() =>
          navigate(
            "dashboard",
          )
        }
      />
    );

  /* =========================================================
     SETTINGS
  ========================================================= */

  const renderSettings =
    () => (
      <AdminSettings
        onBack={() =>
          navigate(
            "dashboard",
          )
        }
      />
    );

  /* =========================================================
     RESULTS
  ========================================================= */

  const renderResults =
    () => (
      <section className="dashboard-panel page-panel">
        <div className="panel-header">
          <div>
            <h2>Results</h2>

            <p>
              {results.length} real
              submitted examinations.
            </p>
          </div>
        </div>

        <div className="admin-table-wrap">
          {results.length === 0 ? (
            <div className="empty-state">
              No submitted results yet.
            </div>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>
                    Student
                  </th>

                  <th>
                    Paper ID
                  </th>

                  <th>
                    Test
                  </th>

                  <th>
                    Score
                  </th>

                  <th>
                    Correct
                  </th>

                  <th>
                    Submitted
                  </th>
                </tr>
              </thead>

              <tbody>
                {results.map(
                  (
                    result,
                    index,
                  ) => (
                    <tr
                      key={
                        result.attemptId ||
                        result.id ||
                        index
                      }
                    >
                      <td>
                        <strong>
                          {
                            result.studentName ||
                            "Unknown Student"
                          }
                        </strong>

                        <small>
                          {
                            result.studentEmail ||
                            ""
                          }
                        </small>
                      </td>

                      <td>
                        {
                          result.paperId ||
                          "�"
                        }
                      </td>

                      <td>
                        {
                          result.subject ||
                          result.testName ||
                          "�"
                        }
                      </td>

                      <td>
                        {result.score ==
                        null
                          ? "�"
                          : `${result.score}%`}
                      </td>

                      <td>
                        {result.correct ==
                        null
                          ? "�"
                          : `${result.correct}/${result.totalQuestions || 0}`}
                      </td>

                      <td>
                        {formatDate(
                          result.submittedAt,
                        )}
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          )}
        </div>
      </section>
    );

  /* =========================================================
     QUESTIONS
  ========================================================= */

  const renderQuestions =
    () => (
      <section className="dashboard-panel page-panel">
        <div className="panel-header">
          <div>
            <h2>
              Question Bank
            </h2>

            <p>
              {questions.length} questions
              stored inside persisted
              tests.
            </p>
          </div>
        </div>

        {questionSubjects.length >
          0 && (
          <div className="question-summary">
            {questionSubjects
              .slice(0, 6)
              .map(
                ([
                  subject,
                  count,
                ]) => (
                  <div
                    className="question-summary-item"
                    key={subject}
                  >
                    <span>
                      {subject}
                    </span>

                    <strong>
                      {count}
                    </strong>
                  </div>
                ),
              )}
          </div>
        )}

        <div className="admin-table-wrap">
          {questions.length ===
          0 ? (
            <div className="empty-state">
              No questions found.
            </div>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>#</th>

                  <th>
                    Test
                  </th>

                  <th>
                    Topic
                  </th>

                  <th>
                    Type
                  </th>

                  <th>
                    Difficulty
                  </th>

                  <th>
                    Question
                  </th>
                </tr>
              </thead>

              <tbody>
                {questions.map(
                  (
                    question,
                    index,
                  ) => (
                    <tr
                      key={`${question.paperId || "paper"}-${
                        question.id ||
                        index
                      }`}
                    >
                      <td>
                        {question.number ||
                          index + 1}
                      </td>

                      <td>
                        {
                          question.subject ||
                          question.testName ||
                          "�"
                        }
                      </td>

                      <td>
                        {
                          question.topic ||
                          "General"
                        }
                      </td>

                      <td>
                        {
                          question.type ||
                          "MCQ"
                        }
                      </td>

                      <td>
                        {
                          question.difficulty ||
                          "Unknown"
                        }
                      </td>

                      <td className="question-cell">
                        {
                          question.question ||
                          "�"
                        }
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          )}
        </div>
      </section>
    );

  /* =========================================================
     MAIN DASHBOARD SHELL
  ========================================================= */

  return (
    <main className="admin-dashboard">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <span className="admin-brand-box">
            T
          </span>

          <span>
            TEST
            <span>FLOW</span>
          </span>
        </div>

        <div className="admin-profile">
          <div className="admin-avatar">
            A
          </div>

          <div>
            <h3>
              {
                adminProfile.adminName
              }
            </h3>

            <p>
              {adminEmail}
            </p>
          </div>
        </div>

        <nav className="admin-navigation">
          <button
            className={
              page === "dashboard"
                ? "active"
                : ""
            }
            onClick={() =>
              navigate(
                "dashboard",
              )
            }
            type="button"
          >
            <span>?</span>
            Dashboard
          </button>

          <button
            className={
              page ===
              "create-test"
                ? "active"
                : ""
            }
            onClick={
              handleCreateTest
            }
            type="button"
          >
            <span>+</span>
            Create Test
          </button>

          <button
            className={
              page === "tests"
                ? "active"
                : ""
            }
            onClick={() =>
              navigate("tests")
            }
            type="button"
          >
            <span>??</span>
            Tests
          </button>

          <button
            className={
              page === "students"
                ? "active"
                : ""
            }
            onClick={() =>
              navigate(
                "students",
              )
            }
            type="button"
          >
            <span>?????</span>
            Students
          </button>

          <button
            className={
              page === "results"
                ? "active"
                : ""
            }
            onClick={() =>
              navigate(
                "results",
              )
            }
            type="button"
          >
            <span>??</span>
            Results
          </button>

          <button
            className={
              page ===
              "questions"
                ? "active"
                : ""
            }
            onClick={() =>
              navigate(
                "questions",
              )
            }
            type="button"
          >
            <span>??</span>
            Questions
          </button>

          <button
            className={
              page === "manage-admins"
                ? "active"
                : ""
            }
            onClick={() =>
              navigate("manage-admins")
            }
            type="button"
          >
            <span>???</span>
            Manage Admins
          </button>

          <button
            className={page === "groups" ? "active" : ""}
            onClick={() => navigate("groups")}
            type="button"
          >
            <span>??</span>
            Groups
          </button>

          <button
            className={page === "notifications" ? "active" : ""}
            onClick={() => navigate("notifications")}
            type="button"
          >
            <span>??</span>
            Notifications
          </button>

          <button
            className={page === "private-messages" ? "active" : ""}
            onClick={() => navigate("private-messages")}
            type="button"
          >
            <span>??</span>
            Private Messages
          </button>

          <button
            className={
              page === "settings"
                ? "active"
                : ""
            }
            onClick={() =>
              navigate(
                "settings",
              )
            }
            type="button"
          >
            <span>?</span>
            Settings
          </button>
        </nav>

        <button
          className="admin-logout"
          onClick={onLogout}
          type="button"
        >
          <span>?</span>
          Logout
        </button>
      </aside>

      <section className="admin-main">
        {loading && (
          <div className="admin-loading-bar">
            <span />
          </div>
        )}

        {error &&
          page !==
            "create-test" && (
            <div className="admin-error">
              <strong>
                Some data could not be
                loaded.
              </strong>

              <span>
                {error}
              </span>

              <button
                onClick={() =>
                  loadPageData(
                    page,
                  )
                }
                type="button"
              >
                Retry
              </button>
            </div>
          )}

        {page ===
          "dashboard" &&
          renderDashboard()}

        {page ===
          "create-test" && (
          <CreateTestView
            editPaperId={editingPaperId}
            onBack={() => {
              setEditingPaperId(null);
              navigate("tests");
            }}
            onCreated={handleTestCreated}
          />
        )}

        {page === "tests" &&
          renderTests()}

        {page ===
          "students" &&
          renderStudents()}

        {page === "results" &&
          renderResults()}

        {page ===
          "questions" &&
          renderQuestions()}

        {page === "manage-admins" && (
          <AdminAdmins />
        )}

        {page === "groups" && <Groups role="admin" />}

        {page === "notifications" && <Notifications />}

        {page === "private-messages" && <PrivateMessages />}

        {page ===
          "settings" &&
          renderSettings()}

        <footer className="admin-data-footer">
          <span className="live-dot">
            ?
          </span>

          <strong>
            LIVE DATA
          </strong>

          <span>
            TestFlow Backend
          </span>

          <span>
            {lastUpdated
              ? `Updated ${lastUpdated.toLocaleTimeString()}`
              : "Waiting for data"}
          </span>

          <button
            onClick={() =>
              loadPageData(
                page,
              )
            }
            type="button"
          >
            Refresh data
          </button>
        </footer>
      </section>
    </main>
  );
}

export default AdminDashboard;