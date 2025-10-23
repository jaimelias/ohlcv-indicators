export const volumeDelta = (main, index, { lag = 0 }) => {
  const { verticalOhlcv, instances, len } = main;
  const groupName = 'volume_delta';

  if (index === 0) {
    if (!instances[groupName]) instances[groupName] = { isBuyVolume: true, cross: 0 };

    const keys = [
      `${groupName}_open`,
      `${groupName}_high`,
      `${groupName}_low`,
      `${groupName}_close`,
      `${groupName}_cross`,
    ];

    // allocate outputs
    for (const k of keys) verticalOhlcv[k] = new Float64Array(len).fill(NaN);

    // optional lag
    if (lag > 0) main.lag(keys, lag);
  }

  const inst = instances[groupName];

  // inputs
  const vol       = verticalOhlcv.volume[index];
  const open      = verticalOhlcv.open[index];
  const close     = verticalOhlcv.close[index];
  const prevClose = index > 0 ? verticalOhlcv.close[index - 1] : NaN;

  // TradingView tie-breaks:
  // 1) close>open -> buy, 2) close<open -> sell,
  // 3) equal: compare to prev close, 4) still equal: carry prior state
  let isBuy = inst.isBuyVolume;
  if (close > open) isBuy = true;
  else if (close < open) isBuy = false;
  else if (close > prevClose) isBuy = true;
  else if (close < prevClose) isBuy = false;

  inst.isBuyVolume = isBuy;

  if(index < 1)
  {
    if(isBuy) inst.cross = 1
    else inst.cross = -1
  }
  else {
    if(isBuy)
    {
        if(inst.cross > 0) inst.cross = inst.cross + 1
        else inst.cross = 1 //reset
    } else {
        if(inst.cross > 0) inst.cross = -1 //reset
        else inst.cross = inst.cross - 1
    }
  }
  

  const delta = Number.isFinite(vol) ? (isBuy ? vol : -vol) : NaN;

  // delta "candle"
  const openVal  = Number.isNaN(delta) ? NaN : 0;
  const closeVal = delta;
  const highVal  = Number.isNaN(delta) ? NaN : Math.max(delta, 0);
  const lowVal   = Number.isNaN(delta) ? NaN : Math.min(delta, 0);

  main.pushToMain({ index, key: `${groupName}_open`,  value: openVal });
  main.pushToMain({ index, key: `${groupName}_high`,  value: highVal });
  main.pushToMain({ index, key: `${groupName}_low`,   value: lowVal });
  main.pushToMain({ index, key: `${groupName}_close`, value: closeVal });
  main.pushToMain({ index, key: `${groupName}_cross`, value: inst.cross });

  return true;
};
