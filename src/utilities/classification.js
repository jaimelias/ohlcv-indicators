import { calcMagnitude } from "./numberUtilities.js"

/**
 * Classifies a given value relative to provided Bollinger band thresholds.
 *
 * The function evaluates the input value against the lower, middle, and upper thresholds
 * of the Bollinger bands. If the value is below the lower threshold, it returns 0.
 * If the value exceeds the upper threshold, it returns 1 (or -1 if the value is negative).
 * For values within the bands, it calculates a normalized magnitude between 0 and 1 (or 0 and -1 for negatives)
 * based on the position within the range, rounded to one decimal place.
 * Additionally, if the value is nearly equal to the middle threshold (within a small tolerance),
 * the function returns 0.5 or -0.5 depending on the sign of the value.
 *
 * @param {number} value - The value to classify.
 * @param {Object} bollingerBands - An object containing Bollinger band thresholds.
 * @param {number} bollingerBands.upper - The upper band threshold.
 * @param {number} bollingerBands.middle - The middle band value.
 * @param {number} bollingerBands.lower - The lower band threshold.
 * @returns {number|null} The classified value, or null if inputs are invalid or if upper equals lower.
 */


export const classifyBoll = (value, bollingerBands, scale = 0.05, autoMinMax = false) => {

  // Validate that value and bollingerBands are not null/undefined
  if (value == null || bollingerBands == null) return null

  const positive = value >= 0
  const absValue = Math.abs(value)

  const { upper, lower } = bollingerBands

  const rangeValue = (absValue - lower) / (upper - lower)
  let magnitude = calcMagnitude(rangeValue, scale)

  if(magnitude === 0)
  {
    magnitude = (positive) ? 0.01 : -0.01
  }

  if(autoMinMax)
  {
    return positive ? Math.min(magnitude, 1) : Math.max(-magnitude, -1)
  }
  else {
    return positive ? magnitude : -magnitude
  }

}
