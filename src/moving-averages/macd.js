import { FasterEMA, FasterMACD } from 'trading-signals'
import { validateInputValues } from '../utilities/validators.js'
import { initializeColumns } from '../core-functions/initializeColumns.js'

const defaultTarget = 'close'

export const macd = (main, index, fast, slow, signal, { target, lag, precomputed }) => {
  const { verticalOhlcv, instances, useFullNames } = main
  const { instanceKey } = precomputed

  // Initialization on the first index.
  if (index === 0) {
    validateInputValues({ [target]: true }, verticalOhlcv, index, 'macd')

    const { inputParams } = main

    if (!verticalOhlcv.hasOwnProperty(target)) {
      throw new Error(`Target property ${target} not found in verticalOhlcv for macd.`)
    }

    let numberOfIndicators = 0

    for (const o of inputParams) {
      if (o.key === 'macd') numberOfIndicators++
    }

    const useIndexedKeys = numberOfIndicators > 1 || useFullNames
    const indicatorSuffix = `${fast}_${slow}_${signal}`

    const getKey = name => {
      if (target === defaultTarget) {
        return useIndexedKeys
          ? `macd_${name}_${indicatorSuffix}`
          : `macd_${name}`
      }

      return useIndexedKeys
        ? `macd_${name}_${target}_${indicatorSuffix}`
        : `macd_${name}_${target}`
    }

    // Build the keys.
    const diffKey = getKey('diff')
    const deaKey = getKey('dea')
    const histogramKey = getKey('histogram')

    if (!instances.hasOwnProperty('macd')) {
      instances.macd = {
        numberOfIndicators,
        settings: {}
      }
    }

    instances.macd.settings[instanceKey] = new FasterMACD(
      new FasterEMA(fast),
      new FasterEMA(slow),
      new FasterEMA(signal)
    )

    const keyNames = [diffKey, deaKey, histogramKey]
    initializeColumns(main, keyNames.map(key => ({ key, priceBased: true })), { lag })
  }

  const { numberOfIndicators, settings } = instances.macd
  const useIndexedKeys = numberOfIndicators > 1 || useFullNames
  const indicatorSuffix = `${fast}_${slow}_${signal}`

  const getKey = name => {
    if (target === defaultTarget) {
      return useIndexedKeys
        ? `macd_${name}_${indicatorSuffix}`
        : `macd_${name}`
    }

    return useIndexedKeys
      ? `macd_${name}_${target}_${indicatorSuffix}`
      : `macd_${name}_${target}`
  }

  const diffKey = getKey('diff')
  const deaKey = getKey('dea')
  const histogramKey = getKey('histogram')

  const macdInstance = settings[instanceKey]
  const value = verticalOhlcv[target][index]
  macdInstance.update(value)

  let macdResult = {}
  try {
    macdResult = macdInstance.getResult()
  } catch (err) {
    // If the result is unavailable, macdResult remains NaN.
  }

  // Always push values; use NaN as fallback when macdResult is missing.
  main.pushToMain({ index, key: diffKey, value: macdResult ? macdResult.macd : NaN })
  main.pushToMain({ index, key: deaKey, value: macdResult ? macdResult.signal : NaN })
  main.pushToMain({ index, key: histogramKey, value: macdResult ? macdResult.histogram : NaN })
}