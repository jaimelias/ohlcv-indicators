import { FasterSMA } from 'trading-signals';
import { calcMagnitude } from '../utilities/numberUtilities.js';

export const relativeVolume = (main, index, size = 10, { scale }) => {
  const key = `relative_volume_${size}`;
  const { instances, verticalOhlcv, lastIndexReplace } = main;

  if (index === 0) {
    const { nullArray } = main;
    instances[key] = {
      instance: new FasterSMA(size),
      prevRelativeVolumeSma: null
    };
    verticalOhlcv[key] = [...nullArray];
  }

  const value = verticalOhlcv.volume[index];
  const smaInstance = instances[key].instance;
  smaInstance.update(value, lastIndexReplace);

  let smaValue = null;
  try {
    smaValue = smaInstance.getResult();
  } catch (err) {
    smaValue = null;
  }

  const prevSma = instances[key].prevRelativeVolumeSma;
  let currRelativeVolume = null;

  // Only calculate relative volume if both current SMA and previous SMA are valid numbers and prevSma is not zero.
  if (typeof smaValue === 'number' && typeof prevSma === 'number' && prevSma !== 0) {
    currRelativeVolume = value / prevSma;
    if (scale) {
      currRelativeVolume = calcMagnitude(currRelativeVolume, scale);
    }
  }

  main.pushToMain({ index, key, value: currRelativeVolume });
  instances[key].prevRelativeVolumeSma = smaValue;

  return true;
};
