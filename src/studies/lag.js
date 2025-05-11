import { buildArray } from "../utilities/assignTypes.js";

export const lag = (main, index) => {

    const {instances, verticalOhlcv, len, arrayTypes, priceBased} = main

    if(index === 0)
    {
        const {inputParams} = main
        const findParams = inputParams.filter(o => o.key === 'lag')

        if(typeof findParams !== 'object') return

        const params = findParams.map(o => o.params)

        for (const [colKeys, lookback] of params)
        {
            for (const colKey of colKeys)
            {
                if(priceBased.includes(colKey))
                {
                    for (let step = 1; step <= lookback; step++) {
                        priceBased.push(`${colKey}_lag_${step}`)
                    }
                }
            }
        }

        instances.lag = {
            lagParams: params
        }
    }
    
    const {lagParams} = instances.lag

    for (const [colKeys, lookback] of lagParams) {
    
        for (const colKey of colKeys) {
            const currentColumn = verticalOhlcv[colKey];
    
            // Initialize lagged arrays only on the first index
            if (index === 0) {
                for (let step = 1; step <= lookback; step++) {
                    const key = `${colKey}_lag_${step}`;

                    verticalOhlcv[key] = buildArray(arrayTypes[colKey], len)
                    arrayTypes[key] = arrayTypes[colKey]
                }
            }

            // Populate lagged values
            for (let step = 1; step <= lookback; step++) {
                const key = `${colKey}_lag_${step}`;
                const laggedIndex = index - step;

                const value = (laggedIndex <= 0 || typeof currentColumn[laggedIndex] === 'undefined') 
                    ? null 
                    : currentColumn[laggedIndex]

                main.pushToMain({index, key, value})
            }
        }
    }
    



    return true;
};
