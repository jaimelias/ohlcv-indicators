export const lag = (main, index) => {

    if(index === 0)
    {
        const findParams = main.inputParams.filter(o => o.key === 'lag')

        if(typeof findParams !== 'object') return

        const params = findParams.map(o => o.params)

        for (const [colKeys, lags] of params)
        {
            for (const colKey of colKeys)
            {
                if(main.priceBased.includes(colKey))
                {
                    for (let lag = 1; lag <= lags; lag++) {
                        main.priceBased.push(`${colKey}_lag_${lag}`)
                    }
                }
            }
        }

        main.instances.lag = {
            lagParams: params
        }
    }
    
    for (const [colKeys, lags] of main.instances.lag.lagParams) {
    
        for (const colKey of colKeys) {
            const currentColumn = main.verticalOhlcv[colKey];
    
            // Initialize lagged arrays only on the first index
            if (index === 0) {
                for (let lag = 1; lag <= lags; lag++) {
                    const key = `${colKey}_lag_${lag}`;
                    main.verticalOhlcv[key] = [...main.nullArray];
                }
            }

            // Populate lagged values
            for (let lag = 1; lag <= lags; lag++) {
                const key = `${colKey}_lag_${lag}`;
                const laggedIndex = index - lag;

                if(laggedIndex <= 0) break
    
                main.verticalOhlcv[key][index] = currentColumn[laggedIndex]
            }
        }
    }
    



    return true;
};
