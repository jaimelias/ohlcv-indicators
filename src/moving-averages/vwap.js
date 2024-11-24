

export const vwap = (main) => {
    const { verticalOhlcv } = main;
    
    const vwapValues = calculateVWAP(verticalOhlcv);

    return {
        [`vwap`]: vwapValues,
    };
};

const calculateVWAP = data => {
    const { high, low, close, volume } = data;
    const output = new Array(close.length).fill(null)

    // Cumulative sums for VWAP calculation
    let cumulativePriceVolume = 0;
    let cumulativeVolume = 0;

    for (let x = 0; x < close.length; x++) {

        const typicalPrice = (high[x] + low[x] + close[x]) / 3;

        // Calculate Price * Volume for this interval
        const priceVolume = typicalPrice * volume[x];

        // Update cumulative sums
        cumulativePriceVolume += priceVolume;
        cumulativeVolume += volume[x];

        // Calculate VWAP for this interval
        const vwap = cumulativePriceVolume / cumulativeVolume;

        // Push the VWAP value into the array
        output[x] = vwap
    }

    return output
}