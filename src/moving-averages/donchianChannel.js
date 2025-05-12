
export const donchianChannels = (main, index, size, offset, { height, range, lag }) => {
  const indicatorKey = `${size}_${offset}`;
  const { verticalOhlcv, instances, len } = main;

  // Initialization: create output arrays and indicator instance on the first call.
  if (index === 0) {
    const { inputParams, priceBased, arrayTypes} = main;
    let numberOfIndicators = 0

    for (const o of inputParams) {
      if (o.key === 'donchianChannels') numberOfIndicators++;
    }

    const prefix = numberOfIndicators > 1 ? `donchian_channel_${indicatorKey}` : 'donchian_channel';

    const keyNames = [
      `${prefix}_upper`,
      `${prefix}_basis`,
      `${prefix}_lower`,
    ]


    if (height) {
      keyNames.push(`${prefix}_height`)
    }

   
    if (!instances.hasOwnProperty('donchian_channel')) {
      instances.donchian_channel = { numberOfIndicators, settings: {} };
    }

    // Set up additional arrays for each range property.
    for (const rangeKey of range) {
      if (!(rangeKey in verticalOhlcv) || !priceBased.has(rangeKey)) {
        throw new Error(`Invalid range item value "${rangeKey}" property for donchianChannels. Only price based key names are accepted:\n${JSON.stringify(priceBased)}`);
      }
      keyNames.push(`${prefix}_range_${rangeKey}`)

    }

    const verticalOhlcvSetup = Object.fromEntries(keyNames.map(v => [v, new Float64Array(len).fill(NaN)]))
    Object.assign(verticalOhlcv, {...verticalOhlcvSetup})

    if(lag > 0)
    {
      main.lag(keyNames, lag)
    }


    [`${prefix}_upper`, `${prefix}_basis`, `${prefix}_lower`].forEach(v => {
      priceBased.add(v)
    })

    instances.donchian_channel.settings[indicatorKey] = {
      maxDeque: [], // will hold indices for highs in descending order
      minDeque: []  // will hold indices for lows in ascending order
    };

    for(const key of keyNames)
    {
      arrayTypes[key] = 'Float64Array'
    }
  }

  const numberOfIndicators = instances.donchian_channel.numberOfIndicators;
  const subPrefix = numberOfIndicators > 1 ? `donchian_channel_${indicatorKey}` : 'donchian_channel';
  const state = instances.donchian_channel.settings[indicatorKey];
  const { maxDeque, minDeque } = state;

  // Compute the “current bar index” for the window.
  // Note: We use index - offset so that the window is built on the proper part of the array.
  const currentBarIdx = index - offset;
  const endIdx = currentBarIdx + 1; // currentBarIdx is inclusive
  const startIdx = endIdx - size;     // window: [startIdx, endIdx)

  // If the window is not fully available, push NaN values for all computed outputs.
  if (startIdx < 0 || endIdx > len) {
    main.pushToMain({ index, key: `${subPrefix}_upper`, value: NaN });
    main.pushToMain({ index, key: `${subPrefix}_basis`, value: NaN });
    main.pushToMain({ index, key: `${subPrefix}_lower`, value: NaN });
    if (height) {
      main.pushToMain({ index, key: `${subPrefix}_height`, value: NaN });
    }
    for (const rangeKey of range) {
      main.pushToMain({ index, key: `${subPrefix}_range_${rangeKey}`, value: NaN });
    }
    return true;
  }

  const highs = verticalOhlcv.high;
  const lows = verticalOhlcv.low;

  // **Update the maximum deque:**
  while (maxDeque.length && maxDeque[0] < startIdx) {
    maxDeque.shift();
  }
  while (maxDeque.length && highs[maxDeque[maxDeque.length - 1]] <= highs[currentBarIdx]) {
    maxDeque.pop();
  }
  maxDeque.push(currentBarIdx);

  // **Update the minimum deque:**
  while (minDeque.length && minDeque[0] < startIdx) {
    minDeque.shift();
  }
  while (minDeque.length && lows[minDeque[minDeque.length - 1]] >= lows[currentBarIdx]) {
    minDeque.pop();
  }
  minDeque.push(currentBarIdx);

  // Retrieve computed values with safety checks.
  const upper = maxDeque.length ? highs[maxDeque[0]] : NaN;
  const lower = minDeque.length ? lows[minDeque[0]] : NaN;
  const basis = (!Number.isNaN(upper) && !Number.isNaN(lower)) ? (upper + lower) / 2 : NaN;

  // Always push the main indicator values.
  main.pushToMain({ index, key: `${subPrefix}_upper`, value: upper });
  main.pushToMain({ index, key: `${subPrefix}_basis`, value: basis });
  main.pushToMain({ index, key: `${subPrefix}_lower`, value: lower });

  // Process height if enabled.
  if (height) {
    let heightValue = NaN;
    if (!Number.isNaN(upper) && !Number.isNaN(lower)) {
      heightValue = ((upper - lower) / lower)
    }
    main.pushToMain({ index, key: `${subPrefix}_height`, value: heightValue });
  }

  // Process each range property.
  for (const rangeKey of range) {
    let rangeValue = NaN;
    const priceValue = verticalOhlcv[rangeKey][index]
    if (
      !Number.isNaN(priceValue) &&
      !Number.isNaN(upper) &&
      !Number.isNaN(lower)
    ) {
      rangeValue = (priceValue - lower) / (upper - lower)
    }
    main.pushToMain({ index, key: `${subPrefix}_range_${rangeKey}`, value: rangeValue });
  }

  return true;
}
