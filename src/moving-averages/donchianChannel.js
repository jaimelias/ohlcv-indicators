
import { roundDecimalPlaces } from "../utilities/numberUtilities.js";

export const donchianChannels = (main, index, size, offset, options) => {

  

  const {verticalOhlcv, instances, len, inputParams, lag} = main
  const { height: includeHeight, range: rangeKeys, decimals } = options
  const indicatorKey = `${size}_${offset}`

  // ---- INIT (only at first bar) ----
  if (index === 0) {
    // how many donchianChannels calls in this session?
    const numberOfIndicators = inputParams.filter(o => o.key === 'donchianChannels').length;
    const basePrefix = 'donchian_channel';
    const prefix = numberOfIndicators > 1
      ? `${basePrefix}_${indicatorKey}`
      : basePrefix;

    // build all output keys once
    const keys = ['upper', 'basis', 'lower'].map(n => `${prefix}_${n}`);
    if (includeHeight) keys.push(`${prefix}_height`);
    for (const rk of rangeKeys) {
      if (!(rk in verticalOhlcv)) {
        throw new Error(
          `Invalid range key "${rk}".`
        );
      }
      keys.push(`${prefix}_range_${rk}`);
    }

    // bootstrap instance
    if (!instances.donchian_channel) {
      instances.donchian_channel = { numberOfIndicators, settings: {} };
    }
    instances.donchian_channel.numberOfIndicators = numberOfIndicators;
    instances.donchian_channel.settings[indicatorKey] = { maxDeque: [], minDeque: [] };

    // allocate & fill NaNs
    Object.assign(
      verticalOhlcv,
      Object.fromEntries(keys.map(k => [k, new Float64Array(len).fill(NaN)]))
    );

    // apply lag if requested
    if (lag > 0) main.lag(keys, lag)
  }

  // ---- PER-BAR COMPUTATION ----
  const { numberOfIndicators, settings } = instances.donchian_channel;
  const prefix = numberOfIndicators > 1
    ? `donchian_channel_${indicatorKey}`
    : 'donchian_channel';

  const { maxDeque, minDeque } = settings[indicatorKey];
  const current = index - offset;
  const start   = current - size + 1;

  // prepare key lists again (cheap)
  const outKeys    = ['upper','basis','lower'].map(n => `${prefix}_${n}`);
  if (includeHeight) outKeys.push(`${prefix}_height`);
  const rangeOut   = rangeKeys.map(rk => `${prefix}_range_${rk}`);

  // not enough data → push NaNs
  if (start < 0 || current + 1 > len) {
    [...outKeys, ...rangeOut].forEach(key =>
      main.pushToMain({ index, key, value: NaN })
    );
    return true;
  }

  const { high: highs, low: lows } = verticalOhlcv;

  // tiny helper to keep deques up-to-date
  const update = (dq, arr, cmp) => {
    while (dq.length && dq[0] < start)      dq.shift();
    while (dq.length && cmp(arr[dq.at(-1)], arr[current])) dq.pop();
    dq.push(current);
  };
  update(maxDeque, highs, (a,b) => a <= b);
  update(minDeque, lows,  (a,b) => a >= b);

  // single “bounds exist?” flag instead of repeated isNaN
  const hasBounds = maxDeque.length && minDeque.length;
  const upper     = hasBounds ? highs[maxDeque[0]] : NaN;
  const lower     = hasBounds ? lows[minDeque[0]]  : NaN;
  const basis     = hasBounds ? (upper + lower) / 2  : NaN;

  main.pushToMain({ index, key: `${prefix}_upper`, value: upper });
  main.pushToMain({ index, key: `${prefix}_basis`, value: basis });
  main.pushToMain({ index, key: `${prefix}_lower`, value: lower });

  if (includeHeight) {
    // avoid divide-by-zero
    const heightVal = hasBounds && lower
      ? (upper - lower) / lower
      : NaN;
    main.pushToMain({ index, key: `${prefix}_height`, value: (decimals === null) ? heightVal : roundDecimalPlaces(heightVal, decimals) });
  }

  // precompute spread once
  const spread = hasBounds ? (upper - lower) : NaN;

  // for each extra range key, use price===price to skip NaNs

  for(let i = 0; i < rangeKeys.length; i++)
  {
    const rk = rangeKeys[i]
    const price = verticalOhlcv[rk][index];
    const val   = hasBounds && price === price && spread
      ? (price - lower) / spread
      : NaN;
    main.pushToMain({ index, key: rangeOut[i], value: (decimals === null) ? val : roundDecimalPlaces(val, decimals) });
  }

  return true;
};
