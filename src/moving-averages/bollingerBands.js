import { FasterBollingerBands } from '../core-indicators/index.js'
import { validateInputValues } from '../utilities/validators.js'
import { initializeColumns } from '../core-functions/initializeColumns.js'

export const bollingerBands = (main, index, size, stdDev, { lag } = {}) => {
  const { verticalOhlcv, instances, useFullNames } = main
  const indicatorKey = `${size}_${stdDev}`
  const prefix = 'bollinger_bands'
  const target = 'close'

  // Initialization on the first call.
  if (index === 0) {
    const { inputParams, verticalOhlcv, priceBased } = main

    validateInputValues({ [target]: true }, verticalOhlcv, index, 'bollingerBands')

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

    initializeColumns(main, keyNames.map(key => ({
      key, priceBased: priceBased.has(target)
    })), { lag })
  }

  const { numberOfIndicators } = instances.bollinger_bands
  const suffix = (numberOfIndicators > 1 || useFullNames) ? `_${indicatorKey}` : ''

  const instance = instances.bollinger_bands.settings[indicatorKey]
  const value = verticalOhlcv[target][index]
  instance.update(value)

  const result = instance.isStable ? instance.getResult() : null

  const upper = result?.upper ?? NaN
  const middle = result?.middle ?? NaN
  const lower = result?.lower ?? NaN

  main.pushToMain({ index, key: `${prefix}_upper${suffix}`, value: upper })
  main.pushToMain({ index, key: `${prefix}_middle${suffix}`, value: middle })
  main.pushToMain({ index, key: `${prefix}_lower${suffix}`, value: lower })
}
