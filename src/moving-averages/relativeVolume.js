import { getSMA } from './sma.js'

export const RelativeVolume = (main, size) => {
    const ohlcv = main.getData()
    const data = ohlcv['volume']
    const relVolume = getRelativeVolume(main.BigNumber, data, size)
    main.addColumn(`relative_volume_${size}`, relVolume)
}

export const getRelativeVolume = (BigNumber, data, size = 10) => {
    const sma = getSMA(BigNumber, data, size)

    return data.map((v, i) => {
        if (i === 0 || !sma[i - 2]) return NaN // or handle the edge case appropriately
        return v.dividedBy(sma[i - 2])
    }).filter(v => v !== NaN) // remove null values if necessary
}
