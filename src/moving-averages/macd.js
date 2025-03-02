import { FasterEMA, FasterMACD } from 'trading-signals';

const defaultTarget = 'close';

export const macd = (main, index, fast, slow, signal, options) => {
  const { target } = options;
  const { verticalOhlcv, instances, lastIndexReplace } = main;

  // Instance key (for internal storage) includes target if not default.
  const instanceKey = `${fast}_${slow}_${signal}${target === defaultTarget ? '' : `_${target}`}`;

  // On the first index, do the initialization.
  if (index === 0) {
    const { inputParams, crossPairsList, nullArray } = main;

    if (!verticalOhlcv.hasOwnProperty(target)) {
      throw new Error(`Target property ${target} not found in verticalOhlcv for macd.`);
    }

    const numberOfIndicators = inputParams.filter(o => o.key === 'macd').length;
    // For display keys: if there's more than one indicator, include the parameters in the prefix.
    const displayPrefix = numberOfIndicators > 1 ? `macd_${fast}_${slow}_${signal}` : 'macd';

    // Build the keys: if target is not the default, append it at the end.
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
    )

    Object.assign(verticalOhlcv, {
      [diffKey]: [...nullArray],
      [deaKey]: [...nullArray],
      [histogramKey]: [...nullArray],
    })
  }

  const {numberOfIndicators, settings} = instances.macd

  // Determine display prefix for updating values.
  const displayPrefix = numberOfIndicators > 1 ? `macd_${fast}_${slow}_${signal}` : 'macd';
  const diffKey = target === defaultTarget ? `${displayPrefix}_diff` : `${displayPrefix}_diff_${target}`;
  const deaKey = target === defaultTarget ? `${displayPrefix}_dea` : `${displayPrefix}_dea_${target}`;
  const histogramKey = target === defaultTarget ? `${displayPrefix}_histogram` : `${displayPrefix}_histogram_${target}`;

  const macdInstance = settings[instanceKey];
  const value = verticalOhlcv[target][index];
  macdInstance.update(value, lastIndexReplace);

  let macdResult;
  try {
    macdResult = macdInstance.getResult();
  } catch (err) {
    // Do nothing if no result is available.
  }

  if (macdResult) {
    main.pushToMain({ index, key: diffKey, value: macdResult.macd });
    main.pushToMain({ index, key: deaKey, value: macdResult.signal });
    main.pushToMain({ index, key: histogramKey, value: macdResult.histogram });
  }

  return true;
};
