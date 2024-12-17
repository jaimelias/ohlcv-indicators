export const setIndicatorsFromInputParams = ({ input, inputParams, OHLCV_INDICATORS }) => {
    const indicators = new OHLCV_INDICATORS({ input });

    for (const [key, technical] of Object.entries(inputParams)) {

        if(['crossPairs', 'lag'].includes(key)) continue

        if (Array.isArray(technical)) {
            for (let i = 0; i < technical.length; i++) {
                const params = technical[i];

                if (Array.isArray(params)) {
                    if (params.length > 0) {
                        indicators[key](...params);
                    } else {
                        indicators[key]();
                    }
                }
            }
        }
    }

    for (const [key, technical] of Object.entries(inputParams)) {

        if(!['crossPairs', 'lag'].includes(key)) continue

        if (Array.isArray(technical)) {
            for (let i = 0; i < technical.length; i++) {
                const params = technical[i];

                if (Array.isArray(params)) {
                    if (params.length > 0) {
                        indicators[key](...params);
                    } else {
                        indicators[key]();
                    }
                }
            }
        }
    }
    
    return indicators;
};
