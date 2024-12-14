export const lag = (main, index, colKeys = ['close'], lags = 1) => {

    const { verticalOhlcv, len } = main;

    // Ensure arrays exist for each lag key before we populate
    for (let x = 0; x < colKeys.length; x++) {
        for (let lag = 1; lag <= lags; lag++) {
            const key = `${colKeys[x]}_lag_${lag}`;
            // If the array does not exist, initialize it
            if (!verticalOhlcv.hasOwnProperty(key)) {
                verticalOhlcv[key] = new Array(len).fill(null);
            }

            // Compute the lagged index
            const laggedIndex = index - lag;
            
            // If laggedIndex is negative, we don't have a previous value
            const value = (laggedIndex >= 0) 
                ? verticalOhlcv[colKeys[x]][laggedIndex] 
                : null;
            
            verticalOhlcv[key][index] = value;
        }
    }

    return true;
};
