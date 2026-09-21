import { isPositiveInteger } from '../utilities/numberUtilities.js';


export const volumeDelta = (main, index, { lag = 0 }) => {
  const { verticalOhlcv, instances, len } = main;
  const key = 'volume_delta';

  if (index === 0) {
    if (!instances[key]) {
      instances[key] = { isBuyVolume: true, cross: 0, hasInvalidInputValue: false };
    }

    const keyNames = [
      `${key}_high`,
      `${key}_low`,
      `${key}_close`,
      `${key}_cross`,
    ];

    // allocate outputs
    Object.assign( 
        verticalOhlcv, 
        Object.fromEntries(keyNames.map(k => [k, new Float64Array(len).fill(NaN)]))
    );

    // optional lag
    if (lag > 0) main.lag(keyNames, lag);
  }

  const inst = instances[key];

  const {hasInvalidInputValue} = inst

  // inputs
  const volume = verticalOhlcv.volume[index];


  if(hasInvalidInputValue) {
      return;
  }
  if(!isPositiveInteger(volume)) {
      instances[key].hasInvalidInputValue = true;
      return;
  };


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
  
  const delta = isBuy ? volume : -volume;

  // delta "candle"
  const closeVal = delta;
  const highVal  = Math.max(delta, 0);
  const lowVal   = Math.min(delta, 0);

  main.pushToMain({ index, key: `${key}_high`,  value: highVal });
  main.pushToMain({ index, key: `${key}_low`,   value: lowVal });
  main.pushToMain({ index, key: `${key}_close`, value: closeVal });
  main.pushToMain({ index, key: `${key}_cross`, value: inst.cross });

};
