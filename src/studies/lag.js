export const lag = (main, index) => {

    const {instances, verticalOhlcv} = main

    if(index === 0)
    {
        const {inputParams, priceBased} = main
        const findParams = inputParams.filter(o => o.key === 'lag')

        if(typeof findParams !== 'object') return

        const params = findParams.map(o => o.params)

        for (const [colKeys, lags] of params)
        {
            for (const colKey of colKeys)
            {
                if(priceBased.includes(colKey))
                {
                    for (let lag = 1; lag <= lags; lag++) {
                        priceBased.push(`${colKey}_lag_${lag}`)
                    }
                }
            }
        }

        instances.lag = {
            lagParams: params
        }
    }
    
    const {lagParams} = instances.lag

    for (const [colKeys, lags] of lagParams) {
    
        for (const colKey of colKeys) {
            const currentColumn = verticalOhlcv[colKey];
    
            // Initialize lagged arrays only on the first index
            if (index === 0) {
                for (let lag = 1; lag <= lags; lag++) {
                    const key = `${colKey}_lag_${lag}`;
                    verticalOhlcv[key] = [...main.nullArray];
                }
            }

            // Populate lagged values
            for (let lag = 1; lag <= lags; lag++) {
                const key = `${colKey}_lag_${lag}`;
                const laggedIndex = index - lag;

                if(laggedIndex <= 0) break
    
                main.pushToMain({index, key, value: currentColumn[laggedIndex]})
            }
        }
    }
    



    return true;
};
