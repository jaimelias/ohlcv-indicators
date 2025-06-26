import { normalizeMinMax, normalizeZScore } from "./ml-utilities.js";
  
export const scaler = (main, index, size, colKeys, {type, group, range, lag, precomputed, secondaryLoop}) => {

    if(index + 1 > main.len) return

    const {groupKey, groupKeyLen} = precomputed
    const { verticalOhlcv, instances, arrayTypes, invalidValueIndex } = main;
    const prefix = `${type}_${size}`;
  
    if((index === 0 && secondaryLoop === false) || ((index + 1) === (invalidValueIndex + 1) && secondaryLoop === true)) {
      const { len, isAlreadyComputed } = main;

      if(isAlreadyComputed.has(prefix))
      {
        throw new Error(`In scaler method can not repeat params "size" and "options.type" together between indicators.`)
      }

      isAlreadyComputed.add(prefix)
  
      if(!instances.hasOwnProperty('scaler')) {
        instances.scaler = {}
      }

      if(!instances.scaler.hasOwnProperty(prefix))
      {
        instances.scaler[prefix] = {
          windows: {}
        }
      }

      const features = []

      for (const target of colKeys) {
        if (!verticalOhlcv.hasOwnProperty(target)) {
          throw new Error(`Target property "${target}" not found in verticalOhlcv`);
        }
  
        const key = `${prefix}_${target}`;
        verticalOhlcv[key] = new Float64Array(len).fill(NaN);
        arrayTypes[key] = 'Float64Array'
  
        const winKey = group ? groupKey : target;
        instances.scaler[prefix].windows[winKey] = [];
  
        if (!main.scaledGroups[groupKey]) main.scaledGroups[groupKey] = [];
        main.scaledGroups[groupKey].push(key);
  
        if (lag > 0) {
          const lags = Array.from({ length: lag }).map((_, i) => `${key}_lag_${i + 1}`)
          main.scaledGroups[groupKey].push(...lags)
          features.push(key)
        }
      }

      if(lag > 0)
      {
        main.lag(features, lag)
      }
    }

    if(secondaryLoop === true && index <= invalidValueIndex) true
  
    const { windows } = instances.scaler[prefix]
    
    let hasInvalidVal = false

    // update windows with current values
    for (let x = 0; x < colKeys.length; x++) {
      const target = colKeys[x]
      const col = verticalOhlcv[target]

      if(typeof col === 'undefined')
      {
        hasInvalidVal = true
        break     
      }

      const val = col[index]

      if(Number.isNaN(val) || val === null)
      {
        hasInvalidVal = true
        break
      }

      const winKey = group ? groupKey : target
      const win = windows[winKey]
  
      win.push(val)
      
      if (win.length > (group ? size * groupKeyLen : size)) {
        win.shift()
      }

    }

    if(hasInvalidVal) return
  
    const ready = index + 1 >= size

    if(!ready) return
  
    // scale values once enough data
    for (let x = 0; x < colKeys.length; x++) {
      const target = colKeys[x]
      const col = verticalOhlcv[target]

      if(typeof col === 'undefined')
      {
        break     
      }     

      const val = col[index]

      if(Number.isNaN(val) || val === null)
      {
        break
      }

      const key = `${prefix}_${target}`
      let scaled = null
      const winKey = group ? groupKey : target
      const win = windows[winKey]

      if (type === 'minmax') {
        const mn = Math.min(...win)
        const mx = Math.max(...win)
        scaled = normalizeMinMax(val, mn, mx, range)
      } else if (type === 'zscore') {
        const mean = win.reduce((sum, x) => sum + x, 0) / win.length;
        const variance = win.reduce((sum, x) => sum + Math.pow(x - mean, 2), 0) / win.length
        const std = Math.sqrt(variance);
        scaled = normalizeZScore(val, mean, std)
      } else {
        throw new Error(`Unknown scaler type "${type}"`)
      }
  
      main.pushToMain({ index, key, value: scaled})
    }
}
  