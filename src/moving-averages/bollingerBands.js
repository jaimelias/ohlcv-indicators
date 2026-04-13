import { FasterBollingerBands } from 'trading-signals'

export const bollingerBands = (main, index, size, stdDev, { lag } = {}) => {
  const { verticalOhlcv, instances, useFullNames } = main
  const indicatorKey = `${size}_${stdDev}`
  const prefix = 'bollinger_bands'
  const target = 'close'

  // Initialization on the first call.
  if (index === 0) {
    const { inputParams, verticalOhlcv, len, priceBased } = main

    if (!(target in verticalOhlcv)) {
      throw new Error(`bollingerBands could not find target "${target}"`)
    }

    let numberOfIndicators = 0

    for (const o of inputParams) {
      if (o.key === 'bollingerBands') numberOfIndicators++
    }

    if (!instances.bollinger_bands) {
      instances.bollinger_bands = {
        numberOfIndicators,
        settings: {}
      }
    }

    instances.bollinger_bands.settings[indicatorKey] = new FasterBollingerBands(size, stdDev)

    const suffix = (numberOfIndicators > 1 || useFullNames) ? `_${indicatorKey}` : ''

    const keyNames = [
      `${prefix}_upper${suffix}`,
      `${prefix}_middle${suffix}`,
      `${prefix}_lower${suffix}`,
    ]

    if (priceBased.has(target)) {
      for (const k of keyNames) {
        priceBased.add(k)
      }
    }

    const verticalOhlcvSetup = Object.fromEntries(
      keyNames.map(v => [v, new Float64Array(len).fill(NaN)])
    )

    Object.assign(verticalOhlcv, { ...verticalOhlcvSetup })

    if (lag > 0) {
      main.lag(keyNames, lag)
    }
  }

  const { numberOfIndicators } = instances.bollinger_bands
  const suffix = (numberOfIndicators > 1 || useFullNames) ? `_${indicatorKey}` : ''

  const instance = instances.bollinger_bands.settings[indicatorKey]
  const value = verticalOhlcv[target][index]
  instance.update(value)

  let result = {}
  try {
    result = instance.getResult()
  } catch (err) {
    // If not available, result stays {}.
  }

  const upper = result?.upper ?? NaN
  const middle = result?.middle ?? NaN
  const lower = result?.lower ?? NaN

  main.pushToMain({ index, key: `${prefix}_upper${suffix}`, value: upper })
  main.pushToMain({ index, key: `${prefix}_middle${suffix}`, value: middle })
  main.pushToMain({ index, key: `${prefix}_lower${suffix}`, value: lower })

  return true
}