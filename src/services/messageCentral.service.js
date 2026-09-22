// src/services/messageCentral.service.js

const messageCentral = require("../config/messageCentral");

// ==========================================================
// MESSAGE CENTRAL CONFIGURATION
// ==========================================================

const CUSTOMER_ID =
  process.env.MESSAGE_CENTRAL_CUSTOMER_ID;

const EMAIL =
  process.env.MESSAGE_CENTRAL_EMAIL;

const PASSWORD =
  process.env.MESSAGE_CENTRAL_PASSWORD;

const COUNTRY =
  process.env.MESSAGE_CENTRAL_COUNTRY || "91";

// ==========================================================
// VALIDATE CONFIGURATION
// ==========================================================

const validateConfig = () => {
  const missing = [];

  if (!CUSTOMER_ID) {
    missing.push(
      "MESSAGE_CENTRAL_CUSTOMER_ID"
    );
  }

  if (!EMAIL) {
    missing.push(
      "MESSAGE_CENTRAL_EMAIL"
    );
  }

  if (!PASSWORD) {
    missing.push(
      "MESSAGE_CENTRAL_PASSWORD"
    );
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing Message Central environment variables: ${missing.join(
        ", "
      )}`
    );
  }
};

// ==========================================================
// NORMALIZE PHONE NUMBER
// ==========================================================

const normalizeIndianPhone = (phone) => {
  let mobileNumber = String(phone || "").trim();

  // Remove spaces, hyphens, brackets, etc.
  mobileNumber = mobileNumber.replace(/\D/g, "");

  // Convert 919328097349 -> 9328097349
  if (mobileNumber.startsWith("91")) {
    mobileNumber = mobileNumber.substring(2);
  }

  // Must be a valid Indian 10-digit mobile number.
  if (!/^[6-9]\d{9}$/.test(mobileNumber)) {
    throw new Error(
      "Invalid Indian mobile number."
    );
  }

  return mobileNumber;
};

// ==========================================================
// GENERATE AUTH TOKEN
// ==========================================================

const generateAuthToken = async () => {
  validateConfig();

  console.log("");
  console.log("====================================");
  console.log("MESSAGE CENTRAL AUTH REQUEST");
  console.log("====================================");

  console.log(
    "Customer :",
    CUSTOMER_ID
  );

  console.log(
    "Email    :",
    EMAIL
  );

  console.log(
    "Country  :",
    COUNTRY
  );

  console.log(
    "Password configured:",
    Boolean(PASSWORD)
  );

  // --------------------------------------------------------
  // IMPORTANT
  // Message Central expects the password to be Base64 encoded
  // and sent as the `key` query parameter.
  // --------------------------------------------------------

  const encodedPassword =
    Buffer.from(
      PASSWORD,
      "utf8"
    ).toString("base64");

  try {
    const response =
      await messageCentral.get(
        "/auth/v1/authentication/token",
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

    console.log("");
    console.log("====================================");
    console.log("MESSAGE CENTRAL AUTH RESPONSE");
    console.log("====================================");

    console.log(
      "HTTP Status:",
      response.status
    );

    console.log(
      "API Status:",
      response.data?.status
    );

    console.log(
      "Has Token:",
      Boolean(response.data?.token)
    );

    // ------------------------------------------------------
    // SUCCESS
    // ------------------------------------------------------

    if (
      response.data?.token &&
      (
        response.data?.status === 200 ||
        response.status === 200
      )
    ) {
      console.log("");
      console.log(
        "✅ Message Central authentication successful."
      );

      return response.data.token;
    }

    // ------------------------------------------------------
    // MESSAGE CENTRAL RETURNED AN ERROR
    // ------------------------------------------------------

    console.error("");
    console.error(
      "Message Central authentication response:"
    );

    console.error(
      JSON.stringify(
        response.data,
        null,
        2
      )
    );

    const message =
      response.data?.error ||
      response.data?.message ||
      "Message Central authentication failed.";

    throw new Error(message);
  } catch (error) {
    console.log("");
    console.log(
      "===================================="
    );
    console.log(
      "MESSAGE CENTRAL AUTH ERROR"
    );
    console.log(
      "===================================="
    );

    if (error.response) {
      console.error(
        "HTTP Status:",
        error.response.status
      );

      console.error(
        "Response:",
        JSON.stringify(
          error.response.data,
          null,
          2
        )
      );

      const message =
        error.response.data?.error ||
        error.response.data?.message ||
        "Message Central authentication failed.";

      throw new Error(message);
    }

    console.error(
      "Message:",
      error.message
    );

    throw new Error(
      error.message ||
        "Message Central authentication failed."
    );
  }
};

// ==========================================================
// SEND PHONE OTP
// ==========================================================

const sendOtp = async (phone) => {
  try {
    validateConfig();

    const mobileNumber =
      normalizeIndianPhone(phone);

    console.log("");
    console.log(
      "===================================="
    );
    console.log(
      "MESSAGE CENTRAL SEND OTP"
    );
    console.log(
      "===================================="
    );

    console.log(
      "Mobile:",
      mobileNumber
    );

    // ------------------------------------------------------
    // Generate auth token
    // ------------------------------------------------------

    const authToken =
      await generateAuthToken();

    if (!authToken) {
      throw new Error(
        "Message Central authToken was not generated."
      );
    }

    console.log(
      "Auth token generated successfully."
    );

    // ------------------------------------------------------
    // Send OTP
    // ------------------------------------------------------

    const response =
      await messageCentral.post(
        "/verification/v3/send",
        null,
        {
          params: {
            countryCode: COUNTRY,
            customerId: CUSTOMER_ID,
            mobileNumber,
            flowType: "SMS",
            otpLength: 6,
          },

          headers: {
            accept: "*/*",
            authToken,
          },

          timeout: 15000,
        }
      );

    console.log("");
    console.log(
      "===================================="
    );
    console.log(
      "MESSAGE CENTRAL SEND OTP RESPONSE"
    );
    console.log(
      "===================================="
    );

    console.log(
      JSON.stringify(
        response.data,
        null,
        2
      )
    );

    if (!response.data) {
      throw new Error(
        "Empty response received from Message Central."
      );
    }

    // ------------------------------------------------------
    // Check documented response
    // ------------------------------------------------------

    if (
      response.data.responseCode &&
      String(response.data.responseCode) !== "200"
    ) {
      throw new Error(
        response.data.message ||
          response.data.data?.errorMessage ||
          "Message Central failed to send OTP."
      );
    }

    if (
      response.data.data?.errorMessage
    ) {
      throw new Error(
        response.data.data.errorMessage
      );
    }

    return response.data;
  } catch (error) {
    console.log("");
    console.log(
      "============================================"
    );
    console.log(
      "MESSAGE CENTRAL SEND OTP ERROR"
    );
    console.log(
      "============================================"
    );

    if (error.response) {
      console.error(
        "HTTP Status:",
        error.response.status
      );

      console.error(
        "Response:",
        JSON.stringify(
          error.response.data,
          null,
          2
        )
      );
    } else {
      console.error(
        "Message:",
        error.message
      );
    }

    throw new Error(
      error.response?.data?.error ||
        error.response?.data?.message ||
        error.message ||
        "Failed to send OTP."
    );
  }
};

// ==========================================================
// VERIFY OTP
// ==========================================================

const verifyOtp = async (
  verificationId,
  otp
) => {
  try {
    validateConfig();

    verificationId =
      String(
        verificationId || ""
      ).trim();

    otp =
      String(
        otp || ""
      ).trim();

    if (!verificationId) {
      throw new Error(
        "Verification ID is required."
      );
    }

    if (!otp) {
      throw new Error(
        "OTP is required."
      );
    }

    if (!/^\d{4,8}$/.test(otp)) {
      throw new Error(
        "OTP must contain 4 to 8 digits."
      );
    }

    console.log("");
    console.log(
      "===================================="
    );
    console.log(
      "MESSAGE CENTRAL VERIFY OTP"
    );
    console.log(
      "===================================="
    );

    console.log(
      "Verification ID:",
      verificationId
    );

    // ------------------------------------------------------
    // Generate auth token
    // ------------------------------------------------------

    const authToken =
      await generateAuthToken();

    if (!authToken) {
      throw new Error(
        "Message Central authToken was not generated."
      );
    }

    // ------------------------------------------------------
    // Validate OTP
    // ------------------------------------------------------

    const response =
      await messageCentral.get(
        "/verification/v3/validateOtp",
        {
          params: {
            verificationId,
            code: otp,
          },

          headers: {
            accept: "*/*",
            authToken,
          },

          timeout: 15000,
        }
      );

    console.log("");
    console.log(
      "===================================="
    );
    console.log(
      "MESSAGE CENTRAL VERIFY RESPONSE"
    );
    console.log(
      "===================================="
    );

    console.log(
      JSON.stringify(
        response.data,
        null,
        2
      )
    );

    return response.data;
  } catch (error) {
    console.log("");
    console.log(
      "============================================"
    );
    console.log(
      "MESSAGE CENTRAL VERIFY OTP ERROR"
    );
    console.log(
      "============================================"
    );

    if (error.response) {
      console.error(
        "HTTP Status:",
        error.response.status
      );

      console.error(
        "Response:",
        JSON.stringify(
          error.response.data,
          null,
          2
        )
      );
    } else {
      console.error(
        "Message:",
        error.message
      );
    }

    throw new Error(
      error.response?.data?.error ||
        error.response?.data?.message ||
        error.message ||
        "Failed to verify OTP."
    );
  }
};

// ==========================================================
// EXPORT
// ==========================================================

module.exports = {
  generateAuthToken,
  sendOtp,
  verifyOtp,
};