import { FasterSMA } from '../core-indicators/index.js';
import { mathLog } from '../utilities/math.js';
import { validateInputValues } from '../utilities/validators.js';
import { initializeColumns } from '../core-functions/initializeColumns.js';


export const relativeVolume = (main, index, size, {lag, retLogs = false}) => {

  const key = `${retLogs ? 'ret_log_' : ''}relative_volume_${size}`;
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

  const smaValue = smaInstance.isStable ? smaInstance.getResult() : NaN;

  const prevSma = instances[key].prevRelativeVolumeSma;

  // Save the current SMA for the next nonzero-volume row.
  instances[key].prevRelativeVolumeSma = smaValue;

  if(Number.isNaN(smaValue) || Number.isNaN(prevSma)) {
    return
  }

  const ratio = volume / prevSma;
  const currRelativeVolume = retLogs
    ? volume > 0 && prevSma > 0 && ratio > 0 && Number.isFinite(ratio)
      ? mathLog(ratio, 1)
      : NaN
    : ratio;

  main.pushToMain({ index, key, value: currRelativeVolume });

};
