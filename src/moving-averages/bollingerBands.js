import { FasterBollingerBands } from 'trading-signals'
import { roundDecimalPlaces } from '../utilities/numberUtilities.js';

const defaultTarget = 'close'

export const bollingerBands = (main, index, size, stdDev, { height, range = [], target, lag, decimals }) => {

  

  const { verticalOhlcv, instances } = main;
  const indicatorKey = `${size}_${stdDev}`;
  const prefix = 'bollinger_bands'

  // Initialization on the first call.
  if (index === 0) {

    const {inputParams, verticalOhlcv, len, arrayTypes } = main;

    if (!(target in verticalOhlcv)) {
      throw new Error(`bollingerBands could not find target "${target}"`);
    }

    let numberOfIndicators = 0

    for (const o of inputParams) {
      if (o.key === 'bollingerBands') numberOfIndicators++;
    }

    // Only create the container if it doesn't already exist.
    if (!instances.bollinger_bands) {
      instances.bollinger_bands = {
        numberOfIndicators,
        settings: {}
      };
    }
    // Add (or override) the indicator instance keyed by indicatorKey.
    instances.bollinger_bands.settings[indicatorKey] = new FasterBollingerBands(size, stdDev);

    let suffix = ''
    if((numberOfIndicators > 1)) suffix += `_${indicatorKey}`
    if(target !== defaultTarget) suffix += `_${target}`

    const keyNames = [
      `${prefix}_upper`,
      `${prefix}_middle`,
      `${prefix}_lower`,
    ].map(v => `${v}${suffix}`)


    if (height) {
      keyNames.push(
        `${prefix}_height${suffix}`
      )
    }

    // Set up additional arrays for each range property.
    for (const rangeKey of range) {
      if (!(rangeKey in verticalOhlcv)) {
        throw new Error(`Invalid range item value "${rangeKey}" property for bollingerBands.`);
      }
      keyNames.push(`${prefix}_range_${rangeKey}${suffix}`)

    }

    const verticalOhlcvSetup = Object.fromEntries(keyNames.map(v => [v, new Float64Array(len).fill(NaN)]))
    Object.assign(verticalOhlcv, {...verticalOhlcvSetup})

    if(lag > 0)
    {
      main.lag(keyNames, lag)
    }

    for(const key of keyNames)
    {
      arrayTypes[key] = 'Float64Array'
    }
  }

  const {numberOfIndicators} = instances.bollinger_bands

  let suffix = ''
  if((numberOfIndicators > 1)) suffix += `_${indicatorKey}`
  if(target !== defaultTarget) suffix += `_${target}`
  
  // Update the indicator with the current value.
  const instance = instances.bollinger_bands.settings[indicatorKey]
  const value = verticalOhlcv[target][index]
  instance.update(value)

  // Attempt to retrieve the result.
  let result = {};
  try {
    result = instance.getResult();
  } catch (err) {
    // If not available, result stays {}.
  }

  // Use NaN fallbacks for the primary values.
  const upper = result?.upper ?? NaN;
  const middle = result?.middle ?? NaN;
  const lower = result?.lower ?? NaN;

  // Always push the indicator outputs.
  main.pushToMain({ index, key: `${prefix}_upper${suffix}`, value: upper });
  main.pushToMain({ index, key: `${prefix}_middle${suffix}`, value: middle });
  main.pushToMain({ index, key: `${prefix}_lower${suffix}`, value: lower });

  // Process height if requested.
  if (height) {
    let heightValue = NaN;
    if (!Number.isNaN(lower) && !Number.isNaN(upper)) {
      heightValue = ((upper - lower) / lower)
    }
    main.pushToMain({ index, key: `${prefix}_height${suffix}`, value: (decimals === null) ? heightValue : roundDecimalPlaces(heightValue, decimals) });
  }

  // Process each range property.
  for (const rangeKey of range) {
    let rangeValue = NaN;
    const priceValue = verticalOhlcv[rangeKey][index];
    if (!Number.isNaN(priceValue) && !Number.isNaN(lower) && !Number.isNaN(upper)) {
      rangeValue = (priceValue - lower) / (upper - lower)
    }
    main.pushToMain({ index, key: `${prefix}_range_${rangeKey}${suffix}`, value: (decimals === null) ? rangeValue : roundDecimalPlaces(rangeValue, decimals) });
  }

  return true;
}
