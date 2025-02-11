import { FasterBollingerBands, FasterSMA } from 'trading-signals';
import { classifySize } from '../utilities/classification.js';

const defaultTarget = 'close';

export const bollingerBands = (main, index, size, stdDev, options) => {
  // Destructure options; ensure range and zScore default to empty arrays if not provided.
  const { height, range = [], zScore = [], target } = options;
  const suffix = target === defaultTarget ? '' : `_${target}`;
  const indicatorKey = `${size}_${stdDev}${suffix}`;
  let prefix; // Will be computed during initialization

  // Initialize indicator instances and output arrays on the first call.
  if (index === 0) {
    if (!(target in main.verticalOhlcv)) {
      throw new Error(`bollingerBands could not find target "${target}"`);
    }

    const numberOfIndicators = main.inputParams.filter(o => o.key === 'bollingerBands').length;
    // Choose a prefix based on the number of indicators.
    prefix = numberOfIndicators > 1
      ? `bollinger_bands_${indicatorKey}`
      : `bollinger_bands${suffix}`;

    // Ensure the container exists.
    if (!main.instances.bollinger_bands) {
      main.instances.bollinger_bands = {
        numberOfIndicators,
        settings: {}
      };
    }

    // Create the Bollinger Bands (and optional height) indicator instance.
    main.instances.bollinger_bands.settings[indicatorKey] = {
      instance: new FasterBollingerBands(size, stdDev),
      heightInstance: height >= size ? new FasterSMA(height) : null
    };

    // Build the base output arrays.
    const ohlcvSetup = {
      [`${prefix}_upper`]: [...main.nullArray],
      [`${prefix}_middle`]: [...main.nullArray],
      [`${prefix}_lower`]: [...main.nullArray],
      ...(height >= size && { [`${prefix}_height`]: [...main.nullArray] })
    };




    // Set up additional arrays for each range property.
    for (const rangeKey of range) {
      if (!(rangeKey in main.verticalOhlcv) || !main.priceBased.includes(rangeKey)) {
        throw new Error(`Invalid range item value "${rangeKey}" property for bollingerBands. Only price based key names are accepted:\n${JSON.stringify(main.priceBased)}`);
      }
      ohlcvSetup[`${prefix}_range_${rangeKey}`] = [...main.nullArray];
    }

    // Set up additional arrays for each zScore property.
    for (const zScoreKey of zScore) {
      if (!(zScoreKey in main.verticalOhlcv) || !main.priceBased.includes(zScoreKey)) {
        throw new Error(`Invalid zScore item value "${zScoreKey}" for bollingerBands. Only price based key names are accepted:\n${JSON.stringify(main.priceBased)}`);
      }
      ohlcvSetup[`${prefix}_zscore_${zScoreKey}`] = [...main.nullArray];
    }

    // Merge the new arrays into verticalOhlcv.
    Object.assign(main.verticalOhlcv, ohlcvSetup);
  }

  // For subsequent calls, if prefix wasn’t computed (i.e. index > 0), derive it.
  if (!prefix) {
    const num = main.instances.bollinger_bands.numberOfIndicators;
    prefix = num > 1 ? `bollinger_bands_${indicatorKey}` : `bollinger_bands${suffix}`;
  }
  // Use the same prefix for output keys.
  const subPrefix = prefix;

  // Retrieve the indicator instance(s) and update with the current value.
  const { instance, heightInstance } = main.instances.bollinger_bands.settings[indicatorKey];
  const value = main.verticalOhlcv[target][index];
  instance.update(value, main.lastIndexReplace);

  let result;
  try {
    result = instance.getResult();
  } catch (err) {
    // If the result is not available yet, simply exit.
  }
  if (!result) return true;

  const { upper, middle, lower } = result;
  main.pushToMain({index, key: `${subPrefix}_upper`, value: upper})
  main.pushToMain({index, key: `${subPrefix}_middle`, value: middle})
  main.pushToMain({index, key: `${subPrefix}_lower`, value: lower})

  // Exit early if neither height nor range are requested.
  if (!height && !range) return true;

  // Process height if a height instance exists.
  if (heightInstance) {
    const heightValue = upper - lower;
    heightInstance.update(heightValue, main.lastIndexReplace);
    let heightMean;
    try {
      heightMean = heightInstance.getResult();
    } catch (err) {
      // Swallow error if the height result is not ready.
    }
    if (heightMean) {
      main.pushToMain({index, key: `${subPrefix}_height`, value: classifySize(heightValue, heightMean, 0.5, 7)})
    }
  }

  // Process each range property.
  for (const rangeKey of range) {
    const rangeValue = (main.verticalOhlcv[rangeKey][index] - lower) / (upper - lower);
    main.pushToMain({index, key: `${subPrefix}_range_${rangeKey}`, value: rangeValue})
  }

  // Process each zScore property.
  for (const zScoreKey of zScore) {
    const denominator = upper - lower;
    const zScoreValue = denominator !== 0
      ? (2 * stdDev * (main.verticalOhlcv[zScoreKey][index] - middle)) / denominator
      : 0;

      
    main.pushToMain({index, key: `${subPrefix}_zscore_${zScoreKey}`, value: zScoreValue})
  }

  return true;
};
