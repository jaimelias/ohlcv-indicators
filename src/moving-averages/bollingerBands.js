import { FasterBollingerBands, FasterSMA } from 'trading-signals';
import { classifySize } from '../utilities/classification.js';

const defaultTarget = 'close';

export const bollingerBands = (main, index, size, times, options) => {
  const { height, range, target } = options;
  const suffix = target === defaultTarget ? '' : `_${target}`;
  const indicatorKey = `${size}_${times}${suffix}`;

  if (index === 0) {
    if (!main.verticalOhlcv.hasOwnProperty(target)) {
      throw new Error(`bollingerBands could not find target "${target}"`);
    }

    const numberOfIndicators = main.inputParams.filter(o => o.key === 'bollingerBands').length;
    const prefix =
      numberOfIndicators > 1
        ? `bollinger_bands_${size}_${times}${suffix}`
        : `bollinger_bands${suffix}`;

    // Initialize the instance container if it does not exist.

    if(!main.instances.hasOwnProperty('bollinger_bands'))
    {
      main.instances.bollinger_bands = {
        numberOfIndicators,
        settings: {}
      }
    }

    // Create the Bollinger Bands (and optional height) indicator instance.
    main.instances.bollinger_bands.settings[indicatorKey] = {
      instance: new FasterBollingerBands(size, times),
      heightInstance: height ? new FasterSMA(size) : null,
    };

    // Set up the output arrays.
    const ohlcvSetup = {
      [`${prefix}_upper`]: [...main.nullArray],
      [`${prefix}_middle`]: [...main.nullArray],
      [`${prefix}_lower`]: [...main.nullArray],
      ...(height && { [`${prefix}_height`]: [...main.nullArray] }),
      ...(range && { [`${prefix}_range`]: [...main.nullArray] }),
    };

    Object.assign(main.verticalOhlcv, ohlcvSetup);
  }

  // Determine the prefix used for output keys.
  const subPrefix =
    main.instances.bollinger_bands.numberOfIndicators > 1
      ? `bollinger_bands_${size}_${times}${suffix}`
      : `bollinger_bands${suffix}`;

  const { instance, heightInstance } = main.instances.bollinger_bands.settings[indicatorKey];
  const value = main.verticalOhlcv[target][index];

  instance.update(value, main.lastIndexReplace);

  let result;
  try {
    result = instance.getResult();
  } catch (err) {
    // Swallow error if result is not available yet.
  }

  if (!result) return true;

  const { upper, middle, lower } = result;
  main.verticalOhlcv[`${subPrefix}_upper`][index] = upper;
  main.verticalOhlcv[`${subPrefix}_middle`][index] = middle;
  main.verticalOhlcv[`${subPrefix}_lower`][index] = lower;

  // If neither height nor range is requested, exit early.
  if (!height && !range) return true;

  const rangeValue = (value - lower) / (upper - lower);
  const heightValue = upper - lower;

  if (heightInstance) {
    heightInstance.update(heightValue, main.lastIndexReplace);
  }

  let heightMean;
  try {
    if (heightInstance) {
      heightMean = heightInstance.getResult();
    }
  } catch (err) {
    // Swallow error if height result is not ready.
  }

  main.verticalOhlcv[`${subPrefix}_range`][index] = rangeValue;

  if (heightMean) {
    main.verticalOhlcv[`${subPrefix}_height`][index] = classifySize(heightValue, heightMean, 1.5);
  }

  return true;
};
