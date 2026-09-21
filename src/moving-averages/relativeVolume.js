import { FasterSMA } from 'trading-signals';
import { isPositiveInteger } from '../utilities/numberUtilities.js';
import { validateInputValues } from '../utilities/validators.js';
import { initializeColumns } from '../core-functions/initializeColumns.js';


export const relativeVolume = (main, index, size, {lag}) => {

  const key = `relative_volume_${size}`;
  const { instances, verticalOhlcv } = main;
  

  if (index === 0) {
    validateInputValues({ volume: true }, verticalOhlcv, index, 'relativeVolume');

    instances[key] = {
      instance: new FasterSMA(size),
      prevRelativeVolumeSma: NaN
    };
    
    initializeColumns(main, [{ key }], { lag });

  }

  const volume = verticalOhlcv.volume[index];

  if(volume === 0) {
    return;
  }
  
  const smaInstance = instances[key].instance;
  smaInstance.update(volume);

  let smaValue = NaN;
  try {
    smaValue = smaInstance.getResult();
  } catch (err) {

  }

  const prevSma = instances[key].prevRelativeVolumeSma;

  // Save the current SMA for the next nonzero-volume row.
  instances[key].prevRelativeVolumeSma = smaValue;

  if(Number.isNaN(smaValue) || Number.isNaN(prevSma)) {
    return
  }

  let currRelativeVolume =  volume / prevSma;

  main.pushToMain({ index, key, value: currRelativeVolume });
  instances[key].prevRelativeVolumeSma = smaValue;

};
