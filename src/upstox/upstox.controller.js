
const upstoxService = require("./upstox.service");
const { setAccessToken } = require("./upstox.token.store");

const STATE_COOKIE = "upstox_oauth_state";

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  maxAge: 10 * 60 * 1000,
  path: "/",
};

function appRedirectUri() {
  return (
    process.env.UPSTOX_APP_REDIRECT_URI ||
    "aitradex://upstox-callback"
  );
}

function redirectToApp(res, params) {
  const target = new URL(appRedirectUri());

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      target.searchParams.set(key, String(value));
    }
  }

  return res.redirect(302, target.toString());
}

class UpstoxController {
  async login(req, res) {
    try {
      const state = upstoxService.generateState();

      res.cookie(STATE_COOKIE, state, COOKIE_OPTIONS);

      const authorizationUrl =
        upstoxService.getAuthorizationUrl(state);

      return res.redirect(302, authorizationUrl);
    } catch (error) {
      console.error(
        "[Upstox OAuth] Login error:",
        error.message
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to start Upstox authentication. Check server OAuth configuration.",
      });
    }
  }

  async callback(req, res) {
    const {
      code,
      state,
      error,
    } = req.query;

    try {
      if (error) {
        res.clearCookie(STATE_COOKIE, COOKIE_OPTIONS);

        return redirectToApp(res, {
          status: "error",
          broker: "upstox",
          message: "Upstox authorization was cancelled or denied.",
        });
      }

      if (typeof code !== "string" || !code.trim()) {
        return res.status(400).send(
          "Upstox authorization code is missing. Return to AiTradeX and try again."
        );
      }

      const savedState = req.cookies?.[STATE_COOKIE];

      if (
        typeof state !== "string" ||
        !savedState ||
        state !== savedState
      ) {
        res.clearCookie(STATE_COOKIE, COOKIE_OPTIONS);

        return res.status(400).send(
          "Upstox OAuth state validation failed or expired. Return to AiTradeX and try again."
        );
      }

      res.clearCookie(STATE_COOKIE, COOKIE_OPTIONS);

      const tokenData =
        await upstoxService.exchangeCodeForToken(code);

      if (!tokenData?.access_token) {
        return redirectToApp(res, {
          status: "error",
          broker: "upstox",
          message: "Upstox did not return an access token.",
        });
      }

      let profileData;

      try {
        profileData = await upstoxService.getUserProfile(
          tokenData.access_token
        );
      } catch (profileError) {
        console.error(
          "[Upstox OAuth] Profile verification failed:",
          profileError.response?.data ||
            profileError.message
        );

        return redirectToApp(res, {
          status: "error",
          broker: "upstox",
          message:
            "Authorization received, but the Upstox profile could not be verified.",
        });
      }

      // IMPORTANT:
      // This is a process-level token cache.
      // For multi-user production, store tokens encrypted
      // and associate them with the authenticated AiTradeX user.
      setAccessToken(
        tokenData.access_token,
        tokenData.expires_in
      );

      const profile = profileData?.data || profileData || {};

      console.info(
        "[Upstox OAuth] Authentication successful:",
        profile.user_id || "unknown"
      );

      // Never send the broker access token to Flutter.
      return redirectToApp(res, {
        status: "success",
        broker: "upstox",
        authenticated: "true",
        userId: profile.user_id || "",
        userName: profile.user_name || "",
      });
    } catch (error) {
      console.error(
        "[Upstox OAuth] Callback failed:",
        error.response?.data || error.message
      );

      return redirectToApp(res, {
        status: "error",
        broker: "upstox",
        message: "Upstox authentication failed. Please try again.",
      });
    }
  }
}

module.exports = new UpstoxController();
