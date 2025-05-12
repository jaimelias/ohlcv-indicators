import { buildArray } from "../utilities/assignTypes.js";

export const lag = (main, index) => {

    const {instances, verticalOhlcv, len, arrayTypes, priceBased} = main

    if(index === 0)
    {
        const {inputParams} = main

        const params = []

        for (const o of inputParams) {
            if (o.key === 'lag') {
                params.push(o.params)
            }
        }

        for (const [colKeys, lookback] of params)
        {
            for (const colKey of colKeys)
            {
                if(priceBased.has(colKey))
                {
                    for (let step = 1; step <= lookback; step++) {
                        priceBased.add(`${colKey}_lag_${step}`)
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

                    if(!arrayTypes.hasOwnProperty(colKey))
                    {
                        throw new Error(`Lag processing invoked by "${colKey}" expected arrayTypes to have a "${colKey}" property, but it wasn’t found.`)                          
                    }

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
