
export const classifySize = (value, mean, standardDeviation = 1.5) => {
    if (value === null || mean === null || standardDeviation === null) return null;
  
    const largeThreshold = mean + (2 * standardDeviation); // Large (2σ above mean)
    const mediumThreshold = mean + (1 * standardDeviation); // Medium (1σ above mean)
    const smallThreshold = mean - (1 * standardDeviation); // Small (1σ below mean)
    const verySmallThreshold = mean - (1.5 * standardDeviation); // Very small (1.5σ below mean)
  
    if (value > largeThreshold) {
        return 1;        // Large
    } else if (value > mediumThreshold) {
        return 0.75;    // Medium
    } else if (value > smallThreshold) {
        return 0.5;    // Small
    } else if (value > verySmallThreshold) {
        return 0.25;    // Very small
    } else {
        return 0;    // Insignificant
    }
  };
  

  export const classifyChange = (value, mean, standardDeviation = 0.5) => {
    if (value === null || mean === null || standardDeviation === null) return null;

    const largePositiveThreshold = mean + (2 * standardDeviation); // Large positive
    const mediumPositiveThreshold = mean + (1.5 * standardDeviation); // Medium positive (1.5σ)
    const smallPositiveThreshold = mean + (0.5 * standardDeviation); // Small positive (0.5σ)
    const smallNegativeThreshold = mean - (0.5 * standardDeviation); // Small negative (-0.5σ)
    const mediumNegativeThreshold = mean - (1.5 * standardDeviation); // Medium negative (-1.5σ)
    const largeNegativeThreshold = mean - (2 * standardDeviation); // Large negative

    if (value >= largePositiveThreshold) {
        return 1;    // Large positive
    } else if (value >= mediumPositiveThreshold) {
        return 0.5; // Medium positive
    } else if (value >= smallPositiveThreshold) {
        return 0.25; // Small positive
    } else if (value <= largeNegativeThreshold) {
        return -1;   // Large negative
    } else if (value <= mediumNegativeThreshold) {
        return -0.5; // Medium negative
    } else if (value <= smallNegativeThreshold) {
        return -0.25; // Small negative
    } else {
        return 0; // No significant change
    }
};