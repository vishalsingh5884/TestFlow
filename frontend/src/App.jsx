import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import "./App.css";

import AdminDashboard from "./AdminDashboard.jsx";
import CreateTest from "./CreateTest.jsx";
import StudentDashboard from "./StudentDashboard.jsx";
import StudentTest from "./StudentTest.jsx";
import StudentResults from "./Results.jsx";
import ForgotPassword from "./ForgotPassword.jsx";
import ResetPassword from "./ResetPassword.jsx";

const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  "http://localhost:5000";

if (
  typeof window !== "undefined" &&
  !window.__TESTFLOW_LOCAL_FETCH_BRIDGE__
) {
  const nativeFetch = window.fetch.bind(window);

  const legacyApiBase =
    "https://testflow-pkbi.onrender.com";

  window.fetch = (input, init) => {
    const rawUrl =
      typeof input === "string"
        ? input
        : input instanceof Request
        ? input.url
        : String(input);

    if (rawUrl.startsWith(legacyApiBase)) {
      const rewrittenUrl =
        API_BASE_URL +
        rawUrl.slice(legacyApiBase.length);

      if (input instanceof Request) {
        return nativeFetch(
          new Request(rewrittenUrl, input),
          init
        );
      }

      return nativeFetch(
        rewrittenUrl,
        init
      );
    }

    return nativeFetch(input, init);
  };

  window.__TESTFLOW_LOCAL_FETCH_BRIDGE__ =
    true;
}

const STUDENT_API_URL =
  API_BASE_URL;

const API_URL =
  API_BASE_URL;

const ADMIN_TOKEN_KEYS = [
  "access_token",
  "adminToken",
  "admin_token",
  "token",
  "authToken",
  "accessToken",
];

const getAdminToken = () => {
  for (const key of ADMIN_TOKEN_KEYS) {
    const localValue = localStorage.getItem(key);

    if (localValue) {
      return localValue;
    }

    const sessionValue =
      sessionStorage.getItem(key);

    if (sessionValue) {
      return sessionValue;
    }
  }

  return "";
};

const clearAdminTokens = () => {
  ADMIN_TOKEN_KEYS.forEach((key) => {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  });
};

const applyTestFlowTheme = () => {
  if (
    typeof document === "undefined"
  ) {
    return;
  }

  const savedTheme =
    localStorage.getItem(
      "testflow-theme"
    ) || "system";

  const validThemes = [
    "system",
    "light",
    "dark",
  ];

  const theme =
    validThemes.includes(
      savedTheme
    )
      ? savedTheme
      : "system";

  document.documentElement.setAttribute(
    "data-theme",
    theme
  );

  document.documentElement.setAttribute(
    "data-testflow-theme",
    theme
  );
};

const parseJsonResponse =
  async (response) => {
    const contentType =
      response.headers.get(
        "content-type"
      ) || "";

    if (
      contentType
        .toLowerCase()
        .includes(
          "application/json"
        )
    ) {
      return await response.json();
    }

    const text =
      await response.text();

    console.error(
      "Server returned non-JSON response:",
      {
        status:
          response.status,
        statusText:
          response.statusText,
        contentType,
        body: text,
      }
    );

    throw new Error(
      `Server returned non-JSON response (${response.status}). ` +
        `Check that the TestFlow backend is available at ${API_BASE_URL}.`
    );
  };

function App() {
  useEffect(() => {
    applyTestFlowTheme();

    const handleThemeChange =
      (event) => {
        const requestedTheme =
          event?.detail?.theme;

        if (
          ![
            "system",
            "light",
            "dark",
          ].includes(
            requestedTheme
          )
        ) {
          return;
        }

        localStorage.setItem(
          "testflow-theme",
          requestedTheme
        );

        document.documentElement.setAttribute(
          "data-theme",
          requestedTheme
        );

        document.documentElement.setAttribute(
          "data-testflow-theme",
          requestedTheme
        );
      };

    window.addEventListener(
      "testflow-theme-change",
      handleThemeChange
    );

    return () => {
      window.removeEventListener(
        "testflow-theme-change",
        handleThemeChange
      );
    };
  }, []);

  const [showLogin, setShowLogin] =
    useState(false);

  const [showPassword, setShowPassword] =
    useState(false);

  const [email, setEmail] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [userType, setUserType] =
    useState("");

  const [rememberMe, setRememberMe] =
    useState(false);

  const [loading, setLoading] =
    useState(false);

  const [
    showForgotPassword,
    setShowForgotPassword,
  ] = useState(false);

  const [showRegister, setShowRegister] =
    useState(false);

  const [registerName, setRegisterName] =
    useState("");

  const [registerEmail, setRegisterEmail] =
    useState("");

  const [registerPassword, setRegisterPassword] =
    useState("");

  const [
    registerConfirmPassword,
    setRegisterConfirmPassword,
  ] = useState("");

  const [
    showRegisterPassword,
    setShowRegisterPassword,
  ] = useState(false);

  const [
    showRegisterConfirmPassword,
    setShowRegisterConfirmPassword,
  ] = useState(false);

  const [
    registerLoading,
    setRegisterLoading,
  ] = useState(false);

  const [
    registerMessage,
    setRegisterMessage,
  ] = useState("");

  const [
    registerMessageType,
    setRegisterMessageType,
  ] = useState("");

  const [isLoggedIn, setIsLoggedIn] =
    useState(false);

  const [loggedInType, setLoggedInType] =
    useState("");

  const [currentPage, setCurrentPage] =
    useState("dashboard");

  const [activeTest, setActiveTest] =
    useState(null);

  const [searchParams] =
    useSearchParams();

  const resetToken =
    searchParams.get("token");

  useEffect(() => {
    let cancelled = false;
    let cleanupTimer;

    const restoreSession = async () => {
      const adminToken = getAdminToken();
      const studentToken =
        localStorage.getItem("student_token") ||
        sessionStorage.getItem("student_token");
      const existingUserType = localStorage.getItem("user_type");

      if (adminToken && existingUserType === "admin") {
        try {
          const response = await fetch(`${API_URL}/api/auth/admin/me`, {
            method: "GET",
            cache: "no-store",
            headers: {
              Accept: "application/json",
              Authorization: `Bearer ${adminToken}`,
            },
          });

          const data = await parseJsonResponse(response);

          if (!response.ok || data?.success === false || !data?.user) {
            throw new Error(
              data?.message ||
                `Admin session verification failed (${response.status}).`,
            );
          }

          if (cancelled) return;

          localStorage.setItem("user_type", "admin");
          localStorage.setItem(
            "admin_email",
            data.user.email || localStorage.getItem("admin_email") || "",
          );

          setIsLoggedIn(true);
          setLoggedInType("admin");
          setCurrentPage("dashboard");
        } catch (error) {
          console.warn("Stored admin session is no longer valid:", error);
          clearAdminTokens();
          localStorage.removeItem("admin_email");
          localStorage.removeItem("admin_id");
          localStorage.removeItem("admin_name");
          localStorage.removeItem("admin_is_primary");
          localStorage.removeItem("user_type");
        }
      } else if (adminToken) {
        clearAdminTokens();
      }

      if (!adminToken && studentToken) {
        if (cancelled) return;

        setIsLoggedIn(true);
        setLoggedInType("student");

        const savedTest = localStorage.getItem("active_test");

        if (savedTest) {
          try {
            const parsedTest = JSON.parse(savedTest);

            if (
              parsedTest &&
              parsedTest.paperId &&
              Array.isArray(parsedTest.questions)
            ) {
              setActiveTest(parsedTest);
              setCurrentPage("student-test");
            } else {
              setCurrentPage("dashboard");
            }
          } catch (error) {
            console.error("Active test restore error:", error);
            localStorage.removeItem("active_test");
            setCurrentPage("dashboard");
          }
        } else {
          setCurrentPage("dashboard");
        }
      }

      cleanupTimer = setTimeout(() => {
        if (!cancelled) setShowLogin(true);
      }, 300);
    };

    restoreSession();

    return () => {
      cancelled = true;
      if (cleanupTimer) clearTimeout(cleanupTimer);
    };
  }, []);

  const handleSubmit =
    async (event) => {
      event.preventDefault();

      if (!userType) {
        alert(
          "Please select Admin or Student."
        );

        return;
      }

      if (
        !email.trim() ||
        !password
      ) {
        alert(
          "Please enter your username/email and password."
        );

        return;
      }

      setLoading(true);

      try {
        if (
          userType ===
          "student"
        ) {
          const cleanEmail =
            email
              .trim()
              .toLowerCase();

          console.log(
            "Student Login Request:",
            `${STUDENT_API_URL}/api/auth/student/login`
          );

          const response =
            await fetch(
              `${STUDENT_API_URL}/api/auth/student/login`,
              {
                method: "POST",

                headers: {
                  "Content-Type":
                    "application/json",

                  Accept:
                    "application/json",
                },

                body: JSON.stringify({
                  email:
                    cleanEmail,

                  password:
                    password,
                }),
              }
            );

          const data =
            await parseJsonResponse(
              response
            );

          console.log(
            "Student Login Status:",
            response.status
          );

          console.log(
            "Student Login Response:",
            data
          );

          if (!response.ok) {
            alert(
              data.message ||
                data.detail ||
                "Student login failed."
            );

            return;
          }

          const studentToken =
            data.token ||
            data.access_token ||
            "";

          if (
            !studentToken
          ) {
            alert(
              "Student login succeeded, but the server did not return an authentication token."
            );

            return;
          }

          clearAdminTokens();

          localStorage.removeItem(
            "admin_email"
          );

          if (rememberMe) {
            localStorage.setItem(
              "student_token",
              studentToken
            );

            sessionStorage.removeItem(
              "student_token"
            );
          } else {
            sessionStorage.setItem(
              "student_token",
              studentToken
            );

            localStorage.removeItem(
              "student_token"
            );
          }

          localStorage.setItem(
            "user_type",
            "student"
          );

          localStorage.setItem(
            "student_email",
            data.user?.email ||
              cleanEmail
          );

          localStorage.setItem(
            "student_name",
            data.user?.name ||
              ""
          );

          setIsLoggedIn(true);

          setLoggedInType(
            "student"
          );

          setCurrentPage(
            "dashboard"
          );

          setActiveTest(
            null
          );

          setEmail("");

          setPassword("");

          return;
        }

        const cleanEmail =
          email
            .trim()
            .toLowerCase();

        const adminLoginUrl =
          `${API_URL}/api/auth/admin/login`;

        console.log(
          "Admin Login Request:",
          adminLoginUrl
        );

        const response =
          await fetch(
            adminLoginUrl,
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "application/json",

                Accept:
                  "application/json",
              },

              body: JSON.stringify({
                email:
                  cleanEmail,

                password:
                  password,
              }),
            }
          );

        const data =
          await parseJsonResponse(
            response
          );

        console.log(
          "Admin Login Status:",
          response.status
        );

        console.log(
          "Admin Login Response:",
          data
        );

        if (!response.ok) {
          alert(
            data.message ||
              data.detail ||
              "Admin login failed."
          );

          return;
        }

        const adminToken =
          data.token ||
          data.access_token ||
          "";

        if (!adminToken) {
          console.error(
            "Admin login response did not contain a token:",
            data
          );

          alert(
            "Admin login succeeded, but the server did not return an authentication token."
          );

          return;
        }

        localStorage.removeItem(
          "student_token"
        );

        sessionStorage.removeItem(
          "student_token"
        );

        localStorage.removeItem(
          "student_email"
        );

        localStorage.removeItem(
          "student_name"
        );

        localStorage.removeItem(
          "active_test"
        );

        clearAdminTokens();

        if (rememberMe) {
          localStorage.setItem(
            "access_token",
            adminToken
          );

          sessionStorage.removeItem(
            "access_token"
          );
        } else {
          sessionStorage.setItem(
            "access_token",
            adminToken
          );

          localStorage.removeItem(
            "access_token"
          );
        }

        localStorage.setItem(
          "user_type",
          "admin"
        );

        localStorage.setItem(
          "admin_email",
          data.user?.email ||
            cleanEmail
        );

        localStorage.setItem(
          "admin_id",
          data.user?.id ||
            ""
        );

        localStorage.setItem(
          "admin_name",
          data.user?.name ||
            ""
        );

        localStorage.setItem(
          "admin_is_primary",
          data.user?.isPrimary === true
            ? "true"
            : "false"
        );

        setIsLoggedIn(true);

        setLoggedInType(
          "admin"
        );

        setCurrentPage(
          "dashboard"
        );

        setActiveTest(
          null
        );

        setEmail("");

        setPassword("");

        return;
      } catch (error) {
        console.error(
          "LOGIN ERROR:",
          error
        );

        alert(
          error?.message ||
            "Login failed. Please make sure the local Node backend is running on port 5000."
        );
      } finally {
        setLoading(false);
      }
    };

  const openForgotPassword =
    () => {
      setShowForgotPassword(
        true
      );

      setShowRegister(
        false
      );
    };

  const closeForgotPassword =
    () => {
      setShowForgotPassword(
        false
      );
    };

  const handleRegister =
    async (event) => {
      event.preventDefault();

      setRegisterMessage("");

      setRegisterMessageType(
        ""
      );

      if (!registerName.trim()) {
        setRegisterMessage(
          "Please enter your full name."
        );

        setRegisterMessageType(
          "error"
        );

        return;
      }

      if (!registerEmail.trim()) {
        setRegisterMessage(
          "Please enter your email address."
        );

        setRegisterMessageType(
          "error"
        );

        return;
      }

      if (!registerPassword) {
        setRegisterMessage(
          "Please enter a password."
        );

        setRegisterMessageType(
          "error"
        );

        return;
      }

      if (
        registerPassword.length <
        6
      ) {
        setRegisterMessage(
          "Password must contain at least 6 characters."
        );

        setRegisterMessageType(
          "error"
        );

        return;
      }

      if (
        registerPassword !==
        registerConfirmPassword
      ) {
        setRegisterMessage(
          "Passwords do not match."
        );

        setRegisterMessageType(
          "error"
        );

        return;
      }

      setRegisterLoading(true);

      try {
        const response =
          await fetch(
            `${STUDENT_API_URL}/api/auth/student/register`,
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "application/json",

                Accept:
                  "application/json",
              },

              body: JSON.stringify({
                name:
                  registerName.trim(),

                email:
                  registerEmail
                    .trim()
                    .toLowerCase(),

                password:
                  registerPassword,
              }),
            }
          );

        const data =
          await parseJsonResponse(
            response
          );

        console.log(
          "Student Registration Status:",
          response.status
        );

        console.log(
          "Student Registration Response:",
          data
        );

        if (!response.ok) {
          setRegisterMessage(
            data.message ||
              data.detail ||
              "Registration failed. Please try again."
          );

          setRegisterMessageType(
            "error"
          );

          return;
        }

        setRegisterMessage(
          data.message ||
            "Student account created successfully."
        );

        setRegisterMessageType(
          "success"
        );

        const savedEmail =
          registerEmail
            .trim()
            .toLowerCase();

        setRegisterName("");

        setRegisterEmail("");

        setRegisterPassword("");

        setRegisterConfirmPassword("");

        setTimeout(() => {
          setShowRegister(false);

          setRegisterMessage("");

          setRegisterMessageType(
            ""
          );

          setEmail(
            savedEmail
          );

          setPassword("");

          setUserType(
            "student"
          );

          setShowRegisterPassword(
            false
          );

          setShowRegisterConfirmPassword(
            false
          );
        }, 1200);
      } catch (error) {
        console.error(
          "REGISTRATION ERROR:",
          error
        );

        setRegisterMessage(
          error?.message ||
            "Cannot connect to Student backend. Make sure the Node server is running on port 5000."
        );

        setRegisterMessageType(
          "error"
        );
      } finally {
        setRegisterLoading(
          false
        );
      }
    };

  const openRegister = () => {
    setShowRegister(true);

    setShowForgotPassword(
      false
    );

    setRegisterMessage("");

    setRegisterMessageType(
      ""
    );

    setRegisterName("");

    setRegisterEmail("");

    setRegisterPassword("");

    setRegisterConfirmPassword("");

    setShowRegisterPassword(
      false
    );

    setShowRegisterConfirmPassword(
      false
    );
  };

  const closeRegister = () => {
    setShowRegister(false);

    setRegisterMessage("");

    setRegisterMessageType(
      ""
    );

    setRegisterName("");

    setRegisterEmail("");

    setRegisterPassword("");

    setRegisterConfirmPassword("");

    setShowRegisterPassword(
      false
    );

    setShowRegisterConfirmPassword(
      false
    );
  };

  const handleLogout = () => {
    clearAdminTokens();

    localStorage.removeItem(
      "admin_email"
    );

    localStorage.removeItem(
      "admin_id"
    );

    localStorage.removeItem(
      "admin_name"
    );

    localStorage.removeItem(
      "admin_is_primary"
    );

    localStorage.removeItem(
      "student_token"
    );

    sessionStorage.removeItem(
      "student_token"
    );

    localStorage.removeItem(
      "student_email"
    );

    localStorage.removeItem(
      "student_name"
    );

    localStorage.removeItem(
      "user_type"
    );

    localStorage.removeItem(
      "active_test"
    );

    setIsLoggedIn(false);

    setLoggedInType("");

    setCurrentPage(
      "dashboard"
    );

    setActiveTest(null);

    setEmail("");

    setPassword("");

    setUserType("");

    setRememberMe(false);
  };

  const handleStartStudentTest =
    (test) => {
      if (!test) {
        return;
      }

      console.log(
        "Opening Student Test:",
        test
      );

      setActiveTest(test);

      try {
        localStorage.setItem(
          "active_test",
          JSON.stringify(test)
        );
      } catch (error) {
        console.error(
          "Unable to save active test:",
          error
        );
      }

      setCurrentPage(
        "student-test"
      );
    };

  const handleBackToStudentDashboard =
    () => {
      setCurrentPage(
        "dashboard"
      );
    };

  const handleStudentTestSubmitted =
    (result) => {
      console.log(
        "Student test submitted:",
        result
      );

      localStorage.removeItem(
        "active_test"
      );

      localStorage.removeItem(
        "attemptId"
      );

      localStorage.removeItem(
        "studentAttemptId"
      );

      localStorage.removeItem(
        "examAttemptId"
      );

      setActiveTest(null);

      setCurrentPage(
        "student-results"
      );
    };

  if (
    isLoggedIn &&
    loggedInType ===
      "student"
  ) {
    if (
      currentPage ===
      "student-results"
    ) {
      return (
        <StudentResults
          onBackToDashboard={() =>
            setCurrentPage(
              "dashboard"
            )
          }
        />
      );
    }

    if (
      currentPage ===
        "student-test" &&
      activeTest
    ) {
      return (
        <StudentTest
          test={activeTest}
          onBackToDashboard={
            handleBackToStudentDashboard
          }
          onTestSubmitted={
            handleStudentTestSubmitted
          }
        />
      );
    }

    return (
      <StudentDashboard
        onLogout={
          handleLogout
        }
        onStartTest={
          handleStartStudentTest
        }
      />
    );
  }

  if (
    isLoggedIn &&
    loggedInType ===
      "admin"
  ) {
    if (
      currentPage ===
      "create-test"
    ) {
      return (
        <CreateTest
          onBack={() =>
            setCurrentPage(
              "dashboard"
            )
          }
        />
      );
    }

    return (
      <AdminDashboard
        onLogout={
          handleLogout
        }
        onCreateTest={() =>
          setCurrentPage(
            "create-test"
          )
        }
      />
    );
  }

  const LoginBackground = ({
    showStudent = false,
  }) => (
    <>
      <div className="sky">
        <div className="moon-glow" />

        <div className="moon">
          <div className="moon-crater crater-one" />

          <div className="moon-crater crater-two" />

          <div className="moon-crater crater-three" />
        </div>

        <div className="stars">
          {Array.from({
            length: 90,
          }).map(
            (_, index) => (
              <span
                key={index}
              />
            )
          )}
        </div>

        <div className="shooting-stars">
          <span />

          <span />

          <span />

          <span />
        </div>
      </div>

      <div className="city">
        <div className="city-glow" />

        <div className="buildings">
          <div className="building building-1">
            <div className="antenna" />

            <div className="windows" />
          </div>

          <div className="building building-2">
            <div className="windows" />
          </div>

          <div className="building building-3">
            <div className="antenna" />

            <div className="windows" />
          </div>

          <div className="building building-4">
            <div className="windows" />
          </div>

          <div className="building building-5">
            <div className="windows" />
          </div>

          <div className="building building-6">
            <div className="antenna" />

            <div className="windows" />
          </div>

          <div className="building building-7">
            <div className="windows" />
          </div>

          <div className="building building-8">
            <div className="windows" />
          </div>

          <div className="building building-9">
            <div className="antenna" />

            <div className="windows" />
          </div>

          <div className="building building-10">
            <div className="windows" />
          </div>
        </div>
      </div>

      <div className="rooftop">
        <div className="roof-glow" />

        <div className="roof-edge" />

        <div className="roof-object object-one" />

        <div className="roof-object object-two" />

        <div className="roof-object object-three" />
      </div>

      {showStudent && (
        <div className="student-scene">
          <div className="student-shadow" />

          <div className="backpack">
            <div className="backpack-pocket" />
          </div>

          <div className="student-body">
            <div className="hoodie-hood" />

            <div className="hoodie-string string-left" />

            <div className="hoodie-string string-right" />
          </div>

          <div className="student-neck" />

          <div className="student-head">
            <div className="student-hair">
              <span />

              <span />

              <span />
            </div>

            <div className="student-ear ear-left" />

            <div className="student-ear ear-right" />

            <div className="student-face">
              <div className="student-eyebrow eyebrow-left" />

              <div className="student-eyebrow eyebrow-right" />

              <div className="student-eye eye-left">
                <span />
              </div>

              <div className="student-eye eye-right">
                <span />
              </div>

              <div className="student-nose" />

              <div className="student-mouth" />
            </div>
          </div>

          <div className="student-arm arm-left">
            <div className="student-hand" />
          </div>

          <div className="student-arm arm-right">
            <div className="student-hand" />
          </div>

          <div className="student-laptop">
            <div className="laptop-screen">
              <div className="laptop-camera" />

              <div className="laptop-screen-glow" />

              <div className="tiny-ui">
                <span />

                <span />

                <span />
              </div>
            </div>

            <div className="laptop-base">
              <div className="keyboard">
                {Array.from({
                  length: 36,
                }).map(
                  (_, index) => (
                    <i
                      key={index}
                    />
                  )
                )}
              </div>

              <div className="trackpad" />
            </div>
          </div>
        </div>
      )}
    </>
  );

  if (resetToken) {
    return (
      <ResetPassword />
    );
  }

  if (
    showForgotPassword
  ) {
    return (
      <main className="login-page">
        <LoginBackground />

        <section
          className={`login-card ${
            showLogin
              ? "login-visible"
              : ""
          }`}
        >
          <button
            className="close-button"
            type="button"
            aria-label="Back to login"
            onClick={
              closeForgotPassword
            }
          >
            ×
          </button>

          <div className="login-content">
            <div className="login-logo">
              TEST
              <span>
                FLOW
              </span>
            </div>

            <ForgotPassword
              onBackToLogin={
                closeForgotPassword
              }
            />
          </div>
        </section>

        <div className="top-brand">
          <div className="brand">
            <span className="brand-box">
              T
            </span>

            TEST
            <span>
              FLOW
            </span>
          </div>

          <div className="exam-status">
            <span />

            ONLINE EXAM
          </div>
        </div>
      </main>
    );
  }

  if (showRegister) {
    return (
      <main className="login-page">
        <LoginBackground />

        <div className="top-brand">
          <div className="brand">
            <span className="brand-box">
              T
            </span>

            TEST
            <span>
              FLOW
            </span>
          </div>

          <div className="exam-status">
            <span />

            ONLINE EXAM
          </div>
        </div>

        <section
          className={`login-card ${
            showLogin
              ? "login-visible"
              : ""
          }`}
        >
          <button
            className="close-button"
            type="button"
            aria-label="Close registration"
            onClick={
              closeRegister
            }
          >
            ×
          </button>

          <div className="login-content">
            <div className="login-logo">
              TEST
              <span>
                FLOW
              </span>
            </div>

            <h1>
              Create Account
            </h1>

            <p className="login-subtitle">
              Create your student
              account and start
              your examination.
            </p>

            <form
              onSubmit={
                handleRegister
              }
            >
              <div className="input-group">
                <label htmlFor="registerName">
                  Full Name
                </label>

                <div className="input-wrapper">
                  <input
                    id="registerName"
                    type="text"
                    value={
                      registerName
                    }
                    placeholder="Enter your full name"
                    onChange={(
                      event
                    ) =>
                      setRegisterName(
                        event.target
                          .value
                      )
                    }
                    autoComplete="name"
                    required
                  />

                  <span
                    className="input-icon email-icon"
                    aria-hidden="true"
                  >
                    N
                  </span>
                </div>
              </div>

              <div className="input-group">
                <label htmlFor="registerEmail">
                  Email
                </label>

                <div className="input-wrapper">
                  <input
                    id="registerEmail"
                    type="email"
                    value={
                      registerEmail
                    }
                    placeholder="Enter your email"
                    onChange={(
                      event
                    ) =>
                      setRegisterEmail(
                        event.target
                          .value
                      )
                    }
                    autoComplete="email"
                    required
                  />
                </div>
              </div>

              <div className="input-group">
                <label htmlFor="registerPassword">
                  Password
                </label>

                <div className="input-wrapper">
                  <input
                    id="registerPassword"
                    type={
                      showRegisterPassword
                        ? "text"
                        : "password"
                    }
                    value={
                      registerPassword
                    }
                    placeholder="Minimum 6 characters"
                    onChange={(
                      event
                    ) =>
                      setRegisterPassword(
                        event.target
                          .value
                      )
                    }
                    autoComplete="new-password"
                    required
                  />

                  <button
                    type="button"
                    className={`password-button ${
                      showRegisterPassword
                        ? "password-visible"
                        : ""
                    }`}
                    onClick={() =>
                      setShowRegisterPassword(
                        !showRegisterPassword
                      )
                    }
                    aria-label={
                      showRegisterPassword
                        ? "Hide password"
                        : "Show password"
                    }
                  >
                    <span className="eye-icon">
                      <span className="eye-pupil" />
                    </span>
                  </button>
                </div>
              </div>

              <div className="input-group">
                <label htmlFor="registerConfirmPassword">
                  Confirm Password
                </label>

                <div className="input-wrapper">
                  <input
                    id="registerConfirmPassword"
                    type={
                      showRegisterConfirmPassword
                        ? "text"
                        : "password"
                    }
                    value={
                      registerConfirmPassword
                    }
                    placeholder="Re-enter your password"
                    onChange={(
                      event
                    ) =>
                      setRegisterConfirmPassword(
                        event.target
                          .value
                      )
                    }
                    autoComplete="new-password"
                    required
                  />

                  <button
                    type="button"
                    className={`password-button ${
                      showRegisterConfirmPassword
                        ? "password-visible"
                        : ""
                    }`}
                    onClick={() =>
                      setShowRegisterConfirmPassword(
                        !showRegisterConfirmPassword
                      )
                    }
                    aria-label={
                      showRegisterConfirmPassword
                        ? "Hide password"
                        : "Show password"
                    }
                  >
                    <span className="eye-icon">
                      <span className="eye-pupil" />
                    </span>
                  </button>
                </div>
              </div>

              {registerMessage && (
                <div
                  className={`register-message ${registerMessageType}`}
                >
                  {registerMessage}
                </div>
              )}

              <button
                className="login-button"
                type="submit"
                disabled={
                  registerLoading
                }
              >
                <span>
                  {registerLoading
                    ? "Creating Account..."
                    : "Create Account"}
                </span>

                <strong>
                  {registerLoading
                    ? "..."
                    : "→"}
                </strong>
              </button>
            </form>

            <div className="register-text">
              <span>
                Already have an
                account?
              </span>

              <button
                type="button"
                onClick={
                  closeRegister
                }
              >
                Login
              </button>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="login-page">
      <LoginBackground
        showStudent
      />

      <section
        className={`login-card ${
          showLogin
            ? "login-visible"
            : ""
        }`}
      >
        <button
          className="close-button"
          type="button"
          aria-label="Close login"
          onClick={() => {
            setEmail("");

            setPassword("");

            setUserType("");

            setShowPassword(
              false
            );
          }}
        >
          ×
        </button>

        <div className="login-content">
          <div className="login-logo">
            TEST
            <span>
              FLOW
            </span>
          </div>

          <h1>
            Login
          </h1>

          <p className="login-subtitle">
            Welcome back. Continue
            your examination.
          </p>

          <form
            onSubmit={
              handleSubmit
            }
          >
            <div className="input-group">
              <label htmlFor="email">
                Email / Username
              </label>

              <div className="input-wrapper">
                <input
                  id="email"
                  type="text"
                  value={email}
                  placeholder="Enter your username"
                  onChange={(
                    event
                  ) =>
                    setEmail(
                      event.target
                        .value
                    )
                  }
                  autoComplete="username"
                  required
                />

                <span
                  className="input-icon email-icon"
                  aria-hidden="true"
                >
                  @
                </span>
              </div>
            </div>

            <div className="input-group">
              <label htmlFor="password">
                Password
              </label>

              <div className="input-wrapper">
                <input
                  id="password"
                  type={
                    showPassword
                      ? "text"
                      : "password"
                  }
                  value={password}
                  placeholder="Enter your password"
                  onChange={(
                    event
                  ) =>
                    setPassword(
                      event.target
                        .value
                    )
                  }
                  autoComplete="current-password"
                  required
                />

                <button
                  type="button"
                  className={`password-button ${
                    showPassword
                      ? "password-visible"
                      : ""
                  }`}
                  onClick={() =>
                    setShowPassword(
                      !showPassword
                    )
                  }
                  aria-label={
                    showPassword
                      ? "Hide password"
                      : "Show password"
                  }
                >
                  <span className="eye-icon">
                    <span className="eye-pupil" />
                  </span>
                </button>
              </div>
            </div>

            <div className="input-group user-type-group">
              <label htmlFor="userType">
                User Type
              </label>

              <div className="input-wrapper select-wrapper">
                <select
                  id="userType"
                  value={
                    userType
                  }
                  onChange={(
                    event
                  ) =>
                    setUserType(
                      event.target
                        .value
                    )
                  }
                  required
                >
                  <option
                    value=""
                    disabled
                  >
                    Select user type
                  </option>

                  <option value="admin">
                    Admin
                  </option>

                  <option value="student">
                    Student
                  </option>
                </select>

                <span
                  className="select-arrow"
                  aria-hidden="true"
                >
                  ▼
                </span>
              </div>
            </div>

            <div className="login-options">
              <label className="remember-me">
                <input
                  type="checkbox"
                  checked={
                    rememberMe
                  }
                  onChange={(
                    event
                  ) =>
                    setRememberMe(
                      event.target
                        .checked
                    )
                  }
                />

                <span className="custom-checkbox">
                  <span className="check-symbol">
                    ✓
                  </span>
                </span>

                <span>
                  Remember me
                </span>
              </label>

              <button
                type="button"
                className="forgot-password"
                onClick={
                  openForgotPassword
                }
              >
                Forgot Password?
              </button>
            </div>

            <button
              className="login-button"
              type="submit"
              disabled={
                loading
              }
            >
              <span>
                {loading
                  ? "Logging in..."
                  : "Login"}
              </span>

              <strong>
                {loading
                  ? "..."
                  : "→"}
              </strong>
            </button>
          </form>

          <div className="register-text">
            <span>
              Don't have an
              account?
            </span>

            <button
              type="button"
              onClick={
                openRegister
              }
            >
              Register
            </button>
          </div>
        </div>
      </section>

      <div className="top-brand">
        <div className="brand">
          <span className="brand-box">
            T
          </span>

          TEST
          <span>
            FLOW
          </span>
        </div>

        <div className="exam-status">
          <span />

          ONLINE EXAM
        </div>
      </div>
    </main>
  );
}

export default App;