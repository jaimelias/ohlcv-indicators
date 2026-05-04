import { FasterEMA } from 'trading-signals';

const isBadNumber = v => v == null || !Number.isFinite(v);

export const heikenAshi = (
  main,
  index,
  smoothLength,
  afterSmoothLength,
  { lag = 0, bothNull = false, retLogs = true } = {}
) => {
  const { verticalOhlcv, instances, len, scaledGroups } = main;
  const indicatorKey = `${smoothLength}_${afterSmoothLength}`;
  const ohlcKeys = ['open', 'high', 'low', 'close'];

  const getRet = (next, prev) => retLogs
    ? Math.log(next / prev)
    : (next - prev) / prev;

  const prefix = retLogs ? 'ret_log_' : 'ret_';

  const paramsKey = bothNull ? '' : `_${indicatorKey}`;

  const getKey = key => `${prefix}heiken_ashi_${key}${paramsKey}`;

  const featureKeys = [
    'body',
    'upper_wick',
    'lower_wick',
    'range'
  ];

  const crossKey = bothNull
    ? 'heiken_ashi_cross'
    : `heiken_ashi_cross_${indicatorKey}`;

  const instanceKey = bothNull
    ? 'heiken_ashi'
    : `heiken_ashi_${indicatorKey}`;

  // ---- INIT ----
  if (index === 0) {
    instances[instanceKey] = {
      emaPre: !bothNull
        ? Object.fromEntries(ohlcKeys.map(k => [k, new FasterEMA(smoothLength)]))
        : null,
      emaPost: !bothNull
        ? Object.fromEntries(ohlcKeys.map(k => [k, new FasterEMA(afterSmoothLength)]))
        : null,
      prevHaOpen: NaN,
      prevHaClose: NaN,
      prevSmOpen: NaN,
      prevSmClose: NaN,
      isTrendUp: false,
    };

    const keyNames = featureKeys.map(getKey);

    const verticalOhlcvSetup = Object.fromEntries(
      [...keyNames, crossKey].map(k => [k, new Float64Array(len).fill(NaN)])
    );

    Object.assign(verticalOhlcv, verticalOhlcvSetup);

    if (scaledGroups) {
      scaledGroups.heikenAshi = keyNames;
    }

    if (lag > 0) {
      main.lag(keyNames, lag);
    }
  }

  // ---- FETCH RAW INPUTS ----
  const open = verticalOhlcv.open[index];
  const high = verticalOhlcv.high[index];
  const low = verticalOhlcv.low[index];
  const close = verticalOhlcv.close[index];
  const inst = instances[instanceKey];

  if (
    isBadNumber(open) ||
    isBadNumber(high) ||
    isBadNumber(low) ||
    isBadNumber(close)
  ) {
    return true;
  }

  let sOpen, sHigh, sLow, sClose;

  if (!bothNull) {
    // ---- PRE-SMOOTHING EMA ----
    inst.emaPre.open.update(open);
    inst.emaPre.high.update(high);
    inst.emaPre.low.update(low);
    inst.emaPre.close.update(close);

    try {
      sOpen = inst.emaPre.open.getResult();
      sHigh = inst.emaPre.high.getResult();
      sLow = inst.emaPre.low.getResult();
      sClose = inst.emaPre.close.getResult();
    } catch {
      return true;
    }
  } else {
    sOpen = open;
    sHigh = high;
    sLow = low;
    sClose = close;
  }

  if (
    isBadNumber(sOpen) ||
    isBadNumber(sHigh) ||
    isBadNumber(sLow) ||
    isBadNumber(sClose)
  ) {
    return true;
  }

  // ---- HEIKEN ASHI CORE ----
  const haClose = (sOpen + sHigh + sLow + sClose) / 4;

  const haOpen = (
    Number.isNaN(inst.prevHaOpen) ||
    Number.isNaN(inst.prevHaClose)
  )
    ? (sOpen + sClose) / 2
    : (inst.prevHaOpen + inst.prevHaClose) / 2;

  const haHigh = Math.max(sHigh, haOpen, haClose);
  const haLow = Math.min(sLow, haOpen, haClose);

  inst.prevHaOpen = haOpen;
  inst.prevHaClose = haClose;

  let smOpen, smHigh, smLow, smClose;

  if (!bothNull) {
    // ---- POST-SMOOTHING EMA ----
    inst.emaPost.open.update(haOpen);
    inst.emaPost.high.update(haHigh);
    inst.emaPost.low.update(haLow);
    inst.emaPost.close.update(haClose);

    try {
      smOpen = inst.emaPost.open.getResult();
      smHigh = inst.emaPost.high.getResult();
      smLow = inst.emaPost.low.getResult();
      smClose = inst.emaPost.close.getResult();
    } catch {
      return true;
    }
  } else {
    smOpen = haOpen;
    smHigh = haHigh;
    smLow = haLow;
    smClose = haClose;
  }

  if (
    isBadNumber(smOpen) ||
    isBadNumber(smHigh) ||
    isBadNumber(smLow) ||
    isBadNumber(smClose) ||
    smOpen <= 0 ||
    smHigh <= 0 ||
    smLow <= 0 ||
    smClose <= 0
  ) {
    return true;
  }

  // ---- TREND/CROSS LOGIC ----
  // Cross uses raw smoothed HA values, not the returned log/return features.
  const prevCross = index > 0 ? verticalOhlcv[crossKey][index - 1] : 0;
  const prevSmOpen = inst.prevSmOpen;
  const prevSmClose = inst.prevSmClose;

  const crossUp = (
    Number.isFinite(prevSmOpen) &&
    Number.isFinite(prevSmClose) &&
    prevSmClose <= prevSmOpen &&
    smClose > smOpen
  );

  const crossDown = (
    Number.isFinite(prevSmOpen) &&
    Number.isFinite(prevSmClose) &&
    prevSmClose >= prevSmOpen &&
    smClose < smOpen
  );

  if (crossUp) inst.isTrendUp = true;
  if (crossDown) inst.isTrendUp = false;

  let cross = 0;

  if (index > 0) {
    if (inst.isTrendUp) {
      cross = prevCross > 0 ? prevCross + 1 : 1;
    } else {
      cross = prevCross < 0 ? prevCross - 1 : -1;
    }
  }

  // Store previous raw smoothed HA values after cross calculation.
  inst.prevSmOpen = smOpen;
  inst.prevSmClose = smClose;

  // ---- HEIKEN ASHI STRUCTURE RETURNS ----
  const bodyTop = Math.max(smOpen, smClose);
  const bodyBottom = Math.min(smOpen, smClose);

  const row = {
    [getKey('body')]: getRet(smClose, smOpen),
    [getKey('upper_wick')]: getRet(smHigh, bodyTop),
    [getKey('lower_wick')]: getRet(bodyBottom, smLow),
    [getKey('range')]: getRet(smHigh, smLow),
  };

  for (const [key, value] of Object.entries(row)) {
    if (!isBadNumber(value)) {
      main.pushToMain({ index, key, value });
    }
  }

  // Do not add return logs to cross.
  main.pushToMain({ index, key: crossKey, value: cross });

  return true;
};