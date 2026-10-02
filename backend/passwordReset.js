import crypto from "crypto";
import bcrypt from "bcryptjs";

/*
====================================================
PASSWORD RESET SYSTEM
====================================================

Development version:

- User enters email
- Server generates secure reset token
- Token expires after 30 minutes
- Reset link is printed in backend terminal
- No email service is required
- Later we can connect Gmail/Resend/SendGrid/etc.
====================================================
*/

const resetTokens = new Map();

const RESET_TOKEN_EXPIRY = 30 * 60 * 1000;

/*
====================================================
REGISTER PASSWORD RESET ROUTES
====================================================
*/

export function registerPasswordResetRoutes(
  app,
  users,
) {
  /*
  ==================================================
  FORGOT PASSWORD
  ==================================================
  */

  app.post(
    "/api/auth/forgot-password",
    async (req, res) => {
      try {
        const email =
          String(
            req.body?.email || "",
          )
            .trim()
            .toLowerCase();

        /*
        Always return the same response
        whether the email exists or not.
        */

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
        Do not reveal whether the account exists.
        */

        if (!user) {
          return res.json({
            success: true,

            message:
              "If an account exists with this email, a password reset link has been generated.",
          });
        }

        /*
        ==================================================
        GENERATE SECURE RESET TOKEN
        ==================================================
        */

        const token =
          crypto
            .randomBytes(32)
            .toString("hex");

        const expiresAt =
          Date.now() +
          RESET_TOKEN_EXPIRY;

        /*
        Remove any previous reset token
        belonging to this user.
        */

        for (
          const [
            existingToken,
            resetData,
          ] of resetTokens.entries()
        ) {
          if (
            resetData.userId ===
            user.id
          ) {
            resetTokens.delete(
              existingToken,
            );
          }
        }

        resetTokens.set(
          token,
          {
            userId:
              user.id,

            email:
              user.email,

            expiresAt,
          },
        );

        /*
        ==================================================
        RESET LINK
        ==================================================
        */

        const frontendUrl =
          process.env.FRONTEND_URL ||
          "http://localhost:5173";

        const resetLink =
          `${frontendUrl}/reset-password?token=${token}`;

        /*
        ==================================================
        DEVELOPMENT MODE
        ==================================================

        Since there is currently no email service,
        we print the reset link in the terminal.
        ==================================================
        */

        console.log("");
        console.log(
          "==========================================",
        );
        console.log(
          "🔐 PASSWORD RESET REQUEST",
        );
        console.log(
          "==========================================",
        );
        console.log(
          `📧 Email: ${user.email}`,
        );
        console.log(
          `👤 User: ${user.name}`,
        );
        console.log(
          `🔗 Reset Link: ${resetLink}`,
        );
        console.log(
          `⏰ Expires: ${new Date(
            expiresAt,
          ).toLocaleString()}`,
        );
        console.log(
          "==========================================",
        );
        console.log("");

        res.json({
          success: true,

          message:
            "If an account exists with this email, a password reset link has been generated.",

          /*
          Development only.

          REMOVE resetLink from the response
          when a real email service is connected.
          */

          development: true,

          resetLink,
        });
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
  ==================================================
  VERIFY RESET TOKEN
  ==================================================
  */

  app.get(
    "/api/auth/reset-password/verify/:token",
    (req, res) => {
      try {
        const token =
          String(
            req.params.token || "",
          ).trim();

        if (!token) {
          return res.status(400).json({
            success: false,

            message:
              "Reset token is required.",
          });
        }

        const resetData =
          resetTokens.get(token);

        if (!resetData) {
          return res.status(400).json({
            success: false,

            valid: false,

            message:
              "Invalid or expired password reset link.",
          });
        }

        /*
        Check expiration
        */

        if (
          Date.now() >
          resetData.expiresAt
        ) {
          resetTokens.delete(
            token,
          );

          return res.status(400).json({
            success: false,

            valid: false,

            message:
              "This password reset link has expired.",
          });
        }

        res.json({
          success: true,

          valid: true,

          email:
            resetData.email,

          expiresAt:
            resetData.expiresAt,
        });
      } catch (error) {
        console.error(
          "Reset token verification error:",
          error,
        );

        res.status(500).json({
          success: false,

          message:
            "Unable to verify reset link.",
        });
      }
    },
  );

  /*
  ==================================================
  RESET PASSWORD
  ==================================================
  */

  app.post(
    "/api/auth/reset-password",
    async (req, res) => {
      try {
        const {
          token,
          password,
          confirmPassword,
        } = req.body;

        /*
        ==================================================
        VALIDATION
        ==================================================
        */

        if (
          !token ||
          !password ||
          !confirmPassword
        ) {
          return res.status(400).json({
            success: false,

            message:
              "Token, password and confirm password are required.",
          });
        }

        if (
          password !==
          confirmPassword
        ) {
          return res.status(400).json({
            success: false,

            message:
              "Passwords do not match.",
          });
        }

        if (
          password.length < 6
        ) {
          return res.status(400).json({
            success: false,

            message:
              "Password must contain at least 6 characters.",
          });
        }

        /*
        ==================================================
        FIND RESET TOKEN
        ==================================================
        */

        const resetData =
          resetTokens.get(token);

        if (!resetData) {
          return res.status(400).json({
            success: false,

            message:
              "Invalid or expired password reset link.",
          });
        }

        /*
        ==================================================
        CHECK EXPIRATION
        ==================================================
        */

        if (
          Date.now() >
          resetData.expiresAt
        ) {
          resetTokens.delete(
            token,
          );

          return res.status(400).json({
            success: false,

            message:
              "This password reset link has expired.",
          });
        }

        /*
        ==================================================
        FIND USER
        ==================================================
        */

        const user =
          users.get(
            resetData.userId,
          );

        if (!user) {
          resetTokens.delete(
            token,
          );

          return res.status(404).json({
            success: false,

            message:
              "User account not found.",
          });
        }

        /*
        ==================================================
        HASH NEW PASSWORD
        ==================================================
        */

        const passwordHash =
          await bcrypt.hash(
            password,
            10,
          );

        /*
        ==================================================
        UPDATE USER PASSWORD
        ==================================================
        */

        user.passwordHash =
          passwordHash;

        user.updatedAt =
          new Date().toISOString();

        users.set(
          user.id,
          user,
        );

        /*
        ==================================================
        INVALIDATE RESET TOKEN
        ==================================================
        */

        resetTokens.delete(
          token,
        );

        /*
        ==================================================
        SUCCESS
        ==================================================
        */

        console.log(
          `🔐 Password successfully reset for ${user.email}`,
        );

        res.json({
          success: true,

          message:
            "Password reset successfully. You can now login with your new password.",
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
  ==================================================
  CLEAN EXPIRED TOKENS
  ==================================================
  */

  setInterval(
    () => {
      const now =
        Date.now();

      for (
        const [
          token,
          resetData,
        ] of resetTokens.entries()
      ) {
        if (
          now >
          resetData.expiresAt
        ) {
          resetTokens.delete(
            token,
          );
        }
      }
    },
    5 * 60 * 1000,
  );

  console.log(
    "🔐 Password reset system: ENABLED",
  );

  console.log(
    "📧 Email service: NOT CONFIGURED",
  );

  console.log(
    "🔗 Development reset links: ENABLED",
  );
}