const axios = require("axios");

// ==========================================================
// Message Central Client
// ==========================================================

const messageCentral = axios.create({
  baseURL: "https://cpaas.messagecentral.com",
  timeout: 30000,
  headers: {
    Accept: "*/*",
  },
});

// ==========================================================
// Helper
// ==========================================================

const getProviderErrorMessage = (error) => {
  const data = error?.response?.data;

  return (
    data?.message ||
    data?.errorMessage ||
    data?.error ||
    data?.data?.message ||
    data?.data?.errorMessage ||
    error?.message ||
    "Message Central request failed."
  );
};

// ==========================================================
// Generate Message Central Auth Token
// ==========================================================

const generateAuthToken = async () => {
  try {
    const customerId =
      process.env.MESSAGE_CENTRAL_CUSTOMER_ID;

    const email =
      process.env.MESSAGE_CENTRAL_EMAIL;

    const password =
      process.env.MESSAGE_CENTRAL_PASSWORD;

    const country =
      process.env.MESSAGE_CENTRAL_COUNTRY || "91";

    if (!customerId) {
      throw new Error(
        "MESSAGE_CENTRAL_CUSTOMER_ID is missing."
      );
    }

    if (!email) {
      throw new Error(
        "MESSAGE_CENTRAL_EMAIL is missing."
      );
    }

    if (!password) {
      throw new Error(
        "MESSAGE_CENTRAL_PASSWORD is missing."
      );
    }

    // Message Central requires Base64 encoded password.
    const base64Key = Buffer
      .from(password, "utf8")
      .toString("base64");

    console.log("");
    console.log("====================================");
    console.log("MESSAGE CENTRAL AUTH REQUEST");
    console.log("Customer :", customerId);
    console.log("Email    :", email);
    console.log("Country  :", country);
    console.log("Password : ********");
    console.log("Key      : ********");
    console.log("====================================");

    const response = await messageCentral.get(
      "/auth/v1/authentication/token",
      {
        params: {
          customerId,
          key: base64Key,
          scope: "NEW",
          country,
          email,
        },
      }
    );

    console.log("");
    console.log("====================================");
    console.log("MESSAGE CENTRAL AUTH RESPONSE");
    console.log(
      JSON.stringify(response.data, null, 2)
    );
    console.log("====================================");

    const authToken =
      response.data?.token ||
      response.data?.authToken ||
      response.data?.data?.token ||
      response.data?.data?.authToken;

    if (!authToken) {
      const providerMessage =
        response.data?.error ||
        response.data?.message ||
        "Auth token not found.";

      throw new Error(providerMessage);
    }

    console.log(
      "✅ Message Central auth token generated successfully."
    );

    return authToken;
  } catch (error) {
    console.error("");
    console.error("====================================");
    console.error("MESSAGE CENTRAL AUTH ERROR");
    console.error("====================================");

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

    console.error("====================================");

    const providerMessage =
      getProviderErrorMessage(error);

    const authError = new Error(
      providerMessage
    );

    authError.status =
      error.response?.status || 500;

    authError.response =
      error.response;

    throw authError;
  }
};

// ==========================================================
// Send OTP
// ==========================================================

const sendOtp = async (phone) => {
  try {
    if (!phone) {
      throw new Error(
        "Phone number is required."
      );
    }

    const authToken =
      await generateAuthToken();

    const mobile = String(phone)
      .replace("+91", "")
      .replace(/\D/g, "")
      .trim();

    if (!/^[6-9]\d{9}$/.test(mobile)) {
      throw new Error(
        "Invalid Indian mobile number."
      );
    }

    const customerId =
      process.env.MESSAGE_CENTRAL_CUSTOMER_ID;

    const countryCode =
      process.env.MESSAGE_CENTRAL_COUNTRY ||
      "91";

    console.log("");
    console.log("====================================");
    console.log("MESSAGE CENTRAL SEND OTP");
    console.log("Mobile       :", mobile);
    console.log("Country Code :", countryCode);
    console.log("Customer     :", customerId);
    console.log("====================================");

    const response =
      await messageCentral.post(
        "/verification/v3/send",
        null,
        {
          headers: {
            authToken,
            Accept: "*/*",
          },
          params: {
            customerId,
            countryCode,
            flowType: "SMS",
            mobileNumber: mobile,
            otpLength: 6,
          },
        }
      );

    console.log("");
    console.log("====================================");
    console.log("MESSAGE CENTRAL SEND OTP RESPONSE");
    console.log("Status:", response.status);
    console.log(
      JSON.stringify(
        response.data,
        null,
        2
      )
    );
    console.log("====================================");

    return response.data;
  } catch (error) {
    console.error("");
    console.error(
      "========== MESSAGE CENTRAL SEND OTP ERROR =========="
    );

    if (error.response) {
      console.error(
        "Status:",
        error.response.status
      );

      console.error(
        "Data:",
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

    const sendError =
      new Error(
        getProviderErrorMessage(error)
      );

    sendError.status =
      error.response?.status || 500;

    sendError.response =
      error.response;

    throw sendError;
  }
};

// ==========================================================
// Verify OTP
// ==========================================================

const verifyOtp = async (
  verificationId,
  otp
) => {
  try {
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

    const authToken =
      await generateAuthToken();

    const customerId =
      process.env.MESSAGE_CENTRAL_CUSTOMER_ID;

    console.log("");
    console.log("====================================");
    console.log("MESSAGE CENTRAL VERIFY OTP");
    console.log(
      "Verification ID:",
      verificationId
    );
    console.log(
      "OTP:",
      "******"
    );
    console.log("====================================");

    const response =
      await messageCentral.get(
        "/verification/v3/validateOtp",
        {
          headers: {
            authToken,
            Accept: "*/*",
          },
          params: {
            customerId,
            verificationId:
              String(verificationId),
            code: String(otp),
            flowType: "SMS",
            langid: "en",
          },
          validateStatus: () => true,
        }
      );

    console.log("");
    console.log("====================================");
    console.log(
      "MESSAGE CENTRAL VERIFY RESPONSE"
    );
    console.log(
      "Status:",
      response.status
    );
    console.log(
      JSON.stringify(
        response.data,
        null,
        2
      )
    );
    console.log("====================================");

    if (response.status >= 200 &&
        response.status < 300) {
      return response.data;
    }

    const errorMessage =
      response.data?.message ||
      response.data?.errorMessage ||
      response.data?.error ||
      `Message Central returned HTTP ${response.status}.`;

    throw new Error(
      errorMessage
    );
  } catch (error) {
    console.error("");
    console.error(
      "========== MESSAGE CENTRAL VERIFY OTP ERROR =========="
    );

    if (error.response) {
      console.error(
        "Status:",
        error.response.status
      );

      console.error(
        "Data:",
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
// Exports
// ==========================================================

module.exports = {
  generateAuthToken,
  sendOtp,
  verifyOtp,
};