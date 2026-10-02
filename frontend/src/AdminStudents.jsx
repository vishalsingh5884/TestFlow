import { useEffect, useMemo, useState } from "react";
import "./AdminStudents.css";

const API_URL = (
  import.meta.env.VITE_API_URL ||
  "http://localhost:5000"
).replace(/\/$/, "");

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
    ...(includeJson
      ? { "Content-Type": "application/json" }
      : {}),
    ...(token
      ? { Authorization: `Bearer ${token}` }
      : {}),
  };
}

function AdminStudents({ onBack }) {
  const [students, setStudents] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);

  const loadStudents = async () => {
    try {
      setLoading(true);
      setError("");

      const token = getAdminToken();

      if (!token) {
        throw new Error(
          "Admin session not found. Please log in to the Admin account again.",
        );
      }

      const response = await fetch(
        `${API_URL}/api/admin/students`,
        {
          method: "GET",
          cache: "no-store",
          headers: getAuthHeaders(),
        },
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.message ||
            (response.status === 401
              ? "Admin authentication failed. Please log in again."
              : `HTTP ${response.status}`),
        );
      }

      setStudents(
        Array.isArray(data.students)
          ? data.students
          : [],
      );
    } catch (err) {
      console.error(
        "Admin students loading error:",
        err,
      );
      setStudents([]);
      setError(
        err.message ||
          "Unable to load students.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStudents();
  }, []);

  const filteredStudents = useMemo(() => {
    const query = search.trim().toLowerCase();

    return students.filter((student) => {
      const matchesStatus =
        statusFilter === "all" ||
        (student.status || "active") ===
          statusFilter;

      const matchesSearch =
        !query ||
        String(student.name || "")
          .toLowerCase()
          .includes(query) ||
        String(student.email || "")
          .toLowerCase()
          .includes(query) ||
        String(
          student.studentId ||
            student.id ||
            "",
        )
          .toLowerCase()
          .includes(query);

      return matchesStatus && matchesSearch;
    });
  }, [students, search, statusFilter]);

  const updateStatus = async (
    student,
    status,
  ) => {
    const action =
      status === "blocked"
        ? "block"
        : "unblock";

    const reason =
      status === "blocked"
        ? window.prompt(
            "Reason for blocking this student:",
            "Blocked by administrator.",
          )
        : "";

    if (
      status === "blocked" &&
      reason === null
    ) {
      return;
    }

    try {
      setBusyId(student.id);

      const token = getAdminToken();

      if (!token) {
        throw new Error(
          "Admin session not found. Please log in again.",
        );
      }

      const response = await fetch(
        `${API_URL}/api/admin/students/${encodeURIComponent(
          student.id,
        )}/status`,
        {
          method: "PATCH",
          headers: getAuthHeaders(true),
          body: JSON.stringify({
            status,
            reason,
          }),
        },
      );

      const data = await response
        .json()
        .catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.message ||
            (response.status === 401
              ? "Admin authentication failed. Please log in again."
              : `HTTP ${response.status}`),
        );
      }

      await loadStudents();

      if (selected?.id === student.id) {
        setSelected(data.student || null);
      }
    } catch (err) {
      window.alert(
        err.message ||
          `Unable to ${action} student.`,
      );
    } finally {
      setBusyId("");
    }
  };

  const removeStudent = async (
    student,
  ) => {
    const confirmed =
      window.confirm(
        `Remove ${
          student.name ||
          student.email
        } from TestFlow?\n\nThe account will be deleted, while historical examination attempts are retained.`,
      );

    if (!confirmed) {
      return;
    }

    try {
      setBusyId(student.id);

      const token = getAdminToken();

      if (!token) {
        throw new Error(
          "Admin session not found. Please log in again.",
        );
      }

      const response = await fetch(
        `${API_URL}/api/admin/students/${encodeURIComponent(
          student.id,
        )}`,
        {
          method: "DELETE",
          headers: getAuthHeaders(),
        },
      );

      const data = await response
        .json()
        .catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.message ||
            (response.status === 401
              ? "Admin authentication failed. Please log in again."
              : `HTTP ${response.status}`),
        );
      }

      setSelected(null);
      await loadStudents();
    } catch (err) {
      window.alert(
        err.message ||
          "Unable to remove student.",
      );
    } finally {
      setBusyId("");
    }
  };

  return (
    <main className="students-page">
      <header className="students-header">
        <div>
          <p className="students-kicker">
            ADMINISTRATION
          </p>

          <h1>Students</h1>

          <p>
            Manage registered student
            accounts and access.
          </p>
        </div>

        <button
          className="students-refresh"
          onClick={loadStudents}
          disabled={loading}
        >
          {loading
            ? "Refreshing…"
            : "↻ Refresh"}
        </button>
      </header>

      <section className="students-toolbar">
        <div className="students-search">
          <span>🔍</span>

          <input
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder="Search by name, email or student ID…"
          />
        </div>

        <div className="students-filters">
          {[
            ["all", "All"],
            ["active", "Active"],
            ["blocked", "Blocked"],
          ].map(([value, label]) => (
            <button
              key={value}
              className={
                statusFilter === value
                  ? "selected"
                  : ""
              }
              onClick={() =>
                setStatusFilter(value)
              }
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      {error && (
        <div className="students-error">
          {error}
        </div>
      )}

      <section className="students-summary">
        <div>
          <strong>
            {students.length}
          </strong>
          <span>Total students</span>
        </div>

        <div>
          <strong>
            {
              students.filter(
                (s) =>
                  (s.status ||
                    "active") ===
                  "active",
              ).length
            }
          </strong>
          <span>Active accounts</span>
        </div>

        <div>
          <strong>
            {
              students.filter(
                (s) =>
                  s.status ===
                  "blocked",
              ).length
            }
          </strong>
          <span>Blocked accounts</span>
        </div>

        <div>
          <strong>
            {students.reduce(
              (sum, s) =>
                sum +
                Number(
                  s.attempts || 0,
                ),
              0,
            )}
          </strong>
          <span>Total attempts</span>
        </div>
      </section>

      <section className="students-table-panel">
        {loading ? (
          <div className="students-empty">
            Loading students…
          </div>
        ) : filteredStudents.length ===
          0 ? (
          <div className="students-empty">
            <strong>
              No students found
            </strong>
            <span>
              Try another search or
              filter.
            </span>
          </div>
        ) : (
          <div className="students-table-wrap">
            <table className="students-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Student ID</th>
                  <th>Status</th>
                  <th>Attempts</th>
                  <th>Completed</th>
                  <th>Avg. Score</th>
                  <th>Joined</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredStudents.map(
                  (student) => {
                    const status =
                      student.status ||
                      "active";
                    const busy =
                      busyId ===
                      student.id;

                    return (
                      <tr
                        key={
                          student.id
                        }
                      >
                        <td>
                          <div className="student-cell">
                            <div className="student-avatar">
                              {String(
                                student.name ||
                                  "S",
                              )
                                .charAt(
                                  0,
                                )
                                .toUpperCase()}
                            </div>

                            <div>
                              <strong>
                                {student.name ||
                                  "Unknown Student"}
                              </strong>

                              <span>
                                {
                                  student.email
                                }
                              </span>
                            </div>
                          </div>
                        </td>

                        <td>
                          {student.studentId ||
                            student.id ||
                            "—"}
                        </td>

                        <td>
                          <span
                            className={`student-status ${status}`}
                          >
                            {status}
                          </span>
                        </td>

                        <td>
                          {student.attempts ||
                            0}
                        </td>

                        <td>
                          {student.completed ||
                            0}
                        </td>

                        <td>
                          {student.averageScore ==
                          null
                            ? "—"
                            : `${student.averageScore}%`}
                        </td>

                        <td>
                          {student.createdAt
                            ? new Date(
                                student.createdAt,
                              ).toLocaleDateString()
                            : "—"}
                        </td>

                        <td>
                          <div className="student-actions">
                            <button
                              onClick={() =>
                                setSelected(
                                  student,
                                )
                              }
                            >
                              View
                            </button>

                            {status ===
                            "active" ? (
                              <button
                                className="warning"
                                disabled={
                                  busy
                                }
                                onClick={() =>
                                  updateStatus(
                                    student,
                                    "blocked",
                                  )
                                }
                              >
                                Block
                              </button>
                            ) : (
                              <button
                                className="gold"
                                disabled={
                                  busy
                                }
                                onClick={() =>
                                  updateStatus(
                                    student,
                                    "active",
                                  )
                                }
                              >
                                Unblock
                              </button>
                            )}

                            <button
                              className="danger"
                              disabled={
                                busy
                              }
                              onClick={() =>
                                removeStudent(
                                  student,
                                )
                              }
                            >
                              Remove
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  },
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selected && (
        <div
          className="student-modal-backdrop"
          onMouseDown={() =>
            setSelected(null)
          }
        >
          <div
            className="student-modal"
            onMouseDown={(event) =>
              event.stopPropagation()
            }
          >
            <button
              className="modal-close"
              onClick={() =>
                setSelected(null)
              }
            >
              ×
            </button>

            <div className="modal-avatar">
              {String(
                selected.name ||
                  "S",
              )
                .charAt(0)
                .toUpperCase()}
            </div>

            <p className="students-kicker">
              STUDENT PROFILE
            </p>

            <h2>
              {selected.name}
            </h2>

            <p className="modal-email">
              {selected.email}
            </p>

            <div className="modal-grid">
              <div>
                <span>Student ID</span>
                <strong>
                  {selected.studentId ||
                    selected.id}
                </strong>
              </div>

              <div>
                <span>Status</span>
                <strong>
                  {selected.status ||
                    "active"}
                </strong>
              </div>

              <div>
                <span>Attempts</span>
                <strong>
                  {selected.attempts ||
                    0}
                </strong>
              </div>

              <div>
                <span>Completed</span>
                <strong>
                  {selected.completed ||
                    0}
                </strong>
              </div>

              <div>
                <span>Average score</span>
                <strong>
                  {selected.averageScore ==
                  null
                    ? "—"
                    : `${selected.averageScore}%`}
                </strong>
              </div>

              <div>
                <span>Joined</span>
                <strong>
                  {selected.createdAt
                    ? new Date(
                        selected.createdAt,
                      ).toLocaleString()
                    : "—"}
                </strong>
              </div>
            </div>

            {selected.status ===
              "blocked" &&
              selected.blockedReason && (
                <div className="blocked-note">
                  <strong>
                    Block reason
                  </strong>
                  <span>
                    {
                      selected.blockedReason
                    }
                  </span>
                </div>
              )}
          </div>
        </div>
      )}
    </main>
  );
}

export default AdminStudents;
