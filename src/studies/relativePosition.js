const prefix = 'rel_pos';

export const relativePositions = (main, index) => {
  if (index === 0) {
    // Filter for relativePositions input parameters.
    const findParams = main.inputParams.filter(param => param.key === 'relativePositions');
    if (!findParams.length) return;

    main.instances.relativePositions = [];

    // Check once whether a priceVariations parameter exists.
    const hasPriceVariations = main.inputParams.some(param => param.key === 'priceVariations');

    // Build the base key names array.
    const baseKeys = ['open', 'high', 'low', 'close'];
    const midPriceKeys = hasPriceVariations ? ['mid_price_open_close', 'mid_price_high_low'] : [];
    const dynamicKeys = Object.keys(main.verticalOhlcv).filter(
      k => k && (k.startsWith('ema') || k.startsWith('sma'))
    );
    const keyNames = [...baseKeys, ...midPriceKeys, ...dynamicKeys];

    // Process each relativePositions parameter.
    findParams.forEach(({ params }) => {
      const [wrapperParam, lagParam] = params;
      const instanceSettings = main.instances[wrapperParam].settings;

      for (const indicatorKey of Object.keys(instanceSettings)) {
        const relativeWrapper = `${wrapperParam}_${indicatorKey}`;
        // Compute the full property names for storing the relative positions.
        const fullKeys = keyNames.map(k => `${prefix}_${relativeWrapper}_${k}`);

        if (lagParam > 0) {
          main.inputParams.push({ key: 'lag', params: [fullKeys, lagParam] });
        }

        // Add the new relative position arrays to verticalOhlcv.
        Object.assign(
          main.verticalOhlcv,
          Object.fromEntries(fullKeys.map(key => [key, [...main.nullArray]]))
        );

        // Save the instance info using the base key names.
        main.instances.relativePositions.push({ wrapper: relativeWrapper, keyNames });
      }
    });
  }

  // If no relativePositions were set up, exit.
  if (!main.instances.relativePositions) return true;

  const isInit = index === 0;
  // For each stored instance, update its relative positions.
  for (const { wrapper, keyNames } of main.instances.relativePositions) {
    keyNames.forEach(baseKey => {
      if (isInit) {
        if (!(baseKey in main.verticalOhlcv)) {
          throw new Error(
            `Error in "relativePositions". Property "${baseKey}" not found in "verticalOhlcv".`
          );
        }
        if (!(`${wrapper}_upper` in main.verticalOhlcv)) {
          throw new Error(
            `Error in "relativePositions". Property "${wrapper}_upper" not found in "verticalOhlcv".`
          );
        }
      }

      const value = main.verticalOhlcv[baseKey][index];
      const upper = main.verticalOhlcv[`${wrapper}_upper`][index];
      const lower = main.verticalOhlcv[`${wrapper}_lower`][index];
      const position = (value - lower) / (upper - lower);
      main.verticalOhlcv[`${prefix}_${wrapper}_${baseKey}`][index] = position;
    });
  }
};
