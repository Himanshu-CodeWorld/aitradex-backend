const axios = require("axios");

// ==========================================================
// MESSAGE CENTRAL CONFIGURATION
// ==========================================================

const MESSAGE_CENTRAL_BASE_URL =
  "https://cpaas.messagecentral.com";

// ==========================================================
// ENVIRONMENT VARIABLES
// ==========================================================

const CUSTOMER_ID = process.env.MESSAGE_CENTRAL_CUSTOMER_ID;
const EMAIL = process.env.MESSAGE_CENTRAL_EMAIL;
const PASSWORD = process.env.MESSAGE_CENTRAL_PASSWORD;

// ==========================================================
// VALIDATE CONFIGURATION
// ==========================================================

const validateConfig = () => {
  const missing = [];

  if (!CUSTOMER_ID) {
    missing.push("MESSAGE_CENTRAL_CUSTOMER_ID");
  }

  if (!EMAIL) {
    missing.push("MESSAGE_CENTRAL_EMAIL");
  }

  if (!PASSWORD) {
    missing.push("MESSAGE_CENTRAL_PASSWORD");
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing Message Central environment variables: ${missing.join(", ")}`
    );
  }
};

// ==========================================================
// GENERATE AUTH TOKEN
// ==========================================================

const generateAuthToken = async () => {
  try {
    validateConfig();

    console.log("");
    console.log("====================================");
    console.log("MESSAGE CENTRAL AUTH REQUEST");
    console.log("====================================");

    console.log("Customer :", CUSTOMER_ID);
    console.log("Email    :", EMAIL);
    console.log("Country  : 91");

    // Message Central requires the password to be
    // Base64 encoded and sent as the `key` parameter.
    const encodedPassword =
      Buffer.from(PASSWORD, "utf8").toString("base64");

    const response = await axios.get(
      `${MESSAGE_CENTRAL_BASE_URL}/auth/v1/authentication/token`,
      {
        params: {
          customerId: CUSTOMER_ID,
          key: encodedPassword,
          scope: "NEW",
          country: "91",
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

    console.log({
      status: response.status,
      hasToken: Boolean(response.data?.token),
    });

    if (!response.data?.token) {
      console.error(
        "Message Central response:",
        JSON.stringify(response.data, null, 2)
      );

      throw new Error(
        response.data?.message ||
          response.data?.error ||
          "Message Central authentication failed."
      );
    }

    console.log("");
    console.log("Message Central authentication successful.");

    return response.data.token;
  } catch (error) {
    console.log("");
    console.log("====================================");
    console.log("MESSAGE CENTRAL AUTH ERROR");
    console.log("====================================");

    if (error.response) {
      console.error(
        "Status:",
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
      "Message Central authentication failed."
    );
  }
};

// ==========================================================
// SEND OTP
// ==========================================================

const sendOtp = async (phone) => {
  try {
    phone = String(phone).trim();

    if (!phone) {
      throw new Error(
        "Phone number is required."
      );
    }

    // Remove + from +919328097349
    // Message Central expects countryCode separately.
    let mobileNumber = phone;

    if (mobileNumber.startsWith("+91")) {
      mobileNumber = mobileNumber.substring(3);
    } else if (mobileNumber.startsWith("91")) {
      mobileNumber = mobileNumber.substring(2);
    }

    mobileNumber = mobileNumber.replace(/\D/g, "");

    if (!/^[6-9]\d{9}$/.test(mobileNumber)) {
      throw new Error(
        "Invalid Indian mobile number."
      );
    }

    console.log("");
    console.log("====================================");
    console.log("MESSAGE CENTRAL SEND OTP");
    console.log("====================================");

    console.log(
      "Mobile:",
      mobileNumber
    );

    // Generate authentication token
    const authToken =
      await generateAuthToken();

    console.log(
      "Auth token generated successfully."
    );

    const response = await axios.post(
      `${MESSAGE_CENTRAL_BASE_URL}/verification/v3/send`,
      null,
      {
        params: {
          countryCode: "91",
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
    console.log("====================================");
    console.log("MESSAGE CENTRAL SEND OTP RESPONSE");
    console.log("====================================");

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

    return response.data;
  } catch (error) {
    console.log("");
    console.log(
      "========== MESSAGE CENTRAL SEND OTP ERROR =========="
    );

    if (error.response) {
      console.error(
        "Status:",
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

    throw error;
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
    verificationId =
      String(verificationId).trim();

    otp = String(otp).trim();

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

    console.log("");
    console.log("====================================");
    console.log("MESSAGE CENTRAL VERIFY OTP");
    console.log("====================================");

    console.log(
      "Verification ID:",
      verificationId
    );

    // Generate authentication token
    const authToken =
      await generateAuthToken();

    const response = await axios.post(
      `${MESSAGE_CENTRAL_BASE_URL}/verification/v3/validateOtp`,
      null,
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
    console.log("====================================");
    console.log("MESSAGE CENTRAL VERIFY RESPONSE");
    console.log("====================================");

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
      "========== MESSAGE CENTRAL VERIFY OTP ERROR =========="
    );

    if (error.response) {
      console.error(
        "Status:",
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

    throw error;
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