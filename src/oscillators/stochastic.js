import { FasterStochasticOscillator } from 'trading-signals';

const defaultTarget = 'close'
export const stochastic = (main, index, kPeriod, kSlowingPeriod, dPeriod, {minmax, prefix, lag, parser}) => {

    

    const { verticalOhlcv, instances } = main;

    const paramsKey = (kPeriod === 14 && kSlowingPeriod === 3 && dPeriod === 3) ? '' : `${kPeriod}_${kSlowingPeriod}_${dPeriod}`
    const stochD = `${prefix}stoch_d${paramsKey}`;
    const stochK = `${prefix}stoch_k${paramsKey}`;
    const instanceKey = `${prefix}${paramsKey}`

  // Initialization on the first index.
    if (index === 0) {

        const {len } = main;

        Object.assign(instances, {
            [instanceKey]: new FasterStochasticOscillator(kPeriod, kSlowingPeriod, dPeriod)
        })

        Object.assign(verticalOhlcv, {
            [stochD]: new Float64Array(len).fill(NaN),
            [stochK]: new Float64Array(len).fill(NaN),
        })

        const baseKeys = [stochD, stochK]

        if (lag > 0) {
            main.lag(baseKeys, lag);
        }

        //[key, key_lag_1, …, key_lag_n] for each key
        const keyNames = lag > 0
            ? baseKeys.flatMap(key => [
                key,
                ...Array.from({ length: lag }, (_, i) => `${key}_lag_${i + 1}`)
            ])
            : baseKeys;

        if (Array.isArray(minmax)) {
            const group = main.scaledGroups.minmax_rsi ??= [];
            group.push(...keyNames)
        }
    }

    const close = verticalOhlcv['close'][index]
    const low = verticalOhlcv['low'][index]
    const high = verticalOhlcv['high'][index]
    let stockObj = null

  // Update the stochastic indicator.
    instances[instanceKey].update({close, low, high})

    try {
        stockObj = instances[instanceKey].getResult()
    } catch (err) {
        stockObj = null
    }

    const kVal = stockObj ? parser(stockObj.stochK) : NaN
    const dVal = stockObj ? parser(stockObj.stochD) : NaN

    main.pushToMain({ index, key: stochK, value: kVal })
    main.pushToMain({ index, key: stochD, value: dVal })

}
