import { FasterSMA } from 'trading-signals';
import { classifySize } from '../utilities/classification.js';

export const donchianChannels = (main, index, size, offset, options) => {
  const { height, range } = options;
  const indicatorKey = `${size}_${offset}`;

  // Initialization: create output arrays and indicator instance on the first call.
  if (index === 0) {
    const numberOfIndicators = main.inputParams.filter(o => o.key === 'donchianChannels').length;
    const prefix = numberOfIndicators > 1 ? `donchian_channel_${indicatorKey}` : 'donchian_channel';

    Object.assign(main.verticalOhlcv, {
      [`${prefix}_upper`]: [...main.nullArray],
      [`${prefix}_basis`]: [...main.nullArray],
      [`${prefix}_lower`]: [...main.nullArray],
      ...(height && { [`${prefix}_height`]: [...main.nullArray] }),
      ...(range && { [`${prefix}_range`]: [...main.nullArray] })
    });

    if (!main.instances.hasOwnProperty('donchian_channel')) {
      main.instances.donchian_channel = { numberOfIndicators, settings: {} };
    }

    // In addition to your heightInstance, also initialize deques for highs and lows.
    main.instances.donchian_channel.settings[indicatorKey] = {
      heightInstance: height
        ? new FasterSMA(typeof height === 'number' && height > 0 ? height : size)
        : null,
      maxDeque: [], // will hold indices for highs in descending order
      minDeque: []  // will hold indices for lows in ascending order
    };
  }

  const numberOfIndicators = main.instances.donchian_channel.numberOfIndicators;
  const subPrefix = numberOfIndicators > 1 ? `donchian_channel_${indicatorKey}` : 'donchian_channel';
  const state = main.instances.donchian_channel.settings[indicatorKey];
  const { heightInstance, maxDeque, minDeque } = state;

  // Compute the “current bar index” for the window.
  // Note: We use index - offset so that the window is built on the proper part of the array.
  const currentBarIdx = index - offset;
  const endIdx = currentBarIdx + 1;    // currentBarIdx is inclusive
  const startIdx = endIdx - size;        // window: [startIdx, endIdx)

  // If the window is not fully available, exit early.
  if (startIdx < 0 || endIdx > main.len) return true;

  const highs = main.verticalOhlcv.high;
  const lows = main.verticalOhlcv.low;

  // **Update the maximum deque:**
  // Remove indices that are out of the current window.
  while (maxDeque.length && maxDeque[0] < startIdx) {
    maxDeque.shift();
  }
  // Remove indices whose corresponding high value is less than or equal to the current high.
  while (maxDeque.length && highs[maxDeque[maxDeque.length - 1]] <= highs[currentBarIdx]) {
    maxDeque.pop();
  }
  // Add the current index.
  maxDeque.push(currentBarIdx);

  // **Update the minimum deque:**
  // Remove indices that are out of the current window.
  while (minDeque.length && minDeque[0] < startIdx) {
    minDeque.shift();
  }
  // Remove indices whose corresponding low value is greater than or equal to the current low.
  while (minDeque.length && lows[minDeque[minDeque.length - 1]] >= lows[currentBarIdx]) {
    minDeque.pop();
  }
  // Add the current index.
  minDeque.push(currentBarIdx);

  // Now the maximum high is at the front of maxDeque and the minimum low is at the front of minDeque.
  const upper = highs[maxDeque[0]];
  const lower = lows[minDeque[0]];
  const basis = (upper + lower) / 2;
  const close = main.verticalOhlcv.close[index];
  const rangeValue = (close - lower) / (upper - lower);
  const heightValue = upper - lower;

  // Update the height indicator if requested.
  if (height && heightInstance) {
    heightInstance.update(heightValue, main.lastIndexReplace);
  }

  // Update the computed values in the output arrays.

  main.pushToMain({index, key: `${subPrefix}_upper`, value: upper})
  main.pushToMain({index, key: `${subPrefix}_basis`, value: basis})
  main.pushToMain({index, key: `${subPrefix}_lower`, value: lower})

  if (range) {
    main.pushToMain({index, key: `${subPrefix}_range`, value: rangeValue})
  }
  if (height && heightInstance) {
    let heightMean;
    try {
      heightMean = heightInstance.getResult();
    } catch (err) {
      // Ignore errors if the result isn't ready.
    }
    if (heightMean) {

      main.pushToMain({index, key: `${subPrefix}_height`, value: classifySize(heightValue, heightMean, 1.5)})
    }
  }

  return true;
};
