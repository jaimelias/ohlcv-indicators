import { FasterBollingerBands } from 'trading-signals'
import { calcMagnitude } from '../utilities/numberUtilities.js';

const defaultTarget = 'close'

export const bollingerBands = (main, index, size, stdDev, { height, range = [], zScore = [], target, scale, lag }) => {
  const { verticalOhlcv, instances, lastIndexReplace } = main;
  const suffix = target === defaultTarget ? '' : `_${target}`;
  const indicatorKey = `${size}_${stdDev}${suffix}`;
  let prefix;

  // Initialization on the first call.
  if (index === 0) {
    const { priceBased, inputParams, nullArray, verticalOhlcv } = main;

    if (!(target in verticalOhlcv)) {
      throw new Error(`bollingerBands could not find target "${target}"`);
    }

    const numberOfIndicators = inputParams.filter(o => o.key === 'bollingerBands').length;
    prefix = numberOfIndicators > 1
      ? `bollinger_bands_${indicatorKey}`
      : `bollinger_bands${suffix}`;

    // Only create the container if it doesn't already exist.
    if (!instances.bollinger_bands) {
      instances.bollinger_bands = {
        numberOfIndicators,
        settings: {}
      };
    }
    // Add (or override) the indicator instance keyed by indicatorKey.
    instances.bollinger_bands.settings[indicatorKey] = new FasterBollingerBands(size, stdDev);

    const keyNames = [
      `${prefix}_upper`,
      `${prefix}_middle`,
      `${prefix}_lower`,
    ]


    if (height) {
      keyNames.push(`${prefix}_height`)
    }

    // Set up additional arrays for each range property.
    for (const rangeKey of range) {
      if (!(rangeKey in verticalOhlcv) || !priceBased.includes(rangeKey)) {
        throw new Error(`Invalid range item value "${rangeKey}" property for bollingerBands. Only price based key names are accepted:\n${JSON.stringify(priceBased)}`);
      }
      keyNames.push(`${prefix}_range_${rangeKey}`)
    }

    // Set up additional arrays for each zScore property.
    for (const zScoreKey of zScore) {
      if (!(zScoreKey in verticalOhlcv) || !priceBased.includes(zScoreKey)) {
        throw new Error(`Invalid zScore item value "${zScoreKey}" for bollingerBands. Only price based key names are accepted:\n${JSON.stringify(priceBased)}`);
      }
      keyNames.push(`${prefix}_zscore_${zScoreKey}`)
    }

    const verticalOhlcvSetup = Object.fromEntries(keyNames.map(v => [v, [...nullArray]]))
    Object.assign(verticalOhlcv, {...verticalOhlcvSetup})

    if(lag > 0)
    {
      main.lag(keyNames, lag)
    }

    priceBased.push(`${prefix}_upper`, `${prefix}_middle`, `${prefix}_lower`);
  }

  // Derive prefix for subsequent calls if not set.
  if (!prefix) {
    const num = instances.bollinger_bands.numberOfIndicators;
    prefix = num > 1 ? `bollinger_bands_${indicatorKey}` : `bollinger_bands${suffix}`;
  }
  const subPrefix = prefix;

  // Update the indicator with the current value.
  const instance = instances.bollinger_bands.settings[indicatorKey];
  const value = verticalOhlcv[target][index];
  instance.update(value, lastIndexReplace);

  // Attempt to retrieve the result.
  let result = null;
  try {
    result = instance.getResult();
  } catch (err) {
    // If not available, result stays null.
  }

  // Use null fallbacks for the primary values.
  const upper = result?.upper ?? null;
  const middle = result?.middle ?? null;
  const lower = result?.lower ?? null;

  // Always push the indicator outputs.
  main.pushToMain({ index, key: `${subPrefix}_upper`, value: upper });
  main.pushToMain({ index, key: `${subPrefix}_middle`, value: middle });
  main.pushToMain({ index, key: `${subPrefix}_lower`, value: lower });

  // Process height if requested.
  if (height) {
    let heightValue = null;
    if (typeof upper === 'number' && typeof lower === 'number' && lower !== 0) {
      heightValue = calcMagnitude( ((upper - lower) / lower), 0.005)
    }
    main.pushToMain({ index, key: `${subPrefix}_height`, value: heightValue });
  }

  // Process each range property.
  for (const rangeKey of range) {
    let rangeValue = null;
    const priceValue = verticalOhlcv[rangeKey][index];
    if (typeof priceValue === 'number' && typeof lower === 'number' && typeof upper === 'number' && (upper - lower) !== 0) {
      rangeValue = (priceValue - lower) / (upper - lower);
      if (scale) {
        rangeValue = calcMagnitude(rangeValue, scale);
      }
    }
    main.pushToMain({ index, key: `${subPrefix}_range_${rangeKey}`, value: rangeValue });
  }

  // Process each zScore property.
  for (const zScoreKey of zScore) {
    let zScoreValue = null;
    const priceValue = verticalOhlcv[zScoreKey][index];
    if (
      typeof priceValue === 'number' &&
      typeof middle === 'number' &&
      typeof upper === 'number' &&
      typeof lower === 'number' &&
      (upper - lower) !== 0
    ) {
      zScoreValue = (2 * stdDev * (priceValue - middle)) / (upper - lower);
      if (scale) {
        zScoreValue = calcMagnitude(zScoreValue, scale);
      }
    }
    main.pushToMain({ index, key: `${subPrefix}_zscore_${zScoreKey}`, value: zScoreValue });
  }

  return true;
}
