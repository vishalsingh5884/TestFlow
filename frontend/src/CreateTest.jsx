import { useEffect, useMemo, useState } from "react";
import "./CreateTest.css";

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "/api";

function getAdminToken() {
  return (
    localStorage.getItem("access_token") ||
    sessionStorage.getItem("access_token") ||
    localStorage.getItem("adminToken") ||
    sessionStorage.getItem("adminToken") ||
    localStorage.getItem("admin_token") ||
    sessionStorage.getItem("admin_token") ||
    ""
  );
}

function getAdminAuthHeaders(extra = {}) {
  const token = getAdminToken();
  return {
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

const defaultForm = {
  subject: "",
  programmingLanguage: "",
  topics: "",
  totalQuestions: 20,
  easyQuestions: 6,
  mediumQuestions: 8,
  hardQuestions: 6,
  codingQuestions: 5,
};

const defaultAccess = {
  mode: "selected",
  studentIds: [],
};

const PROGRAMMING_LANGUAGES = [
  "Python",
  "C",
  "C++",
  "Java",
  "JavaScript",
  "C#",
  "Go",
  "Rust",
  "PHP",
  "Other",
];

function CreateTest() {
  const [form, setForm] = useState(defaultForm);
  const [access, setAccess] = useState(defaultAccess);

  const [students, setStudents] = useState([]);
  const [studentSearch, setStudentSearch] = useState("");
  const [studentsLoading, setStudentsLoading] = useState(true);
  const [studentsError, setStudentsError] = useState("");

  const [paperId, setPaperId] = useState("");
  const [test, setTest] = useState(null);
  const [mode, setMode] = useState("create");

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");

  const [isGenerating, setIsGenerating] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const totalQuestionCount = Number(form.totalQuestions) || 0;
  const easyQuestionCount = Number(form.easyQuestions) || 0;
  const mediumQuestionCount = Number(form.mediumQuestions) || 0;
  const hardQuestionCount = Number(form.hardQuestions) || 0;
  const codingQuestionCount = Number(form.codingQuestions) || 0;

  const difficultyTotal =
    easyQuestionCount +
    mediumQuestionCount +
    hardQuestionCount;

  const remainingQuestions =
    totalQuestionCount - difficultyTotal;

  const mcqQuestions = Math.max(
    totalQuestionCount - codingQuestionCount,
    0,
  );

  const difficultyPercentages = useMemo(() => {
    if (totalQuestionCount <= 0) {
      return {
        easy: 0,
        medium: 0,
        hard: 0,
      };
    }

    return {
      easy: Math.round(
        (easyQuestionCount / totalQuestionCount) * 100,
      ),
      medium: Math.round(
        (mediumQuestionCount / totalQuestionCount) * 100,
      ),
      hard: Math.round(
        (hardQuestionCount / totalQuestionCount) * 100,
      ),
    };
  }, [
    totalQuestionCount,
    easyQuestionCount,
    mediumQuestionCount,
    hardQuestionCount,
  ]);

  const filteredStudents = useMemo(() => {
    const query = studentSearch.trim().toLowerCase();

    if (!query) {
      return students;
    }

    return students.filter((student) =>
      [student.studentId, student.name, student.email]
        .filter(Boolean)
        .some((value) =>
          String(value).toLowerCase().includes(query),
        ),
    );
  }, [students, studentSearch]);

  const selectedCount = access.studentIds.length;

  function showMessage(text, type) {
    setMessage(text);
    setMessageType(type);
  }

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));

    setMessage("");
    setMessageType("");
  }

  function handleQuestionChange(
    questionIndex,
    field,
    value,
  ) {
    setTest((previous) => {
      if (!previous) {
        return previous;
      }

      const updatedQuestions = [
        ...(previous.questions || []),
      ];

      updatedQuestions[questionIndex] = {
        ...updatedQuestions[questionIndex],
        [field]: value,
      };

      return {
        ...previous,
        questions: updatedQuestions,
      };
    });

    setMessage("");
    setMessageType("");
  }

  function handleOptionChange(
    questionIndex,
    optionIndex,
    value,
  ) {
    setTest((previous) => {
      if (!previous) {
        return previous;
      }

      const updatedQuestions = [
        ...(previous.questions || []),
      ];

      const currentQuestion =
        updatedQuestions[questionIndex];

      if (!currentQuestion) {
        return previous;
      }

      const oldOption =
        currentQuestion.options?.[optionIndex];

      const options = [
        ...(currentQuestion.options || []),
      ];

      options[optionIndex] = value;

      updatedQuestions[questionIndex] = {
        ...currentQuestion,
        options,
        correctAnswer:
          currentQuestion.correctAnswer === oldOption
            ? value
            : currentQuestion.correctAnswer,
      };

      return {
        ...previous,
        questions: updatedQuestions,
      };
    });

    setMessage("");
    setMessageType("");
  }

  function setAccessMode(modeValue) {
    setAccess((previous) => ({
      ...previous,
      mode: modeValue,
      studentIds:
        modeValue === "all"
          ? []
          : previous.studentIds,
    }));

    setMessage("");
    setMessageType("");
  }

  function toggleStudent(studentId) {
    const normalized = String(studentId);

    setAccess((previous) => {
      const exists =
        previous.studentIds.includes(normalized);

      return {
        ...previous,
        mode: "selected",
        studentIds: exists
          ? previous.studentIds.filter(
              (id) => id !== normalized,
            )
          : [
              ...previous.studentIds,
              normalized,
            ],
      };
    });

    setMessage("");
    setMessageType("");
  }

  function selectFilteredStudents() {
    const ids = filteredStudents
      .map((student) =>
        String(student.studentId || "").trim(),
      )
      .filter(Boolean);

    setAccess((previous) => ({
      ...previous,
      mode: "selected",
      studentIds: [
        ...new Set([
          ...previous.studentIds,
          ...ids,
        ]),
      ],
    }));

    setMessage("");
    setMessageType("");
  }

  function clearStudentSelection() {
    setAccess((previous) => ({
      ...previous,
      mode: "selected",
      studentIds: [],
    }));

    setMessage("");
    setMessageType("");
  }

  async function loadStudents() {
    setStudentsLoading(true);
    setStudentsError("");

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/admin/students`,
        { headers: getAdminAuthHeaders() },
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message ||
            "Failed to load students.",
        );
      }

      setStudents(
        Array.isArray(data.students)
          ? data.students
          : [],
      );
    } catch (error) {
      console.error(
        "Load students error:",
        error,
      );

      setStudentsError(
        error.message ||
          "Failed to load students.",
      );
    } finally {
      setStudentsLoading(false);
    }
  }

  function normalizeAccessFromTest(existingTest) {
    const accessIds = Array.isArray(existingTest?.accessStudentIds)
      ? existingTest.accessStudentIds
      : [];
    const assignedIds = Array.isArray(existingTest?.assignedStudentIds)
      ? existingTest.assignedStudentIds
      : [];
    const rawIds = accessIds.length > 0 ? accessIds : assignedIds;

    const normalizedIds = rawIds
      .map((id) => String(id || "").trim())
      .filter(Boolean);

    const isAll =
      existingTest?.accessMode === "all" ||
      normalizedIds.length === 0 ||
      normalizedIds.includes("all");

    return {
      mode: isAll ? "all" : "selected",
      studentIds: isAll ? [] : [...new Set(normalizedIds)],
    };
  }

  function buildTestPayload() {
    return {
      subject: form.subject.trim(),

      programmingLanguage:
        form.programmingLanguage.trim(),

      topics: form.topics.trim(),

      totalQuestions:
        Number(form.totalQuestions),

      easyQuestions:
        Number(form.easyQuestions),

      mediumQuestions:
        Number(form.mediumQuestions),

      hardQuestions:
        Number(form.hardQuestions),

      codingQuestions:
        Number(form.codingQuestions),

      accessMode: access.mode,

      accessStudentIds:
        access.mode === "all"
          ? []
          : access.studentIds,

      assignedStudentIds:
        access.mode === "all"
          ? []
          : access.studentIds,
    };
  }

  function validateBasicConfiguration() {
    const total = Number(form.totalQuestions);
    const easy = Number(form.easyQuestions);
    const medium = Number(form.mediumQuestions);
    const hard = Number(form.hardQuestions);
    const coding = Number(form.codingQuestions);

    if (!form.subject.trim()) {
      showMessage(
        "Please enter the subject.",
        "error",
      );
      return false;
    }

    if (!form.topics.trim()) {
      showMessage(
        "Please enter the topics to be covered.",
        "error",
      );
      return false;
    }

    if (!Number.isInteger(total) || total <= 0) {
      showMessage(
        "Total questions must be a positive integer.",
        "error",
      );
      return false;
    }

    if (
      ![
        easy,
        medium,
        hard,
        coding,
      ].every(Number.isInteger)
    ) {
      showMessage(
        "All question counts must be valid integers.",
        "error",
      );
      return false;
    }

    if (
      easy < 0 ||
      medium < 0 ||
      hard < 0 ||
      coding < 0
    ) {
      showMessage(
        "Question counts cannot be negative.",
        "error",
      );
      return false;
    }

    if (easy + medium + hard !== total) {
      showMessage(
        `Difficulty distribution must equal ${total}. Current distribution is ${easy + medium + hard}.`,
        "error",
      );
      return false;
    }

    if (coding > total) {
      showMessage(
        "Coding questions cannot be greater than Total Questions.",
        "error",
      );
      return false;
    }

    if (
      coding > 0 &&
      !form.programmingLanguage.trim()
    ) {
      showMessage(
        "Please select a programming language when Coding Questions is greater than 0.",
        "error",
      );
      return false;
    }

    return true;
  }

  function validateGeneratedPaper() {
    if (!test) {
      showMessage(
        "No question paper is available.",
        "error",
      );
      return false;
    }

    const questions = Array.isArray(
      test.questions,
    )
      ? test.questions
      : [];

    const total = Number(form.totalQuestions);
    const easy = Number(form.easyQuestions);
    const medium = Number(form.mediumQuestions);
    const hard = Number(form.hardQuestions);
    const coding = Number(form.codingQuestions);

    if (questions.length !== total) {
      showMessage(
        `The generated paper contains ${questions.length} questions, but ${total} questions are configured.`,
        "error",
      );
      return false;
    }

    let easyCount = 0;
    let mediumCount = 0;
    let hardCount = 0;
    let codingCount = 0;

    for (
      let index = 0;
      index < questions.length;
      index += 1
    ) {
      const question = questions[index];

      const isCoding =
        question.type === "Coding" ||
        question.type === "CODING";

      if (!question.question?.trim()) {
        showMessage(
          `Question ${index + 1} cannot be empty.`,
          "error",
        );
        return false;
      }

      if (question.difficulty === "Easy") {
        easyCount += 1;
      } else if (
        question.difficulty === "Medium"
      ) {
        mediumCount += 1;
      } else if (
        question.difficulty === "Hard"
      ) {
        hardCount += 1;
      } else {
        showMessage(
          `Question ${index + 1} has an invalid difficulty.`,
          "error",
        );
        return false;
      }

      if (isCoding) {
        codingCount += 1;

        if (
          !question.correctAnswer?.trim()
        ) {
          showMessage(
            `Coding Question ${index + 1} needs an expected/correct answer.`,
            "error",
          );
          return false;
        }

        continue;
      }

      if (question.type !== "MCQ") {
        showMessage(
          `Question ${index + 1} has an unsupported question type.`,
          "error",
        );
        return false;
      }

      if (
        !Array.isArray(question.options) ||
        question.options.length !== 4
      ) {
        showMessage(
          `MCQ Question ${index + 1} must have exactly 4 options.`,
          "error",
        );
        return false;
      }

      if (
        question.options.some(
          (option) => !option?.trim(),
        )
      ) {
        showMessage(
          `All options of MCQ Question ${index + 1} are required.`,
          "error",
        );
        return false;
      }

      if (!question.correctAnswer) {
        showMessage(
          `Please select the correct answer for Question ${index + 1}.`,
          "error",
        );
        return false;
      }

      if (
        !question.options.includes(
          question.correctAnswer,
        )
      ) {
        showMessage(
          `Correct answer of Question ${index + 1} must match one of its options.`,
          "error",
        );
        return false;
      }
    }

    if (
      easyCount !== easy ||
      mediumCount !== medium ||
      hardCount !== hard
    ) {
      showMessage(
        `Difficulty distribution does not match. Paper: Easy ${easyCount}, Medium ${mediumCount}, Hard ${hardCount}. Configured: Easy ${easy}, Medium ${medium}, Hard ${hard}.`,
        "error",
      );
      return false;
    }

    if (codingCount !== coding) {
      showMessage(
        `Coding question count does not match. Paper: ${codingCount}. Configured: ${coding}.`,
        "error",
      );
      return false;
    }

    const expectedMcqCount =
      total - coding;

    const actualMcqCount =
      questions.length - codingCount;

    if (actualMcqCount !== expectedMcqCount) {
      showMessage(
        `MCQ count does not match. Paper: ${actualMcqCount}. Expected: ${expectedMcqCount}.`,
        "error",
      );
      return false;
    }

    return true;
  }

  function validateForm({
    requireAssignment = false,
    validatePaper = false,
  } = {}) {
    if (!validateBasicConfiguration()) {
      return false;
    }

    if (requireAssignment) {
      if (
        access.mode === "selected" &&
        access.studentIds.length === 0
      ) {
        showMessage(
          "Select at least one student by Student ID before publishing, or choose All Students.",
          "error",
        );
        return false;
      }
    }

    if (
      validatePaper &&
      !validateGeneratedPaper()
    ) {
      return false;
    }

    return true;
  }

  useEffect(() => {
    loadStudents();

    const loadExistingTest = async () => {
      const params = new URLSearchParams(
        window.location.search,
      );

      const editId = params.get("edit");

      if (!editId) {
        return;
      }

      try {
        showMessage(
          "Loading test...",
          "info",
        );

        const response = await fetch(
          `${API_BASE_URL}/api/admin/tests/${editId}`,
          { headers: getAdminAuthHeaders() },
        );

        const data =
          await response.json();

        if (
          !response.ok ||
          !data.success
        ) {
          throw new Error(
            data.message ||
              "Failed to load test.",
          );
        }

        const existingTest =
          data.test;

        setTest(existingTest);
        setPaperId(
          existingTest.paperId,
        );

        setAccess(
          normalizeAccessFromTest(
            existingTest,
          ),
        );

        setForm({
          subject:
            existingTest.subject || "",

          programmingLanguage:
            existingTest.programmingLanguage ||
            "",

          topics:
            existingTest.topics || "",

          totalQuestions:
            existingTest.totalQuestions ||
            20,

          easyQuestions:
            existingTest.easyQuestions ??
            0,

          mediumQuestions:
            existingTest.mediumQuestions ??
            0,

          hardQuestions:
            existingTest.hardQuestions ??
            0,

          codingQuestions:
            existingTest.codingQuestions ??
            0,
        });

        setMode("edit");

        showMessage(
          "Test loaded successfully. You can edit the AI-generated paper and student access.",
          "success",
        );
      } catch (error) {
        console.error(
          "Load test error:",
          error,
        );

        showMessage(
          error.message ||
            "Failed to load test.",
          "error",
        );
      }
    };

    loadExistingTest();
  }, []);

  async function generateTest() {
    if (!validateForm()) {
      return;
    }

    setIsGenerating(true);
    setMessage("");
    setMessageType("");

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/admin/tests/generate`,
        {
          method: "POST",
          headers: getAdminAuthHeaders({
            "Content-Type":
              "application/json",
          }),
          body: JSON.stringify(
            buildTestPayload(),
          ),
        },
      );

      const data =
        await response.json();

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.message ||
            "Failed to generate test.",
        );
      }

      const generatedTest =
        data.test;

      setTest(generatedTest);
      setPaperId(
        generatedTest.paperId,
      );

      setAccess(
        normalizeAccessFromTest(
          generatedTest,
        ),
      );

      setMode("generated");

      showMessage(
        `AI question paper generated successfully. Paper ID: ${generatedTest.paperId}`,
        "success",
      );

      setTimeout(() => {
        document
          .getElementById(
            "question-paper-preview",
          )
          ?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
      }, 100);
    } catch (error) {
      console.error(
        "Generate test error:",
        error,
      );

      showMessage(
        error.message ||
          "Failed to generate test.",
        "error",
      );
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleRegenerate() {
    if (!validateForm()) {
      return;
    }

    await generateTest();
  }

  async function saveDraftToServer({
    validatePaper = true,
  } = {}) {
    if (!test) {
      showMessage(
        "Generate a question paper first.",
        "error",
      );
      return null;
    }

    if (
      !validateForm({
        validatePaper,
      })
    ) {
      return null;
    }

    // Published papers keep their questions/configuration locked, but their
    // StudentID access list must remain editable.
    if (String(test.status || "").toLowerCase() === "published") {
      const accessPayload = buildTestPayload();
      const response = await fetch(
        `${API_BASE_URL}/api/admin/tests/${encodeURIComponent(
          test.paperId,
        )}/access`,
        {
          method: "PUT",
          headers: getAdminAuthHeaders({
            "Content-Type":
              "application/json",
          }),
          body: JSON.stringify(accessPayload),
        },
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message ||
            "Failed to update test access.",
        );
      }

      setTest(data.test);
      setPaperId(data.test.paperId);
      setAccess(normalizeAccessFromTest(data.test));
      return data.test;
    }

    const payload = {
      ...buildTestPayload(),

      questions: Array.isArray(
        test.questions,
      )
        ? test.questions
        : [],

      status:
        test.status === "published"
          ? "published"
          : "draft",
    };

    const response = await fetch(
      `${API_BASE_URL}/api/admin/tests/${encodeURIComponent(
        test.paperId,
      )}`,
      {
        method: "PUT",

        headers: getAdminAuthHeaders({
          "Content-Type":
            "application/json",
        }),

        body: JSON.stringify(payload),
      },
    );

    const data =
      await response.json();

    if (
      !response.ok ||
      !data.success
    ) {
      throw new Error(
        data.message ||
          "Failed to save test.",
      );
    }

    setTest(data.test);
    setPaperId(data.test.paperId);

    setAccess(
      normalizeAccessFromTest(
        data.test,
      ),
    );

    return data.test;
  }

  async function handleSaveDraft() {
    if (!test) {
      showMessage(
        "Generate a question paper first.",
        "error",
      );
      return;
    }

    setIsSaving(true);
    setMessage("");
    setMessageType("");

    try {
      const savedTest =
        await saveDraftToServer({
          validatePaper: true,
        });

      if (!savedTest) {
        return;
      }

      setMode("generated");

      showMessage(
        "Draft saved successfully. All question edits, configuration, and student assignments have been saved.",
        "success",
      );
    } catch (error) {
      console.error(
        "Save draft error:",
        error,
      );

      showMessage(
        error.message ||
          "Failed to save draft.",
        "error",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handlePublish() {
    if (!test) {
      showMessage(
        "Generate a question paper first.",
        "error",
      );
      return;
    }

    if (
      !validateForm({
        requireAssignment: true,
        validatePaper: true,
      })
    ) {
      return;
    }

    setIsPublishing(true);
    setMessage("");
    setMessageType("");

    try {
      /*
       * First save every current edit.
       * This makes sure the published paper
       * is exactly what the admin sees.
       */
      const savedTest =
        await saveDraftToServer({
          validatePaper: true,
        });

      if (!savedTest) {
        return;
      }

      const response = await fetch(
        `${API_BASE_URL}/api/admin/tests/${encodeURIComponent(
          savedTest.paperId,
        )}/publish`,
        {
          method: "POST",

          headers: getAdminAuthHeaders({
            "Content-Type":
              "application/json",
          }),

          body: JSON.stringify({
            accessStudentIds:
              access.mode === "all"
                ? []
                : access.studentIds,
            assignedStudentIds:
              access.mode === "all"
                ? []
                : access.studentIds,
            accessMode: access.mode,
          }),
        },
      );

      const data =
        await response.json();

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.message ||
            "Failed to publish test.",
        );
      }

      setTest(data.test);
      setPaperId(data.test.paperId);

      setAccess(
        normalizeAccessFromTest(
          data.test,
        ),
      );

      setMode("generated");

      showMessage(
        data.test.accessMode === "all"
          ? "Test published successfully for all students."
          : `Test published successfully for ${
              data.test.assignedStudentIds
                ?.length || 0
            } selected student(s).`,
        "success",
      );
    } catch (error) {
      console.error(
        "Publish test error:",
        error,
      );

      showMessage(
        error.message ||
          "Failed to publish test.",
        "error",
      );
    } finally {
      setIsPublishing(false);
    }
  }

  function handleEdit() {
    if (!test) {
      return;
    }

    if (test.status === "published") {
      showMessage(
        "Published tests cannot be edited.",
        "error",
      );
      return;
    }

    setMode("edit");

    showMessage(
      "Edit mode enabled. You can modify the AI-generated questions, answers, explanations, difficulty, coding content, and student access.",
      "info",
    );

    setTimeout(() => {
      document
        .getElementById(
          "question-paper-preview",
        )
        ?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
    }, 100);
  }

  async function handleCancelEdit() {
    if (!test) {
      return;
    }

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/admin/tests/${encodeURIComponent(
          test.paperId,
        )}`,
        { headers: getAdminAuthHeaders() },
      );

      const data =
        await response.json();

      if (
        response.ok &&
        data.success
      ) {
        setTest(data.test);
        setPaperId(data.test.paperId);

        setAccess(
          normalizeAccessFromTest(
            data.test,
          ),
        );

        setForm({
          subject:
            data.test.subject || "",

          programmingLanguage:
            data.test.programmingLanguage ||
            "",

          topics:
            data.test.topics || "",

          totalQuestions:
            data.test.totalQuestions ||
            20,

          easyQuestions:
            data.test.easyQuestions ??
            0,

          mediumQuestions:
            data.test.mediumQuestions ??
            0,

          hardQuestions:
            data.test.hardQuestions ??
            0,

          codingQuestions:
            data.test.codingQuestions ??
            0,
        });
      } else {
        throw new Error(
          data.message ||
            "Could not reload the saved test.",
        );
      }

      setMode("generated");

      showMessage(
        "Unsaved changes were discarded.",
        "info",
      );
    } catch (error) {
      console.error(
        "Cancel edit error:",
        error,
      );

      showMessage(
        error.message ||
          "Could not reload the saved test.",
        "error",
      );
    }
  }

  function handleReset() {
    setForm({
      ...defaultForm,
    });

    setAccess({
      ...defaultAccess,
      studentIds: [],
    });

    setPaperId("");
    setTest(null);
    setMode("create");

    setMessage("");
    setMessageType("");

    setStudentSearch("");

    window.history.replaceState(
      {},
      "",
      window.location.pathname,
    );

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  async function copyPaperId() {
    if (!test?.paperId) {
      return;
    }

    try {
      await navigator.clipboard.writeText(
        test.paperId,
      );

      showMessage(
        "Paper ID copied to clipboard.",
        "success",
      );
    } catch {
      showMessage(
        `Paper ID: ${test.paperId}`,
        "info",
      );
    }
  }

  function renderAssignmentCard() {
    const isAll =
      access.mode === "all";

    return (
      <section
        className="create-test-card"
        id="student-assignment"
      >
        <div className="card-heading">
          <div className="heading-icon">
            03
          </div>

          <div>
            <h2>Student Access</h2>

            <p>
              Decide exactly which students
              can see and attempt this test.
            </p>
          </div>
        </div>

        <div className="access-mode-grid">
          <button
            type="button"
            onClick={() =>
              setAccessMode("selected")
            }
            className={`access-mode-card ${
              access.mode === "selected"
                ? "active selected"
                : ""
            }`}
          >
            <strong>
              Specific Students
            </strong>

            <div>
              Select one or more Student IDs.
            </div>
          </button>

          <button
            type="button"
            onClick={() =>
              setAccessMode("all")
            }
            className={`access-mode-card ${
              isAll ? "active all" : ""
            }`}
          >
            <strong>
              All Students
            </strong>

            <div>
              Every active student can see
              the published test.
            </div>
          </button>
        </div>

        {isAll ? (
          <div className="all-students-notice">
            <strong>
              ✓ Available to all students
            </strong>

            <p>
              This test will be visible to
              every active student after
              publishing.
            </p>
          </div>
        ) : (
          <>
            <div className="student-toolbar">
              <input
                type="search"
                value={studentSearch}
                onChange={(event) =>
                  setStudentSearch(
                    event.target.value,
                  )
                }
                placeholder="Search Student ID, name or email..."
              />

              <button
                type="button"
                className="secondary-button"
                onClick={
                  selectFilteredStudents
                }
              >
                Select Visible
              </button>

              <button
                type="button"
                className="secondary-button"
                onClick={
                  clearStudentSelection
                }
              >
                Clear Selection
              </button>

              <span>
                {selectedCount} selected
              </span>
            </div>

            {studentsLoading && (
              <p>Loading students...</p>
            )}

            {studentsError && (
              <div className="configuration-warning">
                {studentsError}

                <button
                  type="button"
                  onClick={loadStudents}
                >
                  Refresh
                </button>
              </div>
            )}

            {!studentsLoading &&
              !studentsError &&
              students.length === 0 && (
                <div className="configuration-warning">
                  No student accounts are
                  available yet. Create student
                  accounts first.
                </div>
              )}

            {!studentsLoading &&
              students.length > 0 && (
                <div className="student-list">
                  {filteredStudents.map(
                    (student) => {
                      const studentId =
                        String(
                          student.studentId ||
                            "",
                        );

                      const checked =
                        access.studentIds.includes(
                          studentId,
                        );

                      const blocked =
                        String(
                          student.status ||
                            "active",
                        ).toLowerCase() ===
                        "blocked";

                      return (
                        <label
                          key={
                            student.id ||
                            studentId
                          }
                          className={`student-row ${
                            checked
                              ? "selected"
                              : ""
                          } ${
                            blocked
                              ? "blocked"
                              : ""
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={
                              blocked ||
                              !studentId
                            }
                            onChange={() =>
                              toggleStudent(
                                studentId,
                              )
                            }
                          />

                          <div>
                            <strong>
                              #
                              {studentId ||
                                "No ID"}{" "}
                              •{" "}
                              {student.name}
                            </strong>

                            <span>
                              {student.email}

                              {blocked
                                ? " • BLOCKED"
                                : ""}
                            </span>
                          </div>
                        </label>
                      );
                    },
                  )}
                </div>
              )}

            {!studentsLoading &&
              students.length > 0 &&
              filteredStudents.length ===
                0 && (
                <p className="empty-search">
                  No students match your
                  search.
                </p>
              )}
          </>
        )}
      </section>
    );
  }

  function renderQuestionEditor(
    question,
    questionIndex,
  ) {
    const isCoding =
      question.type === "Coding" ||
      question.type === "CODING";

    return (
      <article
        className="question-preview"
        key={
          question.id ||
          questionIndex
        }
      >
        <div className="question-top">
          <div className="question-number">
            Q{question.number}
          </div>

          <div className="question-meta">
            <span
              className={`difficulty-tag ${(
                question.difficulty ||
                "Medium"
              ).toLowerCase()}`}
            >
              {question.difficulty}
            </span>

            <span className="question-type">
              {question.type}
            </span>

            <span className="topic-tag">
              {question.topic}
            </span>
          </div>
        </div>

        <div className="question-content">
          <div className="edit-field">
            <label>Question</label>

            <textarea
              value={question.question || ""}
              onChange={(event) =>
                handleQuestionChange(
                  questionIndex,
                  "question",
                  event.target.value,
                )
              }
              rows="4"
            />
          </div>

          <div className="edit-two-column">
            <div className="edit-field">
              <label>Topic</label>

              <input
                type="text"
                value={
                  question.topic || ""
                }
                onChange={(event) =>
                  handleQuestionChange(
                    questionIndex,
                    "topic",
                    event.target.value,
                  )
                }
              />
            </div>

            <div className="edit-field">
              <label>Difficulty</label>

              <select
                value={
                  question.difficulty ||
                  "Medium"
                }
                onChange={(event) =>
                  handleQuestionChange(
                    questionIndex,
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
              </select>
            </div>
          </div>

          {isCoding && (
            <>
              <div className="edit-field">
                <label>
                  Programming Language
                </label>

                <select
                  value={
                    question.programmingLanguage ||
                    form.programmingLanguage ||
                    ""
                  }
                  onChange={(event) =>
                    handleQuestionChange(
                      questionIndex,
                      "programmingLanguage",
                      event.target.value,
                    )
                  }
                >
                  <option value="">
                    Select language
                  </option>

                  {PROGRAMMING_LANGUAGES.map(
                    (language) => (
                      <option
                        value={language}
                        key={language}
                      >
                        {language}
                      </option>
                    ),
                  )}
                </select>
              </div>

              <div className="edit-field">
                <label>
                  Starter Code
                </label>

                <textarea
                  className="code-editor"
                  value={
                    question.starterCode ||
                    ""
                  }
                  onChange={(event) =>
                    handleQuestionChange(
                      questionIndex,
                      "starterCode",
                      event.target.value,
                    )
                  }
                  rows="8"
                  spellCheck="false"
                />
              </div>

              <div className="edit-field">
                <label>
                  Expected / Correct Answer
                </label>

                <textarea
                  value={
                    question.correctAnswer ||
                    ""
                  }
                  onChange={(event) =>
                    handleQuestionChange(
                      questionIndex,
                      "correctAnswer",
                      event.target.value,
                    )
                  }
                  rows="6"
                  spellCheck="false"
                />
              </div>
            </>
          )}

          {!isCoding && (
            <>
              <div className="edit-field">
                <label>
                  MCQ Options
                </label>

                <div className="editable-options">
                  {(
                    question.options || []
                  ).map(
                    (
                      option,
                      optionIndex,
                    ) => (
                      <div
                        className="editable-option"
                        key={
                          optionIndex
                        }
                      >
                        <span>
                          {String.fromCharCode(
                            65 +
                              optionIndex,
                          )}
                        </span>

                        <input
                          type="text"
                          value={
                            option
                          }
                          onChange={(
                            event,
                          ) =>
                            handleOptionChange(
                              questionIndex,
                              optionIndex,
                              event.target
                                .value,
                            )
                          }
                        />
                      </div>
                    ),
                  )}
                </div>
              </div>

              <div className="edit-field">
                <label>
                  Correct Answer
                </label>

                <select
                  value={
                    question.correctAnswer ||
                    ""
                  }
                  onChange={(event) =>
                    handleQuestionChange(
                      questionIndex,
                      "correctAnswer",
                      event.target.value,
                    )
                  }
                >
                  <option value="">
                    Select correct answer
                  </option>

                  {(
                    question.options || []
                  ).map(
                    (
                      option,
                      optionIndex,
                    ) => (
                      <option
                        value={option}
                        key={
                          optionIndex
                        }
                      >
                        {String.fromCharCode(
                          65 +
                            optionIndex,
                        )}{" "}
                        — {option}
                      </option>
                    ),
                  )}
                </select>
              </div>
            </>
          )}

          <div className="edit-field">
            <label>Explanation</label>

            <textarea
              value={
                question.explanation || ""
              }
              onChange={(event) =>
                handleQuestionChange(
                  questionIndex,
                  "explanation",
                  event.target.value,
                )
              }
              rows="4"
            />
          </div>
        </div>
      </article>
    );
  }

  return (
    <div className="create-test-page">
      <div className="create-test-header">
        <div>
          <div className="create-test-label">
            ADMIN • TEST MANAGEMENT
          </div>

          <h1>Create New Test</h1>

          <p>
            Configure an AI-ready test, review
            and edit the generated paper,
            control student access, and
            publish it using a unique Paper ID.
          </p>
        </div>

        {test && (
          <div className="paper-id-header">
            <span>Paper ID</span>
            <strong>{paperId}</strong>
          </div>
        )}
      </div>

      {message && (
        <div
          className={`create-message ${messageType}`}
        >
          <span>
            {messageType === "success"
              ? "✓"
              : messageType === "error"
                ? "!"
                : "i"}
          </span>

          <p>{message}</p>
        </div>
      )}

      <div className="create-test-layout">
        {/* =========================
            01 TEST INFORMATION
        ========================== */}

        <section className="create-test-card">
          <div className="card-heading">
            <div className="heading-icon">
              01
            </div>

            <div>
              <h2>Test Information</h2>

              <p>
                Give the AI question generator
                enough context to understand
                the test.
              </p>
            </div>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label>
                Subject{" "}
                <span className="required">
                  *
                </span>
              </label>

              <input
                name="subject"
                value={form.subject}
                onChange={handleChange}
                placeholder="e.g. Data Structures"
              />

              <small>
                Helps the AI understand the
                academic subject.
              </small>
            </div>

            <div className="form-group">
              <label>
                Programming Language{" "}
                {codingQuestionCount > 0 ? (
                  <span className="required">
                    *
                  </span>
                ) : (
                  <span className="optional">
                    Optional
                  </span>
                )}
              </label>

              <select
                name="programmingLanguage"
                value={
                  form.programmingLanguage
                }
                onChange={handleChange}
              >
                <option value="">
                  Select language
                </option>

                {PROGRAMMING_LANGUAGES.map(
                  (language) => (
                    <option
                      value={language}
                      key={language}
                    >
                      {language}
                    </option>
                  ),
                )}
              </select>

              <small>
                Required when coding questions
                are enabled.
              </small>
            </div>

            <div className="form-group full-width">
              <label>
                Topics to be Covered{" "}
                <span className="required">
                  *
                </span>
              </label>

              <textarea
                name="topics"
                value={form.topics}
                onChange={handleChange}
                placeholder="e.g. Arrays, Linked Lists, Stacks, Queues"
                rows="4"
              />

              <small>
                Separate multiple topics using
                commas.
              </small>
            </div>
          </div>
        </section>

        {/* =========================
            02 QUESTION CONFIGURATION
        ========================== */}

        <section className="create-test-card">
          <div className="card-heading">
            <div className="heading-icon">
              02
            </div>

            <div>
              <h2>
                Question Configuration
              </h2>

              <p>
                Control total questions, coding
                questions, and exact difficulty
                distribution.
              </p>
            </div>
          </div>

          <div className="question-mix-summary">
            <div className="question-total-card">
              <div className="mix-card-icon">
                #
              </div>

              <div>
                <span>
                  TOTAL QUESTIONS
                </span>

                <strong>
                  {totalQuestionCount}
                </strong>

                {mode === "edit" && (
                  <small>
                    Generate a new paper to
                    change the total count.
                  </small>
                )}
              </div>
            </div>

            <div className="question-type-card mcq-type-card">
              <div className="mix-card-top">
                <div>
                  <span className="mix-label">
                    MCQ QUESTIONS
                  </span>

                  <strong>
                    {mcqQuestions}
                  </strong>
                </div>

                <span className="mix-badge">
                  MCQ
                </span>
              </div>

              <small>
                Total minus coding questions.
              </small>
            </div>

            <div className="question-type-card coding-type-card">
              <div className="mix-card-top">
                <div>
                  <span className="mix-label">
                    CODING QUESTIONS
                  </span>

                  <strong>
                    {codingQuestionCount}
                  </strong>
                </div>

                <span className="mix-badge coding">
                  CODE
                </span>
              </div>

              <div className="coding-count-control">
                <button
                  type="button"
                  onClick={() =>
                    setForm((previous) => ({
                      ...previous,
                      codingQuestions:
                        Math.max(
                          0,
                          Number(
                            previous.codingQuestions,
                          ) - 1,
                        ),
                    }))
                  }
                  disabled={
                    codingQuestionCount <=
                    0
                  }
                >
                  −
                </button>

                <input
                  type="number"
                  min="0"
                  max={totalQuestionCount}
                  name="codingQuestions"
                  value={
                    form.codingQuestions
                  }
                  onChange={handleChange}
                />

                <button
                  type="button"
                  onClick={() =>
                    setForm((previous) => ({
                      ...previous,
                      codingQuestions:
                        Math.min(
                          Number(
                            previous.totalQuestions,
                          ) || 0,
                          Number(
                            previous.codingQuestions,
                          ) + 1,
                        ),
                    }))
                  }
                  disabled={
                    codingQuestionCount >=
                    totalQuestionCount
                  }
                >
                  +
                </button>
              </div>

              <small>
                Coding questions use the
                selected programming language.
              </small>
            </div>
          </div>

          <div className="question-type-hint">
            <span>QUESTION MIX</span>

            <div className="mix-bar">
              <div
                className="mix-bar-mcq"
                style={{
                  width: `${
                    totalQuestionCount > 0
                      ? (mcqQuestions /
                          totalQuestionCount) *
                        100
                      : 0
                  }%`,
                }}
              />

              <div
                className="mix-bar-coding"
                style={{
                  width: `${
                    totalQuestionCount > 0
                      ? (codingQuestionCount /
                          totalQuestionCount) *
                        100
                      : 0
                  }%`,
                }}
              />
            </div>

            <div className="mix-legend">
              <span>
                <i className="legend-dot mcq" />
                MCQ{" "}
                {totalQuestionCount > 0
                  ? Math.round(
                      (mcqQuestions /
                        totalQuestionCount) *
                        100,
                    )
                  : 0}
                %
              </span>

              <span>
                <i className="legend-dot coding" />
                Coding{" "}
                {totalQuestionCount > 0
                  ? Math.round(
                      (codingQuestionCount /
                        totalQuestionCount) *
                        100,
                    )
                  : 0}
                %
              </span>
            </div>
          </div>

          {/* DIFFICULTY */}

          <div className="difficulty-section">
            <div className="difficulty-heading">
              <div>
                <div className="section-kicker">
                  QUESTION DIFFICULTY
                </div>

                <h3>
                  Difficulty Distribution
                </h3>

                <p>
                  The three difficulty counts
                  must always add up to the
                  total number of questions.
                </p>
              </div>

              <div
                className={`difficulty-counter ${
                  remainingQuestions === 0
                    ? "balanced"
                    : "unbalanced"
                }`}
              >
                <strong>
                  {difficultyTotal}
                </strong>

                <span>
                  / {totalQuestionCount}
                </span>

                <small>
                  {remainingQuestions === 0
                    ? "Balanced"
                    : "Needs adjustment"}
                </small>
              </div>
            </div>

            <div className="difficulty-distribution">
              <div className="distribution-bar">
                <div
                  className="distribution-easy"
                  style={{
                    width: `${Math.min(
                      difficultyPercentages.easy,
                      100,
                    )}%`,
                  }}
                />

                <div
                  className="distribution-medium"
                  style={{
                    width: `${Math.min(
                      difficultyPercentages.medium,
                      100,
                    )}%`,
                  }}
                />

                <div
                  className="distribution-hard"
                  style={{
                    width: `${Math.min(
                      difficultyPercentages.hard,
                      100,
                    )}%`,
                  }}
                />
              </div>

              <div className="distribution-legend">
                <div>
                  <span className="legend-indicator easy" />
                  <span>Easy</span>
                  <strong>
                    {easyQuestionCount}
                  </strong>
                  <small>
                    {difficultyPercentages.easy}%
                  </small>
                </div>

                <div>
                  <span className="legend-indicator medium" />
                  <span>Medium</span>
                  <strong>
                    {mediumQuestionCount}
                  </strong>
                  <small>
                    {difficultyPercentages.medium}%
                  </small>
                </div>

                <div>
                  <span className="legend-indicator hard" />
                  <span>Hard</span>
                  <strong>
                    {hardQuestionCount}
                  </strong>
                  <small>
                    {difficultyPercentages.hard}%
                  </small>
                </div>
              </div>
            </div>

            <div className="difficulty-grid">
              <div className="difficulty-box easy">
                <div className="difficulty-box-top">
                  <div>
                    <span className="difficulty-dot" />
                    <strong>Easy</strong>
                  </div>

                  <b>
                    {difficultyPercentages.easy}%
                  </b>
                </div>

                <input
                  type="number"
                  min="0"
                  name="easyQuestions"
                  value={
                    form.easyQuestions
                  }
                  onChange={handleChange}
                />

                <div className="difficulty-progress">
                  <span
                    style={{
                      width: `${Math.min(
                        difficultyPercentages.easy,
                        100,
                      )}%`,
                    }}
                  />
                </div>

                <small>
                  Fundamentals &amp; basic
                  concepts
                </small>
              </div>

              <div className="difficulty-box medium">
                <div className="difficulty-box-top">
                  <div>
                    <span className="difficulty-dot" />
                    <strong>
                      Medium
                    </strong>
                  </div>

                  <b>
                    {difficultyPercentages.medium}%
                  </b>
                </div>

                <input
                  type="number"
                  min="0"
                  name="mediumQuestions"
                  value={
                    form.mediumQuestions
                  }
                  onChange={handleChange}
                />

                <div className="difficulty-progress">
                  <span
                    style={{
                      width: `${Math.min(
                        difficultyPercentages.medium,
                        100,
                      )}%`,
                    }}
                  />
                </div>

                <small>
                  Application &amp; problem
                  solving
                </small>
              </div>

              <div className="difficulty-box hard">
                <div className="difficulty-box-top">
                  <div>
                    <span className="difficulty-dot" />
                    <strong>Hard</strong>
                  </div>

                  <b>
                    {difficultyPercentages.hard}%
                  </b>
                </div>

                <input
                  type="number"
                  min="0"
                  name="hardQuestions"
                  value={
                    form.hardQuestions
                  }
                  onChange={handleChange}
                />

                <div className="difficulty-progress">
                  <span
                    style={{
                      width: `${Math.min(
                        difficultyPercentages.hard,
                        100,
                      )}%`,
                    }}
                  />
                </div>

                <small>
                  Advanced &amp; analytical
                  problems
                </small>
              </div>
            </div>

            {remainingQuestions !== 0 && (
              <div className="configuration-warning">
                <strong>
                  ⚠ Distribution needs
                  adjustment
                </strong>

                <span>
                  {remainingQuestions > 0
                    ? `${remainingQuestions} question(s) still need a difficulty level.`
                    : `${Math.abs(
                        remainingQuestions,
                      )} question(s) exceed the total.`}
                </span>
              </div>
            )}

            {remainingQuestions === 0 && (
              <div className="difficulty-balanced">
                <span>✓</span>

                <div>
                  <strong>
                    Difficulty distribution
                    is balanced
                  </strong>

                  <small>
                    Easy{" "}
                    {easyQuestionCount} •
                    Medium{" "}
                    {mediumQuestionCount} •
                    Hard{" "}
                    {hardQuestionCount}
                  </small>
                </div>
              </div>
            )}
          </div>

          <div className="generate-area">
            <div>
              <strong>
                Ready to generate?
              </strong>

              <p>
                Gemini will generate the
                question paper using your
                subject, topics, language,
                question count, coding count,
                and difficulty distribution.
              </p>
            </div>

            <button
              className="generate-button"
              onClick={generateTest}
              disabled={
                isGenerating ||
                mode === "edit"
              }
            >
              {isGenerating
                ? "Generating Paper..."
                : "Generate Test"}
            </button>
          </div>
        </section>

        {/* 03 STUDENT ACCESS */}

        {renderAssignmentCard()}

        {/* 04 QUESTION PAPER */}

        {test && (
          <section
            id="question-paper-preview"
            className="create-test-card question-paper-card"
          >
            <div className="generated-top">
              <div className="card-heading">
                <div className="heading-icon">
                  04
                </div>

                <div>
                  <h2>
                    Question Paper Preview
                  </h2>

                  <p>
                    {mode === "edit"
                      ? "Admin editing is enabled. Modify the AI-generated paper before saving or publishing."
                      : "Review the AI-generated paper before publishing it."}
                  </p>
                </div>
              </div>

              <span
                className={`test-status ${test.status}`}
              >
                {test.status ===
                "published"
                  ? "PUBLISHED"
                  : mode === "edit"
                    ? "EDITING"
                    : "DRAFT"}
              </span>
            </div>

            <div className="paper-preview-header">
              <div>
                <span>
                  QUESTION PAPER
                </span>

                <h2>
                  {test.subject}
                </h2>

                <p>
                  {test.programmingLanguage
                    ? `${test.programmingLanguage} • `
                    : ""}
                  {test.totalQuestions}{" "}
                  Questions •{" "}
                  {test.codingQuestions}{" "}
                  Coding Questions
                </p>

                <p>
                  Difficulty: Easy{" "}
                  {test.easyQuestions} •
                  Medium{" "}
                  {test.mediumQuestions} •
                  Hard{" "}
                  {test.hardQuestions}
                </p>

                <p>
                  Access:{" "}
                  {access.mode === "all"
                    ? "All Students"
                    : `${access.studentIds.length} selected student(s)`}
                </p>
              </div>

              <div className="paper-preview-id">
                <span>PAPER ID</span>

                <strong>
                  {test.paperId}
                </strong>

                <button
                  className="copy-button"
                  onClick={copyPaperId}
                >
                  Copy ID
                </button>
              </div>
            </div>

            <div className="questions-list">
              {test.questions?.map(
                (
                  question,
                  questionIndex,
                ) =>
                  mode === "edit" ? (
                    renderQuestionEditor(
                      question,
                      questionIndex,
                    )
                  ) : (
                    <article
                      className="question-preview"
                      key={
                        question.id ||
                        questionIndex
                      }
                    >
                      <div className="question-top">
                        <div className="question-number">
                          Q
                          {question.number}
                        </div>

                        <div className="question-meta">
                          <span
                            className={`difficulty-tag ${(
                              question.difficulty ||
                              "Medium"
                            ).toLowerCase()}`}
                          >
                            {
                              question.difficulty
                            }
                          </span>

                          <span className="question-type">
                            {question.type}
                          </span>

                          <span className="topic-tag">
                            {question.topic}
                          </span>
                        </div>
                      </div>

                      <div className="question-content">
                        <h3>
                          {
                            question.question
                          }
                        </h3>

                        {question.type ===
                          "MCQ" && (
                          <div className="options-list">
                            {question.options?.map(
                              (
                                option,
                                optionIndex,
                              ) => (
                                <div
                                  className={`option-row ${
                                    option ===
                                    question.correctAnswer
                                      ? "correct-option"
                                      : ""
                                  }`}
                                  key={
                                    optionIndex
                                  }
                                >
                                  <span className="option-letter">
                                    {String.fromCharCode(
                                      65 +
                                        optionIndex,
                                    )}
                                  </span>

                                  <span>
                                    {option}
                                  </span>

                                  {option ===
                                    question.correctAnswer && (
                                    <span className="answer-check">
                                      ✓
                                    </span>
                                  )}
                                </div>
                              ),
                            )}
                          </div>
                        )}

                        {(question.type ===
                          "Coding" ||
                          question.type ===
                            "CODING") && (
                          <div className="coding-preview">
                            <div className="coding-label">
                              CODING TASK
                            </div>

                            {question.programmingLanguage && (
                              <div>
                                Language:{" "}
                                <strong>
                                  {
                                    question.programmingLanguage
                                  }
                                </strong>
                              </div>
                            )}

                            <pre>
                              <code>
                                {question.starterCode ||
                                  "// Coding solution required"}
                              </code>
                            </pre>
                          </div>
                        )}

                        <div className="answer-panel">
                          <div>
                            <span>
                              CORRECT / EXPECTED
                              ANSWER
                            </span>

                            <strong>
                              {question.correctAnswer ||
                                "Not provided"}
                            </strong>
                          </div>

                          <div>
                            <span>
                              EXPLANATION
                            </span>

                            <p>
                              {question.explanation ||
                                "No explanation provided."}
                            </p>
                          </div>
                        </div>
                      </div>
                    </article>
                  ),
              )}
            </div>

            <div className="generated-actions">
              {mode !== "edit" && (
                <>
                  <button
                    className="secondary-button"
                    onClick={handleEdit}
                    disabled={
                      isGenerating ||
                      isPublishing ||
                      test.status ===
                        "published"
                    }
                  >
                    Edit AI Paper
                  </button>

                  <button
                    className="secondary-button"
                    onClick={
                      handleRegenerate
                    }
                    disabled={
                      isGenerating ||
                      isPublishing ||
                      test.status ===
                        "published"
                    }
                  >
                    {isGenerating
                      ? "Generating..."
                      : "Regenerate"}
                  </button>
                </>
              )}

              {mode === "edit" && (
                <>
                  <button
                    className="secondary-button"
                    onClick={
                      handleCancelEdit
                    }
                    disabled={
                      isSaving ||
                      isPublishing
                    }
                  >
                    Cancel Edit
                  </button>

                  <button
                    className="draft-button"
                    onClick={
                      handleSaveDraft
                    }
                    disabled={
                      isSaving ||
                      isPublishing
                    }
                  >
                    {isSaving
                      ? "Saving..."
                      : "Save Draft"}
                  </button>

                  <button
                    className="publish-button"
                    onClick={handlePublish}
                    disabled={
                      isSaving ||
                      isPublishing
                    }
                  >
                    {isPublishing
                      ? "Publishing..."
                      : "Save & Publish"}
                  </button>
                </>
              )}

              {mode !== "edit" && (
                <>
                  <button
                    className="draft-button"
                    onClick={
                      handleSaveDraft
                    }
                    disabled={
                      isSaving ||
                      isPublishing ||
                      test.status ===
                        "published"
                    }
                  >
                    {isSaving
                      ? "Saving..."
                      : "Save Draft"}
                  </button>

                  <button
                    className="publish-button"
                    onClick={handlePublish}
                    disabled={
                      test.status ===
                        "published" ||
                      isPublishing
                    }
                  >
                    {test.status ===
                    "published"
                      ? "Published ✓"
                      : isPublishing
                        ? "Publishing..."
                        : "Publish Test"}
                  </button>
                </>
              )}
            </div>
          </section>
        )}
      </div>

      <div className="create-test-footer">
        <button
          className="reset-test-button"
          onClick={handleReset}
        >
          + Create Another Test
        </button>

        <span>
          Student access is enforced by the
          backend using permanent Student IDs.
          Publishing a selected-student test
          does not expose it to other students.
        </span>
      </div>
    </div>
  );
}

export default CreateTest;

