import { getSMA } from './sma.js'

export const RelativeVolume = (main, size) => {
    const {ohlcv} = main
    const data = ohlcv['volume']
    const relVolume = getRelativeVolume(main.BigNumber, data, size)
    main.addColumn(`relative_volume_${size}`, relVolume)
}

export const getRelativeVolume = (BigNumber, data, size = 10) => {
    const sma = getSMA(BigNumber, data, size)

    return data.map((v, i) => {
        if (i === 0 || !sma[i - 2]) return NaN
        // Avoid division by zero
        if (sma[i - 2].isZero()) return NaN
        return v.dividedBy(sma[i - 2])
    }).filter(v => !Number.isNaN(v))
}
