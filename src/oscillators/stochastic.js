import { FasterStochasticOscillator } from 'trading-signals';

export const stochastic = (main, index, kPeriod, kSlowingPeriod, dPeriod, {lag}) => {

    

    const { verticalOhlcv, instances } = main;

    const paramsKey = (kPeriod === 14 && kSlowingPeriod === 3 && dPeriod === 3) ? '' : `${kPeriod}_${kSlowingPeriod}_${dPeriod}`
    const stochD = `stoch_d${paramsKey}`;
    const stochK = `stoch_k${paramsKey}`;
    const instanceKey = paramsKey

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

    const kVal = stockObj ? stockObj.stochK : NaN
    const dVal = stockObj ? stockObj.stochD : NaN

    main.pushToMain({ index, key: stochK, value: kVal })
    main.pushToMain({ index, key: stochD, value: dVal })

}
