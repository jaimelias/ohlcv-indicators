import { FasterEMA } from 'trading-signals';

export const heikenAshi = (main, index, smoothLength, afterSmoothLength, {lag}) => {
  const { verticalOhlcv, instances, len } = main;

  const prefix = `heiken_ashi_${smoothLength}_${afterSmoothLength}`
  const keys = ['open', 'high', 'low', 'close']

  // ---- INIT ----
  if (index === 0) {
    // Initialize pre-smoothing EMA instances and buffers
    instances[prefix] = {
      emaPre: Object.fromEntries(keys.map(k => [k, new FasterEMA(smoothLength)])),
      emaPost: Object.fromEntries(keys.map(k => [k, new FasterEMA(afterSmoothLength)])),
      prevHaOpen: NaN,
      prevHaClose: NaN,
    };

    const keyNames = keys.map(k => `${prefix}_${k}`)

    const verticalOhlcvSetup = Object.fromEntries(keyNames.map(v => [v, new Float64Array(len).fill(NaN)]))

    Object.assign(verticalOhlcv, {...verticalOhlcvSetup})

    if(lag > 0)
    {
      main.lag(keyNames, lag)
    }
  }

  // ---- FETCH RAW INPUTS ----
  const o = verticalOhlcv.open[index]
  const h = verticalOhlcv.high[index]
  const l = verticalOhlcv.low[index]
  const c = verticalOhlcv.close[index]

  if ([o, h, l, c].some(v => Number.isNaN(v))) return true;

  const state = instances[prefix]

  // ---- PRE-SMOOTHING (EMA) ----
  state.emaPre.open.update(o)
  state.emaPre.high.update(h)
  state.emaPre.low.update(l)
  state.emaPre.close.update(c)

  let sOpen, sHigh, sLow, sClose;
  try {
    sOpen = state.emaPre.open.getResult()
    sHigh = state.emaPre.high.getResult()
    sLow = state.emaPre.low.getResult()
    sClose = state.emaPre.close.getResult()
  } catch {
    return true; // skip if not enough data
  }

  // ---- HEIKEN ASHI CORE ----
  const haClose = (sOpen + sHigh + sLow + sClose) / 4;
  const haOpen = (Number.isNaN(state.prevHaOpen) || Number.isNaN(state.prevHaClose))
    ? (sOpen + sClose) / 2
    : (state.prevHaOpen + state.prevHaClose) / 2;
  const haHigh = Math.max(sHigh, haOpen, haClose)
  const haLow = Math.min(sLow, haOpen, haClose)

  // Store for next round
  state.prevHaOpen = haOpen
  state.prevHaClose = haClose

  // ---- POST-SMOOTHING (EMA) ----
  state.emaPost.open.update(haOpen)
  state.emaPost.high.update(haHigh)
  state.emaPost.low.update(haLow)
  state.emaPost.close.update(haClose)

  let smOpen, smHigh, smLow, smClose

  try {
    smOpen = state.emaPost.open.getResult()
    smHigh = state.emaPost.high.getResult()
    smLow = state.emaPost.low.getResult()
    smClose = state.emaPost.close.getResult()
  } catch {
    return true
  }

  // ---- PUSH OUTPUTS ----
  main.pushToMain({ index, key: `${prefix}_open`, value: smOpen })
  main.pushToMain({ index, key: `${prefix}_high`, value: smHigh })
  main.pushToMain({ index, key: `${prefix}_low`, value: smLow })
  main.pushToMain({ index, key: `${prefix}_close`, value: smClose })

  return true
}