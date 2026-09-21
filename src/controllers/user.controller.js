const User = require("../models/User");
const bcrypt = require("bcryptjs");

// ==========================================================
// GET PROFILE
// GET /api/user/profile
// ==========================================================

exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("-mpin");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    return res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error("Get Profile Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ==========================================================
// UPDATE PROFILE
// PUT /api/user/profile
// ==========================================================

exports.updateProfile = async (req, res) => {
  try {
    const {
      fullName,
      gender,
      dob,
      birthPlace,
      occupation,
      monthlyIncome,
      companyName,
      jobTitle,
      investmentGoal,
      investmentExperience,
      address,
      city,
      state,
      pincode,
      profileImage,
    } = req.body;

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    if (fullName !== undefined) user.fullName = fullName;
    if (gender !== undefined) user.gender = gender;
    if (dob !== undefined) user.dob = dob;
    if (birthPlace !== undefined) user.birthPlace = birthPlace;

    if (occupation !== undefined) user.occupation = occupation;
    if (monthlyIncome !== undefined)
      user.monthlyIncome = monthlyIncome;
    if (companyName !== undefined)
      user.companyName = companyName;
    if (jobTitle !== undefined)
      user.jobTitle = jobTitle;

    if (investmentGoal !== undefined)
      user.investmentGoal = investmentGoal;

    if (investmentExperience !== undefined)
      user.investmentExperience =
        investmentExperience;

    if (address !== undefined) user.address = address;
    if (city !== undefined) user.city = city;
    if (state !== undefined) user.state = state;
    if (pincode !== undefined) user.pincode = pincode;

    if (profileImage !== undefined)
      user.profileImage = profileImage;

    await user.save();

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully.",
      data: user,
    });
  } catch (error) {
    console.error("Update Profile Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ==========================================================
// UPDATE BANK DETAILS
// PUT /api/user/bank
// ==========================================================

exports.updateBankDetails = async (req, res) => {
  try {
    const {
      bankName,
      accountHolderName,
      accountNumber,
      ifscCode,
      accountType,
    } = req.body;

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    if (bankName !== undefined)
      user.bankName = bankName;

    if (accountHolderName !== undefined)
      user.accountHolderName =
        accountHolderName;

    if (accountNumber !== undefined)
      user.accountNumber = accountNumber;

    if (ifscCode !== undefined)
      user.ifscCode = ifscCode;

    if (accountType !== undefined)
      user.accountType = accountType;

    await user.save();

    return res.status(200).json({
      success: true,
      message: "Bank details updated successfully.",
      data: user,
    });
  } catch (error) {
    console.error("Bank Update Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ==========================================================
// UPDATE NOMINEE
// PUT /api/user/nominee
// ==========================================================

exports.updateNominee = async (req, res) => {
  try {
    const {
      nomineeName,
      nomineeDob,
      nomineeRelation,
    } = req.body;

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    if (nomineeName !== undefined)
      user.nomineeName = nomineeName;

    if (nomineeDob !== undefined)
      user.nomineeDob = nomineeDob;

    if (nomineeRelation !== undefined)
      user.nomineeRelation =
        nomineeRelation;

    await user.save();

    return res.status(200).json({
      success: true,
      message: "Nominee updated successfully.",
      data: user,
    });
  } catch (error) {
    console.error("Nominee Update Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ==========================================================
// UPDATE FCM TOKEN
// PUT /api/user/fcm-token
// ==========================================================

exports.updateFcmToken = async (req, res) => {
  try {
    const { fcmToken, deviceType } = req.body;

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    if (fcmToken !== undefined)
      user.fcmToken = fcmToken;

    if (deviceType !== undefined)
      user.deviceType = deviceType;

    await user.save();

    return res.status(200).json({
      success: true,
      message: "FCM token updated successfully.",
    });
  } catch (error) {
    console.error("FCM Update Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ==========================================================
// UPDATE KYC DETAILS
// PUT /api/user/kyc
// ==========================================================

exports.updateKyc = async (req, res) => {
  try {
    const {
      panNumber,
      aadhaarNumber,
    } = req.body;

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    if (panNumber !== undefined)
      user.panNumber = panNumber.toUpperCase();

    if (aadhaarNumber !== undefined)
      user.aadhaarNumber = aadhaarNumber;

    await user.save();

    return res.status(200).json({
      success: true,
      message: "KYC updated successfully.",
      data: user,
    });

  } catch (error) {

    console.error("Update KYC Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });

  }
};

// ==========================================================
// UPLOAD PAN
// PUT /api/user/upload-pan
// ==========================================================

exports.uploadPan = async (req, res) => {
  try {

    const { panImageUrl } = req.body;

    if (!panImageUrl) {
      return res.status(400).json({
        success: false,
        message: "PAN image URL is required.",
      });
    }

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    user.panImageUrl = panImageUrl;

    await user.save();

    return res.status(200).json({
      success: true,
      message: "PAN uploaded successfully.",
      imageUrl: user.panImageUrl,
    });

  } catch (error) {

    console.error("PAN Upload Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });

  }
};

// ==========================================================
// UPLOAD AADHAAR
// PUT /api/user/upload-aadhaar
// ==========================================================

exports.uploadAadhaar = async (req, res) => {
  try {

    const {
      aadhaarFrontUrl,
      aadhaarBackUrl,
    } = req.body;

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    if (aadhaarFrontUrl)
      user.aadhaarFrontUrl = aadhaarFrontUrl;

    if (aadhaarBackUrl)
      user.aadhaarBackUrl = aadhaarBackUrl;

    await user.save();

    return res.status(200).json({
      success: true,
      message: "Aadhaar uploaded successfully.",
      frontImage: user.aadhaarFrontUrl,
      backImage: user.aadhaarBackUrl,
    });

  } catch (error) {

    console.error("Aadhaar Upload Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });

  }
};

// ==========================================================
// UPLOAD SELFIE
// PUT /api/user/upload-selfie
// ==========================================================

exports.uploadSelfie = async (req, res) => {
  try {

    const { selfieUrl } = req.body;

    if (!selfieUrl) {
      return res.status(400).json({
        success: false,
        message: "Selfie URL is required.",
      });
    }

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    user.selfieUrl = selfieUrl;

    await user.save();

    return res.status(200).json({
      success: true,
      message: "Selfie uploaded successfully.",
      imageUrl: user.selfieUrl,
    });

  } catch (error) {

    console.error("Selfie Upload Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });

  }
};

// ==========================================================
// UPLOAD SIGNATURE
// PUT /api/user/upload-signature
// ==========================================================

exports.uploadSignature = async (req, res) => {
  try {

    const { signatureUrl } = req.body;

    if (!signatureUrl) {
      return res.status(400).json({
        success: false,
        message: "Signature URL is required.",
      });
    }

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    user.signatureUrl = signatureUrl;

    await user.save();

    return res.status(200).json({
      success: true,
      message: "Signature uploaded successfully.",
      imageUrl: user.signatureUrl,
    });

  } catch (error) {

    console.error("Signature Upload Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });

  }
};


// ==========================================================
// CHANGE MPIN
// PUT /api/user/change-mpin
// ==========================================================

exports.changeMpin = async (req, res) => {
  try {
    const { currentMpin, newMpin } = req.body;

    if (!currentMpin || !newMpin) {
      return res.status(400).json({
        success: false,
        message: "Current MPIN and New MPIN are required.",
      });
    }

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    const isMatch = await bcrypt.compare(
      currentMpin,
      user.mpin
    );

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Current MPIN is incorrect.",
      });
    }

    user.mpin = await bcrypt.hash(newMpin, 10);

    await user.save();

    return res.status(200).json({
      success: true,
      message: "MPIN changed successfully.",
    });

  } catch (error) {

    console.error("Change MPIN Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });

  }
};

// ==========================================================
// DELETE ACCOUNT
// DELETE /api/user/delete
// ==========================================================

exports.deleteAccount = async (req, res) => {
  try {
    // req.user is created by authMiddleware
    const userId = req.user?._id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    // Permanently delete the MongoDB account
    await User.findByIdAndDelete(userId);

    console.log(
      `ACCOUNT DELETED: ${userId}`
    );

    return res.status(200).json({
      success: true,
      message: "Account deleted permanently.",
    });
  } catch (error) {
    console.error(
      "Delete Account Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to delete account.",
    });
  }
};

// ==========================================================
// DASHBOARD
// GET /api/user/dashboard
// ==========================================================

exports.getDashboard = async (req, res) => {
  try {

    const user = await User.findById(req.user._id).select("-mpin");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        profile: user,

        completion: {
          personal:
            !!user.fullName &&
            !!user.gender &&
            !!user.dob,

          kyc:
            !!user.panNumber &&
            !!user.aadhaarNumber,

          bank:
            !!user.bankName &&
            !!user.accountNumber,

          nominee:
            !!user.nomineeName,

          verified: user.kycVerified,
        },
      },
    });

  } catch (error) {

    console.error("Dashboard Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });

  }
};

// ==========================================================
// ACCOUNT STATUS
// GET /api/user/account-status
// ==========================================================

exports.getAccountStatus = async (req, res) => {
  try {

    const user = await User.findById(req.user._id).select(
      "accountStatus emailVerified phoneVerified kycVerified"
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    return res.status(200).json({
      success: true,
      data: user,
    });

  } catch (error) {

    console.error("Account Status Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });

  }
};