import { FasterBollingerBands } from '../core-indicators/index.js'
import { validateInputValues } from '../utilities/validators.js'
import { initializeColumns } from '../core-functions/initializeColumns.js'
import { mathLog } from '../utilities/math.js'

export const bollingerBands = (main, index, size, stdDev, { lag, retLogs = false } = {}) => {
  const { verticalOhlcv, instances, useFullNames } = main
  const indicatorKey = `${size}_${stdDev}`
  const instanceKey = `${retLogs ? 'ret_log_' : ''}${indicatorKey}`
  const prefix = `${retLogs ? 'ret_log_' : ''}bollinger_bands`
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

    instances.bollinger_bands.settings[instanceKey] = new FasterBollingerBands(size, stdDev)

    const suffix = (numberOfIndicators > 1 || useFullNames) ? `_${indicatorKey}` : ''

    const keyNames = retLogs ? [
      `${prefix}_width${suffix}`,
      `${prefix}_position${suffix}`,
    ] : [
      `${prefix}_upper${suffix}`,
      `${prefix}_middle${suffix}`,
      `${prefix}_lower${suffix}`,
    ]

    initializeColumns(main, keyNames.map(key => ({
      key, priceBased: !retLogs && priceBased.has(target)
    })), { lag })
  }

  const { numberOfIndicators } = instances.bollinger_bands
  const suffix = (numberOfIndicators > 1 || useFullNames) ? `_${indicatorKey}` : ''

  const instance = instances.bollinger_bands.settings[instanceKey]
  const value = verticalOhlcv[target][index]
  instance.update(value)

  const result = instance.isStable ? instance.getResult() : null

  const upper = result?.upper ?? NaN
  const middle = result?.middle ?? NaN
  const lower = result?.lower ?? NaN

  if (retLogs) {
    let width = NaN
    let position = NaN
    const rangeRatio = upper / lower
    if (lower > 0 && upper >= lower && Number.isFinite(upper) && Number.isFinite(rangeRatio)) {
      const logRange = mathLog(rangeRatio, 1)
      width = logRange / 2
      const locationRatio = value / lower
      if (logRange > 0 && value > 0 && locationRatio > 0 && Number.isFinite(locationRatio)) {
        const normalized = 2 * mathLog(locationRatio, 1) / logRange - 1
        if (Number.isFinite(normalized)) position = normalized
      }
    }
    main.pushToMain({ index, key: `${prefix}_width${suffix}`, value: width })
    main.pushToMain({ index, key: `${prefix}_position${suffix}`, value: position })
    return
  }

  main.pushToMain({ index, key: `${prefix}_upper${suffix}`, value: upper })
  main.pushToMain({ index, key: `${prefix}_middle${suffix}`, value: middle })
  main.pushToMain({ index, key: `${prefix}_lower${suffix}`, value: lower })
}
