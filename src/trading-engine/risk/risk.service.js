"use strict";

const DEFAULT_RISK_PERCENT = 1;
const DEFAULT_MAX_POSITION_PERCENT = 20;
const DEFAULT_MAX_PORTFOLIO_EXPOSURE_PERCENT = 80;
const DEFAULT_MAX_PORTFOLIO_RISK_PERCENT = 5;

function apiError(message, statusCode = 400, code = "RISK_VALIDATION_ERROR") {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function positiveNumber(value, field) {
  const parsed = numberOrNull(value);
  if (!(parsed > 0)) {
    throw apiError(`${field} must be a positive number.`, 400, `INVALID_${field.replace(/[^A-Z0-9]/gi, "_").toUpperCase()}`);
  }
  return parsed;
}

function percentage(value, fallback, field, min = 0.01, max = 100) {
  const parsed = numberOrNull(value) ?? fallback;
  if (parsed < min || parsed > max) {
    throw apiError(`${field} must be between ${min} and ${max} percent.`, 400, `INVALID_${field.toUpperCase()}`);
  }
  return parsed;
}

function round(value, places = 2) {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** places;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function calculateRisk(input = {}) {
  const accountBalance = positiveNumber(input.accountBalance, "accountBalance");
  const entryPrice = positiveNumber(input.entryPrice, "entryPrice");
  const stopLoss = positiveNumber(input.stopLoss, "stopLoss");
  const direction = String(input.direction || "LONG").trim().toUpperCase();

  if (!["LONG", "SHORT"].includes(direction)) {
    throw apiError("direction must be LONG or SHORT.", 400, "INVALID_DIRECTION");
  }

  if (direction === "LONG" && stopLoss >= entryPrice) {
    throw apiError("For a LONG position, stopLoss must be below entryPrice.", 400, "INVALID_STOP_LOSS");
  }
  if (direction === "SHORT" && stopLoss <= entryPrice) {
    throw apiError("For a SHORT position, stopLoss must be above entryPrice.", 400, "INVALID_STOP_LOSS");
  }

  const riskPercent = percentage(input.riskPercent, DEFAULT_RISK_PERCENT, "riskPercent", 0.1, 5);
  const maxPositionPercent = percentage(input.maxPositionPercent, DEFAULT_MAX_POSITION_PERCENT, "maxPositionPercent", 1, 100);
  const maxPortfolioExposurePercent = percentage(
    input.maxPortfolioExposurePercent,
    DEFAULT_MAX_PORTFOLIO_EXPOSURE_PERCENT,
    "maxPortfolioExposurePercent",
    1,
    100
  );
  const maxPortfolioRiskPercent = percentage(
    input.maxPortfolioRiskPercent,
    DEFAULT_MAX_PORTFOLIO_RISK_PERCENT,
    "maxPortfolioRiskPercent",
    0.1,
    20
  );

  const riskAmount = accountBalance * riskPercent / 100;
  const riskPerUnit = Math.abs(entryPrice - stopLoss);
  if (!(riskPerUnit > 0)) {
    throw apiError("Entry and stop-loss must be different.", 400, "INVALID_RISK_PER_UNIT");
  }

  const maxRiskQuantity = Math.floor(riskAmount / riskPerUnit);
  const positionValueCap = accountBalance * maxPositionPercent / 100;
  const maxCapitalQuantity = Math.floor(positionValueCap / entryPrice);
  const recommendedQuantity = Math.max(0, Math.min(maxRiskQuantity, maxCapitalQuantity));

  const openPositions = Array.isArray(input.openPositions) ? input.openPositions : [];
  if (openPositions.length > 100) {
    throw apiError("openPositions may contain at most 100 positions.", 400, "TOO_MANY_OPEN_POSITIONS");
  }

  let existingExposure = 0;
  let existingRisk = 0;
  for (let index = 0; index < openPositions.length; index += 1) {
    const position = openPositions[index];
    if (!position || typeof position !== "object" || Array.isArray(position)) {
      throw apiError(`openPositions[${index}] must be an object.`, 400, "INVALID_OPEN_POSITION");
    }
    const marketValue = numberOrNull(position.marketValue);
    const positionRisk = numberOrNull(position.riskAmount);
    if (marketValue === null || marketValue < 0) {
      throw apiError(`openPositions[${index}].marketValue must be zero or positive.`, 400, "INVALID_EXISTING_EXPOSURE");
    }
    if (positionRisk !== null && positionRisk < 0) {
      throw apiError(`openPositions[${index}].riskAmount cannot be negative.`, 400, "INVALID_EXISTING_RISK");
    }
    existingExposure += marketValue;
    existingRisk += positionRisk ?? 0;
  }

  const proposedQuantityInput = numberOrNull(input.quantity);
  if (proposedQuantityInput !== null &&
      (!Number.isInteger(proposedQuantityInput) || proposedQuantityInput <= 0)) {
    throw apiError("quantity, when provided, must be a positive whole number.", 400, "INVALID_QUANTITY");
  }

  const quantity = proposedQuantityInput ?? recommendedQuantity;
  const proposedPositionValue = quantity * entryPrice;
  const proposedRisk = quantity * riskPerUnit;
  const totalExposure = existingExposure + proposedPositionValue;
  const totalRisk = existingRisk + proposedRisk;
  const exposurePercent = totalExposure / accountBalance * 100;
  const portfolioRiskPercent = totalRisk / accountBalance * 100;

  const warnings = [];
  if (recommendedQuantity < 1) {
    warnings.push("The selected account balance, risk limit and stop distance allow less than one unit.");
  }
  if (quantity > recommendedQuantity) {
    warnings.push(`Requested quantity exceeds the calculated safe size of ${recommendedQuantity} units.`);
  }
  if (exposurePercent > maxPortfolioExposurePercent) {
    warnings.push(`Estimated portfolio exposure (${round(exposurePercent)}%) exceeds the configured ${maxPortfolioExposurePercent}% limit.`);
  }
  if (portfolioRiskPercent > maxPortfolioRiskPercent) {
    warnings.push(`Estimated portfolio risk (${round(portfolioRiskPercent)}%) exceeds the configured ${maxPortfolioRiskPercent}% limit.`);
  }
  if (proposedPositionValue > positionValueCap) {
    warnings.push(`This position exceeds the configured ${maxPositionPercent}% single-position allocation cap.`);
  }

  const blocked = recommendedQuantity < 1 ||
    exposurePercent > maxPortfolioExposurePercent ||
    portfolioRiskPercent > maxPortfolioRiskPercent;
  const oversized = quantity > recommendedQuantity || proposedPositionValue > positionValueCap;

  let status = "ACCEPTABLE";
  let statusLabel = "Within configured risk limits";
  if (blocked) {
    status = "BLOCK_TRADE";
    statusLabel = "Exceeds portfolio risk limits";
  } else if (oversized) {
    status = "REDUCE_SIZE";
    statusLabel = "Reduce position size";
  }

  const targetPrice = numberOrNull(input.targetPrice);
  let rewardRiskRatio = null;
  let potentialRewardPerUnit = null;
  if (targetPrice !== null) {
    if (!(targetPrice > 0) ||
        (direction === "LONG" && targetPrice <= entryPrice) ||
        (direction === "SHORT" && targetPrice >= entryPrice)) {
      throw apiError("targetPrice must be on the profitable side of entryPrice for the selected direction.", 400, "INVALID_TARGET_PRICE");
    }
    potentialRewardPerUnit = Math.abs(targetPrice - entryPrice);
    rewardRiskRatio = potentialRewardPerUnit / riskPerUnit;
  }

  return {
    status,
    statusLabel,
    direction,
    account: {
      accountBalance: round(accountBalance),
      riskPercent,
      maxRiskAmount: round(riskAmount),
      maxPositionPercent,
      maxPositionValue: round(positionValueCap),
    },
    trade: {
      entryPrice: round(entryPrice),
      stopLoss: round(stopLoss),
      targetPrice: targetPrice === null ? null : round(targetPrice),
      requestedQuantity: proposedQuantityInput,
      analysedQuantity: quantity,
      recommendedQuantity,
      positionValue: round(proposedPositionValue),
      riskPerUnit: round(riskPerUnit),
      estimatedTradeRisk: round(proposedRisk),
      estimatedTradeRiskPercent: round(proposedRisk / accountBalance * 100, 3),
      potentialRewardPerUnit: potentialRewardPerUnit === null ? null : round(potentialRewardPerUnit),
      rewardRiskRatio: rewardRiskRatio === null ? null : round(rewardRiskRatio, 2),
    },
    portfolio: {
      existingExposure: round(existingExposure),
      proposedTotalExposure: round(totalExposure),
      exposurePercent: round(exposurePercent, 2),
      maxExposurePercent: maxPortfolioExposurePercent,
      existingKnownRisk: round(existingRisk),
      proposedTotalRisk: round(totalRisk),
      riskPercent: round(portfolioRiskPercent, 2),
      maxRiskPercent: maxPortfolioRiskPercent,
      openPositionsCount: openPositions.length,
    },
    warnings,
    assumptions: [
      "Account balance, existing exposure and existing position risk are supplied by the client and are not independently verified against a broker account.",
      "Existing positions without riskAmount contribute to exposure but not to estimated portfolio risk.",
      "Quantity is an integer number of units; lot-size and contract multipliers are not applied.",
      "Fees, taxes, slippage, gaps, liquidity and leverage are not included.",
      "This endpoint calculates a planning estimate only and does not place or modify orders.",
    ],
    disclaimer: "Educational risk-planning calculation only; not investment advice. Validate account equity, holdings, contract specifications, charges and broker margin before acting.",
    generatedAt: new Date().toISOString(),
  };
}

module.exports = { calculateRisk };
