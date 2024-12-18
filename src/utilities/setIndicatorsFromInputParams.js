export const setIndicatorsFromInputParams = ({ input, inputParams, OHLCV_INDICATORS }) => {
    const indicators = new OHLCV_INDICATORS({ input })

    for(let x = 0; x < inputParams.length; x++)
    {
        const {key, params} = inputParams[x]
        
        if(Array.isArray(params))
        {
            if(params.length > 0)
            {
            
                if(Array.isArray(params) && key === 'crossPairs')
                {
                    if(Array.isArray(params[0]))
                    {
                        params[0] = params[0].filter(o => !o.isDefault)
                    }
                }

                indicators[key](...params)
            }
            else
            {
                indicators[key]()
            }
        }
    }

    return indicators
};
