import { FasterBollingerBands } from 'trading-signals'
import { calcMagnitude } from '../utilities/numberUtilities.js';

const defaultTarget = 'close'

export const bollingerBands = (main, index, size, stdDev, options) => {
  // Destructure options ensure range and zScore default to empty arrays if not provided.

  const { verticalOhlcv, instances, lastIndexReplace } = main;
  const { height, range = [], zScore = [], target, scale } = options
  const suffix = target === defaultTarget ? '' : `_${target}`
  const indicatorKey = `${size}_${stdDev}${suffix}`
  let prefix // Will be computed during initialization

  // Initialize indicator instances and output arrays on the first call.
  if (index === 0) {

    const {nullArray, priceBased, inputParams} = main

    if (!(target in verticalOhlcv)) {
      throw new Error(`bollingerBands could not find target "${target}"`)
    }

    const numberOfIndicators = inputParams.filter(o => o.key === 'bollingerBands').length
    // Choose a prefix based on the number of indicators.
    prefix = numberOfIndicators > 1
      ? `bollinger_bands_${indicatorKey}`
      : `bollinger_bands${suffix}`

    // Ensure the container exists.
    if (!instances.bollinger_bands) {
      instances.bollinger_bands = {
        numberOfIndicators,
        settings: {}
      }
    }

    // Create the Bollinger Bands (and optional height) indicator instance.
    instances.bollinger_bands.settings[indicatorKey] = {
      instance: new FasterBollingerBands(size, stdDev)
    }

    // Build the base output arrays.
    const ohlcvSetup = {
      [`${prefix}_upper`]: [...nullArray],
      [`${prefix}_middle`]: [...nullArray],
      [`${prefix}_lower`]: [...nullArray],
      ...(height && { [`${prefix}_height`]: [...nullArray] })
    }

    // Set up additional arrays for each range property.
    for (const rangeKey of range) {
      if (!(rangeKey in verticalOhlcv) || !priceBased.includes(rangeKey)) {
        throw new Error(`Invalid range item value "${rangeKey}" property for bollingerBands. Only price based key names are accepted:\n${JSON.stringify(main.priceBased)}`)
      }
      ohlcvSetup[`${prefix}_range_${rangeKey}`] = [...nullArray]
    }

    // Set up additional arrays for each zScore property.
    for (const zScoreKey of zScore) {
      if (!(zScoreKey in verticalOhlcv) || !priceBased.includes(zScoreKey)) {
        throw new Error(`Invalid zScore item value "${zScoreKey}" for bollingerBands. Only price based key names are accepted:\n${JSON.stringify(main.priceBased)}`)
      }
      ohlcvSetup[`${prefix}_zscore_${zScoreKey}`] = [...nullArray]
    }

    // Merge the new arrays into verticalOhlcv.
    Object.assign(verticalOhlcv, ohlcvSetup)
  }

  // For subsequent calls, if prefix wasn’t computed (i.e. index > 0), derive it.
  if (!prefix) {
    const num = instances.bollinger_bands.numberOfIndicators
    prefix = num > 1 ? `bollinger_bands_${indicatorKey}` : `bollinger_bands${suffix}`
  }
  // Use the same prefix for output keys.
  const subPrefix = prefix

  // Retrieve the indicator instance(s) and update with the current value.
  const { instance } = instances.bollinger_bands.settings[indicatorKey]
  const value = verticalOhlcv[target][index]
  instance.update(value, lastIndexReplace)

  let result
  try {
    result = instance.getResult()
  } catch (err) {
    // If the result is not available yet, simply exit.
  }
  if (!result) return true

  const { upper, middle, lower } = result
  
  main.pushToMain({index, key: `${subPrefix}_upper`, value: upper})
  main.pushToMain({index, key: `${subPrefix}_middle`, value: middle})
  main.pushToMain({index, key: `${subPrefix}_lower`, value: lower})


  // Process height if a height instance exists.
  if (height) {
    let heightValue = ((upper - lower) / lower)

    if(scale)
    {
      heightValue = calcMagnitude(heightValue, scale)
    }

    main.pushToMain({index, key: `${subPrefix}_height`, value: heightValue})
  }

  // Process each range property.
  for (const rangeKey of range) {
    let rangeValue = (verticalOhlcv[rangeKey][index] - lower) / (upper - lower)

    if(scale)
    {
      rangeValue = calcMagnitude(rangeValue, scale)
    }

    main.pushToMain({index, key: `${subPrefix}_range_${rangeKey}`, value: rangeValue})
  }

  // Process each zScore property.
  for (const zScoreKey of zScore) {
    const denominator = upper - lower
    let zScoreValue = denominator !== 0
      ? (2 * stdDev * (verticalOhlcv[zScoreKey][index] - middle)) / denominator
      : 0
      
    if(denominator !== 0 && scale)
    {
      zScoreValue = calcMagnitude(zScoreValue, scale)
    }

    main.pushToMain({index, key: `${subPrefix}_zscore_${zScoreKey}`, value: zScoreValue})
  }

  return true
}
