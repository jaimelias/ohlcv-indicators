import { FasterEMA, FasterMACD } from 'trading-signals';

const defaultTarget = 'close';

export const macd = (main, index, fast, slow, signal, options) => {
  const { target } = options;
  const { verticalOhlcv, instances, lastIndexReplace } = main;

  // Create an instance key that includes the target if it isn't the default.
  const instanceKey = `${fast}_${slow}_${signal}${target === defaultTarget ? '' : `_${target}`}`;

  // Initialization on the first index.
  if (index === 0) {
    const { inputParams, crossPairsList, nullArray, priceBased } = main;

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
      [diffKey]: [...nullArray],
      [deaKey]: [...nullArray],
      [histogramKey]: [...nullArray],
    });

    priceBased.push(diffKey, deaKey, histogramKey)
  }

  const { numberOfIndicators, settings } = instances.macd;
  const displayPrefix = numberOfIndicators > 1 ? `macd_${fast}_${slow}_${signal}` : 'macd';
  const diffKey = target === defaultTarget ? `${displayPrefix}_diff` : `${displayPrefix}_diff_${target}`;
  const deaKey = target === defaultTarget ? `${displayPrefix}_dea` : `${displayPrefix}_dea_${target}`;
  const histogramKey = target === defaultTarget ? `${displayPrefix}_histogram` : `${displayPrefix}_histogram_${target}`;

  const macdInstance = settings[instanceKey];
  const value = verticalOhlcv[target][index];
  macdInstance.update(value, lastIndexReplace);

  let macdResult = null;
  try {
    macdResult = macdInstance.getResult();
  } catch (err) {
    // If the result is unavailable, macdResult remains null.
    macdResult = null;
  }

  // Always push values; use null as fallback when macdResult is missing.
  main.pushToMain({ index, key: diffKey, value: macdResult ? macdResult.macd : null });
  main.pushToMain({ index, key: deaKey, value: macdResult ? macdResult.signal : null });
  main.pushToMain({ index, key: histogramKey, value: macdResult ? macdResult.histogram : null });

  return true;
};
