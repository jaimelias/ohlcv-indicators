import { FasterSMA } from "trading-signals";

// Normalize the array (z-score normalization)
const smoothNormalize = (arr, smoothing) => {
    const len = arr.length;
    const instance = new FasterSMA(smoothing);
    const smoothedArr = new Array(len);
    let sum = 0;
    let sumSq = 0;
    let count = 0;

    for (let x = 0; x < len; x++) {
        instance.update(arr[x]);

        if (instance.isStable) {
            const value = instance.getResult();
            smoothedArr[x] = value;
            sum += value;
            sumSq += value * value;
            count++;
        } else {
            smoothedArr[x] = null;
        }
    }

    const meanValue = sum / count;
    const variance = (sumSq / count) - (meanValue * meanValue);
    const stdDev = Math.sqrt(variance);

    return smoothedArr.map(val => (val !== null ? (val - meanValue) / stdDev : null));
}

// Calculate Pearson Correlation
export const correlation = (x, y, smoothing = 5) => {
    if (x.length !== y.length) {
        throw new Error('Both arrays must have the same length');
    }

    const normX = smoothNormalize(x, smoothing);
    const normY = smoothNormalize(y, smoothing);
    const n = x.length;
    const result = [];

    let sumX = 0, sumY = 0, sumXY = 0;
    let sumXSquare = 0, sumYSquare = 0;
    let count = 0;

    // Find the first index where both normX and normY have valid values
    let firstValidIndex = -1;
    for (let i = 0; i < n; i++) {
        if (normX[i] !== null && normY[i] !== null) {
            firstValidIndex = i;
            break;
        } else {
            result.push(0); // Fill initial invalid indices with 0
        }
    }

    if (firstValidIndex === -1) {
        // No valid data points
        return new Array(n).fill(0);
    }

    for (let i = firstValidIndex; i < n; i++) {
        const xVal = normX[i];
        const yVal = normY[i];

        if (xVal === null || yVal === null) {
            // Reset sums and counts when encountering null values
            sumX = sumY = sumXY = sumXSquare = sumYSquare = count = 0;
            result.push(0);
            continue;
        }

        sumX += xVal;
        sumY += yVal;
        sumXY += xVal * yVal;
        sumXSquare += xVal * xVal;
        sumYSquare += yVal * yVal;
        count++;

        if (count < 2) {
            result.push(0); // Not enough data points to calculate correlation
            continue;
        }

        const numerator = (count * sumXY) - (sumX * sumY);
        const denominator = Math.sqrt(
            (count * sumXSquare - sumX * sumX) *
            (count * sumYSquare - sumY * sumY)
        );

        const correlation = denominator === 0 ? 0 : numerator / denominator;
        result.push(correlation);
    }

    return result;
}
