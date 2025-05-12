import { FasterEMA, FasterMACD } from 'trading-signals';

const defaultTarget = 'close';

export const macd = (main, index, fast, slow, signal, {target, lag}) => {

  const { verticalOhlcv, instances } = main;

  // Create an instance key that includes the target if it isn't the default.
  const instanceKey = `${fast}_${slow}_${signal}${target === defaultTarget ? '' : `_${target}`}`;

  // Initialization on the first index.
  if (index === 0) {
    const { inputParams, crossPairsList, priceBased, len , arrayTypes} = main;

    if (!verticalOhlcv.hasOwnProperty(target)) {
      throw new Error(`Target property ${target} not found in verticalOhlcv for macd.`);
    }

    const numberOfIndicators = inputParams.filter(o => o.key === 'macd').length;
    // Choose a display prefix based on the number of indicators.
    const displayPrefix = numberOfIndicators > 1 ? `macd_${fast}_${slow}_${signal}` : 'macd';

    // Build the keys.
    const diffKey = target === defaultTarget ? `${displayPrefix}_diff` : `${displayPrefix}_diff_${target}`;
    const deaKey = target === defaultTarget ? `${displayPrefix}_dea` : `${displayPrefix}_dea_${target}`;
    const histogramKey = target === defaultTarget ? `${displayPrefix}_histogram` : `${displayPrefix}_histogram_${target}`;

    crossPairsList.push({ fast: diffKey, slow: deaKey, isDefault: true });

    if (!instances.hasOwnProperty('macd')) {
      instances.macd = {
        numberOfIndicators,
        settings: {}
      };
    }

    instances.macd.settings[instanceKey] = new FasterMACD(
      new FasterEMA(fast),
      new FasterEMA(slow),
      new FasterEMA(signal)
    );

    Object.assign(verticalOhlcv, {
      [diffKey]: new Float64Array(len).fill(NaN),
      [deaKey]: new Float64Array(len).fill(NaN),
      [histogramKey]: new Float64Array(len).fill(NaN),
    });

    [diffKey, deaKey, histogramKey].forEach(v => {
      priceBased.add(v)
    })

    const keyNames = [diffKey, deaKey, histogramKey]

    if(lag > 0)
    {
      main.lag(keyNames, lag)
    }

    for(const key of keyNames)
    {
      arrayTypes[key] = 'Float64Array'
    }

  }

  const { numberOfIndicators, settings } = instances.macd;
  const displayPrefix = numberOfIndicators > 1 ? `macd_${fast}_${slow}_${signal}` : 'macd';
  const diffKey = target === defaultTarget ? `${displayPrefix}_diff` : `${displayPrefix}_diff_${target}`;
  const deaKey = target === defaultTarget ? `${displayPrefix}_dea` : `${displayPrefix}_dea_${target}`;
  const histogramKey = target === defaultTarget ? `${displayPrefix}_histogram` : `${displayPrefix}_histogram_${target}`;

  const macdInstance = settings[instanceKey];
  const value = verticalOhlcv[target][index];
  macdInstance.update(value);

  let macdResult = {}
  try {
    macdResult = macdInstance.getResult();
  } catch (err) {
    // If the result is unavailable, macdResult remains NaN.
  }

  // Always push values; use NaN as fallback when macdResult is missing.
  main.pushToMain({ index, key: diffKey, value: macdResult ? macdResult.macd : NaN });
  main.pushToMain({ index, key: deaKey, value: macdResult ? macdResult.signal : NaN });
  main.pushToMain({ index, key: histogramKey, value: macdResult ? macdResult.histogram : NaN });

  return true;
};
