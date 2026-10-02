import { useState } from "react";
import "./ForgotPassword.css";

const API_URL =
  import.meta.env.VITE_API_URL ||
  "https://testflow-pkbi.onrender.com";

function ForgotPassword({ onBackToLogin }) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [resetUrl, setResetUrl] = useState("");
  const [expiresInMinutes, setExpiresInMinutes] =
    useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();

    setMessage("");
    setResetUrl("");
    setExpiresInMinutes(null);
    setError("");

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      setError("Please enter your email address.");
      return;
    }

    const emailPattern =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(cleanEmail)) {
      setError("Please enter a valid email address.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        `${API_URL}/api/auth/student/forgot-password`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: cleanEmail,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Unable to process password reset request."
        );
      }

      setMessage(
        data.message ||
          "If an account exists with this email, a password reset link has been generated."
      );

      /*
      DEVELOPMENT MODE

      server.js returns resetUrl when SMTP
      is not configured.
      */

      if (data.development && data.resetUrl) {
        setResetUrl(data.resetUrl);
        setExpiresInMinutes(
          data.expiresInMinutes || 15
        );
      }
    } catch (err) {
      console.error(
        "FORGOT PASSWORD ERROR:",
        err
      );

      setError(
        err.message ||
          "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const openResetLink = () => {
    if (!resetUrl) {
      return;
    }

    window.location.href = resetUrl;
  };

  return (
    <div className="auth-page">
      <div className="auth-card">

        <div className="auth-header">
          <h1>Forgot Password?</h1>

          <p>
            Enter your registered email address
            and we'll help you reset your password.
          </p>
        </div>

        <form onSubmit={handleSubmit}>

          <div className="form-group">
            <label htmlFor="forgot-email">
              Email Address
            </label>

            <input
              id="forgot-email"
              type="email"
              value={email}
              onChange={(event) =>
                setEmail(event.target.value)
              }
              placeholder="Enter your registered email"
              autoComplete="email"
              disabled={loading}
              autoFocus
            />
          </div>

          {error && (
            <div className="auth-error">
              {error}
            </div>
          )}

          {message && (
            <div className="auth-success">
              {message}
            </div>
          )}

          {resetUrl && (
            <div
              style={{
                marginTop: "18px",
                padding: "16px",
                borderRadius: "12px",
                background:
                  "rgba(37, 99, 235, 0.08)",
                border:
                  "1px solid rgba(37, 99, 235, 0.25)",
              }}
            >
              <strong>
                Development Reset Link
              </strong>

              <p
                style={{
                  fontSize: "13px",
                  wordBreak: "break-all",
                  margin: "10px 0",
                }}
              >
                {resetUrl}
              </p>

              {expiresInMinutes && (
                <p
                  style={{
                    fontSize: "12px",
                    marginBottom: "12px",
                  }}
                >
                  This link expires in{" "}
                  {expiresInMinutes} minutes.
                </p>
              )}

              <button
                type="button"
                className="auth-button"
                onClick={openResetLink}
              >
                Open Reset Password
              </button>
            </div>
          )}

          <button
            type="submit"
            className="auth-button"
            disabled={loading}
          >
            {loading
              ? "Generating..."
              : "Send Reset Link"}
          </button>

        </form>

        <button
          type="button"
          className="back-button"
          onClick={onBackToLogin}
          disabled={loading}
        >
          â† Back to Login
        </button>

      </div>
    </div>
  );
}

export default ForgotPassword;

