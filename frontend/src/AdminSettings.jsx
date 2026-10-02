import { useEffect, useState } from "react";
import "./AdminSettings.css";

const API_URL = (
  import.meta.env.VITE_API_URL ||
  "/api"
).replace(/\/$/, "");

const DEFAULTS = {
  adminName: "Administrator",
  adminEmail: "admin@testflow.com",
  mobileNumber: "",
  institutionName: "TestFlow",
  timezone: "Asia/Kolkata",
  autoRefresh: true,
  refreshInterval: 30,
  allowStudentRegistration: true,
  maintenanceMode: false,
  showRecentActivity: true,
};

function AdminSettings({ onBack }) {
  const [settings, setSettings] = useState(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [addingAdmin, setAddingAdmin] = useState(false);
  const [admins, setAdmins] = useState([]);
  const [currentAdmin, setCurrentAdmin] = useState(null);
  const [removingAdminId, setRemovingAdminId] = useState("");
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [newAdmin, setNewAdmin] = useState({
    fullName: "",
    email: "",
    mobileNumber: "",
    password: "",
    confirmPassword: "",
  });

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");

  function getAdminToken() {
    return (
      localStorage.getItem("access_token") ||
      sessionStorage.getItem("access_token") ||
      localStorage.getItem("adminToken") ||
      sessionStorage.getItem("adminToken") ||
      localStorage.getItem("token") ||
      sessionStorage.getItem("token") ||
      localStorage.getItem("authToken") ||
      sessionStorage.getItem("authToken") ||
      ""
    );
  }

  function getAuthHeaders(includeJson = false) {
    const token = getAdminToken();

    return {
      Accept: "application/json",
      ...(includeJson ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }


  const loadSettings = async () => {
    try {
      setLoading(true);
      setMessage("");
      setMessageType("");

      const token = getAdminToken();
      if (!token) {
        throw new Error("Admin authentication required. Please log in to the Admin account again.");
      }

      const response = await fetch(`${API_URL}/api/admin/settings`, {
        method: "GET",
        headers: getAuthHeaders(),
        cache: "no-store",
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.message ||
            `Unable to load settings (${response.status})`,
        );
      }

      setSettings({
        ...DEFAULTS,
        ...(data.settings || {}),
      });

      // Load the complete administrator directory. Every authenticated
      // admin can view it; only the primary admin can create/remove admins.
      const adminsResponse = await fetch(`${API_URL}/api/admin/admins`, {
        method: "GET",
        headers: getAuthHeaders(),
        cache: "no-store",
      });

      const adminsData = await adminsResponse.json().catch(() => ({}));

      if (!adminsResponse.ok) {
        throw new Error(
          adminsData.message ||
            `Unable to load admin accounts (${adminsResponse.status})`,
        );
      }

      setAdmins(Array.isArray(adminsData.admins) ? adminsData.admins : []);
      setCurrentAdmin(adminsData.currentAdmin || null);
    } catch (error) {
      console.error("Admin settings load error:", error);

      setMessage(
        error.message ||
          "Unable to load administrator settings.",
      );
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const update = (key, value) => {
    setSettings((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const save = async (event) => {
    event.preventDefault();

    const token = getAdminToken();
    if (!token) {
      setMessage("Admin authentication required. Please log in again.");
      setMessageType("error");
      return;
    }

    try {
      setSaving(true);
      setMessage("");
      setMessageType("");

      const response = await fetch(`${API_URL}/api/admin/settings`, {
        method: "PUT",
        headers: getAuthHeaders(true),
        body: JSON.stringify(settings),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.message ||
            `Unable to save settings (${response.status})`,
        );
      }

      setSettings({
        ...DEFAULTS,
        ...(data.settings || {}),
      });

      const passwordEntered =
        passwordForm.currentPassword ||
        passwordForm.newPassword ||
        passwordForm.confirmPassword;

      if (passwordEntered) {
        if (
          !passwordForm.currentPassword ||
          !passwordForm.newPassword ||
          !passwordForm.confirmPassword
        ) {
          throw new Error(
            "To change your password, enter the current password, new password and confirmation.",
          );
        }

        const passwordResponse = await fetch(
          `${API_URL}/api/admin/password`,
          {
            method: "PUT",
            headers: getAuthHeaders(true),
            body: JSON.stringify(passwordForm),
          },
        );

        const passwordData = await passwordResponse
          .json()
          .catch(() => ({}));

        if (!passwordResponse.ok) {
          throw new Error(
            passwordData.message ||
              `Unable to change password (${passwordResponse.status})`,
          );
        }

        setPasswordForm({
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
        });
      }

      setMessage("Administrator settings saved successfully.");
      setMessageType("success");
    } catch (error) {
      console.error("Admin settings save error:", error);

      setMessage(
        error.message ||
          "Unable to save administrator settings.",
      );
      setMessageType("error");
    } finally {
      setSaving(false);
    }
  };

  const addAdmin = async (event) => {
    event.preventDefault();

    const token = getAdminToken();
    if (!token) {
      setMessage("Admin authentication required. Please log in again.");
      setMessageType("error");
      return;
    }

    try {
      setAddingAdmin(true);
      setMessage("");
      setMessageType("");

      const response = await fetch(`${API_URL}/api/admin/admins`, {
        method: "POST",
        headers: getAuthHeaders(true),
        body: JSON.stringify(newAdmin),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.message ||
            `Unable to create admin (${response.status})`,
        );
      }

      setNewAdmin({
        fullName: "",
        email: "",
        mobileNumber: "",
        password: "",
        confirmPassword: "",
      });

      if (Array.isArray(data.admins)) {
        setAdmins(data.admins);
      }

      setMessage(
        data.message ||
          "New admin account created successfully.",
      );
      setMessageType("success");
    } catch (error) {
      console.error("Create admin error:", error);
      setMessage(
        error.message ||
          "Unable to create the new admin account.",
      );
      setMessageType("error");
    } finally {
      setAddingAdmin(false);
    }
  };

  const removeAdmin = async (admin) => {
    if (!admin?.id || admin.isPrimary) {
      return;
    }

    if (!currentAdmin?.isPrimary) {
      setMessage("Only the primary admin can remove admin accounts.");
      setMessageType("error");
      return;
    }

    const confirmed = window.confirm(
      `Remove ${admin.name || admin.email} from TestFlow administrators?`,
    );

    if (!confirmed) {
      return;
    }

    try {
      setRemovingAdminId(admin.id);
      setMessage("");
      setMessageType("");

      const response = await fetch(
        `${API_URL}/api/admin/admins/${encodeURIComponent(admin.id)}`,
        {
          method: "DELETE",
          headers: getAuthHeaders(),
        },
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.message ||
            `Unable to remove admin (${response.status})`,
        );
      }

      setAdmins((current) =>
        current.filter((item) => item.id !== admin.id),
      );
      setMessage(data.message || "Admin account removed successfully.");
      setMessageType("success");
    } catch (error) {
      console.error("Remove admin error:", error);
      setMessage(
        error.message ||
          "Unable to remove the admin account.",
      );
      setMessageType("error");
    } finally {
      setRemovingAdminId("");
    }
  };

  const reset = async () => {
    const confirmed = window.confirm(
      "Restore all administrator settings to their defaults?",
    );

    if (!confirmed) {
      return;
    }

    try {
      const token = getAdminToken();
      if (!token) {
        setMessage("Admin authentication required. Please log in again.");
        setMessageType("error");
        return;
      }

      setSaving(true);
      setMessage("");
      setMessageType("");

      const response = await fetch(`${API_URL}/api/admin/settings/reset`, {
        method: "POST",
        headers: getAuthHeaders(true),
        body: JSON.stringify({}),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.message ||
            `Unable to reset settings (${response.status})`,
        );
      }

      setSettings({
        ...DEFAULTS,
        ...(data.settings || {}),
      });

      setMessage("Administrator settings restored to defaults.");
      setMessageType("success");
    } catch (error) {
      console.error("Admin settings reset error:", error);

      setMessage(
        error.message ||
          "Unable to reset administrator settings.",
      );
      setMessageType("error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <main className="admin-settings-page">
        <div className="admin-settings-loading">
          <div className="admin-settings-spinner" />

          <h2>Loading Settings</h2>

          <p>
            Connecting to the TESTFLOW administration server...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="admin-settings-page">
      <div className="admin-settings-inner">
        {/* =====================================================
            HEADER
        ====================================================== */}

        <header className="admin-settings-header">
          <div className="admin-settings-header-content">
            <div className="admin-settings-eyebrow">
              TESTFLOW � ADMINISTRATION
            </div>

            <h1>Settings</h1>

            <p>
              Control your TestFlow administration and platform
              preferences.
            </p>
          </div>

          <div className="admin-settings-header-actions">
            <button
              type="button"
              className="admin-settings-back-button"
              onClick={onBack}
            >
              <span>?</span>
              Dashboard
            </button>
          </div>
        </header>

        {/* =====================================================
            NOTICE
        ====================================================== */}

        {message && (
          <div
            className={`admin-settings-notice ${messageType}`}
            role="status"
          >
            <span className="admin-settings-notice-icon">
              {messageType === "success"
                ? "?"
                : messageType === "error"
                  ? "!"
                  : "�"}
            </span>

            <span>{message}</span>
          </div>
        )}

        {/* =====================================================
            MAIN FORM
        ====================================================== */}

        <form
          className="admin-settings-form"
          onSubmit={save}
        >
          <div className="admin-settings-layout">
            {/* =================================================
                LEFT COLUMN
            ================================================== */}

            <div className="admin-settings-main">
              {/* ===============================================
                  PROFILE
              ================================================ */}

              <section className="admin-settings-section">
                <SectionHeader
                  number="01"
                  title="Administrator Profile"
                  description="Identity shown across the TESTFLOW administration console."
                  badge="Profile"
                />

                <div className="admin-settings-section-content">
                  <div className="admin-settings-fields">
                    <Field
                      label="Administrator name"
                      help="Name displayed in the administrator console."
                    >
                      <input
                        type="text"
                        value={settings.adminName}
                        onChange={(event) =>
                          update(
                            "adminName",
                            event.target.value,
                          )
                        }
                        placeholder="Administrator"
                        autoComplete="name"
                      />
                    </Field>

                    <Field
                      label="Administrator email"
                      help="Primary administrator contact address."
                    >
                      <input
                        type="email"
                        value={settings.adminEmail}
                        onChange={(event) =>
                          update(
                            "adminEmail",
                            event.target.value,
                          )
                        }
                        placeholder="admin@testflow.com"
                        autoComplete="email"
                      />
                    </Field>

                    <Field
                      label="Mobile number"
                      help="Mobile number associated with your administrator account."
                    >
                      <input
                        type="tel"
                        value={settings.mobileNumber || ""}
                        onChange={(event) =>
                          update("mobileNumber", event.target.value)
                        }
                        placeholder="9876543210"
                        autoComplete="tel"
                      />
                    </Field>

                    <Field
                      label="Institution / platform name"
                      help="Name used throughout the platform."
                    >
                      <input
                        type="text"
                        value={settings.institutionName}
                        onChange={(event) =>
                          update(
                            "institutionName",
                            event.target.value,
                          )
                        }
                        placeholder="TestFlow"
                      />
                    </Field>

                    <Field
                      label="Timezone"
                      help="Used for platform dates and examination times."
                    >
                      <select
                        value={settings.timezone}
                        onChange={(event) =>
                          update(
                            "timezone",
                            event.target.value,
                          )
                        }
                      >
                        <option value="Asia/Kolkata">
                          Asia/Kolkata
                        </option>

                        <option value="UTC">
                          UTC
                        </option>

                        <option value="Asia/Dubai">
                          Asia/Dubai
                        </option>

                        <option value="Asia/Singapore">
                          Asia/Singapore
                        </option>
                      </select>
                    </Field>
                  </div>

                  <div className="admin-settings-divider" />

                  <div className="admin-settings-fields">
                    <Field
                      label="Current password"
                      help="Required when changing the administrator password."
                    >
                      <input
                        type="password"
                        value={passwordForm.currentPassword}
                        onChange={(event) =>
                          setPasswordForm((current) => ({
                            ...current,
                            currentPassword: event.target.value,
                          }))
                        }
                        placeholder="Current password"
                        autoComplete="current-password"
                      />
                    </Field>

                    <Field
                      label="New password"
                      help="Use at least 6 characters."
                    >
                      <input
                        type="password"
                        value={passwordForm.newPassword}
                        onChange={(event) =>
                          setPasswordForm((current) => ({
                            ...current,
                            newPassword: event.target.value,
                          }))
                        }
                        placeholder="New password"
                        autoComplete="new-password"
                      />
                    </Field>

                    <Field
                      label="Confirm new password"
                    >
                      <input
                        type="password"
                        value={passwordForm.confirmPassword}
                        onChange={(event) =>
                          setPasswordForm((current) => ({
                            ...current,
                            confirmPassword: event.target.value,
                          }))
                        }
                        placeholder="Confirm new password"
                        autoComplete="new-password"
                      />
                    </Field>
                  </div>
                </div>
              </section>

              {/* ===============================================
                  ADD ADMIN
              ================================================ */}

              <section className="admin-settings-section">
                  <SectionHeader
                    number="02"
                    title="+ Add Admin"
                  description="Any administrator can create another administrator account with its own secure login credentials."
                  badge="Admins"
                />

                <div className="admin-settings-section-content">
                  <div className="admin-settings-fields">
                    <Field label="Full Name">
                      <input
                        type="text"
                        value={newAdmin.fullName}
                        onChange={(event) =>
                          setNewAdmin((current) => ({
                            ...current,
                            fullName: event.target.value,
                          }))
                        }
                        placeholder="Full name"
                        autoComplete="name"
                      />
                    </Field>

                    <Field label="Email">
                      <input
                        type="email"
                        value={newAdmin.email}
                        onChange={(event) =>
                          setNewAdmin((current) => ({
                            ...current,
                            email: event.target.value,
                          }))
                        }
                        placeholder="admin@example.com"
                        autoComplete="email"
                      />
                    </Field>

                    <Field label="Mobile Number">
                      <input
                        type="tel"
                        value={newAdmin.mobileNumber}
                        onChange={(event) =>
                          setNewAdmin((current) => ({
                            ...current,
                            mobileNumber: event.target.value,
                          }))
                        }
                        placeholder="9876543210"
                        autoComplete="tel"
                      />
                    </Field>

                    <Field label="Password">
                      <input
                        type="password"
                        value={newAdmin.password}
                        onChange={(event) =>
                          setNewAdmin((current) => ({
                            ...current,
                            password: event.target.value,
                          }))
                        }
                        placeholder="Password"
                        autoComplete="new-password"
                      />
                    </Field>

                    <Field label="Confirm Password">
                      <input
                        type="password"
                        value={newAdmin.confirmPassword}
                        onChange={(event) =>
                          setNewAdmin((current) => ({
                            ...current,
                            confirmPassword: event.target.value,
                          }))
                        }
                        placeholder="Confirm password"
                        autoComplete="new-password"
                      />
                    </Field>
                  </div>

                  <div className="admin-settings-save-actions" style={{ marginTop: "20px" }}>
                    <button
                      type="button"
                      className="admin-settings-save-button"
                      onClick={addAdmin}
                      disabled={addingAdmin}
                    >
                      {addingAdmin ? "Creating admin..." : "+ Add Admin"}
                    </button>
                  </div>
                </div>
              </section>

              {/* ===============================================
                  MANAGE ADMINS
              ================================================ */}

              <section className="admin-settings-section">
                <SectionHeader
                  number="03"
                  title="Manage Admins"
                  description="View every administrator account. All admins can add accounts; only the primary admin can remove accounts."
                  badge={`${admins.length} Admin${admins.length === 1 ? "" : "s"}`}
                />

                <div className="admin-settings-section-content">
                  <div
                    style={{
                      display: "grid",
                      gap: "12px",
                    }}
                  >
                    {admins.length === 0 ? (
                      <div
                        style={{
                          padding: "18px",
                          borderRadius: "14px",
                          border: "1px dashed rgba(255,255,255,0.18)",
                          color: "rgba(255,255,255,0.65)",
                        }}
                      >
                        No administrator accounts found.
                      </div>
                    ) : (
                      admins.map((admin) => {
                        const isSelf = admin.id === currentAdmin?.id;
                        const isPrimary = admin.isPrimary === true;

                        return (
                          <div
                            key={admin.id}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              flexWrap: "wrap",
                              gap: "14px",
                              width: "100%",
                              boxSizing: "border-box",
                              overflow: "visible",
                              padding: "16px 18px",
                              borderRadius: "16px",
                              border: isPrimary
                                ? "1px solid rgba(255, 193, 7, 0.38)"
                                : "1px solid rgba(255,255,255,0.10)",
                              background: isPrimary
                                ? "rgba(255, 193, 7, 0.07)"
                                : "rgba(255,255,255,0.035)",
                            }}
                          >
                            <div style={{ minWidth: 0 }}>
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "8px",
                                  flexWrap: "wrap",
                                }}
                              >
                                <strong>{admin.name || "Administrator"}</strong>
                                {isPrimary && (
                                  <span
                                    style={{
                                      padding: "4px 8px",
                                      borderRadius: "999px",
                                      fontSize: "11px",
                                      fontWeight: 800,
                                      letterSpacing: "0.04em",
                                      textTransform: "uppercase",
                                      background: "rgba(255, 193, 7, 0.16)",
                                      color: "#ffd54f",
                                    }}
                                  >
                                    Primary Admin
                                  </span>
                                )}
                                {isSelf && (
                                  <span
                                    style={{
                                      padding: "4px 8px",
                                      borderRadius: "999px",
                                      fontSize: "11px",
                                      fontWeight: 700,
                                      background: "rgba(255,255,255,0.09)",
                                      color: "rgba(255,255,255,0.75)",
                                    }}
                                  >
                                    You
                                  </span>
                                )}
                              </div>
                              <div
                                style={{
                                  marginTop: "5px",
                                  color: "rgba(255,255,255,0.62)",
                                  fontSize: "13px",
                                  wordBreak: "break-word",
                                }}
                              >
                                {admin.email}
                                {admin.mobileNumber ? ` � ${admin.mobileNumber}` : ""}
                              </div>
                            </div>

                            {currentAdmin?.isPrimary && !isPrimary && (
                              <button
                                type="button"
                                onClick={() => removeAdmin(admin)}
                                disabled={removingAdminId === admin.id}
                                style={{
                                  flex: "0 0 auto",
                                  width: "auto",
                                  minWidth: "132px",
                                  minHeight: "46px",
                                  padding: "10px 16px",
                                  borderRadius: "11px",
                                  border: "2px solid rgba(255, 82, 102, 0.9)",
                                  background: "rgba(220, 53, 69, 0.28)",
                                  color: "#ff8a98",
                                  fontWeight: 900,
                                  fontSize: "14px",
                                  lineHeight: 1,
                                  whiteSpace: "nowrap",
                                  textAlign: "center",
                                  cursor: removingAdminId === admin.id ? "wait" : "pointer",
                                  opacity: removingAdminId === admin.id ? 0.7 : 1,
                                  boxShadow: "0 0 0 2px rgba(220, 53, 69, 0.08), 0 7px 20px rgba(0,0,0,0.22)",
                                  position: "relative",
                                  zIndex: 2,
                                }}
                              >
                                {removingAdminId === admin.id ? "Removing..." : "? Remove"}
                              </button>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>

                  {!currentAdmin?.isPrimary && (
                    <p
                      style={{
                        margin: "14px 0 0",
                        color: "rgba(255,255,255,0.58)",
                        fontSize: "13px",
                      }}
                    >
                      You can view all administrator accounts and add new admins. Only the primary admin can remove accounts.
                    </p>
                  )}
                </div>
              </section>

              {/* ===============================================
                  DASHBOARD
              ================================================ */}

              <section className="admin-settings-section">
                <SectionHeader
                  number="04"
                  title="Dashboard Preferences"
                  description="Configure how the administrator dashboard behaves."
                  badge="Dashboard"
                />

                <div className="admin-settings-section-content">
                  <div className="admin-settings-toggle-list">
                    <Toggle
                      title="Automatic refresh"
                      description="Keep dashboard statistics updated automatically."
                      checked={settings.autoRefresh}
                      onChange={(value) =>
                        update("autoRefresh", value)
                      }
                    />

                    <Toggle
                      title="Recent activity"
                      description="Show recent examination activity on the dashboard."
                      checked={settings.showRecentActivity}
                      onChange={(value) =>
                        update(
                          "showRecentActivity",
                          value,
                        )
                      }
                    />
                  </div>

                  <div className="admin-settings-divider" />

                  <div className="admin-settings-fields admin-settings-fields-single">
                    <Field
                      label="Dashboard refresh interval"
                      help="Choose how frequently dashboard statistics are refreshed."
                    >
                      <select
                        value={settings.refreshInterval}
                        onChange={(event) =>
                          update(
                            "refreshInterval",
                            Number(event.target.value),
                          )
                        }
                        disabled={!settings.autoRefresh}
                      >
                        <option value={10}>
                          Every 10 seconds
                        </option>

                        <option value={30}>
                          Every 30 seconds
                        </option>

                        <option value={60}>
                          Every 60 seconds
                        </option>

                        <option value={120}>
                          Every 2 minutes
                        </option>
                      </select>
                    </Field>
                  </div>
                </div>
              </section>

              {/* ===============================================
                  STUDENT ACCESS
              ================================================ */}

              <section className="admin-settings-section">
                <SectionHeader
                  number="05"
                  title="Student Access"
                  description="Control student registration and platform availability."
                  badge="Access"
                />

                <div className="admin-settings-section-content">
                  <div className="admin-settings-toggle-list">
                    <Toggle
                      title="Allow new student registration"
                      description="Students can create new accounts from the login screen."
                      checked={
                        settings.allowStudentRegistration
                      }
                      onChange={(value) =>
                        update(
                          "allowStudentRegistration",
                          value,
                        )
                      }
                    />

                    <Toggle
                      title="Maintenance mode"
                      description="Marks the platform as temporarily unavailable for students."
                      checked={settings.maintenanceMode}
                      onChange={(value) =>
                        update(
                          "maintenanceMode",
                          value,
                        )
                      }
                      danger
                    />
                  </div>

                  {settings.maintenanceMode && (
                    <div className="admin-settings-warning">
                      <span>!</span>

                      <div>
                        <strong>
                          Maintenance mode is enabled.
                        </strong>

                        <p>
                          Student access may be temporarily
                          unavailable while this mode is active.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </section>

              {/* ===============================================
                  SAVE BAR
              ================================================ */}

              <div className="admin-settings-save-bar">
                <div className="admin-settings-save-status">
                  <span
                    className={`admin-settings-status-dot ${
                      saving
                        ? "saving"
                        : messageType || "idle"
                    }`}
                  />

                  <span>
                    {saving
                      ? "Saving changes..."
                      : message ||
                        "Review your settings before saving."}
                  </span>
                </div>

                <div className="admin-settings-save-actions">
                  <button
                    type="button"
                    className="admin-settings-reset-button"
                    onClick={reset}
                    disabled={saving}
                  >
                    Reset defaults
                  </button>

                  <button
                    type="submit"
                    className="admin-settings-save-button"
                    disabled={saving}
                  >
                    {saving
                      ? "Saving..."
                      : "Save settings"}
                  </button>
                </div>
              </div>
            </div>

            {/* =================================================
                RIGHT COLUMN
            ================================================== */}

            <aside className="admin-settings-sidebar">
              {/* ===============================================
                  SYSTEM SUMMARY
              ================================================ */}

              <section className="admin-settings-info-card">
                <div className="admin-settings-info-header">
                  <div className="admin-settings-info-icon">
                    ?
                  </div>

                  <div>
                    <h3>System Summary</h3>

                    <p>
                      Current administrator and platform
                      configuration.
                    </p>
                  </div>
                </div>

                <div className="admin-settings-info-body">
                  <InfoRow
                    label="Administrator"
                    value={
                      settings.adminName ||
                      "Administrator"
                    }
                  />

                  <InfoRow
                    label="Institution"
                    value={
                      settings.institutionName ||
                      "TestFlow"
                    }
                  />

                  <InfoRow
                    label="Timezone"
                    value={settings.timezone}
                  />

                  <InfoRow
                    label="Student registration"
                    value={
                      settings.allowStudentRegistration
                        ? "Enabled"
                        : "Disabled"
                    }
                    valueClass={
                      settings.allowStudentRegistration
                        ? "positive"
                        : "negative"
                    }
                  />

                  <InfoRow
                    label="Maintenance"
                    value={
                      settings.maintenanceMode
                        ? "Active"
                        : "Inactive"
                    }
                    valueClass={
                      settings.maintenanceMode
                        ? "negative"
                        : "positive"
                    }
                  />
                </div>
              </section>

              {/* ===============================================
                  CONNECTION
              ================================================ */}

              <div className="admin-settings-connection">
                <span className="admin-settings-connection-dot" />

                <div>
                  <strong>Administration service</strong>

                  <small>
                    TESTFLOW server connection available
                  </small>
                </div>

                <span className="admin-settings-online">
                  ONLINE
                </span>
              </div>

              {/* ===============================================
                  QUICK STATUS
              ================================================ */}

              <section className="admin-settings-status-card">
                <div className="admin-settings-status-card-header">
                  <span>PLATFORM STATUS</span>
                </div>

                <div className="admin-settings-platform-status">
                  <div
                    className={`admin-settings-platform-icon ${
                      settings.maintenanceMode
                        ? "maintenance"
                        : "active"
                    }`}
                  >
                    {settings.maintenanceMode
                      ? "!"
                      : "?"}
                  </div>

                  <div>
                    <strong>
                      {settings.maintenanceMode
                        ? "Maintenance mode"
                        : "Platform active"}
                    </strong>

                    <small>
                      {settings.maintenanceMode
                        ? "Student access is restricted."
                        : "TESTFLOW is available for normal operation."}
                    </small>
                  </div>
                </div>

                <div className="admin-settings-status-grid">
                  <div>
                    <span>Auto refresh</span>

                    <strong>
                      {settings.autoRefresh
                        ? "ON"
                        : "OFF"}
                    </strong>
                  </div>

                  <div>
                    <span>Activity</span>

                    <strong>
                      {settings.showRecentActivity
                        ? "VISIBLE"
                        : "HIDDEN"}
                    </strong>
                  </div>
                </div>
              </section>

              {/* ===============================================
                  HELP
              ================================================ */}

              <section className="admin-settings-help">
                <div className="admin-settings-help-icon">
                  ?
                </div>

                <h3>Administrator settings</h3>

                <p>
                  These preferences control the administrator
                  experience and selected student-access
                  behavior. Changes are stored on the TESTFLOW
                  server.
                </p>
              </section>
            </aside>
          </div>
        </form>
      </div>
    </main>
  );
}

/* =========================================================
   SECTION HEADER
========================================================= */

function SectionHeader({
  number,
  title,
  description,
  badge,
}) {
  return (
    <div className="admin-settings-section-header">
      <div className="admin-settings-section-number">
        {number}
      </div>

      <div className="admin-settings-section-heading">
        <h2>{title}</h2>

        <p>{description}</p>
      </div>

      {badge && (
        <span className="admin-settings-badge">
          {badge}
        </span>
      )}
    </div>
  );
}

/* =========================================================
   FIELD
========================================================= */

function Field({ label, help, children }) {
  return (
    <label className="admin-settings-field">
      <span className="admin-settings-field-label">
        {label}
      </span>

      {children}

      {help && (
        <small className="admin-settings-field-help">
          {help}
        </small>
      )}
    </label>
  );
}

/* =========================================================
   TOGGLE
========================================================= */

function Toggle({
  title,
  description,
  checked,
  onChange,
  danger = false,
}) {
  return (
    <div
      className={`admin-settings-toggle-row ${
        danger
          ? "admin-settings-toggle-danger"
          : ""
      }`}
    >
      <div className="admin-settings-toggle-copy">
        <strong>{title}</strong>

        <p>{description}</p>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={`${title}: ${
          checked ? "On" : "Off"
        }`}
        className={`admin-settings-toggle ${
          checked ? "active" : ""
        }`}
        onClick={() => onChange(!checked)}
      >
        <span />
      </button>
    </div>
  );
}

/* =========================================================
   INFO ROW
========================================================= */

function InfoRow({
  label,
  value,
  valueClass = "",
}) {
  return (
    <div className="admin-settings-info-row">
      <span>{label}</span>

      <strong className={valueClass}>
        {value}
      </strong>
    </div>
  );
}

export default AdminSettings;