import { FasterSMA } from 'trading-signals';
import { isPositiveInteger } from '../utilities/numberUtilities.js';


export const relativeVolume = (main, index, size, {lag}) => {

  const key = `relative_volume_${size}`;
  const { instances, verticalOhlcv } = main;
  

  if (index === 0) {
    const { len } = main;

    instances[key] = {
      instance: new FasterSMA(size),
      prevRelativeVolumeSma: NaN,
      hasInvalidInputValue: false
    };
    
    verticalOhlcv[key] = new Float64Array(len).fill(NaN);

    if(lag > 0)
    {
      main.lag([key], lag)
    }

  }

  const volume = verticalOhlcv.volume[index];
  const { hasInvalidInputValue } = instances[key];

  if(hasInvalidInputValue) {
    return;
  }

  if(!isPositiveInteger(volume)) {
     instances[key].hasInvalidInputValue = true;
    return
  }
  
  const smaInstance = instances[key].instance;
  smaInstance.update(volume);

  let smaValue = NaN;
  try {
    smaValue = smaInstance.getResult();
  } catch (err) {

  }

  const prevSma = instances[key].prevRelativeVolumeSma;
  let currRelativeVolume = NaN;

  if(Number.isNaN(smaValue) || Number.isNaN(prevSma)) {
    return
  }

  // Only calculate relative volume if both current SMA and previous SMA are valid numbers and prevSma is not zero.
  currRelativeVolume = volume / prevSma;

  main.pushToMain({ index, key, value: currRelativeVolume });
  instances[key].prevRelativeVolumeSma = smaValue;

};
