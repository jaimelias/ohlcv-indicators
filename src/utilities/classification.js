export const classifySize = (value, mean, standardDeviation = 1.5, numLevels = 5) => {
    if (value === null || mean === null || standardDeviation === null) return null
    if (numLevels < 2) throw new Error("numLevels must be at least 2")

    // Calculate the range for each level
    const step = (4 * standardDeviation) / (numLevels - 1)
    const thresholds = []

    for (let i = 0; i < numLevels - 1; i++) {
        thresholds.push(mean - (2 * standardDeviation) + (i * step))
    }

    // Classify the value based on calculated thresholds
    for (let i = thresholds.length - 1; i >= 0; i--) {
        if (value > thresholds[i]) {
            return (i + 1) / (numLevels - 1)
        }
    }

    return 0
}