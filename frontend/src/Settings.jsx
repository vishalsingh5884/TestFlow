import { useEffect, useMemo, useState } from "react";
import "./Settings.css";

const API_URL = (
  import.meta.env.VITE_API_URL || "https://testflow-pkbi.onrender.com"
).replace(/\/$/, "");

const THEME_STORAGE_KEY = "testflow_student_theme";

const DEFAULT_SETTINGS = {
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

/* =========================================================
   HELPERS
========================================================= */

function getToken() {
  return (
    localStorage.getItem("studentToken") ||
    localStorage.getItem("accessToken") ||
    sessionStorage.getItem("studentToken") ||
    sessionStorage.getItem("accessToken") ||
    ""
  );
}

function cloneDefaults() {
  return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
}

function normalizeTheme(theme) {
  return ["light", "dark", "system"].includes(theme) ? theme : "system";
}

function mergeSettings(value = {}) {
  const defaults = cloneDefaults();

  return {
    ...defaults,
    ...value,
    theme: normalizeTheme(value.theme),

    notifications: {
      ...defaults.notifications,
      ...(value.notifications || {}),
    },

    examPreferences: {
      ...defaults.examPreferences,
      ...(value.examPreferences || {}),
    },

    general: {
      ...defaults.general,
      ...(value.general || {}),
    },
  };
}

function getStoredStudentInfo() {
  let savedUser = {};
  try {
    savedUser = JSON.parse(
      localStorage.getItem("student") ||
        localStorage.getItem("user") ||
        "{}"
    );
  } catch (err) {
    savedUser = {};
  }

  return {
    name:
      localStorage.getItem("studentName") ||
      savedUser.name ||
      savedUser.fullName ||
      "",
    email: localStorage.getItem("studentEmail") || savedUser.email || "",
    studentId:
      localStorage.getItem("studentId") ||
      savedUser.studentId ||
      savedUser.studentID ||
      savedUser.id ||
      "",
  };
}

/* =========================================================
   GLOBAL THEME
========================================================= */

function applyGlobalTheme(theme, persist = true) {
  const normalizedTheme = normalizeTheme(theme);

  const root = document.documentElement;
  const body = document.body;

  const themeClasses = [
    "settings-light",
    "settings-system",
    "settings-dark",
    "theme-light",
    "theme-system",
    "theme-dark",
  ];

  root.classList.remove(...themeClasses);
  body.classList.remove(...themeClasses);

  root.classList.add(`settings-${normalizedTheme}`);
  body.classList.add(`settings-${normalizedTheme}`);

  root.classList.add(`theme-${normalizedTheme}`);
  body.classList.add(`theme-${normalizedTheme}`);

  root.setAttribute("data-theme", normalizedTheme);
  body.setAttribute("data-theme", normalizedTheme);

  if (persist) {
    localStorage.setItem(THEME_STORAGE_KEY, normalizedTheme);
  }

  window.dispatchEvent(
    new CustomEvent("testflow-theme-change", {
      detail: {
        theme: normalizedTheme,
      },
    })
  );
}

function restoreStoredTheme() {
  const storedTheme = normalizeTheme(
    localStorage.getItem(THEME_STORAGE_KEY) || "system"
  );

  applyGlobalTheme(storedTheme, false);

  return storedTheme;
}

/* =========================================================
   COMPONENT
========================================================= */

export default function Settings({ onBack }) {
  const [profile, setProfile] = useState(null);

  const [settings, setSettings] = useState(cloneDefaults());
  const [pendingTheme, setPendingTheme] = useState("system");

  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  const [message, setMessage] = useState({
    type: "",
    text: "",
  });

  const [password, setPassword] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [passwordLoading, setPasswordLoading] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [studentId, setStudentId] = useState("");

  /* =======================================================
     LOAD SETTINGS
  ======================================================= */

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    setLoading(true);
    setMessage({
      type: "",
      text: "",
    });

    const storedTheme = restoreStoredTheme();
    const storedInfo = getStoredStudentInfo();
    const token = getToken();

    setName(storedInfo.name);
    setEmail(storedInfo.email);
    setStudentId(storedInfo.studentId || "1002");

    if (!token) {
      const fallback = mergeSettings({
        theme: storedTheme,
      });

      setSettings(fallback);
      setPendingTheme(storedTheme);
      setLoading(false);

      setMessage({
        type: "error",
        text: "Your student session has expired. Please log in again.",
      });

      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/student/settings`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to load settings (${response.status})`);
      }

      const data = await response.json();

      const savedSettings = mergeSettings(data.settings || {});
      const savedTheme = normalizeTheme(savedSettings.theme);

      const profileData = data.profile || data.student || {};

      setProfile(profileData);

      setName(
        profileData.name ||
          profileData.fullName ||
          profileData.studentName ||
          storedInfo.name ||
          ""
      );

      setEmail(profileData.email || storedInfo.email || "");

      setStudentId(
        profileData.studentId ||
          profileData.studentID ||
          profileData.id ||
          storedInfo.studentId ||
          "1002"
      );

      setSettings(savedSettings);
      setPendingTheme(savedTheme);

      applyGlobalTheme(savedTheme);

      if (profileData.name) {
        localStorage.setItem("studentName", profileData.name);
      }

      if (profileData.email) {
        localStorage.setItem("studentEmail", profileData.email);
      }

      if (profileData.studentId || profileData.studentID) {
        localStorage.setItem(
          "studentId",
          profileData.studentId || profileData.studentID
        );
      }
    } catch (error) {
      console.error("Settings load error:", error);

      const fallback = mergeSettings({
        theme: storedTheme,
      });

      setSettings(fallback);
      setPendingTheme(storedTheme);

      applyGlobalTheme(storedTheme);

      setMessage({
        type: "error",
        text: "Unable to load live settings from server. Showing local preferences.",
      });
    } finally {
      setLoading(false);
    }
  }

  /* =======================================================
     UPDATE SETTING
  ======================================================= */

  function updateSetting(section, key, value) {
    setSettings((previous) => ({
      ...previous,
      [section]: {
        ...previous[section],
        [key]: value,
      },
    }));
  }

  /* =======================================================
     PROFILE
  ======================================================= */

  async function saveProfile() {
    const token = getToken();

    if (!token) {
      setMessage({
        type: "error",
        text: "Your session has expired. Please log in again.",
      });
      return;
    }

    setSavingProfile(true);
    setMessage({
      type: "",
      text: "",
    });

    try {
      const response = await fetch(`${API_URL}/api/student/profile`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.message || data.error || "Failed to update profile."
        );
      }

      const updatedProfile = data.profile || {
        ...(profile || {}),
        name: name.trim(),
        email: email.trim(),
      };

      setProfile(updatedProfile);

      localStorage.setItem("studentName", name.trim());
      localStorage.setItem("studentEmail", email.trim());

      setMessage({
        type: "success",
        text: "Profile updated successfully.",
      });
    } catch (error) {
      console.error("Profile update error:", error);

      setMessage({
        type: "error",
        text: error.message || "Unable to update your profile.",
      });
    } finally {
      setSavingProfile(false);
    }
  }

  /* =======================================================
     SAVE SETTINGS
  ======================================================= */

  async function saveSettings() {
    const token = getToken();

    if (!token) {
      setMessage({
        type: "error",
        text: "Your session has expired. Please log in again.",
      });
      return;
    }

    setSavingSettings(true);
    setMessage({
      type: "",
      text: "",
    });

    const settingsToSave = {
      ...settings,
      theme: normalizeTheme(pendingTheme),
    };

    try {
      const response = await fetch(`${API_URL}/api/student/settings`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(settingsToSave),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.message || data.error || "Failed to save settings."
        );
      }

      const savedSettings = mergeSettings(
        data.settings || settingsToSave
      );

      const savedTheme = normalizeTheme(savedSettings.theme);

      setSettings(savedSettings);
      setPendingTheme(savedTheme);

      applyGlobalTheme(savedTheme);

      setMessage({
        type: "success",
        text: "All settings saved successfully.",
      });
    } catch (error) {
      console.error("Settings save error:", error);

      setMessage({
        type: "error",
        text: error.message || "Unable to save your settings.",
      });
    } finally {
      setSavingSettings(false);
    }
  }

  /* =======================================================
     RESET
  ======================================================= */

  async function resetSettings() {
    const token = getToken();

    if (!token) {
      setMessage({
        type: "error",
        text: "Your session has expired. Please log in again.",
      });
      return;
    }

    const confirmed = window.confirm(
      "Reset all settings to their default values?"
    );

    if (!confirmed) return;

    setSavingSettings(true);
    setMessage({
      type: "",
      text: "",
    });

    try {
      const response = await fetch(
        `${API_URL}/api/student/settings/reset`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.message || data.error || "Failed to reset settings."
        );
      }

      const resetSettingsData = mergeSettings(
        data.settings || DEFAULT_SETTINGS
      );

      const resetTheme = normalizeTheme(resetSettingsData.theme);

      setSettings(resetSettingsData);
      setPendingTheme(resetTheme);

      applyGlobalTheme(resetTheme);

      setMessage({
        type: "success",
        text: "Settings have been restored to their defaults.",
      });
    } catch (error) {
      console.error("Settings reset error:", error);

      setMessage({
        type: "error",
        text: error.message || "Unable to reset your settings.",
      });
    } finally {
      setSavingSettings(false);
    }
  }

  /* =======================================================
     PASSWORD
  ======================================================= */

  async function changePassword(event) {
    event.preventDefault();

    if (!password.currentPassword) {
      setMessage({
        type: "error",
        text: "Enter your current password.",
      });
      return;
    }

    if (!password.newPassword) {
      setMessage({
        type: "error",
        text: "Enter a new password.",
      });
      return;
    }

    if (password.newPassword.length < 8) {
      setMessage({
        type: "error",
        text: "New password must be at least 8 characters.",
      });
      return;
    }

    if (password.newPassword !== password.confirmPassword) {
      setMessage({
        type: "error",
        text: "New passwords do not match.",
      });
      return;
    }

    const token = getToken();

    if (!token) {
      setMessage({
        type: "error",
        text: "Your session has expired. Please log in again.",
      });
      return;
    }

    setPasswordLoading(true);
    setMessage({
      type: "",
      text: "",
    });

    try {
      const response = await fetch(
        `${API_URL}/api/student/change-password`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            currentPassword: password.currentPassword,
            newPassword: password.newPassword,
          }),
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.message || data.error || "Failed to change password."
        );
      }

      setPassword({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });

      setMessage({
        type: "success",
        text: "Password changed successfully.",
      });
    } catch (error) {
      console.error("Password change error:", error);

      setMessage({
        type: "error",
        text: error.message || "Unable to change your password.",
      });
    } finally {
      setPasswordLoading(false);
    }
  }

  /* =======================================================
     THEME HANDLER
  ======================================================= */

  function handleThemeChange(value) {
    const normalizedTheme = normalizeTheme(value);

    setPendingTheme(normalizedTheme);
    applyGlobalTheme(normalizedTheme, false);
  }

  /* =======================================================
     INITIALS & DISPLAY ID
  ======================================================= */

  const initials = useMemo(() => {
    const source =
      name ||
      profile?.name ||
      profile?.fullName ||
      profile?.studentName ||
      "Student";

    const parts = source.trim().split(/\s+/).filter(Boolean);

    if (!parts.length) return "ST";

    if (parts.length === 1) {
      return parts[0].slice(0, 2).toUpperCase();
    }

    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }, [name, profile]);

  const pageTheme = normalizeTheme(pendingTheme);

  const displayStudentId =
    profile?.studentId ||
    profile?.studentID ||
    studentId ||
    localStorage.getItem("studentId") ||
    "1002";

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <section
      className={`settings-page settings-${pageTheme}`}
      data-theme={pageTheme}
    >
      <div className="settings-shell">
        {/* HEADER */}
        <div className="settings-heading-row">
          <div className="settings-heading-copy">
            <div className="settings-eyebrow">STUDENT PORTAL • SETTINGS</div>
            <h1>Settings</h1>
            <p>
              Manage your account, security and examination preferences.
            </p>
          </div>

          {onBack && (
            <button
              type="button"
              className="settings-back-button"
              onClick={onBack}
            >
              <span>←</span> Back
            </button>
          )}
        </div>

        {/* MESSAGE */}
        {message.text && (
          <div
            className={`settings-message ${
              message.type === "success" ? "success" : "error"
            }`}
            role="alert"
          >
            <span className="settings-message-icon">
              {message.type === "success" ? "✓" : "!"}
            </span>
            <span>{message.text}</span>
          </div>
        )}

        <div className="settings-grid">
          {/* MAIN COLUMN */}
          <main className="settings-main-column">
            {/* PROFILE */}
            <section className="settings-card">
              <div className="settings-card-header">
                <div>
                  <h2 className="settings-card-title">Profile</h2>
                  <p className="settings-card-description">
                    Your TESTFLOW student account information.
                  </p>
                </div>
                <div className="settings-card-icon">👁</div>
              </div>

              <div className="profile-preview">
                <div className="settings-avatar">{initials}</div>
                <div className="profile-preview-info">
                  <div>
                    <strong>{name || "Student"}</strong>
                    <span>{email || "No email added"}</span>
                  </div>
                  <div className="student-id-box">
                    <span>STUDENT ID</span>
                    <strong>{displayStudentId}</strong>
                  </div>
                </div>
              </div>

              <div className="settings-form-grid">
                <label className="settings-field">
                  <span>Full Name</span>
                  <input
                    type="text"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Enter your full name"
                  />
                </label>

                <label className="settings-field">
                  <span>Email Address</span>
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="Enter your email address"
                  />
                </label>
              </div>

              <div className="settings-footer-actions">
                <button
                  type="button"
                  className="settings-primary"
                  onClick={saveProfile}
                  disabled={savingProfile}
                >
                  {savingProfile ? "Saving..." : "Save Profile"}
                </button>
              </div>
            </section>

            {/* NOTIFICATIONS */}
            <section className="settings-card">
              <div className="settings-card-header">
                <div>
                  <h2 className="settings-card-title">Notifications</h2>
                  <p className="settings-card-description">
                    Choose the updates you want TESTFLOW to send you.
                  </p>
                </div>
                <div className="settings-card-icon">⬡</div>
              </div>

              <div className="settings-options-list">
                <Toggle
                  label="Test reminders"
                  description="Receive reminders about upcoming examinations."
                  checked={settings.notifications.testReminders}
                  onChange={(value) =>
                    updateSetting("notifications", "testReminders", value)
                  }
                />

                <Toggle
                  label="Results and scores"
                  description="Get notified when examination results are available."
                  checked={settings.notifications.results}
                  onChange={(value) =>
                    updateSetting("notifications", "results", value)
                  }
                />

                <Toggle
                  label="Security alerts"
                  description="Receive alerts about unauthorized account sign-in attempts."
                  checked={settings.notifications.securityAlerts}
                  onChange={(value) =>
                    updateSetting("notifications", "securityAlerts", value)
                  }
                />
              </div>
            </section>

            {/* SAVE CHANGES */}
            <div className="settings-actions-row">
              <button
                type="button"
                className="settings-secondary"
                onClick={resetSettings}
                disabled={savingSettings}
              >
                Reset Defaults
              </button>

              <button
                type="button"
                className="settings-primary settings-primary-large"
                onClick={saveSettings}
                disabled={savingSettings}
              >
                {savingSettings ? "Saving Changes..." : "Save All Changes"}
              </button>
            </div>
          </main>

          {/* SIDE COLUMN */}
          <aside className="settings-side-column">
            {/* APPEARANCE */}
            <section className="settings-card">
              <div className="settings-card-header">
                <div>
                  <h2 className="settings-card-title">Appearance</h2>
                  <p className="settings-card-description">
                    Choose how TESTFLOW looks.
                  </p>
                </div>
                <div className="settings-card-icon">◐</div>
              </div>

              <div className="theme-options">
                {[
                  ["system", "System", "Use device preference"],
                  ["light", "Light", "Bright interface"],
                  ["dark", "Dark", "Low-light interface"],
                ].map(([value, title, description]) => (
                  <button
                    type="button"
                    key={value}
                    className={`theme-option ${
                      pendingTheme === value ? "selected" : ""
                    }`}
                    onClick={() => handleThemeChange(value)}
                  >
                    <span className="theme-icon">◐</span>
                    <span className="theme-option-content">
                      <strong>{title}</strong>
                      <small>{description}</small>
                    </span>
                    <span className="theme-radio">
                      {pendingTheme === value ? "✓" : ""}
                    </span>
                  </button>
                ))}
              </div>
            </section>

            {/* GENERAL PREFERENCES */}
            <section className="settings-card">
              <div className="settings-card-header">
                <div>
                  <h2 className="settings-card-title">General</h2>
                  <p className="settings-card-description">
                    Display and logout preferences.
                  </p>
                </div>
                <div className="settings-card-icon">⊳</div>
              </div>

              <div
                className="settings-form-grid"
                style={{ gridTemplateColumns: "1fr" }}
              >
                <label className="settings-field">
                  <span>Date format</span>
                  <select
                    className="settings-select"
                    value={settings.general.dateFormat}
                    onChange={(event) =>
                      updateSetting(
                        "general",
                        "dateFormat",
                        event.target.value
                      )
                    }
                  >
                    <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                    <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                    <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                  </select>
                </label>

                <label className="settings-field">
                  <span>Time format</span>
                  <select
                    className="settings-select"
                    value={settings.general.timeFormat}
                    onChange={(event) =>
                      updateSetting(
                        "general",
                        "timeFormat",
                        event.target.value
                      )
                    }
                  >
                    <option value="12-hour">12-hour</option>
                    <option value="24-hour">24-hour</option>
                  </select>
                </label>
              </div>
            </section>

            {/* CHANGE PASSWORD */}
            <section className="settings-card">
              <div className="settings-card-header">
                <div>
                  <h2 className="settings-card-title">Security</h2>
                  <p className="settings-card-description">
                    Update your password.
                  </p>
                </div>
                <div className="settings-card-icon">🔒</div>
              </div>

              <form className="password-form" onSubmit={changePassword}>
                <label className="settings-field">
                  <span>Current password</span>
                  <input
                    type="password"
                    value={password.currentPassword}
                    onChange={(event) =>
                      setPassword((prev) => ({
                        ...prev,
                        currentPassword: event.target.value,
                      }))
                    }
                    placeholder="Current password"
                  />
                </label>

                <label className="settings-field">
                  <span>New password</span>
                  <input
                    type="password"
                    value={password.newPassword}
                    onChange={(event) =>
                      setPassword((prev) => ({
                        ...prev,
                        newPassword: event.target.value,
                      }))
                    }
                    placeholder="New password"
                  />
                </label>

                <div className="password-actions-row">
                  <button
                    type="submit"
                    className="settings-primary"
                    disabled={passwordLoading}
                  >
                    {passwordLoading ? "Updating..." : "Update Password"}
                  </button>
                </div>
              </form>
            </section>

            {/* ACCOUNT STATUS SUMMARY */}
            <section className="settings-card settings-account-card">
              <div className="account-status">
                <span className="account-status-dot" />
                <div>
                  <strong>Account Active</strong>
                  <span>TESTFLOW Student Portal</span>
                </div>
              </div>

              <div className="account-meta">
                <div>
                  <span>Student ID</span>
                  <strong>{displayStudentId}</strong>
                </div>

                <div>
                  <span>Theme</span>
                  <strong>
                    {pendingTheme.charAt(0).toUpperCase() +
                      pendingTheme.slice(1)}
                  </strong>
                </div>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </section>
  );
}

/* =========================================================
   TOGGLE COMPONENT
========================================================= */

function Toggle({ label, description, checked, onChange }) {
  return (
    <div className="setting-toggle">
      <div className="setting-toggle-content">
        <strong>{label}</strong>
        <span>{description}</span>
      </div>

      <button
        type="button"
        className={`toggle ${checked ? "active" : ""}`}
        onClick={() => onChange(!checked)}
        aria-pressed={checked}
        aria-label={label}
      >
        <span className="toggle-knob" />
      </button>
    </div>
  );
}