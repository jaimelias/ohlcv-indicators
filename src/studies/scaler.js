/* General Scaler: supports "minmax" and "zscore" types */

const normalizeMinMax = (value, min, max, [validMin, validMax]) => {
    const clamped = Math.min(Math.max(value, min), max);
    return ((clamped - min) / (max - min)) * (validMax - validMin) + validMin;
  };
  
  const normalizeZScore = (value, mean, std) => {
    return std === 0 ? 0 : (value - mean) / std;
  };
  
export const Scaler = (
    main,
    index,
    size,
    colKeys,
    type,
    group,
    range,         // used for minmax: [validMin, validMax]
    lag,
  ) => {
    const { verticalOhlcv, instances, lastIndexReplace } = main;
    const prefix = `${type}_${size}`;
    let groupKey = '';
  
    if (index === 0) {
      const { nullArray, priceBased, groups } = main;
      groupKey = `${prefix}_group_${colKeys.join('_')}`;
  
      instances.scaler = {
        groupKeyLen: colKeys.length,
        groupKey,
        windows: {}           // stores arrays of past values for each key or group
      };
  
      for (const target of colKeys) {
        if (!verticalOhlcv.hasOwnProperty(target)) {
          throw new Error(`Target property "${target}" not found in verticalOhlcv`);
        }
        if (!priceBased.includes(target)) {
          throw new Error(`Column "${target}" is not priceBased and cannot be scaled.`);
        }
  
        const key = `${prefix}_${target}`;
        verticalOhlcv[key] = [...nullArray];
  
        const winKey = group ? groupKey : target;
        instances.scaler.windows[winKey] = [];
  
        if (group) {
          if (!main.ScaledGroups[groupKey]) main.ScaledGroups[groupKey] = [];
          main.ScaledGroups[groupKey].push(key);
        }
  
        if (lag > 0) {
          if (group) {
            const lags = Array.from({ length: lag }).map((_, i) => `${key}_lag_${i + 1}`);
            main.ScaledGroups[groupKey].push(...lags);
          }
          main.lag([key], lag);
        }
      }
    }
  
    const { windows } = instances.scaler;
    groupKey = instances.scaler.groupKey;
  
    // update windows with current values
    for (const target of colKeys) {
      const val = verticalOhlcv[target][index];
      const winKey = group ? groupKey : target;
      const win = windows[winKey];
  
      if (lastIndexReplace) {
        win[win.length - 1] = val;
      } else {
        win.push(val);
        if (win.length > (group ? size * instances.scaler.groupKeyLen : size)) {
          win.shift();
        }
      }
    }
  
    const ready = index + 1 >= size;
  
    // scale values once enough data
    for (const target of colKeys) {
      const val = verticalOhlcv[target][index];
      const key = `${prefix}_${target}`;
      let scaled = null;
  
      if (ready) {
        const winKey = group ? groupKey : target;
        const win = windows[winKey];
  
        if (type === 'minmax') {
          const mn = Math.min(...win);
          const mx = Math.max(...win);
          scaled = normalizeMinMax(val, mn, mx, range);
        } else if (type === 'zscore') {
          const mean = win.reduce((sum, x) => sum + x, 0) / win.length;
          const variance = win.reduce((sum, x) => sum + Math.pow(x - mean, 2), 0) / win.length;
          const std = Math.sqrt(variance);
          scaled = normalizeZScore(val, mean, std);
        } else {
          throw new Error(`Unknown scaler type "${type}"`);
        }
      }
  
      main.pushToMain({ index, key, value: scaled });
    }
  };
  