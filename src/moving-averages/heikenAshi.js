import { FasterEMA } from 'trading-signals';

export const heikenAshi = (main, index, smoothLength, afterSmoothLength, { lag = 0, bothNull = false } = {}) => {
  const { verticalOhlcv, instances, len, priceBased } = main;
  const prefix = (bothNull) ?  'heiken_ashi' : `heiken_ashi_${smoothLength}_${afterSmoothLength}`;
  const keys = ['open', 'high', 'low', 'close'];

  // ---- INIT ----
  if (index === 0) {
    // Initialize state
    instances[prefix] = {
      // Only allocate EMAs when smoothing is requested
      emaPre: !bothNull
        ? Object.fromEntries(keys.map(k => [k, new FasterEMA(smoothLength)]))
        : null,
      emaPost: !bothNull
        ? Object.fromEntries(keys.map(k => [k, new FasterEMA(afterSmoothLength)]))
        : null,
      prevHaOpen: NaN,
      prevHaClose: NaN,
      isTrendUp: false,
    };

    const keyNames = keys.map(k => `${prefix}_${k}`);
    const verticalOhlcvSetup = Object.fromEntries(
      [...keyNames, `${prefix}_cross`].map(v => [v, new Float64Array(len).fill(NaN)])
    );

    for(const k of keyNames) {
      priceBased.add(k)
    }

    Object.assign(verticalOhlcv, { ...verticalOhlcvSetup });

    if (lag > 0) {
      main.lag(keyNames, lag);
    }
  }

  // ---- FETCH RAW INPUTS ----
  const open = verticalOhlcv.open[index];
  const high = verticalOhlcv.high[index];
  const low = verticalOhlcv.low[index];
  const close = verticalOhlcv.close[index];
  const inst = instances[prefix];

  let sOpen, sHigh, sLow, sClose;

  if (!bothNull) {
    // ---- PRE-SMOOTHING (EMA) ----
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
      return true; // skip if not enough data
    }
  } else {
    // No pre-smoothing: use raw OHLC
    sOpen = open;
    sHigh = high;
    sLow = low;
    sClose = close;
  }

  // ---- HEIKEN ASHI CORE (from s*) ----
  const haClose = (sOpen + sHigh + sLow + sClose) / 4;
  const haOpen = (Number.isNaN(inst.prevHaOpen) || Number.isNaN(inst.prevHaClose))
    ? (sOpen + sClose) / 2
    : (inst.prevHaOpen + inst.prevHaClose) / 2;
  const haHigh = Math.max(sHigh, haOpen, haClose);
  const haLow = Math.min(sLow, haOpen, haClose);

  // Store for next round
  inst.prevHaOpen = haOpen;
  inst.prevHaClose = haClose;

  let smOpen, smHigh, smLow, smClose;

  if (!bothNull) {
    // ---- POST-SMOOTHING (EMA) ----
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
      return true; // skip if not enough data
    }
  } else {
    // No post-smoothing: final values are plain HA
    smOpen = haOpen;
    smHigh = haHigh;
    smLow = haLow;
    smClose = haClose;
  }

  // ---- TREND/CROSS LOGIC (works for both modes) ----
  const prevCross = index > 0 ? verticalOhlcv[`${prefix}_cross`][index - 1] : 0;
  const prevHaOpenArr = index > 0 ? verticalOhlcv[`${prefix}_open`][index - 1] : NaN;
  const prevHaCloseArr = index > 0 ? verticalOhlcv[`${prefix}_close`][index - 1] : NaN;

  const crossUp = !Number.isNaN(prevHaCloseArr) && prevHaCloseArr <= prevHaOpenArr && smClose > smOpen;
  const crossDown = !Number.isNaN(prevHaCloseArr) && prevHaCloseArr >= prevHaOpenArr && smClose < smOpen;

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

  // ---- PUSH OUTPUTS ----
  main.pushToMain({ index, key: `${prefix}_open`, value: smOpen });
  main.pushToMain({ index, key: `${prefix}_high`, value: smHigh });
  main.pushToMain({ index, key: `${prefix}_low`, value: smLow });
  main.pushToMain({ index, key: `${prefix}_close`, value: smClose });
  main.pushToMain({ index, key: `${prefix}_cross`, value: cross });

  return true;
};
