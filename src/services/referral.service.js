const crypto = require("crypto");
const mongoose = require("mongoose");

const User = require("../models/User");
const Referral = require("../models/Referral");
const CoinWallet = require("../models/CoinWallet");
const CoinTransaction = require("../models/CoinTransaction");

const REFERRAL_REWARD_COINS =
  Math.max(
    1,
    Number(process.env.REFERRAL_REWARD_COINS) || 100,
  );

const CODE_PREFIX = "ATX";
const CODE_ALPHABET =
  "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const normalizeCode = (value) =>
  String(value || "")
    .trim()
    .toUpperCase();

const generateReferralCode = () => {
  let suffix = "";

  for (let i = 0; i < 7; i += 1) {
    suffix +=
      CODE_ALPHABET[
        crypto.randomInt(0, CODE_ALPHABET.length)
      ];
  }

  return `${CODE_PREFIX}${suffix}`;
};

/**
 * Ensure an existing user has a referral code.
 *
 * This is also useful for users created before the referral
 * system was added.
 */
const ensureReferralCode = async (user, options = {}) => {
  const { session = null } = options;

  if (user.referralCode) {
    return user;
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = generateReferralCode();

    const existing = await User.findOne({
      referralCode: code,
      _id: { $ne: user._id },
    }).session(session);

    if (existing) {
      continue;
    }

    user.referralCode = code;
    await user.save(session ? { session } : undefined);
    return user;
  }

  throw new Error(
    "Unable to generate a unique referral code.",
  );
};

const validateReferralCode = async ({
  code,
  firebaseUid = "",
}) => {
  const normalizedCode = normalizeCode(code);

  if (!normalizedCode) {
    const error = new Error(
      "Referral code is required.",
    );
    error.code = "REFERRAL_CODE_REQUIRED";
    throw error;
  }

  const owner = await User.findOne({
    referralCode: normalizedCode,
  }).lean();

  if (!owner) {
    const error = new Error(
      "Invalid referral code.",
    );
    error.code = "INVALID_REFERRAL_CODE";
    throw error;
  }

  if (
    firebaseUid &&
    String(owner.firebaseUid) === String(firebaseUid)
  ) {
    const error = new Error(
      "You cannot use your own referral code.",
    );
    error.code = "SELF_REFERRAL";
    throw error;
  }

  return {
    valid: true,
    referralCode: owner.referralCode,
    referrer: {
      firebaseUid: owner.firebaseUid,
      fullName: owner.fullName,
      username: owner.username || "",
      profileImage: owner.profileImage || "",
    },
    rewardCoins: REFERRAL_REWARD_COINS,
  };
};

const getReferralProfile = async (firebaseUid) => {
  const user = await User.findOne({
    firebaseUid,
  }).lean();

  if (!user) {
    const error = new Error("User not found.");
    error.code = "USER_NOT_FOUND";
    throw error;
  }

  const referralCode = user.referralCode ||
    generateReferralCode();

  // Existing accounts may not have a code. Persist one.
  if (!user.referralCode) {
    await User.updateOne(
      { firebaseUid },
      { $set: { referralCode } },
    );
  }

  const completedReferrals = await Referral.find({
    referrerUid: firebaseUid,
    status: "completed",
  })
    .sort({ createdAt: -1 })
    .lean();

  return {
    referralCode,
    referredBy: user.referredBy || "",
    referralCount: completedReferrals.length,
    rewardCoins: REFERRAL_REWARD_COINS,
    totalCoinsEarned:
      completedReferrals.length *
      REFERRAL_REWARD_COINS,
    referrals: completedReferrals.map((item) => ({
      id: item._id,
      referralCode: item.referralCode,
      rewardCoins: item.rewardCoins,
      rewardedAt: item.rewardedAt,
      referredUid: item.referredUid,
    })),
  };
};

/**
 * Apply a referral code to a user.
 *
 * This operation is idempotent:
 * - a referred user can only have one referrer
 * - a referral record can only exist once per referredUid
 * - the coin transaction is protected by a unique referenceId
 */
const applyReferralCode = async ({
  firebaseUid,
  code,
}) => {
  const normalizedCode = normalizeCode(code);

  if (!firebaseUid) {
    throw new Error("Firebase UID is required.");
  }

  if (!normalizedCode) {
    const error = new Error(
      "Referral code is required.",
    );
    error.code = "REFERRAL_CODE_REQUIRED";
    throw error;
  }

  const session = await mongoose.startSession();

  try {
    let result;

    await session.withTransaction(async () => {
      const referredUser = await User.findOne({
        firebaseUid,
      }).session(session);

      if (!referredUser) {
        const error = new Error(
          "User not found.",
        );
        error.code = "USER_NOT_FOUND";
        throw error;
      }

      if (referredUser.isBlocked) {
        const error = new Error(
          "This account has been blocked.",
        );
        error.code = "USER_BLOCKED";
        throw error;
      }

      // Already applied: return the existing state instead of
      // giving another reward.
      if (
        referredUser.referredBy ||
        referredUser.referralRewardClaimed
      ) {
        const existingReferral =
          await Referral.findOne({
            referredUid: firebaseUid,
          }).session(session);

        result = {
          applied: false,
          alreadyApplied: true,
          referralCode:
            existingReferral?.referralCode ||
            referredUser.referredBy ||
            "",
          rewardCoins:
            Number(
              existingReferral?.rewardCoins,
            ) || REFERRAL_REWARD_COINS,
        };

        return;
      }

      const referrer = await User.findOne({
        referralCode: normalizedCode,
      }).session(session);

      if (!referrer) {
        const error = new Error(
          "Invalid referral code.",
        );
        error.code = "INVALID_REFERRAL_CODE";
        throw error;
      }

      if (
        String(referrer.firebaseUid) ===
        String(firebaseUid)
      ) {
        const error = new Error(
          "You cannot use your own referral code.",
        );
        error.code = "SELF_REFERRAL";
        throw error;
      }

      // This is the idempotency guard for concurrent requests.
      const existingReferral =
        await Referral.findOne({
          referredUid: firebaseUid,
        }).session(session);

      if (existingReferral) {
        referredUser.referredBy =
          existingReferral.referralCode;
        referredUser.referralRewardClaimed = true;
        await referredUser.save({ session });

        result = {
          applied: false,
          alreadyApplied: true,
          referralCode:
            existingReferral.referralCode,
          rewardCoins:
            existingReferral.rewardCoins,
        };

        return;
      }

      const referenceId =
        `REFERRAL:${firebaseUid}`;

      // Create the referral record before crediting coins.
      // The unique referredUid/referenceId prevents duplicate
      // rewards when the client retries.
      const referral = new Referral({
        referrerUid: referrer.firebaseUid,
        referredUid: firebaseUid,
        referralCode: normalizedCode,
        rewardCoins: REFERRAL_REWARD_COINS,
        status: "completed",
        rewardedAt: new Date(),
      });

      await referral.save({ session });

      referredUser.referredBy =
        normalizedCode;
      referredUser.referralRewardClaimed =
        true;
      await referredUser.save({ session });

      // Credit the referrer.
      const referrerWallet =
        await CoinWallet.findOneAndUpdate(
          { firebaseUid: referrer.firebaseUid },
          {
            $inc: {
              balance: REFERRAL_REWARD_COINS,
            },
          },
          {
            new: true,
            upsert: true,
            setDefaultsOnInsert: true,
            session,
          },
        );

      await CoinTransaction.create(
        [
          {
            firebaseUid:
              referrer.firebaseUid,
            type: "referral_bonus",
            amount:
              REFERRAL_REWARD_COINS,
            balanceAfter:
              referrerWallet.balance,
            amountInr:
              REFERRAL_REWARD_COINS,
            description:
              "Referral bonus for inviting a friend",
            referenceId,
          },
        ],
        { session },
      );

      // Credit the new/referred user.
      const referredWallet =
        await CoinWallet.findOneAndUpdate(
          { firebaseUid },
          {
            $inc: {
              balance: REFERRAL_REWARD_COINS,
            },
          },
          {
            new: true,
            upsert: true,
            setDefaultsOnInsert: true,
            session,
          },
        );

      await CoinTransaction.create(
        [
          {
            firebaseUid,
            type: "referral_bonus",
            amount:
              REFERRAL_REWARD_COINS,
            balanceAfter:
              referredWallet.balance,
            amountInr:
              REFERRAL_REWARD_COINS,
            description:
              "Welcome bonus for joining with a referral",
            referenceId,
          },
        ],
        { session },
      );

      await User.updateOne(
        { firebaseUid: referrer.firebaseUid },
        {
          $inc: {
            referralCount: 1,
          },
        },
        { session },
      );

      result = {
        applied: true,
        alreadyApplied: false,
        referralCode: normalizedCode,
        rewardCoins: REFERRAL_REWARD_COINS,
        referrerBalance:
          referrerWallet.balance,
        referredUserBalance:
          referredWallet.balance,
        referralId: referral._id,
      };
    });

    return result;
  } catch (error) {
    // If the client retries after a completed referral, return
    // the idempotent result instead of reporting a duplicate.
    if (error?.code === 11000) {
      const existing =
        await Referral.findOne({
          referredUid: firebaseUid,
        }).lean();

      if (existing) {
        return {
          applied: false,
          alreadyApplied: true,
          referralCode:
            existing.referralCode,
          rewardCoins:
            existing.rewardCoins,
        };
      }
    }

    throw error;
  } finally {
    await session.endSession();
  }
};

module.exports = {
  REFERRAL_REWARD_COINS,
  normalizeCode,
  generateReferralCode,
  ensureReferralCode,
  validateReferralCode,
  getReferralProfile,
  applyReferralCode,
};
