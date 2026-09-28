const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    // ========================================================
    // FIREBASE AUTHENTICATION
    // ========================================================

    firebaseUid: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },

    authProvider: {
      type: String,
      enum: ["password", "google", "firebase"],
      default: "firebase",
      index: true,
      trim: true,
    },

    // ========================================================
    // PROFILE
    // ========================================================

    fullName: {
      type: String,
      required: true,
      trim: true,
    },

    username: {
      type: String,
      required: false,
      unique: true,
      sparse: true,
      index: true,
      lowercase: true,
      trim: true,
      minlength: 3,
      maxlength: 20,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      index: true,
      lowercase: true,
      trim: true,
    },

    phoneNumber: {
      type: String,
      required: false,
      unique: true,
      sparse: true,
      index: true,
      trim: true,
    },

    profileImage: {
      type: String,
      default: "",
      trim: true,
    },

    // ========================================================
    // REFERRAL / INVITE
    // ========================================================

    // Every user gets one permanent invite code.
    referralCode: {
      type: String,
      required: true,
      unique: true,
      sparse: true,
      index: true,
      trim: true,
      uppercase: true,
      minlength: 8,
      maxlength: 16,
    },

    // Code used by this user when joining.
    referredBy: {
      type: String,
      default: "",
      trim: true,
      uppercase: true,
      index: true,
    },

    // Number of successfully rewarded friends.
    referralCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Prevents the same new user from receiving/triggering
    // a referral reward more than once.
    referralRewardClaimed: {
      type: Boolean,
      default: false,
      index: true,
    },

    // ========================================================
    // VERIFICATION
    // ========================================================

    emailVerified: {
      type: Boolean,
      default: false,
    },

    phoneVerified: {
      type: Boolean,
      default: false,
    },

    // ========================================================
    // FIREBASE METADATA
    // ========================================================

    firebaseCreatedAt: {
      type: Date,
      default: null,
    },

    firebaseLastSignInAt: {
      type: Date,
      default: null,
    },

    // ========================================================
    // ACCOUNT STATUS
    // ========================================================

    isActive: {
      type: Boolean,
      default: true,
    },

    isBlocked: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

userSchema.pre("validate", function (next) {
  if (this.email) {
    this.email = this.email.toLowerCase().trim();
  }

  if (this.username) {
    this.username = this.username.toLowerCase().trim();
  }

  if (this.phoneNumber) {
    this.phoneNumber = this.phoneNumber.trim();
  }

  if (this.profileImage) {
    this.profileImage = this.profileImage.trim();
  }

  if (this.referralCode) {
    this.referralCode = this.referralCode.trim().toUpperCase();
  }

  if (this.referredBy) {
    this.referredBy = this.referredBy.trim().toUpperCase();
  }

  next();
});

module.exports =
  mongoose.models.User ||
  mongoose.model("User", userSchema);
