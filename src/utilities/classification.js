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
 * @param {string} center - Available options "lower", "middle".
 * @returns {number|null} The classified value, or null if inputs are invalid or if upper equals lower.
 */


const calcDeviation = (value, bollingerBands, center) => {

  const { upper, lower, middle } = bollingerBands

  if(center === 'lower')
  {
      return (value - lower) / (upper - lower)
  }
  else if(center === 'middle')
  {
    return (value >= middle) ? (value - middle) / (upper - middle) : (value - middle) / (middle - lower)
  }
  else
  {
    throw new Error(`Invalid "center" param (center) in calcDeviation`)
  }
}

export const classifyDeviation = (difference, bollingerBands, scale = 0.001, center) => {

  // Validate that value and bollingerBands are not null
  if (difference === null || bollingerBands === null) return null

  const positive = difference >= 0

  let deviation = calcDeviation(Math.abs(difference), bollingerBands, center)
  deviation = calcMagnitude(deviation, scale)

  if(deviation === 0)
  {
    return (positive) ? 0.01 : -0.01
  }

  return positive ? deviation : -deviation

}