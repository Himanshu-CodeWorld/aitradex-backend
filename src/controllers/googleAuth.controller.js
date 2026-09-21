const User = require("../models/User");

const googleAuth = async (
  req,
  res
) => {
  try {
    const firebaseUser =
      req.firebaseUser;

    if (!firebaseUser) {
      return res.status(401).json({
        success: false,
        message: "Firebase user not found.",
      });
    }

    const firebaseUid =
      firebaseUser.uid;

    const email =
      firebaseUser.email || "";

    const fullName =
      firebaseUser.name || "";

    const profileImageUrl =
      firebaseUser.picture || "";

    const emailVerified =
      firebaseUser.email_verified === true;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Google account email is missing.",
      });
    }

    let user =
      await User.findOne({
        firebaseUid,
      });

    const isNewUser =
      !user;

    if (!user) {
      user = await User.create({
        firebaseUid,
        email,
        fullName,
        profileImageUrl,
        provider: "google",
        emailVerified,
        lastLoginAt: new Date(),
      });
    } else {
      user.email = email;
      user.fullName = fullName;
      user.profileImageUrl =
        profileImageUrl;
      user.emailVerified =
        emailVerified;
      user.lastLoginAt =
        new Date();

      await user.save();
    }

    return res.status(
      isNewUser ? 201 : 200
    ).json({
      success: true,
      isNewUser,
      message: isNewUser
        ? "Google account created successfully."
        : "Google account signed in successfully.",
      user: {
        id: user._id,
        firebaseUid: user.firebaseUid,
        email: user.email,
        fullName: user.fullName,
        username: user.username,
        profileImageUrl:
          user.profileImageUrl,
        provider: user.provider,
        emailVerified:
          user.emailVerified,
      },
    });
  } catch (error) {
    console.error(
      "Google authentication error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to synchronize Google account.",
    });
  }
};

module.exports = {
  googleAuth,
};