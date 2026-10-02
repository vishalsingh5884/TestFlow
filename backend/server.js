import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import nodemailer from "nodemailer";
import { GoogleGenAI } from "@google/genai";
import { registerCommunityRoutes } from "./communityFeature.js";
import { readBlobJSON, writeBlobJSON } from "./netlifyBlobs.js";

dotenv.config();

/*
====================================================
PATH CONFIGURATION
====================================================
*/

const __dirname = process.env.NETLIFY ? process.cwd() : path.dirname(new URL(".", import.meta.url).pathname);

const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(__dirname, "data");
const TESTS_FILE = path.join(DATA_DIR, "tests.json");
const EXAM_ATTEMPTS_FILE = path.join(DATA_DIR, "exam-attempts.json");
const STUDENT_SETTINGS_FILE = path.join(DATA_DIR, "student-settings.json");
const STUDENT_ID_COUNTER_FILE = path.join(DATA_DIR, "student-id-counter.json");
const ADMIN_SETTINGS_FILE = path.join(DATA_DIR, "admin-settings.json");
const STUDENTS_FILE = path.join(DATA_DIR, "students.json");
const ADMIN_ACCOUNTS_FILE = path.join(
  process.env.ADMINS_FILE
    ? path.resolve(process.env.ADMINS_FILE)
    : path.join(__dirname, "admins.json"),
);

/*
====================================================
CREATE DATA DIRECTORY
====================================================
*/

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, {
    recursive: true,
  });
}

/*
====================================================
ADMIN SETTINGS PERSISTENCE
====================================================
*/

const DEFAULT_ADMIN_SETTINGS = {
  adminName: "Administrator",
  adminEmail: "admin@testflow.com",
  institutionName: "TestFlow",
  timezone: "Asia/Kolkata",
  autoRefresh: true,
  refreshInterval: 30,
  allowStudentRegistration: true,
  maintenanceMode: false,
  showRecentActivity: true,
};

let adminSettings = { ...DEFAULT_ADMIN_SETTINGS };

async function loadAdminSettingsFromDisk() {
  try {
    const parsed = await readBlobJSON("admin-settings", {});

    adminSettings = {
      ...DEFAULT_ADMIN_SETTINGS,
      ...(parsed && typeof parsed === "object" ? parsed : {}),
    };

    console.log("Admin settings loaded from Netlify Blobs.");
  } catch (error) {
    console.error("Failed to load admin settings from Netlify Blobs:", error);
    adminSettings = { ...DEFAULT_ADMIN_SETTINGS };
  }
}

async function saveAdminSettingsToDisk() {
  try {
    await writeBlobJSON("admin-settings", adminSettings);
    console.log("Admin settings saved to Netlify Blobs.");
  } catch (error) {
    console.error("Failed to save admin settings to Netlify Blobs:", error);
    throw error;
  }
}

function sanitizeAdminSettings(settings) {
  return {
    adminName: String(settings?.adminName || DEFAULT_ADMIN_SETTINGS.adminName).trim(),
    adminEmail: String(settings?.adminEmail || DEFAULT_ADMIN_SETTINGS.adminEmail).trim(),
    institutionName: String(settings?.institutionName || DEFAULT_ADMIN_SETTINGS.institutionName).trim(),
    timezone: String(settings?.timezone || DEFAULT_ADMIN_SETTINGS.timezone),
    autoRefresh: settings?.autoRefresh !== false,
    refreshInterval: Math.max(10, Number(settings?.refreshInterval) || 30),
    allowStudentRegistration: settings?.allowStudentRegistration !== false,
    maintenanceMode: settings?.maintenanceMode === true,
    showRecentActivity: settings?.showRecentActivity !== false,
  };
}

/*
====================================================
APP
====================================================
*/

const app = express();

const PORT = Number(process.env.PORT) || 5000;
const HOST = process.env.HOST || "0.0.0.0";

/*
====================================================
CORS
====================================================
*/

const configuredFrontendOrigin = String(
  process.env.FRONTEND_URL || "",
).trim().replace(/\/$/, "");

const allowedOrigins = new Set(
  [
    configuredFrontendOrigin,
    "https://testfllow.netlify.app",
    "https://testflow.netlify.app",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
  ].filter(Boolean),
);

function isAllowedDevelopmentOrigin(origin) {
  if (!origin) return true;
  if (allowedOrigins.has(origin)) return true;

  try {
    const parsed = new URL(origin);
    return (
      (parsed.hostname === "localhost" ||
        parsed.hostname === "127.0.0.1") &&
      /^\d+$/.test(String(parsed.port || ""))
    );
  } catch {
    return false;
  }
}

const corsOptions = {
  origin(origin, callback) {
    if (isAllowedDevelopmentOrigin(origin)) {
      return callback(null, true);
    }

    console.warn(`Ã¢Å¡Â Ã¯Â¸Â CORS blocked origin: ${origin}`);
    return callback(null, false);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "Accept", "X-Requested-With"],
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));

app.use(
  express.json({
    limit: "2mb",
  }),
);

/*
====================================================
GEMINI AI
====================================================
*/

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

/*
====================================================
GEMINI CONFIGURATION
====================================================
*/

const GEMINI_MODEL = "gemini-3.6-flash";

const GEMINI_MAX_RETRIES = 3;

const GEMINI_RETRY_DELAYS = [
  3000,
  7000,
  12000,
];

/*
====================================================
GEMINI HELPERS
====================================================
*/

function isTemporaryGeminiError(error) {
  const status =
    error?.status ||
    error?.code ||
    error?.response?.status;

  const message =
    error?.message?.toString()?.toLowerCase() ||
    "";

  if (
    status === 503 ||
    status === 429 ||
    status === "UNAVAILABLE" ||
    status === "RESOURCE_EXHAUSTED"
  ) {
    return true;
  }

  if (
    message.includes("high demand") ||
    message.includes("temporarily unavailable") ||
    message.includes("resource exhausted") ||
    message.includes("too many requests") ||
    message.includes("rate limit")
  ) {
    return true;
  }

  return false;
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function generateGeminiContent(
  contents,
  config = {},
) {
  let lastError;

  for (
    let attempt = 0;
    attempt <= GEMINI_MAX_RETRIES;
    attempt++
  ) {
    try {
      console.log(
        `Ã°Å¸Â¤â€“ Gemini request attempt ${
          attempt + 1
        }/${GEMINI_MAX_RETRIES + 1}`,
      );

      const response =
        await ai.models.generateContent({
          model: GEMINI_MODEL,
          contents,
          config,
        });

      console.log("Ã¢Å“â€¦ Gemini response received.");

      return response;
    } catch (error) {
      lastError = error;

      console.error(
        `Ã¢ÂÅ’ Gemini attempt ${
          attempt + 1
        } failed:`,
        error?.message || error,
      );

      if (!isTemporaryGeminiError(error)) {
        throw error;
      }

      if (attempt >= GEMINI_MAX_RETRIES) {
        break;
      }

      const delay =
        GEMINI_RETRY_DELAYS[attempt] ||
        GEMINI_RETRY_DELAYS[
          GEMINI_RETRY_DELAYS.length - 1
        ];

      console.log(
        `Ã¢ÂÂ³ Gemini temporarily unavailable. Retrying in ${
          delay / 1000
        } seconds...`,
      );

      await sleep(delay);
    }
  }

  throw lastError;
}

/*
====================================================
IN-MEMORY DATABASE
====================================================
*/

const users = new Map();

// Admin accounts are persisted separately from the generic users map.
// The same normalized admin objects are also copied into users so that
// session authentication can always resolve an admin after a restart.
const adminAccounts = new Map();

const tests = new Map();

const sessions = new Map();

const examAttempts = new Map();

const studentSettings = new Map();
let nextStudentId = 1001;

/*
====================================================
ADMIN ACCOUNT PERSISTENCE
====================================================
*/

function normalizeAdminAccount(rawAccount, fallbackId = null) {
  if (!rawAccount || typeof rawAccount !== "object") return null;

  const email = String(
    rawAccount.email || rawAccount.username || rawAccount.userEmail || "",
  ).trim().toLowerCase();

  const id = String(
    rawAccount.id || rawAccount.adminId || fallbackId || crypto.randomUUID(),
  ).trim();

  if (!id || !email) return null;

  const rawRole = String(rawAccount.role || "admin").trim().toLowerCase();
  const isPrimary = Boolean(
    rawAccount.isPrimary === true ||
      rawAccount.primary === true ||
      rawAccount.primaryAdmin === true ||
      rawRole === "primary" ||
      rawRole === "primary-admin" ||
      rawRole === "superadmin" ||
      rawRole === "super-admin",
  );

  return {
    id,
    name:
      String(rawAccount.name || rawAccount.fullName || "Administrator").trim() ||
      "Administrator",
    email,
    role: isPrimary ? "primary-admin" : "admin",
    isPrimary,
    passwordHash:
      typeof rawAccount.passwordHash === "string"
        ? rawAccount.passwordHash
        : typeof rawAccount.password === "string"
          ? rawAccount.password
          : "",
    mobileNumber: String(rawAccount.mobileNumber || "").trim(),
    createdAt: rawAccount.createdAt || new Date().toISOString(),
    updatedAt: rawAccount.updatedAt || null,
  };
}

function getPrimaryAdmin() {
  return (
    [...adminAccounts.values()].find((admin) => admin?.isPrimary) ||
    [...adminAccounts.values()][0] ||
    null
  );
}

function serializeAdminAccount(admin) {
  return {
    id: admin.id,
    name: admin.name,
    email: admin.email,
    role: admin.role,
    isPrimary: Boolean(admin.isPrimary),
    createdAt: admin.createdAt || null,
  };
}

async function saveAdminAccountsToDisk() {
  try {
    const records = [...adminAccounts.values()].map((admin) => ({
      ...admin,
      passwordHash: admin.passwordHash,
    }));

    await writeBlobJSON("admin-accounts", records);
    console.log("Admin accounts saved to Netlify Blobs.");
  } catch (error) {
    console.error("Failed to save admin accounts to Netlify Blobs:", error);
    throw error;
  }
}


async function initializeAdminAccounts() {
  try {
    let records = [];

    const parsed = await readBlobJSON("admin-accounts", []);

    if (Array.isArray(parsed)) {
      records = parsed;
    } else if (Array.isArray(parsed?.admins)) {
      records = parsed.admins;
    } else if (Array.isArray(parsed?.accounts)) {
      records = parsed.accounts;
    } else if (parsed && typeof parsed === "object") {
      records = Object.entries(parsed).map(([id, value]) => ({
        ...(value || {}),
        id: value?.id || id,
      }));
    }

    adminAccounts.clear();

    for (const [index, rawAccount] of records.entries()) {
      const admin = normalizeAdminAccount(rawAccount, `admin-${index + 1}`);
      if (!admin) continue;

      // Older admins.json files may contain a plaintext password. Convert it
      // to a bcrypt hash once, then persist the normalized account.
      if (admin.passwordHash && !admin.passwordHash.startsWith("$2")) {
        admin.passwordHash = await bcrypt.hash(admin.passwordHash, 10);
      }

      adminAccounts.set(admin.id, admin);
    }

    const configuredEmail = String(
      process.env.ADMIN_EMAIL || "admin@testflow.com",
    ).trim().toLowerCase();
    const configuredPassword = String(
      process.env.ADMIN_PASSWORD || "Admin@123",
    );

    if (!adminAccounts.size) {
      const passwordHash = await bcrypt.hash(configuredPassword, 10);
      const primary = {
        id: "admin-demo-001",
        name: String(adminSettings.adminName || "Administrator").trim() || "Administrator",
        email: configuredEmail,
        role: "primary-admin",
        isPrimary: true,
        passwordHash,
        createdAt: new Date().toISOString(),
      };
      adminAccounts.set(primary.id, primary);
    }

    // Guarantee exactly one primary flag. If the file predates the flag,
    // the first loaded account becomes primary.
    let primary = getPrimaryAdmin();
    if (!primary) {
      const first = [...adminAccounts.values()][0];
      if (first) {
        first.isPrimary = true;
        first.role = "primary-admin";
        primary = first;
      }
    }

    for (const admin of adminAccounts.values()) {
      if (admin.id !== primary?.id) {
        admin.isPrimary = false;
        admin.role = "admin";
      }

      users.set(admin.id, admin);
    }

    saveAdminAccountsToDisk().catch((error) => console.error("Failed to persist admin accounts:", error));

    console.log(`Ã°Å¸â€˜Â® Loaded ${adminAccounts.size} admin account(s) from ${ADMIN_ACCOUNTS_FILE}`);
    console.log(
      `Ã°Å¸â€œÂ§ Admin emails: ${[...adminAccounts.values()].map((admin) => admin.email).join(", ")}`,
    );
  } catch (error) {
    console.error("Ã¢ÂÅ’ Failed to initialize admin accounts:", error);

    const passwordHash = await bcrypt.hash(
      String(process.env.ADMIN_PASSWORD || "Admin@123"),
      10,
    );
    const fallback = {
      id: "admin-demo-001",
      name: "Administrator",
      email: String(process.env.ADMIN_EMAIL || "admin@testflow.com").trim().toLowerCase(),
      role: "primary-admin",
      isPrimary: true,
      passwordHash,
      createdAt: new Date().toISOString(),
    };
    adminAccounts.clear();
    adminAccounts.set(fallback.id, fallback);
    users.set(fallback.id, fallback);
  }
}

function getTestOwnerId(test) {
  return String(
    test?.createdByAdminId ||
      test?.adminId ||
      test?.ownerAdminId ||
      test?.createdBy?.id ||
      getPrimaryAdmin()?.id ||
      "",
  );
}

function isTestOwnedByAdmin(test, adminUser) {
  if (!test || !adminUser) return false;
  return getTestOwnerId(test) === String(adminUser.id);
}

function ensureTestOwner(test) {
  if (!test || typeof test !== "object") return test;
  if (!test.createdByAdminId) {
    test.createdByAdminId = getPrimaryAdmin()?.id || null;
  }
  return test;
}

/*
====================================================
PASSWORD RESET STORAGE
====================================================

Each reset record contains:

{
  userId,
  tokenHash,
  expiresAt,
  createdAt
}

The actual reset token is NEVER stored.
====================================================
*/

const passwordResetTokens = new Map();

async function saveSessionsToDisk() {
  try {
    await writeBlobJSON("sessions", Object.fromEntries(sessions));
    console.log("Sessions saved to Netlify Blobs.");
  } catch (error) {
    console.error("Failed to save sessions to Netlify Blobs:", error);
    throw error;
  }
}

async function loadSessionsFromDisk() {
  try {
    const parsedData = await readBlobJSON("sessions", {});
    sessions.clear();

    for (const [token, session] of Object.entries(parsedData || {})) {
      if (!session || typeof session !== "object") continue;
      if (!session.userId) continue;
      sessions.set(token, session);
    }

    console.log(`Loaded ${sessions.size} session(s) from Netlify Blobs.`);
  } catch (error) {
    console.error("Failed to load sessions from Netlify Blobs:", error);
    sessions.clear();
  }
}

async function savePasswordResetTokensToDisk() {
  try {
    await writeBlobJSON(
      "password-reset-tokens",
      Object.fromEntries(passwordResetTokens),
    );
    console.log("Password reset tokens saved to Netlify Blobs.");
  } catch (error) {
    console.error(
      "Failed to save password reset tokens to Netlify Blobs:",
      error,
    );
    throw error;
  }
}

function enableAuthPersistence() {
  let sessionsLoaded = false;
  let resetTokensLoaded = false;

  const originalSessionSet = sessions.set.bind(sessions);
  const originalSessionDelete = sessions.delete.bind(sessions);

  sessions.set = function (key, value) {
    const result = originalSessionSet(key, value);

    if (sessionsLoaded) {
      saveSessionsToDisk().catch((error) => {
        console.error("Failed to persist session change:", error);
      });
    }

    return result;
  };

  sessions.delete = function (key) {
    const result = originalSessionDelete(key);

    if (sessionsLoaded && result) {
      saveSessionsToDisk().catch((error) => {
        console.error("Failed to persist session deletion:", error);
      });
    }

    return result;
  };

  const originalResetSet = passwordResetTokens.set.bind(passwordResetTokens);
  const originalResetDelete = passwordResetTokens.delete.bind(passwordResetTokens);

  passwordResetTokens.set = function (key, value) {
    const result = originalResetSet(key, value);

    if (resetTokensLoaded) {
      savePasswordResetTokensToDisk().catch((error) => {
        console.error("Failed to persist password reset token:", error);
      });
    }

    return result;
  };

  passwordResetTokens.delete = function (key) {
    const result = originalResetDelete(key);

    if (resetTokensLoaded && result) {
      savePasswordResetTokensToDisk().catch((error) => {
        console.error("Failed to persist password reset token deletion:", error);
      });
    }

    return result;
  };

  return {
    markSessionsLoaded() {
      sessionsLoaded = true;
    },
    markResetTokensLoaded() {
      resetTokensLoaded = true;
    },
  };
}

async function loadPasswordResetTokensFromDisk() {
  try {
    const parsedData = await readBlobJSON("password-reset-tokens", {});
    passwordResetTokens.clear();

    for (const [tokenHash, resetRecord] of Object.entries(parsedData || {})) {
      if (!resetRecord || typeof resetRecord !== "object") continue;
      if (!resetRecord.userId) continue;
      if (!resetRecord.expiresAt) continue;

      passwordResetTokens.set(tokenHash, resetRecord);
    }

    console.log(
      `Loaded ${passwordResetTokens.size} password reset token(s) from Netlify Blobs.`,
    );
  } catch (error) {
    console.error(
      "Failed to load password reset tokens from Netlify Blobs:",
      error,
    );
    passwordResetTokens.clear();
  }
}

/*
====================================================
ADMIN NOTIFICATIONS
====================================================
*/

const adminNotifications = [];

/*
====================================================
PERSISTENT TEST STORAGE
====================================================
*/

async function saveTestsToDisk() {
  try {
    const serializedTests = Object.fromEntries(tests);

    await writeBlobJSON("tests", serializedTests);

    console.log("ðŸ’¾ Tests saved to Netlify Blobs.");
  } catch (error) {
    console.error("âŒ Failed to save tests to Netlify Blobs:", error);
    throw error;
  }
}

async function loadTestsFromDisk() {
  try {
    const parsedData = await readBlobJSON("tests", {});

    tests.clear();

    for (const [paperId, test] of Object.entries(parsedData || {})) {
      if (
        !test ||
        typeof test !== "object" ||
        Array.isArray(test)
      ) {
        console.warn(`âš ï¸ Skipping invalid test record: ${paperId}`);
        continue;
      }

      if (!test.paperId) {
        test.paperId = paperId;
      }

      tests.set(paperId, test);
    }

    console.log(`ðŸ“š Loaded ${tests.size} test(s) from Netlify Blobs.`);
  } catch (error) {
    console.error("âŒ Failed to load tests from Netlify Blobs:", error);
    tests.clear();
  }
}

/*
====================================================
EXAM ATTEMPT PERSISTENCE
====================================================
*/

function saveExamAttemptsToDisk() {
  try {
    const serializedAttempts =
      Object.fromEntries(
        examAttempts,
      );

    fs.writeFileSync(
      EXAM_ATTEMPTS_FILE,
      JSON.stringify(
        serializedAttempts,
        null,
        2,
      ),
      "utf-8",
    );
  } catch (error) {
    console.error(
      "Ã¢ÂÅ’ Failed to save exam attempts:",
      error,
    );
  }
}

function loadExamAttemptsFromDisk() {
  try {
    if (
      !fs.existsSync(
        EXAM_ATTEMPTS_FILE,
      )
    ) {
      fs.writeFileSync(
        EXAM_ATTEMPTS_FILE,
        "{}",
        "utf-8",
      );

      console.log(
        "Ã°Å¸â€œÂ Created exam-attempts.json",
      );

      return;
    }

    const rawData =
      fs.readFileSync(
        EXAM_ATTEMPTS_FILE,
        "utf-8",
      );

    if (!rawData.trim()) {
      return;
    }

    const parsedData =
      JSON.parse(rawData);

    examAttempts.clear();

    for (
      const [attemptId, attempt] of Object.entries(
        parsedData,
      )
    ) {
      if (
        !attempt ||
        typeof attempt !== "object" ||
        Array.isArray(attempt)
      ) {
        console.warn(`Ã¢Å¡Â Ã¯Â¸Â Skipping invalid exam attempt record: ${attemptId}`);
        continue;
      }

      if (!attempt.attemptId) {
        attempt.attemptId = attemptId;
      }

      examAttempts.set(
        attemptId,
        attempt,
      );
    }

    console.log(
      `Ã°Å¸â€œÂ Loaded ${examAttempts.size} exam attempt(s) from persistent storage.`,
    );
  } catch (error) {
    console.error(
      "Ã¢ÂÅ’ Failed to load exam-attempts.json:",
      error,
    );
  }
}

/*
====================================================
STUDENT SETTINGS / STUDENT ID PERSISTENCE
====================================================
*/

const DEFAULT_STUDENT_SETTINGS = {
  theme: "system",
  notifications: {
    testReminders: true,
    results: true,
    securityAlerts: true,
    emailNotifications: true,
  },
  examPreferences: {
    fullscreen: true,
    violationMonitoring: true,
    secureExamMode: true,
    autoSave: true,
  },
  general: {
    dateFormat: "DD/MM/YYYY",
    timeFormat: "12-hour",
    confirmLogout: true,
  },
};

function cloneDefaultStudentSettings() {
  return JSON.parse(JSON.stringify(DEFAULT_STUDENT_SETTINGS));
}

function mergeStudentSettings(existing = {}) {
  const defaults = cloneDefaultStudentSettings();
  return {
    ...defaults,
    ...existing,
    notifications: { ...defaults.notifications, ...(existing.notifications || {}) },
    examPreferences: { ...defaults.examPreferences, ...(existing.examPreferences || {}) },
    general: { ...defaults.general, ...(existing.general || {}) },
  };
}

async function saveStudentSettingsToDisk() {
  try {
    const serializedSettings = Object.fromEntries(studentSettings);
    await writeBlobJSON("student-settings", serializedSettings);
    console.log("Student settings saved to Netlify Blobs.");
  } catch (error) {
    console.error("Failed to save student settings to Netlify Blobs:", error);
    throw error;
  }
}

async function loadStudentSettingsFromDisk() {
  try {
    const parsedData = await readBlobJSON("student-settings", {});

    studentSettings.clear();

    for (const [studentId, settings] of Object.entries(parsedData || {})) {
      studentSettings.set(studentId, mergeStudentSettings(settings));
    }

    console.log(`Loaded settings for ${studentSettings.size} student(s) from Netlify Blobs.`);
  } catch (error) {
    console.error("Failed to load student settings from Netlify Blobs:", error);
    studentSettings.clear();
  }
}

async function saveStudentIdCounterToDisk() {
  try {
    await writeBlobJSON("student-id-counter", { nextStudentId });
    console.log("Student ID counter saved to Netlify Blobs.");
  } catch (error) {
    console.error("Failed to save Student ID counter to Netlify Blobs:", error);
    throw error;
  }
}

async function loadStudentIdCounterFromDisk() {
  try {
    const parsedData = await readBlobJSON("student-id-counter", null);

    if (!parsedData) {
      nextStudentId = 1001;
      return;
    }

    const parsedNextId = Number(parsedData?.nextStudentId);

    nextStudentId =
      Number.isInteger(parsedNextId) && parsedNextId >= 1001
        ? parsedNextId
        : 1001;

    console.log(`Next Student ID loaded: ${nextStudentId}`);
  } catch (error) {
    console.error("Failed to load Student ID counter from Netlify Blobs:", error);
    nextStudentId = 1001;
  }
}

function getStudentSettings(studentId) {
  const key = String(studentId);
  const settings = mergeStudentSettings(studentSettings.get(key) || {});
  if (!studentSettings.has(key)) {
    studentSettings.set(key, settings);
    saveStudentSettingsToDisk().catch((error) => console.error("Failed to persist default student settings:", error));
  }
  return settings;
}

function sanitizeStudentSettings(settings) {
  const merged = mergeStudentSettings(settings);
  return { theme: merged.theme, notifications: merged.notifications, examPreferences: merged.examPreferences, general: merged.general };
}

function sanitizeStudentProfile(user) {
  return { id: user.id, studentId: user.studentId || null, name: user.name, email: user.email, role: user.role, createdAt: user.createdAt || null };
}

function formatStudentId(value) {
  const numericId = Number(value);

  if (!Number.isInteger(numericId) || numericId < 1001 || numericId > 9999) {
    throw new Error("No valid 4-digit Student ID is available.");
  }

  return String(numericId);
}

function generateStudentIdForUser(user) {
  if (user.studentId) return formatStudentId(user.studentId);

  const generatedId = formatStudentId(nextStudentId);

  nextStudentId += 1;
  user.studentId = generatedId;

  users.set(user.id, user);
  saveStudentIdCounterToDisk().catch((error) => console.error("Failed to persist Student ID counter:", error));

  return generatedId;
}

function validateStudentSettingsPayload(payload = {}) {
  const allowedThemes = ["light", "dark", "system"];
  const allowedDateFormats = ["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"];
  const allowedTimeFormats = ["12-hour", "24-hour"];
  if (payload.theme !== undefined && !allowedThemes.includes(payload.theme)) return "Theme must be light, dark, or system.";
  if (payload.general?.dateFormat !== undefined && !allowedDateFormats.includes(payload.general.dateFormat)) return "Invalid date format.";
  if (payload.general?.timeFormat !== undefined && !allowedTimeFormats.includes(payload.general.timeFormat)) return "Invalid time format.";
  const booleanPaths = [
    ["notifications", "testReminders"], ["notifications", "results"], ["notifications", "securityAlerts"], ["notifications", "emailNotifications"],
    ["examPreferences", "fullscreen"], ["examPreferences", "violationMonitoring"], ["examPreferences", "secureExamMode"], ["examPreferences", "autoSave"],
    ["general", "confirmLogout"],
  ];
  for (const [section, key] of booleanPaths) {
    if (payload[section]?.[key] !== undefined && typeof payload[section][key] !== "boolean") return `${section}.${key} must be true or false.`;
  }
  return null;
}

/*
====================================================
STUDENT ACCOUNT PERSISTENCE
====================================================
*/

async function saveStudentsToDisk() {
  try {
    const persistedStudents = {};

    for (const [userId, user] of users.entries()) {
      if (user?.role !== "student") continue;

      persistedStudents[userId] = { ...user };
    }

    await writeBlobJSON("students", persistedStudents);
    console.log("Student accounts saved to Netlify Blobs.");
  } catch (error) {
    console.error("Failed to save students to Netlify Blobs:", error);
    throw error;
  }
}


async function loadStudentsFromDisk() {
  try {
    const parsedData = await readBlobJSON("students", {});
    let maxExistingStudentId = 0;
    let studentsChanged = false;

    for (const [userId, storedUser] of Object.entries(parsedData || {})) {
      if (!storedUser || typeof storedUser !== "object") continue;

      const user = { ...storedUser };

      if (!user.id) {
        user.id = userId;
        studentsChanged = true;
      }

      if (user.role !== "student") {
        user.role = "student";
        studentsChanged = true;
      }

      const numericStudentId = Number.parseInt(
        String(user.studentId || "").replace(/\D/g, ""),
        10,
      );

      if (Number.isInteger(numericStudentId) && numericStudentId >= 1001) {
        maxExistingStudentId = Math.max(
          maxExistingStudentId,
          numericStudentId,
        );
      }

      users.set(user.id, user);
    }

    if (maxExistingStudentId >= 1001) {
      const persistedNextStudentId = nextStudentId;

      nextStudentId = Math.max(
        maxExistingStudentId + 1,
        persistedNextStudentId,
        1001,
      );

      if (nextStudentId !== persistedNextStudentId) {
        await saveStudentIdCounterToDisk();
      }
    }

    if (studentsChanged) {
      await saveStudentsToDisk();
    }

    const studentCount = [...users.values()].filter(
      (user) => user?.role === "student",
    ).length;

    console.log(
      `Loaded ${studentCount} student account(s) from Netlify Blobs.`,
    );
  } catch (error) {
    console.error("Failed to load students from Netlify Blobs:", error);
  }
}

/*
====================================================
PASSWORD RESET CONFIGURATION
====================================================
*/

const RESET_TOKEN_EXPIRY_MS =
  15 * 60 * 1000;

const FRONTEND_URL =
  process.env.FRONTEND_URL ||
  "http://localhost:5173";

/*
====================================================
EMAIL CONFIGURATION
====================================================

Email is optional.

If SMTP variables are not configured,
the application works in development mode
and returns the reset link in the API response.

For real email configure:

SMTP_HOST
SMTP_PORT
SMTP_USER
SMTP_PASS
SMTP_FROM
====================================================
*/

let mailTransporter = null;

function initializeMailTransporter() {
  const {
    SMTP_HOST,
    SMTP_PORT,
    SMTP_USER,
    SMTP_PASS,
    SMTP_FROM,
  } = process.env;

  if (
    !SMTP_HOST ||
    !SMTP_PORT ||
    !SMTP_USER ||
    !SMTP_PASS
  ) {
    console.log(
      "Ã°Å¸â€œÂ§ SMTP not configured.",
    );

    console.log(
      "Ã°Å¸Â§Âª Password reset will run in development mode.",
    );

    return;
  }

  try {
    mailTransporter =
      nodemailer.createTransport({
        host: SMTP_HOST,

        port: Number(
          SMTP_PORT,
        ),

        secure:
          Number(
            SMTP_PORT,
          ) === 465,

        auth: {
          user:
            SMTP_USER,

          pass:
            SMTP_PASS,
        },
      });

    console.log(
      "Ã°Å¸â€œÂ§ SMTP email service configured.",
    );

    if (SMTP_FROM) {
      console.log(
        `Ã°Å¸â€œÂ¨ Password reset sender: ${SMTP_FROM}`,
      );
    }
  } catch (error) {
    console.error(
      "Ã¢ÂÅ’ Failed to initialize email transporter:",
      error,
    );

    mailTransporter = null;
  }
}

/*
====================================================
PASSWORD RESET HELPERS
====================================================
*/

function createPasswordResetToken() {
  return crypto.randomBytes(32).toString("hex");
}

function hashPasswordResetToken(token) {
  return crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
}

function cleanupExpiredPasswordResetTokens() {
  const now = Date.now();

  for (
    const [
      tokenHash,
      resetRecord,
    ] of passwordResetTokens.entries()
  ) {
    if (
      resetRecord.expiresAt <=
      now
    ) {
      passwordResetTokens.delete(
        tokenHash,
      );
    }
  }
}

function buildPasswordResetUrl(
  token,
) {
  return `${FRONTEND_URL}/reset-password?token=${encodeURIComponent(
    token,
  )}`;
}

async function sendPasswordResetEmail(
  user,
  resetUrl,
) {
  if (!mailTransporter) {
    console.log("");
    console.log(
      "Ã°Å¸Â§Âª DEVELOPMENT PASSWORD RESET",
    );
    console.log(
      `Ã°Å¸â€˜Â¤ Student: ${user.email}`,
    );
    console.log(
      `Ã°Å¸â€â€” Reset URL: ${resetUrl}`,
    );
    console.log("");

    return {
      sent: false,
      development: true,
    };
  }

  const sender =
    process.env.SMTP_FROM ||
    process.env.SMTP_USER;

  await mailTransporter.sendMail({
    from: sender,

    to: user.email,

    subject:
      "Reset your Online Class Test password",

    text: `
Hello ${user.name},

We received a request to reset your Online Class Test password.

Use the following link to reset your password:

${resetUrl}

This link will expire in 15 minutes.

If you did not request a password reset, you can safely ignore this email.

Regards,
Online Class Test AI
`,

    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Password Reset</title>
</head>

<body
  style="
    margin:0;
    padding:0;
    background:#f4f7fb;
    font-family:Arial,Helvetica,sans-serif;
  "
>
  <div
    style="
      max-width:600px;
      margin:40px auto;
      background:white;
      border-radius:16px;
      padding:32px;
      box-shadow:0 10px 30px rgba(0,0,0,0.08);
    "
  >
    <h2
      style="
        color:#111827;
        margin-top:0;
      "
    >
      Reset Your Password
    </h2>

    <p
      style="
        color:#4b5563;
        line-height:1.6;
      "
    >
      Hello ${user.name},
    </p>

    <p
      style="
        color:#4b5563;
        line-height:1.6;
      "
    >
      We received a request to reset your
      Online Class Test password.
    </p>

    <div
      style="
        text-align:center;
        margin:32px 0;
      "
    >
      <a
        href="${resetUrl}"
        style="
          display:inline-block;
          background:#2563eb;
          color:white;
          text-decoration:none;
          padding:14px 24px;
          border-radius:10px;
          font-weight:bold;
        "
      >
        Reset Password
      </a>
    </div>

    <p
      style="
        color:#6b7280;
        font-size:14px;
        line-height:1.6;
      "
    >
      This link will expire in 15 minutes.
    </p>

    <p
      style="
        color:#6b7280;
        font-size:14px;
        line-height:1.6;
      "
    >
      If you did not request a password reset,
      you can safely ignore this email.
    </p>

  </div>
</body>
</html>
`,
  });

  console.log(
    `Ã°Å¸â€œÂ¨ Password reset email sent to ${user.email}`,
  );

  return {
    sent: true,
    development: false,
  };
}

/*
====================================================
UTILITY FUNCTIONS
====================================================
*/

function normalizePaperId(value) {
  return String(value || "").trim();
}

/*
====================================================
TEST CONFIGURATION HELPERS
====================================================
These helpers support the Create Test UI for:
- Easy / Medium / Hard distribution
- Coding question count / enable option
- Existing direct question-count payloads
- difficultyDistribution payloads
====================================================
*/
function parseTestConfiguration(body = {}) {
  const totalQuestions = Number(body.totalQuestions);
  const distribution =
    body.difficultyDistribution &&
    typeof body.difficultyDistribution === "object"
      ? body.difficultyDistribution
      : {};

  const easyQuestions = Number(
    body.easyQuestions ?? distribution.easy ?? distribution.Easy ?? 0,
  );
  const mediumQuestions = Number(
    body.mediumQuestions ?? distribution.medium ?? distribution.Medium ?? 0,
  );
  const hardQuestions = Number(
    body.hardQuestions ?? distribution.hard ?? distribution.Hard ?? 0,
  );

  const mcqQuestions = Number(
    body.mcqQuestions ?? Math.max(0, totalQuestions - (Number(body.codingQuestions) || 0)),
  );

  let codingQuestions;
  if (body.codingQuestions !== undefined) {
    codingQuestions = Number(body.codingQuestions);
  } else if (body.codingQuestionCount !== undefined) {
    codingQuestions = Number(body.codingQuestionCount);
  } else if (body.codingQuestionsEnabled === true) {
    codingQuestions = 1;
  } else {
    codingQuestions = 0;
  }

  return { totalQuestions, easyQuestions, mediumQuestions, hardQuestions, mcqQuestions, codingQuestions };
}

function validateTestConfiguration(config) {
  const { totalQuestions, easyQuestions, mediumQuestions, hardQuestions, mcqQuestions, codingQuestions } = config;

  if (!Number.isInteger(totalQuestions) || totalQuestions <= 0) {
    return "Total questions must be a positive integer.";
  }
  if (![easyQuestions, mediumQuestions, hardQuestions, mcqQuestions, codingQuestions].every(Number.isInteger)) {
    return "Question counts must be valid integers.";
  }
  if (easyQuestions < 0 || mediumQuestions < 0 || hardQuestions < 0 || mcqQuestions < 0 || codingQuestions < 0) {
    return "Question counts cannot be negative.";
  }
  if (easyQuestions + mediumQuestions + hardQuestions !== totalQuestions) {
    return "Easy + Medium + Hard must equal Total Questions.";
  }
  if (codingQuestions > totalQuestions) {
    return "Coding questions cannot exceed Total Questions.";
  }
  if (!Number.isInteger(mcqQuestions) || mcqQuestions < 0) {
    return "MCQ question count must be a valid non-negative integer.";
  }
  if (mcqQuestions + codingQuestions !== totalQuestions) {
    return "MCQ + Coding questions must equal Total Questions.";
  }
  return null;
}

function getTestConfigurationMetadata(config) {
  return {
    difficultyDistribution: {
      easy: config.easyQuestions,
      medium: config.mediumQuestions,
      hard: config.hardQuestions,
    },
    questionTypes: {
      mcq: config.mcqQuestions,
      coding: config.codingQuestions,
    },
    codingQuestionsEnabled: config.codingQuestions > 0,
  };
}

function validateGeneratedQuestionDistribution(questions, config) {
  if (!Array.isArray(questions) || questions.length !== config.totalQuestions) {
    return `Gemini generated ${Array.isArray(questions) ? questions.length : 0} questions instead of ${config.totalQuestions}.`;
  }

  const difficultyCounts = { Easy: 0, Medium: 0, Hard: 0 };
  let codingCount = 0;
  let mcqCount = 0;

  for (const question of questions) {
    const difficulty = String(question?.difficulty || "").trim();
    if (Object.prototype.hasOwnProperty.call(difficultyCounts, difficulty)) {
      difficultyCounts[difficulty] += 1;
    }
    const type = String(question?.type || "MCQ").trim().toLowerCase();
    if (type === "coding") {
      codingCount += 1;
    } else if (type === "mcq" || type === "multiple choice") {
      mcqCount += 1;
    }
  }

  if (difficultyCounts.Easy !== config.easyQuestions) return `Gemini generated ${difficultyCounts.Easy} Easy questions instead of ${config.easyQuestions}.`;
  if (difficultyCounts.Medium !== config.mediumQuestions) return `Gemini generated ${difficultyCounts.Medium} Medium questions instead of ${config.mediumQuestions}.`;
  if (difficultyCounts.Hard !== config.hardQuestions) return `Gemini generated ${difficultyCounts.Hard} Hard questions instead of ${config.hardQuestions}.`;
  if (codingCount !== config.codingQuestions) return `Gemini generated ${codingCount} Coding questions instead of ${config.codingQuestions}.`;
  if (mcqCount !== config.mcqQuestions) return `Gemini generated ${mcqCount} MCQ questions instead of ${config.mcqQuestions}.`;
  return null;
}

function generatePaperId() {
  let id;

  do {
    id = String(
      Math.floor(
        100000 +
          Math.random() * 900000,
      ),
    );
  } while (tests.has(id));

  return id;
}

function generateSessionToken() {
  return crypto
    .randomBytes(32)
    .toString("hex");
}

function generateAttemptId() {
  return crypto.randomUUID();
}

function cleanStudentQuestion(
  question,
) {
  const safeQuestion =
    question &&
    typeof question === "object" &&
    !Array.isArray(question)
      ? question
      : {};

  return {
    id: safeQuestion.id || null,

    number: safeQuestion.number || null,

    type: safeQuestion.type || "MCQ",

    difficulty:
      safeQuestion.difficulty || "Medium",

    topic:
      safeQuestion.topic || "General",

    question:
      safeQuestion.question || "",

    options:
      Array.isArray(safeQuestion.options)
        ? safeQuestion.options
        : [],
  };
}

function createStudentSafeTest(
  test,
) {
  return {
    paperId: test.paperId,

    subject: test.subject,

    programmingLanguage:
      test.programmingLanguage,

    topics: test.topics,

    totalQuestions:
      test.totalQuestions,

    codingQuestions:
      test.codingQuestions,

    difficultyDistribution:
      test.difficultyDistribution || {
        easy: Number(test.easyQuestions) || 0,
        medium: Number(test.mediumQuestions) || 0,
        hard: Number(test.hardQuestions) || 0,
      },

    questionTypes:
      test.questionTypes || {
        mcq: Math.max(0, Number(test.totalQuestions) - Number(test.codingQuestions || 0)),
        coding: Number(test.codingQuestions) || 0,
      },

    codingQuestionsEnabled:
      Boolean(test.codingQuestions),

    status: test.status,

    questions:
      Array.isArray(test.questions)
        ? test.questions.map(
            cleanStudentQuestion,
          )
        : [],
  };
}

/*
====================================================
AUTHENTICATION
====================================================
*/

function authenticateStudent(
  req,
  res,
  next,
) {
  try {
    const authHeader = String(
      req.headers.authorization || "",
    ).trim();

    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,

        message:
          "Student login required.",
      });
    }

    const token = authHeader
      .slice(7)
      .trim();

    if (!token) {
      return res.status(401).json({
        success: false,

        message:
          "Student login required.",
      });
    }

    const session =
      sessions.get(token);

    if (!session || typeof session !== "object" || !session.userId) {
      return res.status(401).json({
        success: false,

        message:
          "Invalid or expired login session.",
      });
    }

    const user =
      users.get(session.userId);

    if (!user || typeof user !== "object") {
      return res.status(401).json({
        success: false,

        message:
          "User account not found.",
      });
    }

    if (user.role !== "student") {
      return res.status(403).json({
        success: false,

        message:
          "Student access required.",
      });
    }

    req.user = user;

    req.sessionToken = token;

    return next();
  } catch (error) {
    console.error("Student authentication error:", error);

    return res.status(401).json({
      success: false,
      message:
        "Invalid or expired login session.",
    });
  }
}

function getAdminUserFromSession(session) {
  if (!session || session.role !== "admin") return null;
  const user = users.get(session.userId);
  if (!user || user.role !== "admin" && user.role !== "primary-admin") return null;
  if (!adminAccounts.has(user.id)) return null;
  return user;
}

function authenticateAdmin(req, res, next) {
  try {
    const authHeader = String(req.headers.authorization || "").trim();

    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Admin authentication required.",
      });
    }

    const token = authHeader.slice(7).trim();
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Admin authentication required.",
      });
    }

    const session = sessions.get(token);
    if (!session || session.role !== "admin" || !session.userId) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired admin session.",
      });
    }

    const adminUser = getAdminUserFromSession(session);
    if (!adminUser) {
      return res.status(401).json({
        success: false,
        message: "Admin account is no longer available.",
      });
    }

    req.user = adminUser;
    req.sessionToken = token;
    return next();
  } catch (error) {
    console.error("Admin authentication error:", error);
    return res.status(401).json({
      success: false,
      message: "Invalid or expired admin session.",
    });
  }
}

/*
====================================================
GET STUDENT ATTEMPT
====================================================
*/

function getStudentAttempt(
  studentId,
  attemptId,
) {
  const attempt =
    examAttempts.get(attemptId);

  if (!attempt) {
    return null;
  }

  if (
    attempt.studentId !==
    studentId
  ) {
    return null;
  }

  return attempt;
}

/*
====================================================
HEALTH CHECK
====================================================
*/


app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    status: "healthy",
    service: "testflow-backend",
    timestamp: new Date().toISOString(),
  });
});

app.get("/", (req, res) => {
  res.json({
    success: true,

    message:
      "Online Class Test AI Backend is running",

    geminiConfigured:
      Boolean(
        process.env.GEMINI_API_KEY,
      ),

    geminiModel:
      GEMINI_MODEL,

    testsStored:
      tests.size,

    usersStored:
      users.size,

    activeExamAttempts:
      examAttempts.size,

    studentSettingsStored:
      studentSettings.size,

    nextStudentId,

    adminNotifications:
      adminNotifications.length,

    passwordReset:
      {
        enabled: true,

        expiryMinutes: 15,

        emailConfigured:
          Boolean(
            mailTransporter,
          ),
      },
  });
});

/*
====================================================
STUDENT REGISTER
====================================================
*/

app.post(
  "/api/auth/student/register",
  async (req, res) => {
    try {
      const {
        name,
        email,
        password,
      } = req.body;

      if (
        !name ||
        !email ||
        !password
      ) {
        return res.status(400).json({
          success: false,

          message:
            "Name, email and password are required.",
        });
      }

      if (password.length < 6) {
        return res.status(400).json({
          success: false,

          message:
            "Password must contain at least 6 characters.",
        });
      }

      const normalizedEmail = email.toLowerCase();

      const existingUser =
        [...users.values()].find(
          (user) =>
            user.email ===
            normalizedEmail,
        );

      if (existingUser) {
        return res.status(409).json({
          success: false,

          message:
            "An account with this email already exists.",
        });
      }

      const passwordHash =
        await bcrypt.hash(
          password,
          10,
        );

      const userId =
        crypto.randomUUID();

      const user = {
        id: userId,

        name: name.trim(),

        email:
          normalizedEmail,

        role: "student",

        passwordHash,

        createdAt:
          new Date().toISOString(),
        status: "active",
      };

      // Allocate the next sequential 4-digit Student ID before persisting.
      const studentId = generateStudentIdForUser(user);

      users.set(
        userId,
        user,
      );

      // Persist both the student record and the updated counter.
      saveStudentsToDisk().catch((error) => console.error("Failed to persist students:", error));
      await saveStudentIdCounterToDisk();

      res.status(201).json({
        success: true,

        message:
          "Student account created successfully.",

        user: {
          id: user.id,

          name: user.name,

          email: user.email,

          role: user.role,

          studentId: studentId,
        },
      });
    } catch (error) {
      console.error(
        "Student registration error:",
        error,
      );

      res.status(500).json({
        success: false,

        message:
          "Failed to create student account.",
      });
    }
  },
);

/*
====================================================
DEMO ADMIN LOGIN
====================================================
For testing/development only.
Credentials can be overridden with ADMIN_EMAIL and ADMIN_PASSWORD
Render environment variables.
====================================================
*/

app.post(
  "/api/auth/admin/login",
  async (req, res) => {
    try {
      const email = String(req.body?.email || "").trim().toLowerCase();
      const password = String(req.body?.password || "");

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: "Email and password are required.",
        });
      }

      const admin = [...adminAccounts.values()].find(
        (account) => account.email === email,
      );

      if (!admin || !admin.passwordHash) {
        return res.status(401).json({
          success: false,
          message: "Invalid admin email or password.",
        });
      }

      let passwordCorrect = false;
      try {
        passwordCorrect = await bcrypt.compare(password, admin.passwordHash);
      } catch (passwordError) {
        console.error("Admin password verification error:", passwordError);
      }

      if (!passwordCorrect) {
        return res.status(401).json({
          success: false,
          message: "Invalid admin email or password.",
        });
      }

      // Keep the same object in both maps so session verification cannot
      // fail after a restart because users and admins drift apart.
      users.set(admin.id, admin);

      const token = generateSessionToken();
      sessions.set(token, {
        userId: admin.id,
        role: "admin",
        email: admin.email,
        createdAt: new Date().toISOString(),
      });

      return res.json({
        success: true,
        message: "Admin login successful.",
        token,
        access_token: token,
        user: serializeAdminAccount(admin),
      });
    } catch (error) {
      console.error("Admin login error:", error);
      return res.status(500).json({
        success: false,
        message: "Admin login failed.",
      });
    }
  },
);

/*
====================================================
ADMIN SESSION VERIFICATION
====================================================
*/

app.get("/api/auth/admin/me", authenticateAdmin, (req, res) => {
  return res.json({
    success: true,
    user: serializeAdminAccount(req.user),
  });
});

/*
====================================================
STUDENT LOGIN
====================================================
*/

app.post(
  "/api/auth/student/login",
  async (req, res) => {
    try {
      const email = String(req.body?.email || "").trim();
      const password = String(req.body?.password || "");

      if (!email || !password) {
        return res.status(400).json({
          success: false,

          message:
            "Email and password are required.",
        });
      }

      const normalizedEmail =
        email
          .trim()
          .toLowerCase();

      const user =
        [...users.values()].find(
          (item) =>
            item.email ===
              normalizedEmail &&
            item.role ===
              "student",
        );

      if (!user) {
        return res.status(401).json({
          success: false,

          message:
            "Invalid email or password.",
        });
      }

      if (user.status === "blocked") {
        return res.status(403).json({
          success: false,
          message: "This student account has been blocked. Please contact the administrator.",
        });
      }

      if (typeof user.passwordHash !== "string" || !user.passwordHash) {
        return res.status(401).json({
          success: false,
          message: "Invalid email or password.",
        });
      }

      let passwordCorrect = false;
      try {
        passwordCorrect = await bcrypt.compare(password, user.passwordHash);
      } catch (passwordError) {
        console.error("Student password verification error:", passwordError);
        return res.status(401).json({
          success: false,
          message: "Invalid email or password.",
        });
      }

      if (!passwordCorrect) {
        return res.status(401).json({
          success: false,

          message:
            "Invalid email or password.",
        });
      }

      const token =
        generateSessionToken();

      sessions.set(
        token,
        {
          userId: user.id,

          createdAt:
            new Date().toISOString(),
        },
      );

      res.json({
        success: true,

        message:
          "Student login successful.",

        token,

        user: {
          id: user.id,

          name: user.name,

          email: user.email,

          role: user.role,
        },
      });
    } catch (error) {
      console.error(
        "Student login error:",
        error,
      );

      res.status(500).json({
        success: false,

        message:
          "Login failed.",
      });
    }
  },
);

/*
====================================================
FORGOT PASSWORD
====================================================
*/

app.post(
  "/api/auth/student/forgot-password",
  async (req, res) => {
    try {
      cleanupExpiredPasswordResetTokens();

      const email =
        String(
          req.body?.email ||
            "",
        )
          .trim()
          .toLowerCase();

      if (!email) {
        return res.status(400).json({
          success: false,

          message:
            "Email address is required.",
        });
      }

      const user =
        [...users.values()].find(
          (item) =>
            item.email === email &&
            item.role === "student",
        );

      /*
      ----------------------------------------------
      SECURITY NOTE
      ----------------------------------------------

      We intentionally return the same general
      response even if the account does not exist.
      ----------------------------------------------
      */

      if (!user) {
        return res.json({
          success: true,

          message:
            "If an account exists with this email, a password reset link has been generated.",
        });
      }

      /*
      ----------------------------------------------
      REMOVE OLD RESET TOKENS FOR THIS USER
      ----------------------------------------------
      */

      for (
        const [
          tokenHash,
          resetRecord,
        ] of passwordResetTokens.entries()
      ) {
        if (
          resetRecord.userId ===
          user.id
        ) {
          passwordResetTokens.delete(
            tokenHash,
          );
        }
      }

      /*
      ----------------------------------------------
      CREATE NEW TOKEN
      ----------------------------------------------
      */

      const rawToken =
        createPasswordResetToken();

      const tokenHash =
        hashPasswordResetToken(
          rawToken,
        );

      const expiresAt =
        Date.now() +
        RESET_TOKEN_EXPIRY_MS;

      passwordResetTokens.set(
        tokenHash,
        {
          userId:
            user.id,

          tokenHash,

          createdAt:
            new Date().toISOString(),

          expiresAt,
        },
      );

      const resetUrl =
        buildPasswordResetUrl(
          rawToken,
        );

      /*
      ----------------------------------------------
      SEND EMAIL OR DEVELOPMENT LINK
      ----------------------------------------------
      */

      let emailResult;

      try {
        emailResult =
          await sendPasswordResetEmail(
            user,
            resetUrl,
          );
      } catch (emailError) {
        console.error(
          "Ã¢ÂÅ’ Password reset email failed:",
          emailError,
        );

        /*
        Delete the token if an actual
        configured email service failed.
        */

        passwordResetTokens.delete(
          tokenHash,
        );

        return res.status(500).json({
          success: false,

          message:
            "Unable to send the password reset email. Please try again later.",
        });
      }

      const response = {
        success: true,

        message:
          "If an account exists with this email, a password reset link has been generated.",

        emailSent:
          Boolean(
            emailResult?.sent,
          ),
      };

      /*
      ----------------------------------------------
      DEVELOPMENT MODE
      ----------------------------------------------

      This allows us to test Forgot Password
      before Gmail/SMTP configuration.
      ----------------------------------------------
      */

      if (
        emailResult?.development
      ) {
        response.development =
          true;

        response.resetUrl =
          resetUrl;

        response.expiresInMinutes =
          15;
      }

      console.log(
        `Ã°Å¸â€Â Password reset requested for ${user.email}`,
      );

      res.json(
        response,
      );
    } catch (error) {
      console.error(
        "Forgot password error:",
        error,
      );

      res.status(500).json({
        success: false,

        message:
          "Unable to process password reset request.",
      });
    }
  },
);

/*
====================================================
RESET PASSWORD
====================================================
*/

app.post(
  "/api/auth/student/reset-password",
  async (req, res) => {
    try {
      cleanupExpiredPasswordResetTokens();

      const token =
        String(
          req.body?.token ||
            "",
        ).trim();

      const newPassword =
        String(
          req.body?.newPassword ||
            "",
        );

      if (!token) {
        return res.status(400).json({
          success: false,

          message:
            "Password reset token is required.",
        });
      }

      if (!newPassword) {
        return res.status(400).json({
          success: false,

          message:
            "New password is required.",
        });
      }

      if (
        newPassword.length < 6
      ) {
        return res.status(400).json({
          success: false,

          message:
            "Password must contain at least 6 characters.",
        });
      }

      const tokenHash =
        hashPasswordResetToken(
          token,
        );

      const resetRecord =
        passwordResetTokens.get(
          tokenHash,
        );

      if (!resetRecord) {
        return res.status(400).json({
          success: false,

          message:
            "Invalid or expired password reset link.",
        });
      }

      if (
        resetRecord.expiresAt <=
        Date.now()
      ) {
        passwordResetTokens.delete(
          tokenHash,
        );

        return res.status(400).json({
          success: false,

          message:
            "This password reset link has expired. Please request a new one.",
        });
      }

      const user =
        users.get(
          resetRecord.userId,
        );

      if (!user) {
        passwordResetTokens.delete(
          tokenHash,
        );

        return res.status(400).json({
          success: false,

          message:
            "The account associated with this reset link no longer exists.",
        });
      }

      /*
      ----------------------------------------------
      HASH NEW PASSWORD
      ----------------------------------------------
      */

      const passwordHash =
        await bcrypt.hash(
          newPassword,
          10,
        );

      user.passwordHash =
        passwordHash;

      users.set(
        user.id,
        user,
      );

      /*
      ----------------------------------------------
      INVALIDATE RESET TOKEN
      ----------------------------------------------
      */

      passwordResetTokens.delete(
        tokenHash,
      );

      /*
      ----------------------------------------------
      INVALIDATE EXISTING LOGIN SESSIONS
      ----------------------------------------------

      This forces the student to log in again
      using the new password.
      ----------------------------------------------
      */

      for (
        const [
          sessionToken,
          session,
        ] of sessions.entries()
      ) {
        if (
          session.userId ===
          user.id
        ) {
          sessions.delete(
            sessionToken,
          );
        }
      }

      console.log(
        `Ã°Å¸â€â€˜ Password successfully reset for ${user.email}`,
      );

      res.json({
        success: true,

        message:
          "Password reset successfully. Please log in with your new password.",
      });
    } catch (error) {
      console.error(
        "Reset password error:",
        error,
      );

      res.status(500).json({
        success: false,

        message:
          "Unable to reset password.",
      });
    }
  },
);

/*
====================================================
CURRENT STUDENT
====================================================
*/

app.get(
  "/api/auth/student/me",
  authenticateStudent,
  (req, res) => {
    try {
      if (!req.user || typeof req.user !== "object") {
        return res.status(401).json({
          success: false,
          message: "Student login required.",
        });
      }

      return res.json({
        success: true,

        user: sanitizeStudentProfile(req.user),
      });
    } catch (error) {
      console.error("Current student error:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to load student profile.",
      });
    }
  },
);


/*
====================================================
STUDENT LOGOUT
====================================================
*/

app.post(
  "/api/auth/student/logout",
  authenticateStudent,
  (req, res) => {
    sessions.delete(
      req.sessionToken,
    );

    res.json({
      success: true,

      message:
        "Student logged out successfully.",
    });
  },
);

/*
====================================================
STUDENT SETTINGS
====================================================
*/

app.get("/api/student/settings", authenticateStudent, (req, res) => {
  try {
    if (!req.user || typeof req.user !== "object" || !req.user.id) {
      return res.status(401).json({ success: false, message: "Student login required." });
    }
    const settings = getStudentSettings(req.user.id);
    res.json({ success: true, profile: sanitizeStudentProfile(req.user), settings: sanitizeStudentSettings(settings) });
  } catch (error) {
    console.error("Get student settings error:", error);
    res.status(500).json({ success: false, message: "Failed to load student settings." });
  }
});

app.put("/api/student/settings", authenticateStudent, async (req, res) => {
  try {
    const validationError = validateStudentSettingsPayload(req.body || {});
    if (validationError) return res.status(400).json({ success: false, message: validationError });
    const current = getStudentSettings(req.user.id);
    const payload = req.body || {};
    const updated = mergeStudentSettings({
      ...current, ...payload,
      notifications: { ...current.notifications, ...(payload.notifications || {}) },
      examPreferences: { ...current.examPreferences, ...(payload.examPreferences || {}) },
      general: { ...current.general, ...(payload.general || {}) },
    });
    studentSettings.set(req.user.id, updated);
    await saveStudentSettingsToDisk();
    res.json({ success: true, message: "Settings saved successfully.", profile: sanitizeStudentProfile(req.user), settings: sanitizeStudentSettings(updated) });
  } catch (error) {
    console.error("Update student settings error:", error);
    res.status(500).json({ success: false, message: "Failed to save student settings." });
  }
});

app.post("/api/student/settings/reset", authenticateStudent, async (req, res) => {
  try {
    const settings = cloneDefaultStudentSettings();
    studentSettings.set(req.user.id, settings);
    await saveStudentSettingsToDisk();
    res.json({ success: true, message: "Settings restored to default values.", settings });
  } catch (error) {
    console.error("Reset student settings error:", error);
    res.status(500).json({ success: false, message: "Failed to reset settings." });
  }
});

app.post("/api/student/settings/generate-id", authenticateStudent, (req, res) => {
  try {
    if (req.user.studentId) {
      return res.status(409).json({ success: false, alreadyGenerated: true, studentId: String(req.user.studentId), message: "Student ID has already been generated for this account." });
    }
    const studentId = generateStudentIdForUser(req.user);
    res.status(201).json({ success: true, generated: true, studentId, message: `Student ID ${studentId} generated successfully.`, profile: sanitizeStudentProfile(req.user) });
  } catch (error) {
    console.error("Generate student ID error:", error);
    res.status(500).json({ success: false, message: "Failed to generate Student ID." });
  }
});

app.put("/api/student/profile", authenticateStudent, (req, res) => {
  try {
    const name = String(req.body?.name || "").trim();
    const email = String(req.body?.email || "").trim().toLowerCase();
    if (!name || !email) return res.status(400).json({ success: false, message: "Name and email are required." });
    if (name.length < 2) return res.status(400).json({ success: false, message: "Name must contain at least 2 characters." });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ success: false, message: "Please enter a valid email address." });
    const duplicate = [...users.values()].find(user => user.id !== req.user.id && user.role === "student" && user.email === email);
    if (duplicate) return res.status(409).json({ success: false, message: "Another account is already using this email address." });
    req.user.name = name;
    req.user.email = email;
    users.set(req.user.id, req.user);
    res.json({ success: true, message: "Profile updated successfully.", profile: sanitizeStudentProfile(req.user) });
  } catch (error) {
    console.error("Update student profile error:", error);
    res.status(500).json({ success: false, message: "Failed to update profile." });
  }
});

app.post("/api/student/settings/change-password", authenticateStudent, async (req, res) => {
  try {
    const currentPassword = String(req.body?.currentPassword || "");
    const newPassword = String(req.body?.newPassword || "");
    const confirmPassword = String(req.body?.confirmPassword || "");
    if (!currentPassword || !newPassword || !confirmPassword) return res.status(400).json({ success: false, message: "Current password, new password and confirmation are required." });
    if (!(await bcrypt.compare(currentPassword, req.user.passwordHash))) return res.status(401).json({ success: false, message: "Current password is incorrect." });
    if (newPassword.length < 6) return res.status(400).json({ success: false, message: "New password must contain at least 6 characters." });
    if (newPassword !== confirmPassword) return res.status(400).json({ success: false, message: "New password and confirmation do not match." });
    if (await bcrypt.compare(newPassword, req.user.passwordHash)) return res.status(400).json({ success: false, message: "New password must be different from the current password." });
    req.user.passwordHash = await bcrypt.hash(newPassword, 10);
    users.set(req.user.id, req.user);
    for (const [token, session] of sessions.entries()) {
      if (session.userId === req.user.id && token !== req.sessionToken) sessions.delete(token);
    }
    res.json({ success: true, message: "Password changed successfully." });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({ success: false, message: "Failed to change password." });
  }
});

app.post("/api/student/settings/logout-other-sessions", authenticateStudent, (req, res) => {
  let removed = 0;
  for (const [token, session] of sessions.entries()) {
    if (session.userId === req.user.id && token !== req.sessionToken) { sessions.delete(token); removed += 1; }
  }
  res.json({ success: true, removedSessions: removed, message: removed ? `${removed} other session${removed === 1 ? "" : "s"} logged out successfully.` : "No other active sessions were found." });
});

app.get("/api/student/settings/export-data", authenticateStudent, (req, res) => {
  try {
    const settings = getStudentSettings(req.user.id);
    const testHistory = [...examAttempts.values()].filter(a => a.studentId === req.user.id).map(a => ({ attemptId: a.attemptId, paperId: a.paperId, subject: a.subject, status: a.status, score: a.score, correct: a.correct, totalQuestions: a.totalQuestions, startedAt: a.startedAt, submittedAt: a.submittedAt, terminatedAt: a.terminatedAt, violation: a.violation || null }));
    res.json({ success: true, exportedAt: new Date().toISOString(), profile: sanitizeStudentProfile(req.user), settings: sanitizeStudentSettings(settings), testHistory });
  } catch (error) {
    console.error("Student data export error:", error);
    res.status(500).json({ success: false, message: "Failed to export student data." });
  }
});

/*
====================================================
TEST GEMINI
====================================================
*/

app.get(
  "/api/test-gemini",
  async (req, res) => {
    try {
      const response =
        await generateGeminiContent(
          "Reply with exactly: Gemini AI connection successful.",
        );

      res.json({
        success: true,

        model:
          GEMINI_MODEL,

        message:
          response.text,
      });
    } catch (error) {
      console.error(
        "Gemini test error:",
        error,
      );

      const status =
        error?.status ||
        error?.code ||
        500;

      res.status(
        status === 404
          ? 404
          : 500,
      ).json({
        success: false,

        message:
          "Gemini API connection failed.",

        model:
          GEMINI_MODEL,

        error:
          error?.message ||
          "Unknown Gemini error.",
      });
    }
  },
);

/*
====================================================
ADMIN AUTHENTICATION GATE
====================================================
*/

app.use("/api/admin", authenticateAdmin);

/*
====================================================
ADMIN GENERATE TEST
====================================================
*/

app.post(
  "/api/admin/tests/generate",
  async (req, res) => {
    try {
      const { subject, programmingLanguage, topics, paperId: requestedPaperId } = req.body;
      const requestedPaper = normalizePaperId(requestedPaperId);
      const existingTest = requestedPaper ? tests.get(requestedPaper) : null;

      if (existingTest && !isTestOwnedByAdmin(existingTest, req.user)) {
        return res.status(403).json({
          success: false,
          message: "You can only regenerate tests created by your admin account.",
        });
      }

      if (requestedPaper && !existingTest) {
        return res.status(404).json({ success: false, message: "Test not found.", paperId: requestedPaper });
      }

      if (existingTest?.status === "published") {
        return res.status(409).json({ success: false, message: "Published tests cannot be regenerated." });
      }

      const testConfig = parseTestConfiguration(req.body);
      const configurationError = validateTestConfiguration(testConfig);

      if (
        !subject ||
        !topics
      ) {
        return res.status(400).json({
          success: false,

          message:
            "Subject and topics are required.",
        });
      }

      if (configurationError) {
        return res.status(400).json({ success: false, message: configurationError });
      }

      const {
        totalQuestions: total,
        mcqQuestions: mcq,
        easyQuestions: easy,
        mediumQuestions: medium,
        hardQuestions: hard,
        codingQuestions: coding,
      } = testConfig;

      const paperId =
        requestedPaper || generatePaperId();

      const prompt = `
You are an expert examination paper generator.

Create a high-quality academic test.

SUBJECT:
${subject}

PROGRAMMING LANGUAGE:
${
  programmingLanguage ||
  "Not specified"
}

TOPICS:
${topics}

TOTAL QUESTIONS:
${total}

DIFFICULTY DISTRIBUTION:
Easy: ${easy}
Medium: ${medium}
Hard: ${hard}

QUESTION TYPE DISTRIBUTION:
MCQ: ${mcq}
Coding: ${coding}

IMPORTANT RULES:

1. Generate exactly ${total} questions.
2. Exactly ${easy} questions must be Easy.
3. Exactly ${medium} questions must be Medium.
4. Exactly ${hard} questions must be Hard.
5. Exactly ${coding} questions must be Coding questions.
6. Exactly ${mcq} questions must be MCQ questions.
7. The programming language is a paper-level preference and must be respected for coding questions if any are requested.
8. Questions must genuinely match the supplied topics.
9. Avoid duplicate questions.
10. MCQs must have exactly 4 options.
11. Coding questions must have a clear programming problem.
12. Every question must have one correct answer.
13. Include a short explanation for every answer.
14. Return ONLY valid JSON.
15. Do NOT use markdown code fences.

JSON format:

{
  "questions": [
    {
      "number": 1,
      "type": "MCQ",
      "difficulty": "Easy",
      "topic": "Arrays",
      "question": "Question text",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "correctAnswer": "Option A",
      "explanation": "Short explanation"
    }
  ]
}

For Coding questions:

{
  "number": 1,
  "type": "Coding",
  "difficulty": "Medium",
  "topic": "Arrays",
  "question": "Programming problem statement",
  "options": [],
  "correctAnswer": "Expected solution or answer",
  "explanation": "Short explanation"
}
`;

      console.log(
        `Ã°Å¸Â¤â€“ Generating test ${paperId} with Gemini...`,
      );

      const response =
        await generateGeminiContent(
          prompt,
          {
            responseMimeType:
              "application/json",
          },
        );

      const rawText =
        response.text;

      let generated;

      try {
        generated =
          JSON.parse(rawText);
      } catch (parseError) {
        console.error(
          "Gemini JSON parse error:",
          rawText,
        );

        return res.status(500).json({
          success: false,

          message:
            "Gemini returned invalid JSON.",
        });
      }

      if (
        !generated.questions ||
        !Array.isArray(
          generated.questions,
        )
      ) {
        return res.status(500).json({
          success: false,

          message:
            "Gemini did not return a valid question list.",
        });
      }

      const generatedConfigurationError =
        validateGeneratedQuestionDistribution(
          generated.questions,
          testConfig,
        );

      if (generatedConfigurationError) {
        return res.status(500).json({
          success: false,
          message: generatedConfigurationError,
        });
      }

      const questions =
        generated.questions.map(
          (
            question,
            index,
          ) => ({
            id: `${paperId}-${index + 1}`,

            number:
              index + 1,

            type:
              question.type ||
              "MCQ",

            difficulty:
              question.difficulty ||
              "Medium",

            topic:
              question.topic ||
              "General",

            question:
              question.question ||
              "",

            options:
              Array.isArray(
                question.options,
              )
                ? question.options
                : [],

            correctAnswer:
              question.correctAnswer ||
              "",

            explanation:
              question.explanation ||
              "",

            starterCode:
              question.starterCode ||
              "",
          }),
        );

      const test = {
        ...(existingTest || {}),
        paperId,

        createdByAdminId: req.user.id,
        createdByAdminEmail: req.user.email,

        title:
          typeof req.body.title === "string" ? req.body.title.trim() : (existingTest?.title || subject.trim()),

        subject:
          subject.trim(),

        description:
          typeof req.body.description === "string" ? req.body.description.trim() : (existingTest?.description || ""),

        duration:
          Number(req.body.duration) > 0 ? Number(req.body.duration) : (existingTest?.duration || 30),

        testType:
          req.body.testType || existingTest?.testType || "MCQ",

        difficulty:
          req.body.difficulty || existingTest?.difficulty || "Mixed",

        startDate:
          req.body.startDate || existingTest?.startDate || null,

        endDate:
          req.body.endDate || existingTest?.endDate || null,

        instructions:
          typeof req.body.instructions === "string" ? req.body.instructions.trim() : (existingTest?.instructions || ""),

        programmingLanguage:
          programmingLanguage?.trim() ||
          "",

        topics:
          topics.trim(),

        totalQuestions:
          total,

        easyQuestions:
          easy,

        mediumQuestions:
          medium,

        hardQuestions:
          hard,

        codingQuestions:
          coding,

        ...getTestConfigurationMetadata(testConfig),

        questions,

        status:
          "draft",

        createdAt:
          new Date().toISOString(),

        updatedAt:
          new Date().toISOString(),
      };

      tests.set(
        paperId,
        test,
      );

      await saveTestsToDisk();

      console.log(
        `Ã¢Å“â€¦ Test ${paperId} generated successfully`,
      );

      res.json({
        success: true,

        test,
      });
    } catch (error) {
      console.error(
        "Generate test error:",
        error,
      );

      if (
        isTemporaryGeminiError(
          error,
        )
      ) {
        return res.status(503).json({
          success: false,

          message:
            "Gemini is temporarily busy. Please try again shortly.",

          model:
            GEMINI_MODEL,
        });
      }

      res.status(500).json({
        success: false,

        message:
          "Failed to generate test.",

        error:
          error?.message ||
          "Unknown error.",
      });
    }
  },
);

/*
====================================================
ADMIN GET TEST
====================================================
*/

app.get(
  "/api/admin/tests/:paperId",
  (req, res) => {
    const paperId =
      normalizePaperId(
        req.params.paperId,
      );

    const test =
      tests.get(paperId);

    if (test && !isTestOwnedByAdmin(test, req.user)) {
      return res.status(403).json({
        success: false,
        message: "You can only view tests created by your admin account.",
      });
    }

    if (!test) {
      return res.status(404).json({
        success: false,

        message:
          "Test not found.",

        paperId,
      });
    }

    res.json({
      success: true,

      test,
    });
  },
);

/*
====================================================
ADMIN UPDATE TEST
====================================================
*/

app.put("/api/admin/tests/:paperId", async (req, res) => {
    try {
      const paperId =
        normalizePaperId(
          req.params.paperId,
        );

      const test =
        tests.get(paperId);

      if (test && !isTestOwnedByAdmin(test, req.user)) {
        return res.status(403).json({
          success: false,
          message: "You can only edit tests created by your admin account.",
        });
      }

      if (!test) {
        return res.status(404).json({
          success: false,

          message:
            "Test not found.",

          paperId,
        });
      }

      if (
        test.status ===
        "published"
      ) {
        return res.status(409).json({
          success: false,

          message:
            "Published tests cannot be edited.",
        });
      }

      const { subject, programmingLanguage, topics } = req.body;
      const testConfig = parseTestConfiguration(req.body);
      const configurationError = validateTestConfiguration(testConfig);

      if (
        typeof subject !==
          "string" ||
        !subject.trim()
      ) {
        return res.status(400).json({
          success: false,

          message:
            "Subject is required.",
        });
      }

      if (
        typeof topics !==
          "string" ||
        !topics.trim()
      ) {
        return res.status(400).json({
          success: false,

          message:
            "Topics are required.",
        });
      }

      if (configurationError) {
        return res.status(400).json({ success: false, message: configurationError });
      }

      const {
        totalQuestions: total,
        easyQuestions: easy,
        mediumQuestions: medium,
        hardQuestions: hard,
        codingQuestions: coding,
      } = testConfig;

      test.subject =
        subject.trim();

      test.programmingLanguage =
        typeof programmingLanguage ===
        "string"
          ? programmingLanguage.trim()
          : "";

      test.topics =
        topics.trim();

      test.totalQuestions =
        total;

      test.easyQuestions =
        easy;

      test.mediumQuestions =
        medium;

      test.hardQuestions =
        hard;

      test.codingQuestions =
        coding;

      Object.assign(
        test,
        getTestConfigurationMetadata(testConfig),
      );

      test.status =
        "draft";

      test.updatedAt =
        new Date().toISOString();

      tests.set(
        paperId,
        test,
      );

      await saveTestsToDisk();

      res.json({
        success: true,

        message:
          "Test draft saved successfully.",

        test,
      });
    } catch (error) {
      console.error(
        "Update test error:",
        error,
      );

      res.status(500).json({
        success: false,

        message:
          "Failed to save test draft.",
      });
    }
  },
);

/*
====================================================
ADMIN SYNC TEST FROM FRONTEND
====================================================
*/

app.put("/api/admin/tests/:paperId/sync", async (req, res) => {
    try {
      const paperId =
        normalizePaperId(
          req.params.paperId,
        );

      const {
        title,
        subject,
        programmingLanguage,
        topics,
        description,
        duration,
        difficulty,
        testType,
        startDate,
        endDate,
        instructions,
        questions,
        status,
      } = req.body || {};
      const testConfig = parseTestConfiguration(req.body || {});
      const configurationError = validateTestConfiguration(testConfig);

      if (
        typeof subject !==
          "string" ||
        !subject.trim()
      ) {
        return res.status(400).json({
          success: false,
          message: "Subject is required.",
        });
      }

      if (
        typeof topics !==
          "string" ||
        !topics.trim()
      ) {
        return res.status(400).json({
          success: false,
          message: "Topics are required.",
        });
      }

      if (configurationError) {
        return res.status(400).json({ success: false, message: configurationError });
      }

      const {
        totalQuestions: total,
        easyQuestions: easy,
        mediumQuestions: medium,
        hardQuestions: hard,
        codingQuestions: coding,
      } = testConfig;

      if (!Array.isArray(questions)) {
        return res.status(400).json({
          success: false,
          message:
            "Questions are required before publishing.",
        });
      }

      if (questions.length !== total) {
        return res.status(400).json({
          success: false,
          message:
            "Question count does not match Total Questions.",
        });
      }

      const existingTest =
        tests.get(paperId);

      if (existingTest && !isTestOwnedByAdmin(existingTest, req.user)) {
        return res.status(403).json({
          success: false,
          message: "You can only manage tests created by your admin account.",
        });
      }

      if (
        existingTest?.status ===
        "published"
      ) {
        return res.status(409).json({
          success: false,
          message:
            "Published tests cannot be overwritten.",
        });
      }

      const syncedTest = {
        ...(existingTest || {}),
        paperId,
        createdByAdminId: existingTest?.createdByAdminId || req.user.id,
        createdByAdminEmail: existingTest?.createdByAdminEmail || req.user.email,
        title: typeof title === "string" ? title.trim() : (existingTest?.title || subject.trim()),
        subject: subject.trim(),
        description: typeof description === "string" ? description.trim() : (existingTest?.description || ""),
        duration: Number(duration) > 0 ? Number(duration) : (existingTest?.duration || 30),
        difficulty: difficulty || existingTest?.difficulty || "Mixed",
        testType: testType || existingTest?.testType || "MCQ",
        startDate: startDate || null,
        endDate: endDate || null,
        instructions: typeof instructions === "string" ? instructions.trim() : (existingTest?.instructions || ""),
        programmingLanguage:
          typeof programmingLanguage ===
          "string"
            ? programmingLanguage.trim()
            : "",
        topics: topics.trim(),
        totalQuestions: total,
        easyQuestions: easy,
        mediumQuestions: medium,
        hardQuestions: hard,
        codingQuestions: coding,
        ...getTestConfigurationMetadata(testConfig),
        questions,
        status:
          status === "published"
            ? "draft"
            : status || "draft",
        createdAt:
          existingTest?.createdAt ||
          new Date().toISOString(),
        updatedAt:
          new Date().toISOString(),
      };

      tests.set(
        paperId,
        syncedTest,
      );

      await saveTestsToDisk();

      res.json({
        success: true,
        message:
          "Test synchronized successfully.",
        test: syncedTest,
      });
    } catch (error) {
      console.error(
        "Test sync error:",
        error,
      );

      res.status(500).json({
        success: false,
        message:
          "Failed to synchronize test.",
      });
    }
  },
);

/*
====================================================
DELETE DRAFT TEST
====================================================
*/

app.delete("/api/admin/tests/:paperId", async (req, res) => {
    try {
      const paperId = normalizePaperId(req.params.paperId);
      const test = tests.get(paperId);

      if (test && !isTestOwnedByAdmin(test, req.user)) {
        return res.status(403).json({
          success: false,
          message: "You can only delete tests created by your admin account.",
        });
      }

      if (!test) {
        return res.status(404).json({
          success: false,
          message: "Test not found.",
          paperId,
        });
      }

      if (test.status === "published") {
        return res.status(409).json({
          success: false,
          message: "Published tests cannot be deleted.",
          paperId,
        });
      }

      tests.delete(paperId);
      await saveTestsToDisk();

      return res.json({
        success: true,
        message: `Draft test ${paperId} deleted successfully.`,
        paperId,
      });
    } catch (error) {
      console.error("Admin delete test error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to delete test.",
      });
    }
  },
);

/*
====================================================
PUBLISH TEST
====================================================
*/

app.post(
  "/api/admin/tests/:paperId/publish", async (req, res) => {
    const paperId =
      normalizePaperId(
        req.params.paperId,
      );

    const test =
      tests.get(paperId);

    if (test && !isTestOwnedByAdmin(test, req.user)) {
      return res.status(403).json({
        success: false,
        message: "You can only publish tests created by your admin account.",
      });
    }

    if (!test) {
      return res.status(404).json({
        success: false,

        message:
          "Test not found.",

        paperId,
      });
    }

    if (test.status !== "draft") {
      return res.status(409).json({
        success: false,
        message: "Only an existing draft test can be published.",
        paperId,
        status: test.status,
      });
    }

    const publishConfig = parseTestConfiguration(test);
    const publishConfigurationError = validateTestConfiguration(publishConfig);
    if (publishConfigurationError) {
      return res.status(400).json({
        success: false,
        message: publishConfigurationError,
        paperId,
      });
    }

    const publishDistributionError = validateGeneratedQuestionDistribution(
      test.questions,
      publishConfig,
    );
    if (publishDistributionError) {
      return res.status(400).json({
        success: false,
        message: publishDistributionError,
        paperId,
      });
    }

    for (const question of test.questions) {
      const type = String(question?.type || "").trim().toLowerCase();
      if (!String(question?.question || "").trim()) {
        return res.status(400).json({
          success: false,
          message: `Question ${question?.number || ""} is missing question text.`,
          paperId,
        });
      }
      if (type === "mcq" && (!Array.isArray(question.options) || question.options.length !== 4)) {
        return res.status(400).json({
          success: false,
          message: `MCQ question ${question?.number || ""} must have exactly 4 options.`,
          paperId,
        });
      }
    }

    if (
      !Array.isArray(
        test.questions,
      ) ||
      test.questions.length !==
        test.totalQuestions
    ) {
      return res.status(400).json({
        success: false,

        message:
          "Test cannot be published because the question count is invalid.",
      });
    }

    test.status =
      "published";

    test.publishedAt =
      new Date().toISOString();

    test.updatedAt =
      new Date().toISOString();

    tests.set(
      paperId,
      test,
    );

    await saveTestsToDisk();

    community.createNotificationForAllStudents({
      type: "TEST",
      title: "New Test",
      message: `${test.title || test.subject || "A new test"} is now available.`,
      data: { paperId: test.paperId, subject: test.subject || "" },
    });

    console.log(
      `Ã°Å¸â€œÂ¢ Test ${paperId} published`,
    );

    res.json({
      success: true,

      message:
        `Test ${paperId} published successfully.`,

      test,
    });
  },
);

/*
====================================================
STUDENT GET TEST BY PAPER ID
====================================================
*/

app.get(
  "/api/student/tests/:paperId",
  authenticateStudent,
  (req, res) => {
    const paperId = normalizePaperId(req.params.paperId);

    console.log(`Ã°Å¸Å½â€œ Student requested Paper ID: ${paperId}`);
    console.log(
      `Ã°Å¸â€œâ€˜ Available tests: ${[...tests.keys()].join(", ")}`
    );

    const test = tests.get(paperId);

    if (!test) {
      console.warn(`Ã¢ÂÅ’ Paper ID ${paperId} was not found.`);
      return res.status(404).json({
        success: false,
        message: "Invalid Paper ID.",
        paperId,
      });
    }

    if (String(test.status || "").toLowerCase() !== "published") {
      return res.status(403).json({
        success: false,
        message: "This test has not been published yet.",
        paperId,
        status: test.status,
      });
    }

    // STUDENT RESTRICTION VERIFICATION
    const studentId = String(req.user.studentId || "").trim();
    const accessStudentIds = Array.isArray(test.accessStudentIds)
      ? test.accessStudentIds.map((id) => String(id).trim())
      : [];
    const isAll = test.accessMode === "all" || accessStudentIds.length === 0;

    if (!isAll && (!studentId || !accessStudentIds.includes(studentId))) {
      return res.status(403).json({
        success: false,
        message: "You are not assigned to this test. Please contact your instructor.",
        paperId,
      });
    }

    const studentTest = createStudentSafeTest(test);

    console.log(`Ã¢Å“â€¦ Student test ${paperId} returned successfully.`);

    res.json({
      success: true,
      test: studentTest,
    });
  }
);

/*
====================================================
STUDENT GET ALL PUBLISHED TESTS
====================================================
*/

app.get(
  "/api/student/tests",
  authenticateStudent,
  (req, res) => {
    try {
      const studentTests =
        [...tests.values()]
          .filter(
            (test) =>
              test &&
              typeof test === "object" &&
              !Array.isArray(test) &&
              String(test.status || "").toLowerCase() ===
                "published",
          )
          .map((test) => {
            const attempt =
              [...examAttempts.values()].find(
                (item) =>
                  item &&
                  typeof item === "object" &&
                  !Array.isArray(item) &&
                  item.studentId ===
                    req.user.id &&
                  item.paperId ===
                    test.paperId,
              );

            return {
              ...createStudentSafeTest(
                test,
              ),

              attempt: attempt
                ? {
                    attemptId:
                      attempt.attemptId,
                    status:
                      attempt.status,
                    startedAt:
                      attempt.startedAt,
                    submittedAt:
                      attempt.submittedAt,
                    terminatedAt:
                      attempt.terminatedAt,
                  }
                : null,

              canAttempt:
                !attempt ||
                attempt.status ===
                  "IN_PROGRESS",
            };
          });

      res.json({
        success: true,
        count:
          studentTests.length,
        tests: studentTests,
      });
    } catch (error) {
      console.error(
        "Student tests list error:",
        error,
      );

      res.status(500).json({
        success: false,
        message:
          "Failed to load available tests.",
      });
    }
  },
);

/*
====================================================
STUDENT TEST HISTORY
====================================================
*/

app.get(
  "/api/student/test-history",
  authenticateStudent,
  (req, res) => {
    try {
      const history =
        [...examAttempts.values()]
          .filter(
            (attempt) =>
              attempt &&
              typeof attempt === "object" &&
              !Array.isArray(attempt) &&
              attempt.studentId === req.user.id,
          )
          .map((attempt) => {
            const test = tests.get(attempt.paperId);
            const totalQuestions =
              Number(attempt.totalQuestions) ||
              Number(test?.totalQuestions) ||
              (Array.isArray(test?.questions) ? test.questions.length : 0);

            const correct =
              Number.isFinite(Number(attempt.correct))
                ? Number(attempt.correct)
                : null;

            const score =
              Number.isFinite(Number(attempt.score))
                ? Number(attempt.score)
                : null;

            return {
              attemptId: attempt.attemptId,
              paperId: attempt.paperId,
              subject: test?.subject || attempt.subject || "Online Examination",
              status: attempt.status || "UNKNOWN",
              score,
              correct,
              totalQuestions,
              startedAt: attempt.startedAt || null,
              submittedAt: attempt.submittedAt || null,
              terminatedAt: attempt.terminatedAt || null,
              violation: attempt.violation || null,
            };
          })
          .sort((a, b) =>
            new Date(b.submittedAt || b.terminatedAt || b.startedAt || 0).getTime() -
            new Date(a.submittedAt || a.terminatedAt || a.startedAt || 0).getTime(),
          );

      return res.json({
        success: true,
        count: history.length,
        history,
        testHistory: history,
      });
    } catch (error) {
      console.error("Student test history error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to load test history.",
      });
    }
  },
);

/*
====================================================
STUDENT RESULTS
====================================================
*/

app.get(
  "/api/student/results",
  authenticateStudent,
  (req, res) => {
    try {
      const results =
        [...examAttempts.values()]
          .filter(
            (attempt) =>
              attempt &&
              typeof attempt === "object" &&
              !Array.isArray(attempt) &&
              attempt.studentId === req.user.id &&
              attempt.status === "SUBMITTED",
          )
          .map((attempt) => {
            const test = tests.get(attempt.paperId);
            return {
              attemptId: attempt.attemptId,
              paperId: attempt.paperId,
              subject: test?.subject || attempt.subject || "Online Examination",
              status: attempt.status,
              score: Number.isFinite(Number(attempt.score)) ? Number(attempt.score) : 0,
              correct: Number.isFinite(Number(attempt.correct)) ? Number(attempt.correct) : 0,
              totalQuestions:
                Number(attempt.totalQuestions) ||
                Number(test?.totalQuestions) ||
                (Array.isArray(test?.questions) ? test.questions.length : 0),
              startedAt: attempt.startedAt || null,
              submittedAt: attempt.submittedAt || null,
            };
          })
          .sort((a, b) =>
            new Date(b.submittedAt || 0).getTime() -
            new Date(a.submittedAt || 0).getTime(),
          );

      return res.json({
        success: true,
        count: results.length,
        results,
      });
    } catch (error) {
      console.error("Student results error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to load examination results.",
      });
    }
  },
);

/*
====================================================
START EXAM
====================================================
*/

app.post(
  "/api/student/tests/:paperId/start",
  authenticateStudent,
  async (req, res) => {
    try {
      const paperId =
        normalizePaperId(
          req.params.paperId,
        );

      const test =
        tests.get(paperId);

      if (!test) {
        return res.status(404).json({
          success: false,

          message:
            "Invalid Paper ID.",

          paperId,
        });
      }

      if (
        test.status !==
        "published"
      ) {
        return res.status(403).json({
          success: false,

          message:
            "This test is not available.",
        });
      }

      const existingAttempt =
        [...examAttempts.values()].find(
          (attempt) =>
            attempt.studentId ===
              req.user.id &&
            attempt.paperId ===
              paperId &&
            attempt.status ===
              "IN_PROGRESS",
        );

      if (existingAttempt) {
        return res.json({
          success: true,
          resumed: true,

          message:
            "Existing examination attempt resumed.",

          attemptId:
            existingAttempt.attemptId,

          status:
            existingAttempt.status,

          startedAt:
            existingAttempt.startedAt,
        });
      }

      // One student gets exactly one attempt for a paper.
      // An IN_PROGRESS attempt above may be resumed, but a
      // SUBMITTED / FLAGGED / TERMINATED attempt can never
      // create a second attempt.
      const previousAttempt =
        [...examAttempts.values()].find(
          (attempt) =>
            attempt.studentId ===
              req.user.id &&
            attempt.paperId ===
              paperId,
        );

      if (previousAttempt) {
        return res.status(409).json({
          success: false,
          alreadyAttempted: true,
          attemptId:
            previousAttempt.attemptId,
          status:
            previousAttempt.status,
          message:
            "You cannot reattempt this test. Only one attempt is allowed.",

          studentMessage:
            "You cannot reattempt this test. Only one attempt is allowed.",
        });
      }

      const attemptId =
        generateAttemptId();

      const attempt = {
        attemptId,

        studentId:
          req.user.id,

        studentName:
          req.user.name,

        studentEmail:
          req.user.email,

        paperId,

        status:
          "IN_PROGRESS",

        answers: {},

        startedAt:
          new Date().toISOString(),

        terminatedAt:
          null,

        submittedAt:
          null,

        violation:
          null,
      };

      examAttempts.set(
        attemptId,
        attempt,
      );

      await saveExamAttemptsToDisk();

      console.log(
        `Ã°Å¸â€œÂ Exam started | Student: ${req.user.name} | Paper: ${paperId} | Attempt: ${attemptId}`,
      );

      res.status(201).json({
        success: true,

        message:
          "Exam started successfully.",

        attemptId,

        status:
          attempt.status,

        startedAt:
          attempt.startedAt,
      });
    } catch (error) {
      console.error(
        "Start exam error:",
        error,
      );

      res.status(500).json({
        success: false,

        message:
          "Failed to start examination.",
      });
    }
  },
);

/*
====================================================
FULLSCREEN VIOLATION
====================================================
*/

app.post(
  "/api/student/tests/:paperId/violation",
  authenticateStudent,
  async (req, res) => {
    try {
      const paperId =
        normalizePaperId(
          req.params.paperId,
        );

      const {
        attemptId,
        violationType,
        message,
      } = req.body;

      if (!attemptId) {
        return res.status(400).json({
          success: false,

          message:
            "Attempt ID is required.",
        });
      }

      const attempt =
        getStudentAttempt(
          req.user.id,
          attemptId,
        );

      if (!attempt) {
        return res.status(404).json({
          success: false,

          message:
            "Examination attempt not found.",
        });
      }

      if (
        attempt.paperId !==
        paperId
      ) {
        return res.status(400).json({
          success: false,

          message:
            "Attempt does not belong to this test.",
        });
      }

      if (
        attempt.status ===
          "FLAGGED" ||
        attempt.status ===
          "SUBMITTED" ||
        attempt.status ===
          "TERMINATED"
      ) {
        return res.json({
          success: true,

          alreadyTerminated:
            true,

          status:
            attempt.status,
        });
      }

      const finalViolationType =
        violationType ||
        "FULLSCREEN_EXIT";

      const finalMessage =
        message ||
        "Student broke the fullscreen examination rule.";

      const timestamp =
        new Date().toISOString();

      attempt.status =
        "FLAGGED";

      attempt.terminatedAt =
        timestamp;

      attempt.violation = {
        type:
          finalViolationType,

        message:
          finalMessage,

        timestamp,

        studentId:
          req.user.id,

        studentName:
          req.user.name,

        studentEmail:
          req.user.email,

        paperId,

        attemptId,
      };

      examAttempts.set(
        attemptId,
        attempt,
      );

      await saveExamAttemptsToDisk();

      const notification = {
        id:
          crypto.randomUUID(),

        type:
          "EXAM_RULE_VIOLATION",

        severity:
          "HIGH",

        title:
          "Student broke an examination rule",

        message:
          `${req.user.name}: ${finalMessage}`,

        details: {
          studentId:
            req.user.id,

          studentName:
            req.user.name,

          studentEmail:
            req.user.email,

          paperId,

          attemptId,

          violationType:
            finalViolationType,

          violationMessage:
            finalMessage,
        },

        createdAt:
          timestamp,

        read:
          false,
      };

      adminNotifications.unshift(
        notification,
      );

      console.warn(
        "Ã°Å¸Å¡Â¨ EXAMINATION RULE VIOLATION",
      );

      console.warn(
        `Ã°Å¸Å¡Â¨ Student: ${req.user.name}`,
      );

      console.warn(
        `Ã°Å¸Å¡Â¨ Email: ${req.user.email}`,
      );

      console.warn(
        `Ã°Å¸Å¡Â¨ Paper ID: ${paperId}`,
      );

      console.warn(
        `Ã°Å¸Å¡Â¨ Attempt ID: ${attemptId}`,
      );

      console.warn(
        `Ã°Å¸Å¡Â¨ Violation: ${finalViolationType}`,
      );

      console.warn(
        `Ã°Å¸Å¡Â¨ Time: ${timestamp}`,
      );

      console.warn(
        "Ã°Å¸Å¡Â¨ Exam TERMINATED and FLAGGED.",
      );

      res.json({
        success: true,

        terminated:
          true,

        flagged:
          true,

        status:
          attempt.status,

        message:
          `Examination terminated: ${finalMessage}`,

        studentMessage:
          `Your examination has been terminated because ${finalMessage.toLowerCase()}` ,

        notificationId:
          notification.id,
      });
    } catch (error) {
      console.error(
        "Violation processing error:",
        error,
      );

      res.status(500).json({
        success: false,

        message:
          "Failed to process examination violation.",
      });
    }
  },
);

/*
====================================================
GET CURRENT EXAM ATTEMPT
====================================================
*/

app.get(
  "/api/student/tests/:paperId/attempt/:attemptId",
  authenticateStudent,
  (req, res) => {
    const paperId =
      normalizePaperId(
        req.params.paperId,
      );

    const {
      attemptId,
    } = req.params;

    const attempt =
      getStudentAttempt(
        req.user.id,
        attemptId,
      );

    if (!attempt) {
      return res.status(404).json({
        success: false,

        message:
          "Examination attempt not found.",
      });
    }

    if (
      attempt.paperId !==
      paperId
    ) {
      return res.status(400).json({
        success: false,

        message:
          "Attempt does not belong to this test.",
      });
    }

    res.json({
      success: true,

      attempt: {
        attemptId:
          attempt.attemptId,

        paperId:
          attempt.paperId,

        status:
          attempt.status,

        startedAt:
          attempt.startedAt,

        terminatedAt:
          attempt.terminatedAt,

        submittedAt:
          attempt.submittedAt,

        violation:
          attempt.violation,
      },
    });
  },
);

/*
====================================================
SUBMIT TEST
====================================================
*/

app.post(
  "/api/student/tests/:paperId/submit",
  authenticateStudent,
  async (req, res) => {
    try {
      const paperId =
        normalizePaperId(
          req.params.paperId,
        );

      const body = req.body;

      if (
        !body ||
        typeof body !== "object" ||
        Array.isArray(body)
      ) {
        return res.status(400).json({
          success: false,

          message:
            "Invalid request body.",
        });
      }

      const {
        answers,
        attemptId,
      } = body;

      const test =
        tests.get(paperId);

      if (!test) {
        return res.status(404).json({
          success: false,

          message:
            "Invalid Paper ID.",

          paperId,
        });
      }

      if (
        test.status !==
        "published"
      ) {
        return res.status(403).json({
          success: false,

          message:
            "This test is not available.",
        });
      }

      if (
        typeof attemptId !==
          "string" ||
        !attemptId.trim()
      ) {
        return res.status(400).json({
          success: false,

          message:
            "Attempt ID is required.",
        });
      }

      const attempt =
        getStudentAttempt(
          req.user.id,
          attemptId,
        );

      if (!attempt) {
        return res.status(404).json({
          success: false,

          message:
            "Examination attempt not found.",
        });
      }

      if (
        attempt.paperId !==
        paperId
      ) {
        return res.status(400).json({
          success: false,

          message:
            "Attempt does not belong to this test.",
        });
      }

      if (
        attempt.status ===
        "FLAGGED"
      ) {
        return res.status(403).json({
          success: false,

          flagged:
            true,

          terminated:
            true,

          message:
            "This examination was terminated and flagged because an examination rule was violated.",
        });
      }

      if (
        attempt.status ===
        "TERMINATED"
      ) {
        return res.status(403).json({
          success: false,

          terminated:
            true,

          message:
            "This examination has already been terminated.",
        });
      }

      if (
        attempt.status ===
        "SUBMITTED"
      ) {
        return res.status(409).json({
          success: false,

          message:
            "This examination has already been submitted.",
        });
      }

      if (
        !answers ||
        typeof answers !==
          "object" ||
        Array.isArray(answers)
      ) {
        return res.status(400).json({
          success: false,

          message:
            "Invalid answer submission.",
        });
      }

      attempt.answers =
        answers;

      let correct = 0;

      test.questions.forEach(
        (question) => {
          const submittedAnswer =
            answers[
              question.id
            ];

          if (
            submittedAnswer !==
              undefined &&
            submittedAnswer !==
              null &&
            question.correctAnswer &&
            String(
              submittedAnswer,
            )
              .trim()
              .toLowerCase() ===
              String(
                question.correctAnswer,
              )
                .trim()
                .toLowerCase()
          ) {
            correct++;
          }
        },
      );

      const totalQuestions =
        Number(test.totalQuestions) ||
        (Array.isArray(test.questions)
          ? test.questions.length
          : 0);

      const score =
        totalQuestions >
        0
          ? Math.round(
              (correct /
                totalQuestions) *
                100,
            )
          : 0;

      attempt.correct =
        correct;

      attempt.score =
        score;

      attempt.totalQuestions =
        totalQuestions;

      attempt.subject =
        test.subject;

      attempt.status =
        "SUBMITTED";

      attempt.submittedAt =
        new Date().toISOString();

      examAttempts.set(
        attemptId,
        attempt,
      );

      await saveExamAttemptsToDisk();

      community.createNotification(req.user.id, {
        type: "RESULT",
        title: "Result Available",
        message: `${test.title || test.subject || "Test"} result is available. Score: ${score}%`,
        data: { paperId, attemptId, score, correct, totalQuestions },
      });

      console.log(
        `Ã¢Å“â€¦ Exam submitted | Student: ${req.user.name} | Paper: ${paperId} | Score: ${score}`,
      );

      res.json({
        success: true,

        result: {
          attemptId,

          totalQuestions:
            totalQuestions,

          correct,

          score,

          status:
            attempt.status,
        },
      });
    } catch (error) {
      console.error(
        "Submit exam error:",
        error,
      );

      res.status(500).json({
        success: false,

        message:
          "Failed to submit examination.",
      });
    }
  },
);

/*
====================================================
ADMIN EXAM VIOLATIONS
====================================================
*/

app.get(
  "/api/admin/exam-violations",
  (req, res) => {
    const violations =
      [...examAttempts.values()]
        .filter(
          (attempt) =>
            attempt.status ===
            "FLAGGED",
        )
        .map(
          (attempt) => ({
            attemptId:
              attempt.attemptId,

            studentId:
              attempt.studentId,

            studentName:
              attempt.studentName,

            studentEmail:
              attempt.studentEmail,

            paperId:
              attempt.paperId,

            status:
              attempt.status,

            startedAt:
              attempt.startedAt,

            terminatedAt:
              attempt.terminatedAt,

            violation:
              attempt.violation,
          }),
        );

    res.json({
      success: true,

      count:
        violations.length,

      violations,
    });
  },
);

/*
====================================================
ADMIN NOTIFICATIONS
====================================================
*/

app.get(
  "/api/admin/notifications",
  (req, res) => {
    res.json({
      success: true,

      count:
        adminNotifications.length,

      unreadCount:
        adminNotifications.filter(
          (notification) =>
            !notification.read,
        ).length,

      notifications:
        adminNotifications,
    });
  },
);

/*
====================================================
MARK NOTIFICATION READ
====================================================
*/

app.post(
  "/api/admin/notifications/:notificationId/read",
  (req, res) => {
    const {
      notificationId,
    } = req.params;

    const notification =
      adminNotifications.find(
        (item) =>
          item.id ===
          notificationId,
      );

    if (!notification) {
      return res.status(404).json({
        success: false,

        message:
          "Notification not found.",
      });
    }

    notification.read =
      true;

    res.json({
      success: true,

      message:
        "Notification marked as read.",

      notification,
    });
  },
);

/*
====================================================
ADMIN SPECIFIC EXAM ATTEMPT
====================================================
*/

app.get(
  "/api/admin/exam-attempts/:attemptId",
  (req, res) => {
    const {
      attemptId,
    } = req.params;

    const attempt =
      examAttempts.get(
        attemptId,
      );

    if (!attempt) {
      return res.status(404).json({
        success: false,

        message:
          "Exam attempt not found.",
      });
    }

    res.json({
      success: true,

      attempt,
    });
  },
);

/*
====================================================
ADMIN DEBUG - LIST TESTS
====================================================
*/

app.get(
  "/api/debug/tests",
  authenticateAdmin,
  (req, res) => {
    const testList =
      [...tests.values()].map(
        (test) => ({
          paperId:
            test.paperId,

          subject:
            test.subject,

          status:
            test.status,

          totalQuestions:
            test.totalQuestions,

          createdAt:
            test.createdAt,

          updatedAt:
            test.updatedAt,
        }),
      );

    res.json({
      success: true,

      count:
        testList.length,

      tests:
        testList,
    });
  },
);

/*
====================================================
START SERVER
====================================================
*/

/*
====================================================
ADMIN DASHBOARD + MANAGEMENT ROUTES
====================================================
*/

function buildAdminAttempt(attempt) {
  const test = tests.get(attempt.paperId);
  const totalQuestions =
    Number(attempt.totalQuestions) ||
    Number(test?.totalQuestions) ||
    (Array.isArray(test?.questions) ? test.questions.length : 0);

  const correct =
    attempt.correct !== undefined && attempt.correct !== null
      ? Number(attempt.correct)
      : null;

  const score =
    attempt.score !== undefined && attempt.score !== null
      ? Number(attempt.score)
      : null;

  return {
    attemptId: attempt.attemptId,
    studentId: attempt.studentId,
    studentName: attempt.studentName || "Unknown Student",
    studentEmail: attempt.studentEmail || "",
    paperId: attempt.paperId,
    subject: test?.subject || attempt.subject || "Online Examination",
    status: attempt.status || "UNKNOWN",
    totalQuestions,
    correct: Number.isFinite(correct) ? correct : null,
    score: Number.isFinite(score) ? score : null,
    startedAt: attempt.startedAt || null,
    submittedAt: attempt.submittedAt || null,
    terminatedAt: attempt.terminatedAt || null,
    violation: attempt.violation || null,
  };
}

function getAdminAttempts(adminUser = null) {
  const ownedPaperIds = adminUser
    ? new Set(
        [...tests.values()]
          .filter((test) => isTestOwnedByAdmin(test, adminUser))
          .map((test) => test.paperId),
      )
    : null;

  return [...examAttempts.values()]
    .filter((attempt) => !ownedPaperIds || ownedPaperIds.has(attempt.paperId))
    .map(buildAdminAttempt)
    .sort((a, b) => {
      const aTime = new Date(a.submittedAt || a.startedAt || 0).getTime();
      const bTime = new Date(b.submittedAt || b.startedAt || 0).getTime();
      return bTime - aTime;
    });
}

function getAdminStudents() {
  return [...users.values()]
    .filter((user) => user && user.role === "student")
    .map((student) => {
      const attempts = getAdminAttempts().filter(
        (attempt) => attempt.studentId === student.id,
      );

      const submitted = attempts.filter(
        (attempt) => attempt.status === "SUBMITTED",
      );

      const scored = submitted
        .map((attempt) => Number(attempt.score))
        .filter((value) => Number.isFinite(value));

      const averageScore =
        scored.length > 0
          ? Math.round(
              scored.reduce((sum, value) => sum + value, 0) / scored.length,
            )
          : null;

      return {
        id: student.id,
        studentId: student.studentId || null,
        name: student.name || "Unknown Student",
        email: student.email || "",
        createdAt: student.createdAt || null,
        status: student.status === "blocked" ? "blocked" : "active",
        blockedAt: student.blockedAt || null,
        blockedReason: student.blockedReason || "",
        attempts: attempts.length,
        completed: submitted.length,
        averageScore,
      };
    })
    .sort((a, b) => {
      const aTime = new Date(a.createdAt || 0).getTime();
      const bTime = new Date(b.createdAt || 0).getTime();
      return bTime - aTime;
    });
}

function getAdminTestName(test) {
  const candidates = [
    test?.subject,
    test?.title,
    test?.name,
    test?.testName,
    test?.examName,
    test?.courseName,
  ];

  const valid = candidates.find((value) => {
    if (typeof value !== "string") return false;
    const normalized = value.trim().toLowerCase();
    return normalized && ![
      "untitled test",
      "untitled",
      "online examination",
    ].includes(normalized);
  });

  return valid?.trim() || `Test ${test?.paperId || ""}`.trim();
}

function getAdminTests(adminUser = null) {
  const attempts = getAdminAttempts(adminUser);

  return [...tests.values()]
    .filter((test) => !adminUser || isTestOwnedByAdmin(test, adminUser))
    .map((test) => {
      const testAttempts = attempts.filter(
        (attempt) => attempt.paperId === test.paperId,
      );

      const displayName = getAdminTestName(test);

      return {
        paperId: test.paperId,
        subject: displayName,
        title: displayName,
        name: displayName,
        testName: displayName,
        programmingLanguage: test.programmingLanguage || "",
        topics: test.topics || "",
        totalQuestions: Number(test.totalQuestions) || 0,
        easyQuestions: Number(test.easyQuestions) || 0,
        mediumQuestions: Number(test.mediumQuestions) || 0,
        hardQuestions: Number(test.hardQuestions) || 0,
        codingQuestions: Number(test.codingQuestions) || 0,
        difficultyDistribution: test.difficultyDistribution || {
          easy: Number(test.easyQuestions) || 0,
          medium: Number(test.mediumQuestions) || 0,
          hard: Number(test.hardQuestions) || 0,
        },
        questionTypes: test.questionTypes || {
          mcq: Math.max(0, (Number(test.totalQuestions) || 0) - (Number(test.codingQuestions) || 0)),
          coding: Number(test.codingQuestions) || 0,
        },
        codingQuestionsEnabled: Boolean(test.codingQuestions),
        questionCount: Array.isArray(test.questions)
          ? test.questions.length
          : Number(test.totalQuestions) || 0,
        status: test.status || "draft",
        createdAt: test.createdAt || null,
        updatedAt: test.updatedAt || null,
        attempts: testAttempts.length,
      };
    })
    .sort((a, b) => {
      const aTime = new Date(a.createdAt || 0).getTime();
      const bTime = new Date(b.createdAt || 0).getTime();
      return bTime - aTime;
    });
}

function getAdminQuestions(adminUser = null) {
  const result = [];

  for (const test of tests.values()) {
    if (adminUser && !isTestOwnedByAdmin(test, adminUser)) continue;
    if (!Array.isArray(test.questions)) continue;

    test.questions.forEach((question, index) => {
      result.push({
        id: question.id || `${test.paperId}-${index + 1}`,
        paperId: test.paperId,
        subject: getAdminTestName(test),
        topic: question.topic || "General",
        type: question.type || "MCQ",
        difficulty: question.difficulty || "Unknown",
        number: Number(question.number) || index + 1,
        question: question.question || "",
      });
    });
  }

  return result;
}

function getAdminDashboardData(adminUser) {
  const students = getAdminStudents();
  const adminTests = getAdminTests(adminUser);
  const attempts = getAdminAttempts(adminUser);

  const completedAttempts = attempts.filter(
    (attempt) => attempt.status === "SUBMITTED",
  );

  const inProgressAttempts = attempts.filter(
    (attempt) => attempt.status === "IN_PROGRESS",
  );

  const flaggedAttempts = attempts.filter(
    (attempt) =>
      attempt.status === "FLAGGED" ||
      attempt.status === "TERMINATED",
  );

  const scoredAttempts = completedAttempts
    .map((attempt) => Number(attempt.score))
    .filter((value) => Number.isFinite(value));

  const averageScore =
    scoredAttempts.length > 0
      ? Math.round(
          scoredAttempts.reduce((sum, value) => sum + value, 0) /
            scoredAttempts.length,
        )
      : null;

  const recentTests = adminTests.slice(0, 5);

  const activity = [];

  students.forEach((student) => {
    if (student.createdAt) {
      activity.push({
        id: `student-${student.id}`,
        title: "New student registered",
        description: `${student.name} created a student account.`,
        timestamp: student.createdAt,
      });
    }
  });

  adminTests.forEach((test) => {
    if (test.createdAt) {
      activity.push({
        id: `test-${test.paperId}`,
        title: "New test created",
        description: `${getAdminTestName(test)} was added to TestFlow.` ,
        timestamp: test.createdAt,
      });
    }
  });

  attempts.forEach((attempt) => {
    const timestamp =
      attempt.submittedAt ||
      attempt.terminatedAt ||
      attempt.startedAt;

    if (!timestamp) return;

    if (attempt.status === "SUBMITTED") {
      activity.push({
        id: `attempt-${attempt.attemptId}`,
        title: "Test completed",
        description: `${attempt.studentName} completed ${attempt.subject}.`,
        timestamp,
      });
    } else if (
      attempt.status === "FLAGGED" ||
      attempt.status === "TERMINATED"
    ) {
      activity.push({
        id: `flag-${attempt.attemptId}`,
        title: "Examination flagged",
        description: `${attempt.studentName}'s ${attempt.subject} attempt was flagged.`,
        timestamp,
      });
    } else {
      activity.push({
        id: `started-${attempt.attemptId}`,
        title: "Test started",
        description: `${attempt.studentName} started ${attempt.subject}.`,
        timestamp,
      });
    }
  });

  activity.sort(
    (a, b) =>
      new Date(b.timestamp || 0).getTime() -
      new Date(a.timestamp || 0).getTime(),
  );

  return {
    success: true,
    currentAdmin: adminUser ? serializeAdminAccount(adminUser) : null,
    stats: {
      students: students.length,
      tests: adminTests.length,
      attempts: attempts.length,
      activeTests: adminTests.filter(
        (test) => test.status === "published",
      ).length,
      completedAttempts: completedAttempts.length,
      flaggedAttempts: flaggedAttempts.length,
      inProgressAttempts: inProgressAttempts.length,
      averageScore,
      unreadNotifications: adminNotifications.filter(
        (notification) => !notification.read,
      ).length,
    },
    recentTests,
    recentActivity: activity.slice(0, 10),
  };
}

app.get("/api/admin/dashboard", (req, res) => {
  try {
    res.json(getAdminDashboardData(req.user));
  } catch (error) {
    console.error("Admin dashboard error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to build admin dashboard data.",
    });
  }
});

app.get("/api/admin/exam-attempts", (req, res) => {
  try {
    const attempts = getAdminAttempts(req.user);
    res.json({
      success: true,
      count: attempts.length,
      attempts,
    });
  } catch (error) {
    console.error("Admin exam attempts error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to load examination attempts.",
    });
  }
});

app.get("/api/admin/tests", (req, res) => {
  try {
    const adminTests = getAdminTests(req.user);
    res.json({
      success: true,
      count: adminTests.length,
      tests: adminTests,
    });
  } catch (error) {
    console.error("Admin tests error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to load tests.",
    });
  }
});

app.get("/api/admin/students", (req, res) => {
  try {
    const students = getAdminStudents();
    res.json({
      success: true,
      count: students.length,
      students,
    });
  } catch (error) {
    console.error("Admin students error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to load students.",
    });
  }
});

/*
====================================================
ADMIN STUDENT MANAGEMENT
====================================================
*/

app.patch("/api/admin/students/:studentId/status", (req, res) => {
  try {
    const student = users.get(req.params.studentId);

    if (!student || student.role !== "student") {
      return res.status(404).json({
        success: false,
        message: "Student not found.",
      });
    }

    const requestedStatus = String(req.body?.status || "").trim().toLowerCase();
    const status = requestedStatus === "blocked" ? "blocked" : requestedStatus === "active" ? "active" : null;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: "Status must be active or blocked.",
      });
    }

    if (status === "blocked") {
      student.status = "blocked";
      student.blockedAt = new Date().toISOString();
      student.blockedReason = String(req.body?.reason || "Blocked by administrator.").trim().slice(0, 250);

      for (const [token, session] of sessions.entries()) {
        if (session?.userId === student.id) {
          sessions.delete(token);
        }
      }
    } else {
      student.status = "active";
      student.blockedAt = null;
      student.blockedReason = "";
    }

    users.set(student.id, student);
    saveStudentsToDisk().catch((error) => console.error("Failed to persist students:", error));

    res.json({
      success: true,
      message: status === "blocked" ? "Student account blocked." : "Student account unblocked.",
      student: getAdminStudents().find((item) => item.id === student.id) || null,
    });
  } catch (error) {
    console.error("Admin student status error:", error);
    res.status(500).json({ success: false, message: "Failed to update student status." });
  }
});

app.delete("/api/admin/students/:studentId", (req, res) => {
  try {
    const student = users.get(req.params.studentId);

    if (!student || student.role !== "student") {
      return res.status(404).json({
        success: false,
        message: "Student not found.",
      });
    }

    for (const [token, session] of sessions.entries()) {
      if (session?.userId === student.id) {
        sessions.delete(token);
      }
    }

    users.delete(student.id);
    saveStudentsToDisk().catch((error) => console.error("Failed to persist students:", error));

    // Examination attempts are intentionally retained as historical records.
    res.json({
      success: true,
      message: "Student account removed. Historical examination records were retained.",
      studentId: student.id,
    });
  } catch (error) {
    console.error("Admin delete student error:", error);
    res.status(500).json({ success: false, message: "Failed to remove student." });
  }
});

app.get("/api/admin/admins", (req, res) => {
  // All authenticated admins may VIEW the complete admin directory.
  // Create/delete permissions remain restricted to the primary admin.
  return res.json({
    success: true,
    currentAdmin: serializeAdminAccount(req.user),
    admins: [...adminAccounts.values()]
      .map(serializeAdminAccount)
      .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary)),
  });
});

app.post("/api/admin/admins", async (req, res) => {
  try {
    // Every authenticated administrator may create another administrator.
    // Removal remains restricted to the primary administrator below.
    const fullName = String(
      req.body?.fullName ?? req.body?.name ?? req.body?.adminName ?? "",
    ).trim();

    const email = String(
      req.body?.email ?? req.body?.adminEmail ?? "",
    ).trim().toLowerCase();

    const mobileNumber = String(
      req.body?.mobileNumber ?? req.body?.phone ?? "",
    ).trim();

    const password = String(
      req.body?.password ?? req.body?.newPassword ?? "",
    );

    const confirmPassword = String(
      req.body?.confirmPassword ?? req.body?.passwordConfirmation ?? "",
    );

    if (!fullName) {
      return res.status(400).json({
        success: false,
        message: "Full name is required.",
      });
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid admin email address.",
      });
    }

    if (!password) {
      return res.status(400).json({
        success: false,
        message: "Password is required.",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must contain at least 6 characters.",
      });
    }

    if (confirmPassword && password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Password and confirmation password do not match.",
      });
    }

    const existingAdmin = [...adminAccounts.values()].find(
      (admin) => String(admin.email || "").trim().toLowerCase() === email,
    );

    if (existingAdmin) {
      return res.status(409).json({
        success: false,
        message: "An admin account with this email already exists.",
      });
    }

    // Also prevent an admin email from colliding with a student account.
    const existingUser = [...users.values()].find(
      (user) =>
        String(user.email || "").trim().toLowerCase() === email &&
        user.id !== req.user.id,
    );

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists.",
      });
    }

    const admin = {
      id: `admin-${crypto.randomUUID()}`,
      name: fullName,
      email,
      mobileNumber,
      role: "admin",
      isPrimary: false,
      passwordHash: await bcrypt.hash(password, 10),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Keep the admin in BOTH stores. Login reads adminAccounts and
    // session verification reads users.
    adminAccounts.set(admin.id, admin);
    users.set(admin.id, admin);

    // Persist immediately so the account survives a server restart.
    saveAdminAccountsToDisk().catch((error) => console.error("Failed to persist admin accounts:", error));

    console.log(
      `Ã°Å¸â€˜Â¤ Created admin account: ${admin.name} <${admin.email}> (${admin.id})`,
    );
    console.log(
      `Ã°Å¸â€˜Â® Admin accounts currently loaded: ${adminAccounts.size}`,
    );

    return res.status(201).json({
      success: true,
      message: "New admin account created successfully.",
      admin: serializeAdminAccount(admin),
      admins: [...adminAccounts.values()]
        .map(serializeAdminAccount)
        .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary)),
    });
  } catch (error) {
    console.error("Create admin account error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create admin account.",
    });
  }
});

app.delete("/api/admin/admins/:adminId", (req, res) => {
  if (!req.user.isPrimary) {
    return res.status(403).json({
      success: false,
      message: "Only the primary admin can remove admin accounts.",
    });
  }

  const adminId = String(req.params.adminId || "").trim();
  const target = adminAccounts.get(adminId);

  if (!target) {
    return res.status(404).json({
      success: false,
      message: "Admin account not found.",
    });
  }

  if (target.isPrimary || target.id === req.user.id) {
    return res.status(400).json({
      success: false,
      message: "The primary admin account cannot be removed.",
    });
  }

  for (const [token, session] of sessions.entries()) {
    if (session?.userId === target.id) {
      sessions.delete(token);
    }
  }

  adminAccounts.delete(target.id);
  users.delete(target.id);
  saveAdminAccountsToDisk().catch((error) => console.error("Failed to persist admin accounts:", error));

  return res.json({
    success: true,
    message: `${target.name || target.email} was removed successfully.`,
    adminId: target.id,
  });
});

app.get("/api/admin/settings", (req, res) => {
  try {
    res.json({
      success: true,
      settings: {
        ...sanitizeAdminSettings(adminSettings),
        adminName: req.user.name,
        adminEmail: req.user.email,
      },
      currentAdmin: serializeAdminAccount(req.user),
    });
  } catch (error) {
    console.error("Admin settings load error:", error);
    res.status(500).json({ success: false, message: "Failed to load admin settings." });
  }
});

app.put("/api/admin/settings", (req, res) => {
  try {
    const payload = req.body || {};
    const next = sanitizeAdminSettings({
      ...adminSettings,
      ...payload,
    });

    const nextName = String(payload.adminName ?? req.user.name).trim();
    const nextEmail = String(payload.adminEmail ?? req.user.email).trim().toLowerCase();

    if (!nextName || !nextEmail) {
      return res.status(400).json({
        success: false,
        message: "Admin name and email are required.",
      });
    }

    const duplicate = [...adminAccounts.values()].find(
      (admin) => admin.id !== req.user.id && admin.email === nextEmail,
    );
    if (duplicate) {
      return res.status(409).json({
        success: false,
        message: "Another admin account is already using this email address.",
      });
    }

    req.user.name = nextName;
    req.user.email = nextEmail;
    adminAccounts.set(req.user.id, req.user);
    users.set(req.user.id, req.user);

    adminSettings = next;
    saveAdminSettingsToDisk().catch((error) => console.error("Failed to persist admin settings:", error));
    saveAdminAccountsToDisk().catch((error) => console.error("Failed to persist admin accounts:", error));

    res.json({
      success: true,
      message: "Admin settings saved successfully.",
      settings: {
        ...sanitizeAdminSettings(adminSettings),
        adminName: req.user.name,
        adminEmail: req.user.email,
      },
      currentAdmin: serializeAdminAccount(req.user),
    });
  } catch (error) {
    console.error("Admin settings save error:", error);
    res.status(500).json({ success: false, message: "Failed to save admin settings." });
  }
});

app.post("/api/admin/settings/reset", (req, res) => {
  try {
    adminSettings = { ...DEFAULT_ADMIN_SETTINGS };
    saveAdminSettingsToDisk().catch((error) => console.error("Failed to persist admin settings:", error));

    res.json({
      success: true,
      message: "Admin settings restored to defaults.",
      settings: sanitizeAdminSettings(adminSettings),
      currentAdmin: serializeAdminAccount(req.user),
    });
  } catch (error) {
    console.error("Admin settings reset error:", error);
    res.status(500).json({ success: false, message: "Failed to reset admin settings." });
  }
});

app.get("/api/admin/results", (req, res) => {
  try {
    const results = getAdminAttempts(req.user).filter(
      (attempt) => attempt.status === "SUBMITTED",
    );

    res.json({
      success: true,
      count: results.length,
      results,
    });
  } catch (error) {
    console.error("Admin results error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to load examination results.",
    });
  }
});

app.put("/api/admin/tests/:paperId/questions/:questionId", async (req, res) => {
  try {
    const paperId = normalizePaperId(req.params.paperId);
    const questionId = String(req.params.questionId || "").trim();
    const test = tests.get(paperId);

    if (test && !isTestOwnedByAdmin(test, req.user)) {
      return res.status(403).json({
        success: false,
        message: "You can only edit questions for tests created by your admin account.",
      });
    }

    if (!test) {
      return res.status(404).json({ success: false, message: "Test not found.", paperId });
    }
    if (test.status === "published") {
      return res.status(409).json({ success: false, message: "Published tests cannot be edited.", paperId });
    }
    if (!Array.isArray(test.questions)) {
      return res.status(400).json({ success: false, message: "This test has no editable question list." });
    }

    const index = test.questions.findIndex((question) => String(question?.id || "") === questionId);
    if (index < 0) {
      return res.status(404).json({ success: false, message: "Question not found.", questionId });
    }

    const current = test.questions[index];
    const payload = req.body || {};
    const type = String(payload.type ?? current.type ?? "MCQ").trim();
    const difficulty = String(payload.difficulty ?? current.difficulty ?? "Medium").trim();
    if (!["MCQ", "Coding"].includes(type)) {
      return res.status(400).json({ success: false, message: "Question type must be MCQ or Coding." });
    }
    if (!["Easy", "Medium", "Hard"].includes(difficulty)) {
      return res.status(400).json({ success: false, message: "Difficulty must be Easy, Medium, or Hard." });
    }

    const options = Array.isArray(payload.options)
      ? payload.options.map((option) => String(option))
      : (Array.isArray(current.options) ? current.options : []);

    if (type === "MCQ" && options.length !== 4) {
      return res.status(400).json({ success: false, message: "MCQ questions must have exactly 4 options." });
    }

    const updatedQuestion = {
      ...current,
      ...payload,
      id: current.id,
      number: current.number || index + 1,
      type,
      difficulty,
      topic: String(payload.topic ?? current.topic ?? "General").trim(),
      question: String(payload.question ?? current.question ?? "").trim(),
      options: type === "Coding" ? [] : options,
      correctAnswer: String(payload.correctAnswer ?? current.correctAnswer ?? "").trim(),
      explanation: String(payload.explanation ?? current.explanation ?? "").trim(),
      starterCode: String(payload.starterCode ?? current.starterCode ?? ""),
    };

    if (!updatedQuestion.question) {
      return res.status(400).json({ success: false, message: "Question text is required." });
    }

    test.questions[index] = updatedQuestion;
    test.updatedAt = new Date().toISOString();
    tests.set(paperId, test);
    await saveTestsToDisk();

    return res.json({ success: true, message: "Question updated successfully.", question: updatedQuestion, test });
  } catch (error) {
    console.error("Admin question update error:", error);
    return res.status(500).json({ success: false, message: "Failed to update question." });
  }
});

app.get("/api/admin/questions", (req, res) => {
  try {
    const questions = getAdminQuestions(req.user);
    res.json({
      success: true,
      count: questions.length,
      questions,
    });
  } catch (error) {
    console.error("Admin questions error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to load question bank.",
    });
  }
});



const community = registerCommunityRoutes({
  app,
  DATA_DIR,
  users,
  sessions,
  adminAccounts,
  authenticateAdmin,
  authenticateStudent,
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "API endpoint not found.",
    path: req.originalUrl,
  });
});

app.use((error, req, res, next) => {
  console.error(
    `Ã¢ÂÅ’ Unhandled server error | ${req.method} ${req.originalUrl}:`,
    error,
  );

  if (res.headersSent) return next(error);

  const status = Number.isInteger(error?.status) && error.status >= 400 && error.status < 600
    ? error.status
    : 500;

  res.status(status).json({
    success: false,
    message: status === 500 ? "Internal server error." : (error?.message || "Request failed."),
  });
});

async function startServer(startHttpServer = true) {
  await loadAdminSettingsFromDisk();
  /*
  ------------------------------------------------
  LOAD PERSISTENT TESTS FIRST
  ------------------------------------------------
  */

  await initializeAdminAccounts();

  await loadTestsFromDisk();
  await loadExamAttemptsFromDisk();

  // Load the persisted counter before assigning IDs to legacy students.
  await loadStudentIdCounterFromDisk();
  await loadStudentsFromDisk();

  await loadStudentSettingsFromDisk();
  await loadSessionsFromDisk();
  await loadPasswordResetTokensFromDisk();
  await community.loadCommunityData();

  const authPersistence = enableAuthPersistence();
  authPersistence.markSessionsLoaded();
  authPersistence.markResetTokensLoaded();

  initializeMailTransporter();

  if (!startHttpServer) return app;

  app.listen(
    PORT,
    HOST,
    () => {
      console.log("");

      console.log(
        "======================================",
      );

      console.log(
        "Ã°Å¸Å¡â‚¬ Online Class Test AI Backend",
      );

      console.log(
        `Ã°Å¸â€œÂ¡ Server: http://${HOST}:${PORT}`,
      );

      console.log(
        `Ã°Å¸Å’Â Frontend origin: ${configuredFrontendOrigin || "not set"}`,
      );

      console.log(
        `Ã°Å¸â€œÂ Data directory: ${DATA_DIR}`,
      );

      console.log(
        `Ã°Å¸Â¤â€“ Gemini AI: ${
          process.env.GEMINI_API_KEY
            ? "Configured"
            : "Not Configured"
        }`,
      );

      console.log(
        `Ã°Å¸Â§Â  Gemini Model: ${GEMINI_MODEL}`,
      );

      console.log(
        "Ã°Å¸â€Â Student authentication: ENABLED",
      );

      console.log(
        "Ã°Å¸â€ºÂ¡Ã¯Â¸Â Student answer protection: ENABLED",
      );

      console.log(
        "Ã°Å¸â€â€ž Gemini retry protection: ENABLED",
      );

      console.log(
        "Ã¢Å“ÂÃ¯Â¸Â Admin test editing: ENABLED",
      );

      console.log(
        "Ã°Å¸â€™Â¾ Draft saving: ENABLED",
      );

      console.log(
        "Ã°Å¸â€™Â¿ Persistent JSON storage: ENABLED",
      );

      console.log(
        `Ã°Å¸â€˜Â¥ Student database: ${STUDENTS_FILE}`,
      );

      console.log(
        `Ã°Å¸â€œÂ Test database: ${TESTS_FILE}`,
      );

      console.log(
        "Ã°Å¸â€“Â¥Ã¯Â¸Â Fullscreen exam enforcement: ENABLED",
      );

      console.log(
        "Ã°Å¸Å¡Â¨ Exam violation detection: ENABLED",
      );

      console.log(
        "Ã°Å¸â€â€ Admin violation notifications: ENABLED",
      );

      console.log(
        "Ã°Å¸â€â€˜ Forgot password: ENABLED",
      );

      console.log(
        "Ã¢â„¢Â»Ã¯Â¸Â Password reset: ENABLED",
      );

      console.log(
        "Ã¢ÂÂ±Ã¯Â¸Â Reset token expiry: 15 minutes",
      );

      console.log(
        `Ã°Å¸â€œÂ§ Password reset email: ${
          mailTransporter
            ? "CONFIGURED"
            : "DEVELOPMENT MODE"
        }`,
      );

      console.log(
        "Ã¢Å¡â„¢Ã¯Â¸Â Student settings: ENABLED",
      );

      console.log(
        "Ã°Å¸â€ â€ Student ID generation: ENABLED (first real student starts at 1001)",
      );

      console.log(
        `Ã°Å¸â€ â€ Next Student ID: ${nextStudentId}`,
      );

      console.log(
        `Ã°Å¸â€œÅ¡ Tests loaded: ${tests.size}`,
      );

      console.log(
        "======================================",
      );

      console.log("");
    },
  );
}

process.on("SIGTERM", () => {
  console.log("Ã°Å¸â€ºâ€˜ SIGTERM received. Shutting down gracefully.");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("Ã°Å¸â€ºâ€˜ SIGINT received. Shutting down gracefully.");
  process.exit(0);
});

if (process.env.NETLIFY !== "true") {
  startServer();
}
export { app, startServer };












