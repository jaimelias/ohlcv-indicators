import { FasterSMA } from 'trading-signals';
// Variable Index Dynamic Average (VIDYA) indicator with volume stats

export const vidya = (main, index, size, momentum, options = {}) => {
  const { verticalOhlcv, instances, len, arrayTypes, lag } = main;
  const { target = 'close', atrLength = 200, bandDistance = 2 } = options;
  const indicatorKey = `${size}_${momentum}`;

  // Initialization on the first bar
  if (index === 0) {
    if (!(target in verticalOhlcv)) {
      throw new Error(`VIDYA could not find target "${target}"`);
    }

    const prefix = `vidya_${indicatorKey}`;
    const keyBase = target === 'close' ? prefix : `${prefix}_${target}`;
    const keys = {
      vidya: keyBase,
      upper: `${prefix}_upper`, lower: `${prefix}_lower`,
      up:    `${prefix}_trendUp`, down: `${prefix}_trendDown`,
      volume: `${prefix}_vol`, buyVol: `${prefix}_buyVol`, sellVol: `${prefix}_sellVol`, deltaVol: `${prefix}_deltaVol`,
      cross: `${prefix}_cross`
    };

    // Prepare instances container
    if (!instances.vidya) instances.vidya = { settings: {} };
    instances.vidya.settings[indicatorKey] = {
      momentumBuffer: [], prevVidya: NaN,
      sma: new FasterSMA(15), atrBuffer: [],
      isTrendUp: false, upVol: 0, downVol: 0
    };

    // Allocate output arrays
    Object.values(keys).forEach(key => {
      verticalOhlcv[key] = new Float64Array(len).fill(NaN);
      arrayTypes[key] = 'Float64Array';
    });
    if (lag > 0) main.lag(Object.values(keys), lag);
  }

  // Per-bar computation
  const inst = instances.vidya.settings[indicatorKey];
  const prefix = `vidya_${indicatorKey}`;
  const keyBase = target === 'close' ? prefix : `${prefix}_${target}`;
  const keys = {
    vidya: keyBase,
    upper: `${prefix}_upper`, lower: `${prefix}_lower`,
    up:    `${prefix}_trendUp`, down: `${prefix}_trendDown`,
    volume: `${prefix}_vol`, buyVol: `${prefix}_buyVol`, sellVol: `${prefix}_sellVol`, deltaVol: `${prefix}_deltaVol`,
    cross: `${prefix}_cross`
  };

  // Series inputs
  const price = verticalOhlcv[target][index];
  const high  = verticalOhlcv.high[index];
  const low   = verticalOhlcv.low[index];
  const close = verticalOhlcv.close[index];
  const open  = verticalOhlcv.open[index];
  const vol   = verticalOhlcv.volume[index];
  const prevCross = index > 0 ? verticalOhlcv[keys.cross][index - 1] : 0;

  // Compute ATR (Wilder's RMA)
  if (index > 0) {
    const prevClose = verticalOhlcv.close[index - 1];
    const tr = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    );
    inst.atrBuffer.push(tr);
    if (inst.atrBuffer.length > atrLength) inst.atrBuffer.shift();
  }
  const atr = inst.atrBuffer.length === atrLength
    ? inst.atrBuffer.reduce((a, b) => a + b, 0) / atrLength
    : NaN;

  // Compute raw VIDYA
  let rawVidya = NaN;
  let mom = NaN;
  if (index > 0) mom = price - verticalOhlcv[target][index - 1];
  inst.momentumBuffer.push(mom);
  if (inst.momentumBuffer.length > momentum) inst.momentumBuffer.shift();
  if (inst.momentumBuffer.length === momentum) {
    let sumPos = 0, sumNeg = 0;
    inst.momentumBuffer.forEach(m => m >= 0 ? sumPos += m : sumNeg += -m);
    const denom = sumPos + sumNeg;
    const cmo = denom === 0 ? 0 : Math.abs((sumPos - sumNeg) / denom) * 100;
    const alpha = 2 / (size + 1);
    const a = alpha * (cmo / 100);
    rawVidya = isNaN(inst.prevVidya) ? price : (a * price + (1 - a) * inst.prevVidya);
    inst.prevVidya = rawVidya;
  }

  // Smooth VIDYA using fixed 15-bar SMA
  inst.sma.update(rawVidya);
  let smoothedVidya = NaN;
  try { smoothedVidya = inst.sma.getResult(); } catch {}

  // Bands
  const upper = (!isNaN(atr) && !isNaN(smoothedVidya))
    ? smoothedVidya + atr * bandDistance
    : NaN;
  const lower = (!isNaN(atr) && !isNaN(smoothedVidya))
    ? smoothedVidya - atr * bandDistance
    : NaN;

  // Detect crosses
  const prevPrice = index > 0 ? verticalOhlcv[target][index - 1] : NaN;
  const prevUpper = index > 0 ? verticalOhlcv[keys.upper][index - 1] : NaN;
  const prevLower = index > 0 ? verticalOhlcv[keys.lower][index - 1] : NaN;
  const crossUp   = index > 0 && prevPrice <= prevUpper && price > upper;
  const crossDown = index > 0 && prevPrice >= prevLower && price < lower;

  // Update trend state
  if (crossUp) inst.isTrendUp = true;
  if (crossDown) inst.isTrendUp = false;

  // Cumulative cross counter: positive when uptrend, negative when downtrend
  let cross = 0;
  if (index > 0) {
    if (inst.isTrendUp) {
      cross = prevCross > 0 ? prevCross + 1 : 1;
    } else {
      cross = prevCross < 0 ? prevCross - 1 : -1;
    }
  }

  // Volume accumulation
  if (crossUp || crossDown) {
    inst.upVol = inst.downVol = 0;
  } else {
    inst.upVol   += (close > open ? vol : 0);
    inst.downVol += (close < open ? vol : 0);
  }
  const avgVol = (inst.upVol + inst.downVol) / 2 || 1;
  const deltaPct = (inst.upVol - inst.downVol) / avgVol;

  // Trend-based boundary (reset on crossover)
  const trendValue = (!crossUp && !crossDown)
    ? (inst.isTrendUp ? lower : upper)
    : NaN;

  // Push outputs
  main.pushToMain({ index, key: keys.vidya, value: trendValue });
  main.pushToMain({ index, key: keys.upper, value: upper });
  main.pushToMain({ index, key: keys.lower, value: lower });
  main.pushToMain({ index, key: keys.up, value: crossUp ? 1 : 0 });
  main.pushToMain({ index, key: keys.down, value: crossDown ? 1 : 0 });
  main.pushToMain({ index, key: keys.volume, value: vol });
  main.pushToMain({ index, key: keys.buyVol, value: inst.upVol });
  main.pushToMain({ index, key: keys.sellVol, value: inst.downVol });
  main.pushToMain({ index, key: keys.deltaVol, value: deltaPct });
  main.pushToMain({ index, key: keys.cross, value: cross });

  return true;
};
