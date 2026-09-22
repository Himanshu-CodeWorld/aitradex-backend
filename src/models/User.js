const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    // Firebase Authentication UID
    firebaseUid: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },

    // Firebase user information
    displayName: {
      type: String,
      default: "",
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    emailVerified: {
      type: Boolean,
      default: false,
    },

    phoneNumber: {
      type: String,
      default: "",
      trim: true,
    },

    photoURL: {
      type: String,
      default: "",
      trim: true,
    },

    // Firebase account timestamps
    firebaseCreatedAt: {
      type: Date,
      default: null,
    },

    firebaseLastSignInAt: {
      type: Date,
      default: null,
    },

    // MongoDB account status
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
  }
);

// Normalize email before saving
userSchema.pre("save", function (next) {
  if (this.email) {
    this.email = this.email.toLowerCase().trim();
  }

  next();
});

module.exports = mongoose.model("User", userSchema);