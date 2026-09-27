const crypto = require("crypto");
const Razorpay = require("razorpay");

const CoinPurchase = require("../models/CoinPurchase");
const CoinTransaction = require("../models/CoinTransaction");
const coinService = require("../services/coin.service");

// ==========================================================
// CONFIG
// ==========================================================

const MIN_AMOUNT_INR = 10;
const MAX_AMOUNT_INR = 50000;
const COIN_VALUE_INR = 1;

// ==========================================================
// FIREBASE UID HELPER
// ==========================================================

function getFirebaseUid(req) {
  return (
    req?.user?.uid ||
    req?.user?.firebaseUid ||
    req?.firebaseUser?.uid ||
    req?.firebaseUser?.firebaseUid ||
    req?.auth?.uid ||
    req?.auth?.firebaseUid ||
    null
  );
}

// ==========================================================
// RAZORPAY
// ==========================================================

function getRazorpay() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    throw new Error(
      "Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET."
    );
  }

  return {
    keyId,
    client: new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    }),
  };
}

// ==========================================================
// RAZORPAY SIGNATURE VERIFICATION
// ==========================================================

function isValidSignature(orderId, paymentId, signature) {
  const secret = process.env.RAZORPAY_KEY_SECRET;

  if (!secret) {
    return false;
  }

  if (!orderId || !paymentId || !signature) {
    return false;
  }

  const generatedSignature = crypto
    .createHmac("sha256", secret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");

  const provided = Buffer.from(String(signature), "utf8");
  const expected = Buffer.from(generatedSignature, "utf8");

  if (provided.length !== expected.length) {
    return false;
  }

  return crypto.timingSafeEqual(expected, provided);
}

// ==========================================================
// CREATE COIN PAYMENT ORDER
//
// POST /api/coins/payment/create-order
// ==========================================================

async function createOrder(req, res) {
  try {
    // IMPORTANT:
    // This must be INSIDE the request handler.
    const firebaseUid = getFirebaseUid(req);

    if (!firebaseUid) {
      return res.status(401).json({
        success: false,
        message: "Authenticated user not found.",
      });
    }

    const amountInr = Number(req.body?.amountInr);

    // ------------------------------------------------------
    // Validate amount
    // ------------------------------------------------------

    if (
      !Number.isInteger(amountInr) ||
      amountInr < MIN_AMOUNT_INR ||
      amountInr > MAX_AMOUNT_INR
    ) {
      return res.status(400).json({
        success: false,
        message:
          `Coin purchase amount must be between ₹${MIN_AMOUNT_INR} and ₹${MAX_AMOUNT_INR}.`,
      });
    }

    // ------------------------------------------------------
    // Razorpay
    // ------------------------------------------------------

    const { keyId, client } = getRazorpay();

    // 1 Coin = ₹1
    const coins = amountInr / COIN_VALUE_INR;

    const receipt =
      `coin_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2, 8)}`;

    // ------------------------------------------------------
    // Create Razorpay order
    // ------------------------------------------------------

    const order = await client.orders.create({
      amount: amountInr * 100,
      currency: "INR",
      receipt,
      notes: {
        purpose: "AiTradeX coin purchase",
        firebaseUid,
        coins: String(coins),
      },
    });

    // ------------------------------------------------------
    // Save purchase
    // ------------------------------------------------------

    await CoinPurchase.create({
      firebaseUid,
      orderId: order.id,
      amountInr,
      coins,
      currency: "INR",
      status: "created",
    });

    console.log(
      "COIN ORDER CREATED:",
      JSON.stringify({
        firebaseUid,
        orderId: order.id,
        amountInr,
        coins,
      })
    );

    // ------------------------------------------------------
    // Response
    // ------------------------------------------------------

    return res.status(201).json({
      success: true,
      message: "Coin payment order created.",
      data: {
        keyId,
        orderId: order.id,
        amount: order.amount,
        amountInr,
        coins,
        currency: order.currency,
      },
    });
  } catch (error) {
    console.error(
      "CREATE COIN ORDER ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Unable to create coin payment order.",
    });
  }
}

// ==========================================================
// VERIFY COIN PAYMENT
//
// POST /api/coins/payment/verify
// ==========================================================

async function verifyPayment(req, res) {
  try {
    // IMPORTANT:
    // This must also be INSIDE the request handler.
    const firebaseUid = getFirebaseUid(req);

    if (!firebaseUid) {
      return res.status(401).json({
        success: false,
        message: "Authenticated user not found.",
      });
    }

    const orderId = String(
      req.body?.orderId || ""
    ).trim();

    const paymentId = String(
      req.body?.paymentId || ""
    ).trim();

    const signature = String(
      req.body?.signature || ""
    ).trim();

    // ------------------------------------------------------
    // Validate request
    // ------------------------------------------------------

    if (!orderId || !paymentId || !signature) {
      return res.status(400).json({
        success: false,
        message:
          "orderId, paymentId and signature are required.",
      });
    }

    // ------------------------------------------------------
    // Find purchase
    // ------------------------------------------------------

    const purchase = await CoinPurchase.findOne({
      orderId,
      firebaseUid,
    });

    if (!purchase) {
      return res.status(404).json({
        success: false,
        message: "Coin payment order not found.",
      });
    }

    // ------------------------------------------------------
    // Already paid
    // ------------------------------------------------------

    if (purchase.status === "paid") {
      const balanceData =
        await coinService.getBalance(firebaseUid);

      const balance =
        Number(
          balanceData?.balance ??
          balanceData?.wallet?.balance ??
          0
        );

      return res.status(200).json({
        success: true,
        message: "Coin payment was already verified.",
        data: {
          coinsAdded: purchase.coins,
          balance,
          amountInr: purchase.amountInr,
          orderId,
          paymentId:
            purchase.paymentId || paymentId,
          alreadyProcessed: true,
        },
      });
    }

    // ------------------------------------------------------
    // Verify Razorpay signature
    // ------------------------------------------------------

    const validSignature = isValidSignature(
      orderId,
      paymentId,
      signature
    );

    if (!validSignature) {
      purchase.status = "failed";
      await purchase.save();

      console.error(
        "INVALID RAZORPAY SIGNATURE:",
        {
          firebaseUid,
          orderId,
          paymentId,
        }
      );

      return res.status(400).json({
        success: false,
        message:
          "Payment signature verification failed.",
      });
    }

    // ------------------------------------------------------
    // Prevent duplicate transaction
    // ------------------------------------------------------

    const existingTransaction =
      await CoinTransaction.findOne({
        firebaseUid,
        type: "purchase",
        referenceId: orderId,
      });

    if (existingTransaction) {
      purchase.paymentId = paymentId;
      purchase.status = "paid";

      await purchase.save();

      const balanceData =
        await coinService.getBalance(firebaseUid);

      const balance =
        Number(
          balanceData?.balance ??
          balanceData?.wallet?.balance ??
          0
        );

      return res.status(200).json({
        success: true,
        message:
          "Coin payment was already credited.",
        data: {
          coinsAdded: purchase.coins,
          balance,
          amountInr: purchase.amountInr,
          paymentId,
          orderId,
          alreadyProcessed: true,
        },
      });
    }

    // ------------------------------------------------------
    // CREDIT COINS
    //
    // IMPORTANT:
    // Coins are credited ONLY after:
    //
    // 1. Firebase authentication
    // 2. Purchase belongs to Firebase UID
    // 3. Razorpay signature verification
    //
    // ------------------------------------------------------

    const result =
      await coinService.creditCoins({
        firebaseUid,
        amount: purchase.coins,
        type: "purchase",
        description:
          `Purchased ${purchase.coins} AiTradeX Coins`,
        referenceId: orderId,
        amountInr: purchase.amountInr,
      });

    // ------------------------------------------------------
    // Mark purchase as paid
    // ------------------------------------------------------

    purchase.paymentId = paymentId;
    purchase.status = "paid";

    await purchase.save();

    const balance =
      Number(
        result?.balance ??
        result?.wallet?.balance ??
        0
      );

    console.log(
      "COINS CREDITED:",
      JSON.stringify({
        firebaseUid,
        orderId,
        paymentId,
        coinsAdded: purchase.coins,
        balance,
      })
    );

    // ------------------------------------------------------
    // Response
    // ------------------------------------------------------

    return res.status(200).json({
      success: true,
      message:
        `${purchase.coins} AiTradeX Coins added successfully.`,
      data: {
        coinsAdded: purchase.coins,
        balance,
        amountInr: purchase.amountInr,
        paymentId,
        orderId,
        alreadyProcessed: false,
      },
    });
  } catch (error) {
    console.error(
      "VERIFY COIN PAYMENT ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Payment was received, but coin crediting could not be completed. Please contact support.",
    });
  }
}

// ==========================================================
// EXPORTS
// ==========================================================

module.exports = {
  createOrder,
  verifyPayment,
};