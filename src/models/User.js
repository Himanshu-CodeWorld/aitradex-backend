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
      required: true,
      unique: true,
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
      required: true,
      unique: true,
      index: true,
      trim: true,
    },

    profileImage: {
      type: String,
      default: "",
      trim: true,
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

userSchema.pre("save", function (next) {
  if (this.email) {
    this.email = this.email
      .toLowerCase()
      .trim();
  }

  if (this.username) {
    this.username = this.username
      .toLowerCase()
      .trim();
  }

  next();
});

module.exports = mongoose.model(
  "User",
  userSchema,
);