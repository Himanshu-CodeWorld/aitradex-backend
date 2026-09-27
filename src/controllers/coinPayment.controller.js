const crypto = require("crypto");
const Razorpay = require("razorpay");

const CoinPurchase = require("../models/CoinPurchase");
const CoinTransaction = require("../models/CoinTransaction");
const coinService = require("../services/coin.service");

const MIN_AMOUNT_INR = 10;
const MAX_AMOUNT_INR = 50000;
const COIN_VALUE_INR = 1;

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

function getFirebaseUid(req) {
  return (
    req.user?.uid ||
    req.user?.firebaseUid ||
    req.firebaseUser?.uid ||
    null
  );
}

function isValidSignature(orderId, paymentId, signature) {
  const secret = process.env.RAZORPAY_KEY_SECRET;

  if (!secret) return false;

  const generated = crypto
    .createHmac("sha256", secret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");

  const provided = Buffer.from(String(signature), "utf8");
  const expected = Buffer.from(generated, "utf8");

  if (provided.length !== expected.length) {
    return false;
  }

  return crypto.timingSafeEqual(expected, provided);
}

async function createOrder(req, res) {
  try {
    const firebaseUid = getFirebaseUid(req);

    if (!firebaseUid) {
      return res.status(401).json({
        success: false,
        message: "Authenticated user not found.",
      });
    }

    const amountInr = Number(req.body?.amountInr);

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

    const { keyId, client } = getRazorpay();

    const coins = amountInr / COIN_VALUE_INR;
    const receipt = `coin_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 8)}`;

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

    await CoinPurchase.create({
      firebaseUid,
      orderId: order.id,
      amountInr,
      coins,
      currency: "INR",
      status: "created",
    });

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
    console.error("CREATE COIN ORDER ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to create coin payment order.",
    });
  }
}

async function verifyPayment(req, res) {
  try {
    const firebaseUid = getFirebaseUid(req);

    if (!firebaseUid) {
      return res.status(401).json({
        success: false,
        message: "Authenticated user not found.",
      });
    }

    const orderId = String(req.body?.orderId || "").trim();
    const paymentId = String(req.body?.paymentId || "").trim();
    const signature = String(req.body?.signature || "").trim();

    if (!orderId || !paymentId || !signature) {
      return res.status(400).json({
        success: false,
        message: "orderId, paymentId and signature are required.",
      });
    }

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

    if (purchase.status === "paid") {
      const balance = await coinService.getBalance(firebaseUid);

      return res.status(200).json({
        success: true,
        message: "Coin payment was already verified.",
        data: {
          coinsAdded: purchase.coins,
          balance,
          alreadyProcessed: true,
        },
      });
    }

    if (!isValidSignature(orderId, paymentId, signature)) {
      purchase.status = "failed";
      await purchase.save();

      return res.status(400).json({
        success: false,
        message: "Payment signature verification failed.",
      });
    }

    // Prevent a duplicate credit if the client retries verification.
    const existingTransaction = await CoinTransaction.findOne({
      firebaseUid,
      type: "purchase",
      referenceId: orderId,
    });

    if (existingTransaction) {
      purchase.paymentId = paymentId;
      purchase.status = "paid";
      await purchase.save();

      const balance = await coinService.getBalance(firebaseUid);

      return res.status(200).json({
        success: true,
        message: "Coin payment was already credited.",
        data: {
          coinsAdded: purchase.coins,
          balance,
          alreadyProcessed: true,
        },
      });
    }

    const result = await coinService.creditCoins({
      firebaseUid,
      amount: purchase.coins,
      type: "purchase",
      description: `Purchased ${purchase.coins} AiTradeX Coins`,
      referenceId: orderId,
      amountInr: purchase.amountInr,
    });

    purchase.paymentId = paymentId;
    purchase.status = "paid";
    await purchase.save();

    return res.status(200).json({
      success: true,
      message: `${purchase.coins} AiTradeX Coins added successfully.`,
      data: {
        coinsAdded: purchase.coins,
        balance:
          result?.balance ??
          result?.wallet?.balance ??
          (await coinService.getBalance(firebaseUid)),
        amountInr: purchase.amountInr,
        paymentId,
        orderId,
        alreadyProcessed: false,
      },
    });
  } catch (error) {
    console.error("VERIFY COIN PAYMENT ERROR:", error);

    return res.status(500).json({
      success: false,
      message:
        "Payment was received, but coin crediting could not be completed. Please contact support.",
    });
  }
}

module.exports = {
  createOrder,
  verifyPayment,
};
