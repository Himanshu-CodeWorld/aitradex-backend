const referralService = require("../services/referral.service");

const getFirebaseUid = (req) =>
  req?.user?.uid ||
  req?.user?.firebaseUid ||
  req?.firebaseUser?.uid ||
  req?.firebaseUser?.firebaseUid ||
  req?.auth?.uid ||
  req?.auth?.firebaseUid ||
  null;

// ==========================================================
// GET MY REFERRAL / INVITE DATA
// GET /api/referrals/me
// ==========================================================

const getMyReferral = async (req, res) => {
  try {
    const firebaseUid = getFirebaseUid(req);

    if (!firebaseUid) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized.",
        code: "FIREBASE_UID_MISSING",
      });
    }

    const data =
      await referralService.getReferralProfile(
        firebaseUid,
      );

    return res.status(200).json({
      success: true,
      message:
        "Referral information retrieved successfully.",
      data,
    });
  } catch (error) {
    console.error(
      "GET MY REFERRAL ERROR:",
      error,
    );

    const status =
      error?.code === "USER_NOT_FOUND"
        ? 404
        : 500;

    return res.status(status).json({
      success: false,
      message:
        error?.message ||
        "Failed to retrieve referral information.",
      code:
        error?.code ||
        "REFERRAL_PROFILE_ERROR",
    });
  }
};

// ==========================================================
// VALIDATE REFERRAL CODE
// GET /api/referrals/validate/:code
// ==========================================================

const validateReferral = async (req, res) => {
  try {
    const firebaseUid = getFirebaseUid(req);
    const code = req.params?.code;

    if (!firebaseUid) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized.",
        code: "FIREBASE_UID_MISSING",
      });
    }

    const data =
      await referralService.validateReferralCode({
        code,
        firebaseUid,
      });

    return res.status(200).json({
      success: true,
      message: "Referral code is valid.",
      data,
    });
  } catch (error) {
    const status =
      error?.code === "SELF_REFERRAL"
        ? 400
        : error?.code === "INVALID_REFERRAL_CODE"
          ? 404
          : 400;

    return res.status(status).json({
      success: false,
      message:
        error?.message ||
        "Invalid referral code.",
      code:
        error?.code ||
        "INVALID_REFERRAL_CODE",
    });
  }
};

// ==========================================================
// APPLY REFERRAL CODE
// POST /api/referrals/apply
// Body: { "referralCode": "ATX1234567" }
// ==========================================================

const applyReferral = async (req, res) => {
  try {
    const firebaseUid = getFirebaseUid(req);

    if (!firebaseUid) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized.",
        code: "FIREBASE_UID_MISSING",
      });
    }

    const referralCode =
      req.body?.referralCode ||
      req.body?.code ||
      "";

    const data =
      await referralService.applyReferralCode({
        firebaseUid,
        code: referralCode,
      });

    return res.status(200).json({
      success: true,
      message: data?.alreadyApplied
        ? "Referral code has already been applied."
        : "Referral code applied successfully.",
      data,
    });
  } catch (error) {
    const statusMap = {
      REFERRAL_CODE_REQUIRED: 400,
      INVALID_REFERRAL_CODE: 404,
      SELF_REFERRAL: 400,
      USER_NOT_FOUND: 404,
      USER_BLOCKED: 403,
    };

    return res.status(
      statusMap[error?.code] || 500,
    ).json({
      success: false,
      message:
        error?.message ||
        "Failed to apply referral code.",
      code:
        error?.code ||
        "REFERRAL_APPLY_ERROR",
    });
  }
};

module.exports = {
  getMyReferral,
  validateReferral,
  applyReferral,
};
