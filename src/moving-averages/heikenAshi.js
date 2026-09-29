import { FasterEMA } from '../core-indicators/index.js';
import { validateInputValues } from '../utilities/validators.js';
import { initializeColumns } from '../core-functions/initializeColumns.js';
import { mathLog } from '../utilities/math.js';
const isBadNumber = v => v == null || !Number.isFinite(v);
const arithmeticReturn = (next, prev) => (next - prev) / prev;


export const heikenAshi = (
  main,
  index,
  smoothLength,
  afterSmoothLength,
  { lag = 0, noSmoothing = false, retLogs = false } = {}
) => {
  const { verticalOhlcv, instances, scaledGroups } = main;
  const instanceKey = noSmoothing
    ? 'heiken_ashi'
    : `heiken_ashi_${smoothLength}_${afterSmoothLength}`;

  // ---- INIT ----
  if (index === 0) {
    validateInputValues({ open: true, high: true, low: true, close: true }, verticalOhlcv, index, 'heikenAshi');
    const ohlcKeys = ['open', 'high', 'low', 'close'];
    const featureKeys = ['body', 'upper_wick', 'lower_wick', 'range'];
    const paramsKey = noSmoothing ? '' : `_${smoothLength}_${afterSmoothLength}`;
    const prefix = retLogs ? 'ret_log_' : 'ret_';
    const outputKeys = Object.fromEntries(
      featureKeys.map(key => [key, `${prefix}heiken_ashi_${key}${paramsKey}`])
    );
    const crossKey = `heiken_ashi_cross${paramsKey}`;
    const keyNames = Object.values(outputKeys);

    instances[instanceKey] = {
      emaPre: !noSmoothing
        ? Object.fromEntries(ohlcKeys.map(k => [k, new FasterEMA(smoothLength)]))
        : null,
      emaPost: !noSmoothing
        ? Object.fromEntries(ohlcKeys.map(k => [k, new FasterEMA(afterSmoothLength)]))
        : null,
      prevHaOpen: NaN,
      prevHaClose: NaN,
      prevSmOpen: NaN,
      prevSmClose: NaN,
      trendDirection: 0,
      getRet: retLogs ? mathLog : arithmeticReturn,
      outputKeys,
      crossKey
    };

    initializeColumns(main, [...keyNames, crossKey].map(key => ({ key })), { lag });

    if (scaledGroups) {
      scaledGroups.heikenAshi = keyNames;
    }
  }

  // ---- FETCH RAW INPUTS ----
  const open = verticalOhlcv.open[index];
  const high = verticalOhlcv.high[index];
  const low = verticalOhlcv.low[index];
  const close = verticalOhlcv.close[index];
  const inst = instances[instanceKey];
  const { crossKey, emaPre, emaPost, getRet, outputKeys } = inst;

  if (
    isBadNumber(open) ||
    isBadNumber(high) ||
    isBadNumber(low) ||
    isBadNumber(close)
  ) {
    return;
  }

  let sOpen, sHigh, sLow, sClose;

  if (emaPre !== null) {
    // ---- PRE-SMOOTHING EMA ----
    emaPre.open.update(open);
    emaPre.high.update(high);
    emaPre.low.update(low);
    emaPre.close.update(close);

    if (!emaPre.open.isStable || !emaPre.high.isStable ||
        !emaPre.low.isStable || !emaPre.close.isStable) return;
    sOpen = emaPre.open.getResult();
    sHigh = emaPre.high.getResult();
    sLow = emaPre.low.getResult();
    sClose = emaPre.close.getResult();
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
    return;
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

  if (emaPost !== null) {
    // ---- POST-SMOOTHING EMA ----
    emaPost.open.update(haOpen);
    emaPost.high.update(haHigh);
    emaPost.low.update(haLow);
    emaPost.close.update(haClose);

    if (!emaPost.open.isStable || !emaPost.high.isStable ||
        !emaPost.low.isStable || !emaPost.close.isStable) return;
    smOpen = emaPost.open.getResult();
    smHigh = emaPost.high.getResult();
    smLow = emaPost.low.getResult();
    smClose = emaPost.close.getResult();
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
    return;
  }

  // ---- TREND/CROSS LOGIC ----
  // Cross uses raw smoothed HA values, not the returned log/return features.
  const hasPrevious = (
    Number.isFinite(inst.prevSmOpen) &&
    Number.isFinite(inst.prevSmClose)
  )

  const prevCross = index > 0
    ? verticalOhlcv[crossKey][index - 1]
    : NaN

  // A doji preserves the established direction.
  // Before any direction exists, it remains neutral.
  const direction = smClose > smOpen
    ? 1
    : smClose < smOpen
      ? -1
      : inst.trendDirection

  let cross = 0

  if (hasPrevious && direction !== 0) {
    cross = Number.isFinite(prevCross) &&
            Math.sign(prevCross) === direction
      ? prevCross + direction
      : direction
  }

  inst.trendDirection = direction
  inst.prevSmOpen = smOpen
  inst.prevSmClose = smClose

  // ---- HEIKEN ASHI STRUCTURE RETURNS ----
  const bodyTop = Math.max(smOpen, smClose);
  const bodyBottom = Math.min(smOpen, smClose);

  const body = getRet(smClose, smOpen);
  const upperWick = getRet(smHigh, bodyTop);
  const lowerWick = getRet(bodyBottom, smLow);
  const range = getRet(smHigh, smLow);

  if (!isBadNumber(body)) main.pushToMain({ index, key: outputKeys.body, value: body });
  if (!isBadNumber(upperWick)) main.pushToMain({ index, key: outputKeys.upper_wick, value: upperWick });
  if (!isBadNumber(lowerWick)) main.pushToMain({ index, key: outputKeys.lower_wick, value: lowerWick });
  if (!isBadNumber(range)) main.pushToMain({ index, key: outputKeys.range, value: range });

  // Do not add return logs to cross.
  main.pushToMain({ index, key: crossKey, value: cross });
};
