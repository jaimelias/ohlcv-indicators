export const lag = (main, index, params) => {

    for(let p = 0; p < params.length; p++)
    {
        const [colKeys, lags] = params[p]

        // Ensure arrays exist for each lag key before we populate
        for (let x = 0; x < colKeys.length; x++) {
            for (let lag = 1; lag <= lags; lag++) {
                const key = `${colKeys[x]}_lag_${lag}`;
                // If the array does not exist, initialize it
                if (index === 0) {
                    main.verticalOhlcv[key] = new Array(main.len).fill(null)
                }

                // Compute the lagged index
                const laggedIndex = index - lag;
                
                // If laggedIndex is negative, we don't have a previous value
                const value = (laggedIndex >= 0) 
                    ? main.verticalOhlcv[colKeys[x]][laggedIndex] 
                    : null;
                
                main.verticalOhlcv[key][index] = value;
            }
        }
    }





    return true;
};
