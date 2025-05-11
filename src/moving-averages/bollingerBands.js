import { FasterBollingerBands } from 'trading-signals'

const defaultTarget = 'close'

export const bollingerBands = (main, index, size, stdDev, { height, range = [], target, lag }) => {
  const { verticalOhlcv, instances, lastIndexReplace } = main;
  const suffix = target === defaultTarget ? '' : `_${target}`;
  const indicatorKey = `${size}_${stdDev}${suffix}`;
  let prefix;

  // Initialization on the first call.
  if (index === 0) {

    const { priceBased, inputParams, verticalOhlcv, len, arrayTypes } = main;

    if (!(target in verticalOhlcv)) {
      throw new Error(`bollingerBands could not find target "${target}"`);
    }

    const numberOfIndicators = inputParams.filter(o => o.key === 'bollingerBands').length;
    prefix = numberOfIndicators > 1
      ? `bollinger_bands_${indicatorKey}`
      : `bollinger_bands${suffix}`;

    // Only create the container if it doesn't already exist.
    if (!instances.bollinger_bands) {
      instances.bollinger_bands = {
        numberOfIndicators,
        settings: {}
      };
    }
    // Add (or override) the indicator instance keyed by indicatorKey.
    instances.bollinger_bands.settings[indicatorKey] = new FasterBollingerBands(size, stdDev);

    const keyNames = [
      `${prefix}_upper`,
      `${prefix}_middle`,
      `${prefix}_lower`,
    ]


    if (height) {
      keyNames.push(`${prefix}_height`)
    }

    // Set up additional arrays for each range property.
    for (const rangeKey of range) {
      if (!(rangeKey in verticalOhlcv) || !priceBased.includes(rangeKey)) {
        throw new Error(`Invalid range item value "${rangeKey}" property for bollingerBands. Only price based key names are accepted:\n${JSON.stringify(priceBased)}`);
      }
      keyNames.push(`${prefix}_range_${rangeKey}`)

    }

    const verticalOhlcvSetup = Object.fromEntries(keyNames.map(v => [v, new Float64Array(len).fill(NaN)]))
    Object.assign(verticalOhlcv, {...verticalOhlcvSetup})

    if(lag > 0)
    {
      main.lag(keyNames, lag)
    }

    priceBased.push(`${prefix}_upper`, `${prefix}_middle`, `${prefix}_lower`);

    for(const key of keyNames)
    {
      arrayTypes[key] = 'Float64Array'
    }
  }

  // Derive prefix for subsequent calls if not set.
  if (!prefix) {
    const num = instances.bollinger_bands.numberOfIndicators;
    prefix = num > 1 ? `bollinger_bands_${indicatorKey}` : `bollinger_bands${suffix}`;
  }
  const subPrefix = prefix;

  // Update the indicator with the current value.
  const instance = instances.bollinger_bands.settings[indicatorKey];
  const value = verticalOhlcv[target][index];
  instance.update(value, lastIndexReplace);

  // Attempt to retrieve the result.
  let result = {};
  try {
    result = instance.getResult();
  } catch (err) {
    // If not available, result stays {}.
  }

  // Use NaN fallbacks for the primary values.
  const upper = result?.upper ?? NaN;
  const middle = result?.middle ?? NaN;
  const lower = result?.lower ?? NaN;

  // Always push the indicator outputs.
  main.pushToMain({ index, key: `${subPrefix}_upper`, value: upper });
  main.pushToMain({ index, key: `${subPrefix}_middle`, value: middle });
  main.pushToMain({ index, key: `${subPrefix}_lower`, value: lower });

  // Process height if requested.
  if (height) {
    let heightValue = NaN;
    if (!Number.isNaN(lower) && !Number.isNaN(upper)) {
      heightValue = ((upper - lower) / lower)
    }
    main.pushToMain({ index, key: `${subPrefix}_height`, value: heightValue });
  }

  // Process each range property.
  for (const rangeKey of range) {
    let rangeValue = NaN;
    const priceValue = verticalOhlcv[rangeKey][index];
    if (!Number.isNaN(priceValue) && !Number.isNaN(lower) && !Number.isNaN(upper)) {
      rangeValue = (priceValue - lower) / (upper - lower)
    }
    main.pushToMain({ index, key: `${subPrefix}_range_${rangeKey}`, value: rangeValue });
  }

  return true;
}
