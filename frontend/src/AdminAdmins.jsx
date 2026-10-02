import { useCallback, useEffect, useState } from "react";
import { Shield, Trash2, RefreshCw, UserRound, Crown } from "lucide-react";

const API_URL = (
  import.meta.env.VITE_API_URL || "http://localhost:5000"
).replace(/\/$/, "");

function getToken() {
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

function getHeaders() {
  const token = getToken();
  return {
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString([], {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
}

export default function AdminAdmins() {
  const [admins, setAdmins] = useState([]);
  const [currentAdmin, setCurrentAdmin] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadAdmins = useCallback(async () => {
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(`${API_URL}/api/admin/admins`, {
        method: "GET",
        cache: "no-store",
        headers: getHeaders(),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || data?.success === false) {
        throw new Error(
          data?.message || `Unable to load admins. HTTP ${response.status}`
        );
      }

      setAdmins(Array.isArray(data.admins) ? data.admins : []);
      setCurrentAdmin(data.currentAdmin || null);
    } catch (requestError) {
      console.error("Manage admins error:", requestError);
      setAdmins([]);
      setError(requestError?.message || "Unable to load admin accounts.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAdmins();
  }, [loadAdmins]);

  const removeAdmin = async (admin) => {
    if (!admin?.id || admin.isPrimary) return;

    if (!currentAdmin?.isPrimary) {
      setError("Only the primary admin can remove admin accounts.");
      return;
    }

    const confirmed = window.confirm(
      `Remove admin account "${admin.name || admin.email}"?\n\nTheir active admin sessions will be logged out.`
    );

    if (!confirmed) return;

    setBusyId(String(admin.id));
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `${API_URL}/api/admin/admins/${encodeURIComponent(admin.id)}`,
        {
          method: "DELETE",
          headers: getHeaders(),
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok || data?.success === false) {
        throw new Error(
          data?.message || `Unable to remove admin. HTTP ${response.status}`
        );
      }

      setAdmins((previous) =>
        previous.filter((item) => String(item.id) !== String(admin.id))
      );
      setMessage(data.message || "Admin account removed successfully.");
    } catch (requestError) {
      console.error("Remove admin error:", requestError);
      setError(requestError?.message || "Unable to remove admin account.");
    } finally {
      setBusyId("");
    }
  };

  const isPrimaryAdmin = Boolean(currentAdmin?.isPrimary);

  return (
    <section className="admin-page-panel" style={{ padding: "30px" }}>
      <header
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "20px",
          marginBottom: "24px",
        }}
      >
        <div>
          <p className="admin-header-label">ADMINISTRATION</p>
          <h1 style={{ marginBottom: "6px" }}>Manage Admins</h1>
          <p style={{ margin: 0, opacity: 0.72 }}>
            All admins can view the complete admin list. Only the primary admin can remove other admin accounts.
          </p>
        </div>

        <button
          type="button"
          onClick={loadAdmins}
          disabled={loading}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            padding: "10px 14px",
            borderRadius: "10px",
            border: "1px solid rgba(255,255,255,.12)",
            background: "transparent",
            cursor: loading ? "wait" : "pointer",
          }}
        >
          <RefreshCw size={16} />
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </header>

      {error && (
        <div className="admin-error" style={{ marginBottom: "18px" }}>
          <strong>Manage Admins</strong>
          <span>{error}</span>
          <button type="button" onClick={loadAdmins}>
            Retry
          </button>
        </div>
      )}

      {message && (
        <div
          style={{
            marginBottom: "18px",
            padding: "12px 14px",
            borderRadius: "10px",
            background: "rgba(66, 180, 112, .10)",
          }}
        >
          {message}
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
          gap: "14px",
          marginBottom: "22px",
        }}
      >
        <div className="admin-stat-card">
          <div className="stat-icon">
            <Shield size={20} />
          </div>
          <strong>{admins.length}</strong>
          <span>Total admins</span>
        </div>
        <div className="admin-stat-card">
          <div className="stat-icon">
            <Crown size={20} />
          </div>
          <strong>{admins.filter((item) => item.isPrimary).length}</strong>
          <span>Primary admin</span>
        </div>
      </div>

      <div
        style={{
          border: "1px solid rgba(255,255,255,.10)",
          borderRadius: "16px",
          overflow: "hidden",
        }}
      >
        {loading ? (
          <div style={{ padding: "40px", textAlign: "center" }}>
            Loading admin accounts…
          </div>
        ) : admins.length === 0 ? (
          <div style={{ padding: "40px", textAlign: "center" }}>
            No admin accounts were found.
          </div>
        ) : (
          <div style={{ overflowX: "auto", width: "100%" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                minWidth: "600px",
              }}
            >
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "14px 16px" }}>
                    Admin
                  </th>
                  <th style={{ textAlign: "left", padding: "14px 16px" }}>
                    Role
                  </th>
                  <th style={{ textAlign: "left", padding: "14px 16px" }}>
                    Created
                  </th>
                  <th style={{ textAlign: "right", padding: "14px 16px" }}>
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {admins.map((admin) => {
                  const isSelf =
                    currentAdmin &&
                    String(currentAdmin.id) === String(admin.id);
                  const protectedAccount = admin.isPrimary || isSelf;
                  const canRemoveAdmin = isPrimaryAdmin && !protectedAccount;

                  return (
                    <tr key={admin.id}>
                      <td
                        style={{
                          padding: "16px",
                          borderTop: "1px solid rgba(255,255,255,.07)",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "12px",
                          }}
                        >
                          <div
                            style={{
                              width: 38,
                              height: 38,
                              borderRadius: "50%",
                              display: "grid",
                              placeItems: "center",
                              background: "rgba(255,255,255,.07)",
                              flexShrink: 0,
                            }}
                          >
                            <UserRound size={18} />
                          </div>
                          <div>
                            <strong>{admin.name || "Administrator"}</strong>
                            <div style={{ opacity: 0.65, fontSize: 13 }}>
                              {admin.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td
                        style={{
                          padding: "16px",
                          borderTop: "1px solid rgba(255,255,255,.07)",
                        }}
                      >
                        {admin.isPrimary ? "Primary Admin" : "Admin"}
                      </td>
                      <td
                        style={{
                          padding: "16px",
                          borderTop: "1px solid rgba(255,255,255,.07)",
                        }}
                      >
                        {formatDate(admin.createdAt)}
                      </td>
                      <td
                        style={{
                          padding: "16px",
                          borderTop: "1px solid rgba(255,255,255,.07)",
                          textAlign: "right",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {admin.isPrimary ? (
                          <span style={{ opacity: 0.55, fontSize: 13 }}>
                            Protected
                          </span>
                        ) : isSelf ? (
                          <span style={{ opacity: 0.55, fontSize: 13 }}>
                            Current account
                          </span>
                        ) : canRemoveAdmin ? (
                          <button
                            type="button"
                            onClick={() => removeAdmin(admin)}
                            disabled={busyId === String(admin.id)}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: "8px",
                              padding: "10px 16px",
                              minWidth: "110px",
                              minHeight: "40px",
                              borderRadius: "9px",
                              border: "2px solid #ef4444",
                              background: "rgba(239, 68, 68, 0.18)",
                              color: "#fca5a5",
                              fontWeight: "600",
                              fontSize: "14px",
                              cursor:
                                busyId === String(admin.id)
                                  ? "wait"
                                  : "pointer",
                              boxSizing: "border-box",
                              lineHeight: 1,
                            }}
                          >
                            <Trash2 size={16} />
                            {busyId === String(admin.id)
                              ? "Removing…"
                              : "Remove"}
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled
                            title="Only the primary admin can remove admins"
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: "8px",
                              padding: "10px 16px",
                              minWidth: "110px",
                              minHeight: "40px",
                              borderRadius: "9px",
                              border: "1px solid rgba(255, 255, 255, 0.15)",
                              background: "rgba(255, 255, 255, 0.05)",
                              color: "rgba(255, 255, 255, 0.4)",
                              fontWeight: "600",
                              fontSize: "14px",
                              cursor: "not-allowed",
                              boxSizing: "border-box",
                              lineHeight: 1,
                              opacity: 0.6,
                            }}
                          >
                            <Trash2 size={16} />
                            Remove
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}