// ==========================================================
// AiTradeX - Upstox Controller
// ==========================================================

const upstoxService = require("./upstox.service");

// ==========================================================
// Upstox Controller
// ==========================================================

class UpstoxController {
  // ========================================================
  // Start Upstox Login
  // ========================================================

  async login(req, res) {
    try {
      // ----------------------------------------------------
      // Generate secure OAuth state
      // ----------------------------------------------------

      const state =
        upstoxService.generateState();

      // ----------------------------------------------------
      // Store state in secure HTTP-only cookie
      // ----------------------------------------------------

      res.cookie(
        "upstox_oauth_state",
        state,
        {
          httpOnly: true,

          secure:
            process.env.NODE_ENV ===
            "production",

          sameSite: "lax",

          maxAge: 10 * 60 * 1000,

          path: "/",
        }
      );

      // ----------------------------------------------------
      // Generate Upstox authorization URL
      // ----------------------------------------------------

      const authorizationUrl =
        upstoxService.getAuthorizationUrl(
          state
        );

      console.log("");
      console.log(
        "========================================"
      );
      console.log(
        "📈 UPSTOX OAUTH STARTED"
      );
      console.log(
        "========================================"
      );
      console.log(
        "Redirect URI:",
        process.env.UPSTOX_REDIRECT_URI
      );
      console.log(
        "========================================"
      );
      console.log("");

      // ----------------------------------------------------
      // Redirect user to Upstox
      // ----------------------------------------------------

      return res.redirect(
        authorizationUrl
      );
    } catch (error) {
      console.error("");
      console.error(
        "========================================"
      );
      console.error(
        "❌ UPSTOX LOGIN ERROR"
      );
      console.error(
        "========================================"
      );
      console.error(
        "Message:",
        error.message
      );
      console.error(
        "========================================"
      );
      console.error("");

      return res.status(500).json({
        success: false,
        message:
          "Unable to start Upstox authentication.",
      });
    }
  }

  // ========================================================
  // Upstox OAuth Callback
  // ========================================================

  async callback(req, res) {
    try {
      const {
        code,
        state,
        error,
        error_description,
      } = req.query;

      // ----------------------------------------------------
      // Handle Upstox OAuth error
      // ----------------------------------------------------

      if (error) {
        console.error(
          "Upstox OAuth error:",
          error,
          error_description || ""
        );

        return res.status(400).json({
          success: false,
          message:
            "Upstox authentication was cancelled or failed.",
          error,
          errorDescription:
            error_description || null,
        });
      }

      // ----------------------------------------------------
      // Validate authorization code
      // ----------------------------------------------------

      if (!code) {
        return res.status(400).json({
          success: false,
          message:
            "Authorization code is missing.",
        });
      }

      // ----------------------------------------------------
      // Validate returned state
      // ----------------------------------------------------

      const savedState =
        req.cookies?.upstox_oauth_state;

      if (!state) {
        return res.status(400).json({
          success: false,
          message:
            "OAuth state is missing.",
        });
      }

      if (!savedState) {
        return res.status(400).json({
          success: false,
          message:
            "OAuth session expired. Please try again.",
        });
      }

      if (state !== savedState) {
        console.error(
          "❌ Upstox OAuth state mismatch"
        );

        return res.status(400).json({
          success: false,
          message:
            "Invalid OAuth state.",
        });
      }

      // ----------------------------------------------------
      // Clear OAuth state cookie
      // ----------------------------------------------------

      res.clearCookie(
        "upstox_oauth_state",
        {
          httpOnly: true,

          secure:
            process.env.NODE_ENV ===
            "production",

          sameSite: "lax",

          path: "/",
        }
      );

      // ----------------------------------------------------
      // Exchange code for access token
      // ----------------------------------------------------

      const tokenData =
        await upstoxService.exchangeCodeForToken(
          code
        );

      if (!tokenData?.access_token) {
        console.error(
          "Upstox token response:",
          tokenData
        );

        return res.status(502).json({
          success: false,
          message:
            "Upstox did not return an access token.",
        });
      }

      // ----------------------------------------------------
      // Verify access token
      // ----------------------------------------------------

      let profileData = null;

      try {
        profileData =
          await upstoxService.getUserProfile(
            tokenData.access_token
          );
      } catch (profileError) {
        console.error(
          "Unable to verify Upstox access token:",
          profileError.response?.data ||
            profileError.message
        );

        return res.status(502).json({
          success: false,
          message:
            "Upstox authentication succeeded, but the access token could not be verified.",
        });
      }

      // ----------------------------------------------------
      // IMPORTANT
      // ----------------------------------------------------
      //
      // DO NOT return access_token to browser.
      //
      // The token will be stored securely on the backend
      // in the next step.
      //
      // ----------------------------------------------------

      console.log("");
      console.log(
        "========================================"
      );
      console.log(
        "✅ UPSTOX AUTHENTICATION SUCCESSFUL"
      );
      console.log(
        "========================================"
      );
      console.log(
        "User ID:",
        profileData?.data?.user_id ||
          profileData?.user_id ||
          "Unknown"
      );
      console.log(
        "User Name:",
        profileData?.data?.user_name ||
          profileData?.user_name ||
          "Unknown"
      );
      console.log(
        "========================================"
      );
      console.log("");

      return res.status(200).json({
        success: true,

        message:
          "Upstox authentication successful.",

        data: {
          authenticated: true,

          userId:
            profileData?.data?.user_id ||
            profileData?.user_id ||
            null,

          userName:
            profileData?.data?.user_name ||
            profileData?.user_name ||
            null,

          email:
            profileData?.data?.email ||
            profileData?.email ||
            null,

          broker:
            profileData?.data?.broker ||
            profileData?.broker ||
            "UPSTOX",
        },
      });
    } catch (error) {
      console.error("");
      console.error(
        "========================================"
      );
      console.error(
        "❌ UPSTOX CALLBACK ERROR"
      );
      console.error(
        "========================================"
      );
      console.error(
        "Status:",
        error.response?.status
      );
      console.error(
        "Response:",
        error.response?.data
      );
      console.error(
        "Message:",
        error.message
      );
      console.error(
        "========================================"
      );
      console.error("");

      return res.status(
        error.response?.status || 500
      ).json({
        success: false,

        message:
          "Upstox authentication failed.",

        error:
          error.response?.data ||
          error.message,
      });
    }
  }
}

// ==========================================================
// Export Singleton
// ==========================================================

module.exports = new UpstoxController();