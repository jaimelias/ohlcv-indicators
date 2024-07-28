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
        const prevSma = sma[i - 1]
        if (i === 0 || !prevSma || prevSma.isZero()) return null
        return v.dividedBy(prevSma)
    }).filter(v => !Number.isNaN(v))
}
