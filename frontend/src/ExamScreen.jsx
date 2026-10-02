import { useEffect, useMemo, useState } from "react";
import "./ExamScreen.css";
const API_URL = (
  import.meta.env.VITE_API_URL ||
  "/api"
).replace(/\/$/, "");

function getQuestionKey(question, fallbackIndex) {
  if (!question) return String(fallbackIndex);

  const rawKey =
    question.id ??
    question._id ??
    question.questionId ??
    question.number ??
    fallbackIndex;

  return String(rawKey);
}

function Icon({ name, size = 20, strokeWidth = 2, className = "" }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    className,
    "aria-hidden": "true",
    focusable: "false",
  };

  const paths = {
    checkCircle: (
      <>
        <circle cx="12" cy="12" r="9.5" />
        <path d="m8.5 12.2 2.2 2.2 4.8-5" />
      </>
    ),
    alertCircle: (
      <>
        <circle cx="12" cy="12" r="9.5" />
        <path d="M12 7.5v5" />
        <path d="M12 16.5h.01" />
      </>
    ),
    helpCircle: (
      <>
        <circle cx="12" cy="12" r="9.5" />
        <path d="M9.8 9.3a2.4 2.4 0 1 1 4.1 1.7c-.8.8-1.9 1.2-1.9 2.5" />
        <path d="M12 16.6h.01" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="9.5" />
        <path d="M12 7v5l3.2 1.9" />
      </>
    ),
    star: (
      <path d="m12 3.8 2.55 5.18 5.72.83-4.14 4.04.98 5.7L12 16.87l-5.11 2.68.98-5.7-4.14-4.04 5.72-.83L12 3.8Z" />
    ),
    check: <path d="m5.5 12.5 4 4 9-9" />,
    arrowLeft: (
      <>
        <path d="M19 12H5" />
        <path d="m12 19-7-7 7-7" />
      </>
    ),
    arrowRight: (
      <>
        <path d="M5 12h14" />
        <path d="m12 5 7 7-7 7" />
      </>
    ),
    logOut: (
      <>
        <path d="M10 5H6.5A1.5 1.5 0 0 0 5 6.5v11A1.5 1.5 0 0 0 6.5 19H10" />
        <path d="m14 8 4 4-4 4" />
        <path d="M18 12H9" />
      </>
    ),
  };

  return <svg {...common}>{paths[name]}</svg>;
}

function ExamScreen({ test, onExit }) {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState({});
  const [markedQuestions, setMarkedQuestions] = useState([]);
  const [timeLeft, setTimeLeft] = useState(
    Math.max(Number(test?.duration || test?.timeLimit || 30), 1) * 60
  );
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [submitError, setSubmitError] = useState("");

  const questions = useMemo(() => {
    return Array.isArray(test?.questions) ? test.questions : [];
  }, [test]);

  const question = questions[currentQuestion];

  const answeredCount = Object.keys(answers).length;

  const progress =
    questions.length > 0
      ? ((currentQuestion + 1) / questions.length) * 100
      : 0;

  const formatTime = (seconds) => {
    const safeSeconds = Math.max(seconds, 0);

    const hours = Math.floor(safeSeconds / 3600);
    const minutes = Math.floor((safeSeconds % 3600) / 60);
    const secs = safeSeconds % 60;

    if (hours > 0) {
      return `${String(hours).padStart(2, "0")}:${String(
        minutes
      ).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    }

    return `${String(minutes).padStart(2, "0")}:${String(
      secs
    ).padStart(2, "0")}`;
  };

  useEffect(() => {
    if (result || submitting || questions.length === 0) {
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((previous) => {
        if (previous <= 1) {
          clearInterval(timer);
          return 0;
        }

        return previous - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [result, submitting, questions.length]);

  useEffect(() => {
    if (
      timeLeft === 0 &&
      questions.length > 0 &&
      !submitting &&
      !result
    ) {
      handleSubmit(true);
    }
  }, [timeLeft]);

  const selectAnswer = (option) => {
    if (!question || submitting || result) {
      return;
    }

    const answerKey = getQuestionKey(question, currentQuestion);

    setAnswers((previous) => ({
      ...previous,
      [answerKey]: option,
    }));
  };

  const toggleMark = () => {
    setMarkedQuestions((previous) => {
      if (previous.includes(currentQuestion)) {
        return previous.filter(
          (number) => number !== currentQuestion
        );
      }

      return [...previous, currentQuestion];
    });
  };

  const goToQuestion = (index) => {
    if (
      index >= 0 &&
      index < questions.length &&
      !submitting &&
      !result
    ) {
      setCurrentQuestion(index);
    }
  };

  const nextQuestion = () => {
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion((previous) => previous + 1);
    }
  };

  const previousQuestion = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion((previous) => previous - 1);
    }
  };

  const handleSubmit = async (automatic = false) => {
    if (submitting || result) {
      return;
    }

    if (!automatic) {
      const confirmed = window.confirm(
        "Are you sure you want to submit your examination?"
      );

      if (!confirmed) {
        return;
      }
    }

    setSubmitting(true);
    setSubmitError("");

    const token =
      localStorage.getItem("student_token") ||
      sessionStorage.getItem("student_token") ||
      localStorage.getItem("access_token") ||
      sessionStorage.getItem("access_token");

    try {
      const paperId =
        test?.paperId ||
        test?.paper_id ||
        test?.id;

      const attemptId =
        test?.attemptId ||
        test?.attempt_id ||
        localStorage.getItem("attemptId") ||
        localStorage.getItem("studentAttemptId") ||
        localStorage.getItem("examAttemptId") ||
        sessionStorage.getItem("attemptId") ||
        "";

      if (!paperId) {
        throw new Error("Paper ID is missing for this examination.");
      }

      if (!attemptId) {
        throw new Error("Examination attempt ID is missing. Please start the test again.");
      }

      const response = await fetch(
        `${API_URL}/api/student/tests/${paperId}/submit`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token
              ? {
                  Authorization: `Bearer ${token}`,
                }
              : {}),
          },
          body: JSON.stringify({
            attemptId,
            answers,
          }),
        }
      );

      let data = {};

      try {
        data = await response.json();
      } catch {
        data = {};
      }

      if (!response.ok) {
        throw new Error(
          data.message ||
            data.detail ||
            "Unable to submit the examination."
        );
      }

      setResult(data);
    } catch (error) {
      console.error("Exam submission error:", error);

      setSubmitError(
        error.message ||
          "Something went wrong while submitting the examination."
      );

      setSubmitting(false);
    }
  };

  const getQuestionText = (item) => {
    return (
      item?.question ||
      item?.questionText ||
      item?.text ||
      item?.title ||
      "Question"
    );
  };

  const getOptions = (item) => {
    if (Array.isArray(item?.options)) {
      return item.options;
    }

    if (Array.isArray(item?.choices)) {
      return item.choices;
    }

    return [];
  };

  if (!test) {
    return (
      <div className="exam-page">
        <div className="exam-empty">
          <div className="empty-icon"><Icon name="alertCircle" size={32} strokeWidth={1.8} /></div>

          <h2>Examination unavailable</h2>

          <p>
            We could not load the examination data.
            Please return to your dashboard and try again.
          </p>

          <button
            className="exam-primary-button"
            onClick={onExit}
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (result) {
    return (
      <div className="exam-page">
        <div className="result-wrapper">
          <div className="result-card">
            <div className="result-icon"><Icon name="checkCircle" size={42} strokeWidth={1.8} /></div>

            <span className="result-label">
              EXAMINATION SUBMITTED
            </span>

            <h1>Test Completed</h1>

            <p className="result-message">
              Your examination has been submitted successfully.
            </p>

            <div className="result-stats">
              <div>
                <span>Questions</span>
                <strong>
                  {result.totalQuestions ??
                    questions.length}
                </strong>
              </div>

              <div>
                <span>Answered</span>
                <strong>
                  {result.answered ??
                    answeredCount}
                </strong>
              </div>

              <div>
                <span>Score</span>
                <strong>
                  {result.score !== undefined &&
                  result.score !== null
                    ? result.score
                    : "�"}
                </strong>
              </div>
            </div>

            <button
              className="exam-primary-button result-button"
              onClick={onExit}
            >
              Return to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="exam-page">
        <div className="exam-empty">
          <div className="empty-icon"><Icon name="helpCircle" size={32} strokeWidth={1.8} /></div>

          <h2>No questions found</h2>

          <p>
            This examination does not contain any questions.
          </p>

          <button
            className="exam-primary-button"
            onClick={onExit}
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const options = getOptions(question);

  const isMarked =
    markedQuestions.includes(currentQuestion);

  const isLastQuestion =
    currentQuestion === questions.length - 1;

  const timerWarning = timeLeft <= 300;

  return (
    <div className="exam-page">
      <header className="exam-header">
        <div className="exam-brand">
          <div className="exam-brand-icon">T</div>

          <div>
            <div className="exam-brand-name">
              TEST<span>FLOW</span>
            </div>

            <div className="exam-brand-subtitle">
              Secure Examination
            </div>
          </div>
        </div>

        <div className="exam-title">
          <strong>
            {test.title ||
              test.name ||
              "Online Examination"}
          </strong>

          <span>
            Paper ID:{" "}
            {test.paperId ||
              test.paper_id ||
              test.id ||
              "�"}
          </span>
        </div>

        <div
          className={`exam-timer ${
            timerWarning ? "warning" : ""
          }`}
        >
          <span className="timer-icon"><Icon name="clock" size={22} strokeWidth={2.2} /></span>

          <div>
            <small>TIME REMAINING</small>

            <strong>
              {formatTime(timeLeft)}
            </strong>
          </div>
        </div>
      </header>

      <div className="exam-progress-container">
        <div className="exam-progress-info">
          <span>
            Question {currentQuestion + 1} of{" "}
            {questions.length}
          </span>

          <span>
            {answeredCount}/{questions.length} answered
          </span>
        </div>

        <div className="exam-progress-track">
          <div
            className="exam-progress-bar"
            style={{
              width: `${progress}%`,
            }}
          />
        </div>
      </div>

      <main className="exam-content">
        <section className="question-panel">
          <div className="question-top">
            <div className="question-number">
              QUESTION {String(currentQuestion + 1).padStart(2, "0")}
            </div>

            <button
              className={`mark-button ${
                isMarked ? "marked" : ""
              }`}
              onClick={toggleMark}
              type="button"
            >
              <span><Icon name="star" size={18} strokeWidth={1.9} /></span>
              {isMarked ? "Marked" : "Mark for review"}
            </button>
          </div>

          <h1 className="question-text">
            {getQuestionText(question)}
          </h1>

          {question?.description && (
            <p className="question-description">
              {question.description}
            </p>
          )}

          <div className="options-list">
            {options.map((option, index) => {
              const optionText =
                typeof option === "object"
                  ? option.text ||
                    option.label ||
                    option.value ||
                    ""
                  : String(option);

              const optionValue =
                typeof option === "object"
                  ? option.value ||
                    option.text ||
                    option.label ||
                    ""
                  : option;

              const answerKey = getQuestionKey(question, currentQuestion);

              const selected =
                answers[answerKey] ===
                optionValue;

              const letter = String.fromCharCode(
                65 + index
              );

              return (
                <button
                  key={`${currentQuestion}-${index}`}
                  type="button"
                  className={`answer-option ${
                    selected ? "selected" : ""
                  }`}
                  onClick={() =>
                    selectAnswer(optionValue)
                  }
                >
                  <span className="option-letter">
                    {letter}
                  </span>

                  <span className="option-text">
                    {optionText}
                  </span>

                  <span className="option-check">
                    {selected && <Icon name="check" size={20} strokeWidth={2.4} />}
                  </span>
                </button>
              );
            })}
          </div>

          {options.length === 0 && (
            <div className="no-options">
              No answer options are available for
              this question.
            </div>
          )}

          {submitError && (
            <div className="submit-error">
              <span>!</span>
              {submitError}
            </div>
          )}

          <div className="question-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={previousQuestion}
              disabled={currentQuestion === 0}
            >
              <><Icon name="arrowLeft" size={18} /> <span>Previous</span></>
            </button>

            <div className="action-center">
              {isLastQuestion ? (
                <button
                  type="button"
                  className="submit-button"
                  onClick={() => handleSubmit(false)}
                  disabled={submitting}
                >
                  {submitting
                    ? "Submitting..."
                    : "Submit Examination"}
                  <span><Icon name="check" size={18} strokeWidth={2.5} /></span>
                </button>
              ) : (
                <button
                  type="button"
                  className="next-button"
                  onClick={nextQuestion}
                >
                  Next Question
                  <span><Icon name="arrowRight" size={18} /></span>
                </button>
              )}
            </div>
          </div>
        </section>

        <aside className="question-sidebar">
          <div className="sidebar-card">
            <div className="sidebar-card-header">
              <div>
                <span className="sidebar-label">
                  NAVIGATION
                </span>

                <h2>Questions</h2>
              </div>

              <span className="question-count">
                {answeredCount}/{questions.length}
              </span>
            </div>

            <div className="question-grid">
              {questions.map((_, index) => {
                const gridQuestion = questions[index];
                const answerKey = getQuestionKey(gridQuestion, index);

                const answered =
                  answers[answerKey] !== undefined &&
                  answers[answerKey] !== null &&
                  answers[answerKey] !== "";

                const marked =
                  markedQuestions.includes(index);

                const active =
                  currentQuestion === index;

                return (
                  <button
                    key={index}
                    type="button"
                    className={`question-number-button ${
                      active ? "active" : ""
                    } ${answered ? "answered" : ""} ${
                      marked ? "marked" : ""
                    }`}
                    onClick={() =>
                      goToQuestion(index)
                    }
                  >
                    {index + 1}

                    {marked && (
                      <span className="question-star">
                        <Icon name="star" size={12} strokeWidth={1.9} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="legend">
              <div>
                <span className="legend-dot current" />
                Current Question
              </div>

              <div>
                <span className="legend-dot answered" />
                Answered
              </div>

              <div>
                <span className="legend-dot marked" />
                Marked for Review
              </div>
            </div>
          </div>

          <div className="sidebar-card exam-info-card">
            <span className="sidebar-label">
              EXAM INFORMATION
            </span>

            <div className="info-row">
              <span>Questions</span>
              <strong>{questions.length}</strong>
            </div>

            <div className="info-row">
              <span>Answered</span>
              <strong>{answeredCount}</strong>
            </div>

            <div className="info-row">
              <span>Remaining</span>
              <strong>
                {questions.length - answeredCount}
              </strong>
            </div>
          </div>

          <button
            type="button"
            className="exit-exam-button"
            onClick={() => {
              const confirmed = window.confirm(
                "Are you sure you want to exit the examination?"
              );

              if (confirmed && onExit) {
                onExit();
              }
            }}
          >
            <><Icon name="logOut" size={18} /> <span>Exit Examination</span></>
          </button>
        </aside>
      </main>

      <footer className="exam-footer">
        <span>TESTFLOW</span>

        <span>
          Your answers are securely processed
        </span>

        <span>� 2026</span>
      </footer>
    </div>
  );
}

export default ExamScreen;