/**
 * Classifies a given value relative to the Bollinger bands.
 *
 * @param {Object} params - Parameters object.
 * @param {number} params.value - The value to classify.
 * @param {boolean} [params.positive=true] - Flag to determine if the result should be positive.
 * @param {Object} bollingerBands - Object containing the Bollinger band thresholds.
 * @param {number} bollingerBands.upper - The upper band threshold.
 * @param {number} bollingerBands.middle - The middle band value.
 * @param {number} bollingerBands.lower - The lower band threshold.
 * @returns {number|null} The classified value, or null if inputs are invalid.
 */
export const classifyBoll = ({ value, positive = true }, bollingerBands) => {
    // Validate that value and bollingerBands are not null/undefined
    if (value == null || bollingerBands == null) return null;
  
    const { upper, middle, lower } = bollingerBands;
  
  
    // Handle values outside the Bollinger bands
    if (value < lower) return 0;
    if (value > upper) return positive ? 1 : -1;
  
    // Use a tolerance for floating point comparisons
    const epsilon = Number.EPSILON * Math.max(Math.abs(value), Math.abs(middle));
    if (Math.abs(value - middle) < epsilon) return positive ? 0.5 : -0.5;
  
    // Prevent division by zero if upper and lower are equal
    if (upper === lower) return null;
  
    const rangeValue = (value - lower) / (upper - lower);
    const magnitude = Math.round(rangeValue * 10) / 10;
  
    return positive ? magnitude : -magnitude;
  };
  