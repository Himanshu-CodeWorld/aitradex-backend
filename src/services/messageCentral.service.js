const axios = require("axios");

const BASE_URL =
  process.env.MESSAGE_CENTRAL_BASE_URL ||
  "https://cpaas.messagecentral.com";

const CUSTOMER_ID =
  process.env.MESSAGE_CENTRAL_CUSTOMER_ID;

const EMAIL =
  process.env.MESSAGE_CENTRAL_EMAIL;

const PASSWORD =
  process.env.MESSAGE_CENTRAL_PASSWORD;

const COUNTRY =
  process.env.MESSAGE_CENTRAL_COUNTRY || "91";

let authToken = null;
let authTokenExpiresAt = 0;

// ============================================================
// GENERATE MESSAGE CENTRAL AUTH TOKEN
// ============================================================
const generateAuthToken = async () => {
  try {
    if (!CUSTOMER_ID) {
      throw new Error(
        "MESSAGE_CENTRAL_CUSTOMER_ID is missing"
      );
    }

    if (!EMAIL) {
      throw new Error(
        "MESSAGE_CENTRAL_EMAIL is missing"
      );
    }

    if (!PASSWORD) {
      throw new Error(
        "MESSAGE_CENTRAL_PASSWORD is missing"
      );
    }

    // Message Central requires Base64 encoded password
    const encodedPassword =
      Buffer.from(PASSWORD, "utf8").toString("base64");

    console.log("\n====================================");
    console.log("MESSAGE CENTRAL AUTH REQUEST");
    console.log("Customer :", CUSTOMER_ID);
    console.log("Email    :", EMAIL);
    console.log("Country  :", COUNTRY);
    console.log("====================================");

    const response = await axios.get(
      `${BASE_URL}/auth/v1/authentication/token`,
      {
        params: {
          customerId: CUSTOMER_ID,
          key: encodedPassword,
          scope: "NEW",
          country: COUNTRY,
          email: EMAIL,
        },

        headers: {
          accept: "*/*",
        },

        timeout: 15000,
      }
    );

    console.log(
      "\n===================================="
    );

    console.log(
      "MESSAGE CENTRAL AUTH RESPONSE"
    );

    // Do NOT print password or encoded key
    console.log({
      status: response.data?.status,
      hasToken: Boolean(response.data?.token),
    });

    console.log(
      "===================================="
    );

    if (!response.data?.token) {
      throw new Error(
        response.data?.error ||
        "Auth token not found in Message Central response."
      );
    }

    authToken = response.data.token;

    // Token is commonly valid for a limited period.
    // Refresh conservatively after 23 hours.
    authTokenExpiresAt =
      Date.now() + 23 * 60 * 60 * 1000;

    return authToken;
  } catch (error) {
    const responseData =
      error.response?.data;

    console.error(
      "\n===================================="
    );

    console.error(
      "MESSAGE CENTRAL AUTH ERROR"
    );

    console.error(
      responseData || error.message
    );

    console.error(
      "===================================="
    );

    authToken = null;
    authTokenExpiresAt = 0;

    throw new Error(
      responseData?.error ||
      responseData?.message ||
      "Message Central authentication failed."
    );
  }
};

// ============================================================
// GET AUTH TOKEN
// ============================================================
const getAuthToken = async () => {
  if (
    authToken &&
    Date.now() < authTokenExpiresAt
  ) {
    return authToken;
  }

  return await generateAuthToken();
};

// ============================================================
// SEND OTP
// ============================================================
const sendOtp = async (
  mobileNumber,
  otpLength = 6
) => {
  try {
    const token = await getAuthToken();

    const cleanNumber =
      String(mobileNumber)
        .replace(/\D/g, "")
        .replace(/^91/, "");

    console.log("\n====================================");
    console.log("MESSAGE CENTRAL SEND OTP");
    console.log("Country :", COUNTRY);
    console.log("Mobile  :", cleanNumber);
    console.log("====================================");

    const response = await axios.post(
      `${BASE_URL}/verification/v3/send`,
      null,
      {
        params: {
          countryCode: COUNTRY,
          customerId: CUSTOMER_ID,
          mobileNumber: cleanNumber,
          flowType: "SMS",
          otpLength,
        },

        headers: {
          authToken: token,
          accept: "*/*",
        },

        timeout: 15000,
      }
    );

    console.log(
      "\n===================================="
    );

    console.log(
      "MESSAGE CENTRAL SEND RESPONSE"
    );

    console.log({
      responseCode:
        response.data?.responseCode,
      message:
        response.data?.message,
      verificationId:
        response.data?.data?.verificationId,
    });

    console.log(
      "===================================="
    );

    if (
      response.data?.responseCode !== 200
    ) {
      throw new Error(
        response.data?.message ||
        response.data?.data?.errorMessage ||
        "Failed to send OTP."
      );
    }

    return response.data;
  } catch (error) {
    console.error(
      "\n========== MESSAGE CENTRAL SEND OTP ERROR =========="
    );

    console.error(
      error.response?.data ||
      error.message
    );

    // If token expired/invalid, clear it.
    const status =
      error.response?.status;

    if (
      status === 401 ||
      status === 403
    ) {
      authToken = null;
      authTokenExpiresAt = 0;
    }

    throw new Error(
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Failed to send OTP."
    );
  }
};

// ============================================================
// VERIFY OTP
// ============================================================
const verifyOtp = async (
  verificationId,
  code
) => {
  try {
    const token = await getAuthToken();

    const response = await axios.get(
      `${BASE_URL}/verification/v3/validateOtp`,
      {
        params: {
          verificationId,
          code,
        },

        headers: {
          authToken: token,
          accept: "*/*",
        },

        timeout: 15000,
      }
    );

    console.log(
      "\n===================================="
    );

    console.log(
      "MESSAGE CENTRAL VERIFY RESPONSE"
    );

    console.log(
      response.data
    );

    console.log(
      "===================================="
    );

    return response.data;
  } catch (error) {
    console.error(
      "MESSAGE CENTRAL VERIFY ERROR:",
      error.response?.data ||
        error.message
    );

    throw new Error(
      error.response?.data?.message ||
      error.response?.data?.error ||
      "OTP verification failed."
    );
  }
};

module.exports = {
  generateAuthToken,
  getAuthToken,
  sendOtp,
  verifyOtp,
};