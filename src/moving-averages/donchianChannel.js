import { FasterSMA } from 'trading-signals';
import { classifySize } from '../utilities/classification.js';

export const donchianChannels = (main, index, size, offset, options) => {
  const { height, range } = options;
  const highs = main.verticalOhlcv.high;
  const lows = main.verticalOhlcv.low;
  const indicatorKey = `${size}_${offset}`;

  // Initialization: create output arrays and indicator instance on the first call.
  if (index === 0) {
    const numberOfIndicators = main.inputParams.filter(o => o.key === 'donchianChannels').length;
    const prefix =
      numberOfIndicators > 1 ? `donchian_channel_${size}_${offset}` : 'donchian_channel';

    Object.assign(main.verticalOhlcv, {
      [`${prefix}_upper`]: [...main.nullArray],
      [`${prefix}_basis`]: [...main.nullArray],
      [`${prefix}_lower`]: [...main.nullArray],
      ...(height && { [`${prefix}_height`]: [...main.nullArray] }),
      ...(range && { [`${prefix}_range`]: [...main.nullArray] })
    });

    if(!main.instances.hasOwnProperty('donchian_channel'))
    {
      main.instances.donchian_channel = {numberOfIndicators, settings: {}}
    }

    main.instances.donchian_channel.settings[indicatorKey] = {
      heightInstance: height
        ? new FasterSMA(typeof height === 'number' && height > 0 ? height : size)
        : null
    }
  }

  // Determine the proper key for output arrays based on the number of indicators.
  const numberOfIndicators = main.instances.donchian_channel.numberOfIndicators;
  const subPrefix =
    numberOfIndicators > 1 ? `donchian_channel_${size}_${offset}` : 'donchian_channel';
  const { heightInstance } = main.instances.donchian_channel.settings[indicatorKey];

  // Determine the slice indices for exactly `size` bars.
  const endIdx = (index - offset) + 1; // inclusive
  const startIdx = endIdx - size;

  // If the slice indices are out of bounds, exit early.
  if (startIdx < 0 || endIdx > main.len) return true;

  // Slice the required portions of the high and low arrays.
  const highChunk = highs.slice(startIdx, endIdx);
  const lowChunk = lows.slice(startIdx, endIdx);

  // Compute the Donchian channels.
  const upper = Math.max(...highChunk);
  const lower = Math.min(...lowChunk);
  const basis = (upper + lower) / 2;
  const close = main.verticalOhlcv.close[index];
  const rangeValue = (close - lower) / (upper - lower);
  const heightValue = upper - lower;

  // Update the height indicator if requested.
  if (height && heightInstance) {
    heightInstance.update(heightValue, main.lastIndexReplace);
  }

  // Update the computed values in the output arrays if the index is valid.
  if (index >= 0 && index < main.len) {
    main.verticalOhlcv[`${subPrefix}_upper`][index] = upper;
    main.verticalOhlcv[`${subPrefix}_basis`][index] = basis;
    main.verticalOhlcv[`${subPrefix}_lower`][index] = lower;

    if (range) {
      main.verticalOhlcv[`${subPrefix}_range`][index] = rangeValue;
    }
    if (height && heightInstance) {
      let heightMean;
      try {
        heightMean = heightInstance.getResult();
      } catch (err) {
        // Ignore errors if the result isn't ready.
      }
      if (heightMean) {
        main.verticalOhlcv[`${subPrefix}_height`][index] = classifySize(heightValue, heightMean, 1.5);
      }
    }
  }

  return true;
};
