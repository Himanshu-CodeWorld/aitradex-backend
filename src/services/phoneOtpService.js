const PhoneVerification = require("../models/PhoneVerification");

const {
  sendOtp,
  verifyOtp,
} = require("./messageCentral.service");

// ==========================================================
// NORMALIZE INDIAN PHONE NUMBER
// ==========================================================

const normalizePhoneNumber = (phone) => {
  if (
    phone === undefined ||
    phone === null
  ) {
    return "";
  }

  let normalized =
    String(phone).trim();

  // Remove spaces, hyphens, brackets
  normalized =
    normalized.replace(
      /[\s\-()]/g,
      ""
    );

  // 0091XXXXXXXXXX
  if (
    normalized.startsWith("0091")
  ) {
    normalized =
      `+${normalized.substring(2)}`;
  }

  // 91XXXXXXXXXX
  if (
    normalized.startsWith("91") &&
    normalized.length === 12
  ) {
    normalized =
      `+${normalized}`;
  }

  // XXXXXXXXXX
  if (
    normalized.length === 10 &&
    /^[6-9]\d{9}$/.test(
      normalized
    )
  ) {
    normalized =
      `+91${normalized}`;
  }

  return normalized;
};

// ==========================================================
// VALIDATE INDIAN PHONE NUMBER
// ==========================================================

const isValidIndianPhoneNumber = (
  phone
) => {
  return /^\+91[6-9]\d{9}$/.test(
    phone
  );
};

// ==========================================================
// SEND PHONE OTP
// ==========================================================

const sendPhoneOtp = async (
  phone
) => {
  try {
    phone =
      normalizePhoneNumber(phone);

    if (!phone) {
      throw new Error(
        "Phone number is required."
      );
    }

    if (
      !isValidIndianPhoneNumber(
        phone
      )
    ) {
      throw new Error(
        "Invalid Indian phone number."
      );
    }

    console.log("");
    console.log(
      "===================================="
    );
    console.log(
      "PHONE OTP SERVICE"
    );
    console.log(
      "===================================="
    );
    console.log(
      "Phone:",
      phone
    );

    // ======================================================
    // Remove previous verification
    // ======================================================

    await PhoneVerification.deleteMany({
      phone,
    });

    console.log(
      "Old verification removed."
    );

    // ======================================================
    // Send OTP using Message Central
    // ======================================================

    const response =
      await sendOtp(phone);

    console.log("");
    console.log(
      "========== MESSAGE CENTRAL RESPONSE =========="
    );

    console.log(
      JSON.stringify(
        response,
        null,
        2
      )
    );

    if (!response) {
      throw new Error(
        "Empty response received from Message Central."
      );
    }

    // ======================================================
    // Extract verification ID
    // ======================================================

    const verificationId =
      response?.data
        ?.verificationId ||
      response?.verificationId;

    if (!verificationId) {
      throw new Error(
        "Verification ID not found in Message Central response."
      );
    }

    // ======================================================
    // Extract timeout
    // ======================================================

    const timeout =
      Number(
        response?.data?.timeout
      ) ||
      Number(
        response?.timeout
      ) ||
      300;

    const expiresAt =
      new Date(
        Date.now() +
        timeout * 1000
      );

    // ======================================================
    // Save verification
    // ======================================================

    console.log("");
    console.log(
      "===================================="
    );
    console.log(
      "SAVING PHONE VERIFICATION"
    );
    console.log(
      "===================================="
    );

    const verification =
      new PhoneVerification({
        phone,
        verificationId:
          String(
            verificationId
          ),
        verified: false,
        flowType: "SMS",
        expiresAt,
      });

    await verification.save();

    console.log(
      "PhoneVerification saved successfully."
    );

    console.log(
      "Verification ID:",
      verificationId
    );

    console.log(
      "Expires:",
      expiresAt
    );

    // ======================================================
    // Return
    // ======================================================

    return {
      success: true,
      message:
        "OTP sent successfully.",
      verificationId:
        String(verificationId),
      expiresAt,
    };
  } catch (error) {
    console.error("");
    console.error(
      "===================================="
    );
    console.error(
      "SEND PHONE OTP SERVICE ERROR"
    );
    console.error(
      "===================================="
    );

    console.error(
      "Message:",
      error.message
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
    }

    throw error;
  }
};

// ==========================================================
// VERIFY PHONE OTP
// ==========================================================

const verifyPhoneOtp = async (
  phone,
  otp
) => {
  try {
    phone =
      normalizePhoneNumber(phone);

    otp =
      String(otp).trim();

    // ======================================================
    // Validate
    // ======================================================

    if (!phone || !otp) {
      throw new Error(
        "Phone number and OTP are required."
      );
    }

    if (
      !isValidIndianPhoneNumber(
        phone
      )
    ) {
      throw new Error(
        "Invalid Indian phone number."
      );
    }

    if (!/^\d{6}$/.test(otp)) {
      throw new Error(
        "OTP must be exactly 6 digits."
      );
    }

    console.log("");
    console.log(
      "===================================="
    );
    console.log(
      "VERIFY PHONE OTP SERVICE"
    );
    console.log(
      "===================================="
    );
    console.log(
      "Phone:",
      phone
    );

    // ======================================================
    // Find active verification
    // ======================================================

    const verification =
      await PhoneVerification.findOne({
        phone,
        verified: false,
      }).sort({
        createdAt: -1,
      });

    if (!verification) {
      throw new Error(
        "Verification request not found. Please request a new OTP."
      );
    }

    console.log(
      "Verification ID:",
      verification.verificationId
    );

    // ======================================================
    // Check expiry
    // ======================================================

    if (
      verification.expiresAt &&
      verification.expiresAt < new Date()
    ) {
      await PhoneVerification.deleteOne({
        _id: verification._id,
      });

      throw new Error(
        "OTP expired. Please request a new OTP."
      );
    }

    // ======================================================
    // Verify through Message Central
    // ======================================================

    console.log(
      "Calling Message Central..."
    );

    const response =
      await verifyOtp(
        verification.verificationId,
        otp
      );

    console.log("");
    console.log(
      "========== VERIFY RESPONSE =========="
    );

    console.log(
      JSON.stringify(
        response,
        null,
        2
      )
    );

    if (!response) {
      throw new Error(
        "Message Central returned empty response."
      );
    }

    // ======================================================
    // IMPORTANT
    //
    // Message Central can return HTTP 200 even when
    // OTP is incorrect.
    //
    // The actual success condition is:
    //
    // VERIFICATION_COMPLETED
    // ======================================================

    const verificationStatus =
      response?.data
        ?.verificationStatus ||
      response?.verificationStatus;

    const verified =
      verificationStatus ===
      "VERIFICATION_COMPLETED";

    if (!verified) {
      const errorMessage =
        response?.data
          ?.errorMessage ||
        response?.errorMessage ||
        response?.message ||
        "Invalid OTP. Please try again.";

      throw new Error(
        errorMessage
      );
    }

    // ======================================================
    // Mark verified
    // ======================================================

    verification.verified = true;

    await verification.save();

    console.log(
      "Phone verification marked as verified."
    );

    // ======================================================
    // Delete verification record
    // ======================================================

    await PhoneVerification.deleteOne({
      _id: verification._id,
    });

    console.log(
      "Phone verification record removed."
    );

    // ======================================================
    // Success
    // ======================================================

    return {
      success: true,
      verified: true,
      message:
        "Phone verified successfully.",
    };
  } catch (error) {
    console.error("");
    console.error(
      "===================================="
    );
    console.error(
      "VERIFY PHONE OTP SERVICE ERROR"
    );
    console.error(
      "===================================="
    );

    console.error(
      "Message:",
      error.message
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
    }

    throw error;
  }
};

// ==========================================================
// RESEND PHONE OTP
// ==========================================================

const resendPhoneOtp = async (
  phone
) => {
  return sendPhoneOtp(phone);
};

// ==========================================================
// EXPORT
// ==========================================================

module.exports = {
  sendPhoneOtp,
  verifyPhoneOtp,
  resendPhoneOtp,
};