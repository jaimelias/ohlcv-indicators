import { getSMA } from './sma.js'

export const RelativeVolume = (main, size) => {
    const {ohlcv, compute} = main
    const data = ohlcv['volume']
    const relVolume = getRelativeVolume(main.BigNumber, data, size, compute)
    main.addColumn(`relative_volume_${size}`, relVolume)
}

export const getRelativeVolume = (BigNumber, data, size = 10, compute) => {
    const sma = getSMA(BigNumber, data, size, compute)

    return data.map((v, i) => {
        const prevSma = sma[i - 1]
        if (i === 0 || !prevSma || prevSma.isZero()) return null
        return v.dividedBy(prevSma)
    }).filter(v => !Number.isNaN(v))
}
