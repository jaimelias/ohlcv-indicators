import { FasterSMA } from 'trading-signals';

export const relativeVolume = (main, index, size, {lag}) => {

  const key = `relative_volume_${size}`;
  const { instances, verticalOhlcv, lastIndexReplace } = main;

  if (index === 0) {
    const { len, arrayTypes } = main;

    instances[key] = {
      instance: new FasterSMA(size),
      prevRelativeVolumeSma: NaN
    };
    
    verticalOhlcv[key] = new Float64Array(len).fill(NaN);

    if(lag > 0)
    {
      main.lag([key], lag)
    }
  
    arrayTypes[key] = 'Float64Array'
  }

  const value = verticalOhlcv.volume[index];
  const smaInstance = instances[key].instance;
  smaInstance.update(value, lastIndexReplace);

  let smaValue = NaN;
  try {
    smaValue = smaInstance.getResult();
  } catch (err) {

  }

  const prevSma = instances[key].prevRelativeVolumeSma;
  let currRelativeVolume = NaN;

  // Only calculate relative volume if both current SMA and previous SMA are valid numbers and prevSma is not zero.
  if (!Number.isNaN(smaValue) && !Number.isNaN(prevSma)) {
    currRelativeVolume = value / prevSma;
  }

  main.pushToMain({ index, key, value: currRelativeVolume });
  instances[key].prevRelativeVolumeSma = smaValue;

  return true;
};
