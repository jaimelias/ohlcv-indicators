import { normalizeMinMax, normalizeZScore } from "./ml-utilities.js";

const isBad = (v) => v == null || !Number.isFinite(v)

//rowWiseScaler

export const scaler = (main, index, size, colKeys, {type, range, lookback, precomputed}) => {

    //this function performs scaling row by row "row wise scaling"

    const { verticalOhlcv, instances } = main
    const prefix = `${type}_${size}`
  
    if(index === 0) {
      const { len, isAlreadyComputed } = main

      if(isAlreadyComputed.has(prefix))
      {
        throw new Error(`In scaler method can not repeat params "size" and "options.type" together between indicators.`)
      }
  
      if(!instances.hasOwnProperty('scaler')) {
        instances.scaler = {}
      }

      if(!instances.scaler.hasOwnProperty(prefix))
      {
        instances.scaler[prefix] = {
          extectedFeatures: (lookback === 0) ? colKeys.length : colKeys.length + (lookback * colKeys.length)
        }
      }

      const features = []

      for (const target of colKeys) {
        if (!verticalOhlcv.hasOwnProperty(target)) {
          throw new Error(`Target property "${target}" not found in verticalOhlcv`);
        }
  
        const key = `${prefix}_${target}`;
        verticalOhlcv[key] = new Float64Array(len).fill(NaN)
  
        if (!main.scaledGroups[prefix]) main.scaledGroups[prefix] = [];

        main.scaledGroups[prefix].push(key);
  
        if (lookback > 0) {
          const laggedKeys = Array.from({ length: lookback }).map((_, i) => `${key}_lag_${i + 1}`)

          for(const lKey of laggedKeys) {
            verticalOhlcv[lKey] = new Float64Array(len).fill(NaN)
          }

          main.scaledGroups[prefix].push(...laggedKeys)
          features.push(key)
        }
      }
    }
  
    const { extectedFeatures } = instances.scaler[prefix]
    
    let hasInvalidVal = false
    const row = {}
    let countFeatures = 0

    // update windows with current values
    for (let x = 0; x < colKeys.length; x++) {
      const target = colKeys[x]
      const col = verticalOhlcv[target]
      const val = col[index]

      if(isBad(val))
      {
        hasInvalidVal = true
        break
      }

      row[target] = val
      countFeatures++

      if(lookback > 0) {
        for (let step = 1; step <= lookback; step++) {
          const laggedVal = col[index - step]

          if(isBad(laggedVal))
          {
            hasInvalidVal = true
            break
          }
          
          row[`${target}_lag_${step}`] = laggedVal
          countFeatures++
        }

        if(hasInvalidVal) break
      }
    }

    if(hasInvalidVal || countFeatures !== extectedFeatures) return

    const values = Object.values(row)

    if (type === 'minmax') {
      for(const [key, val] of Object.entries(row)) {
        const mn = Math.min(...values)
        const mx = Math.max(...values)
        const scaled = normalizeMinMax(val, mn, mx, range)

        main.pushToMain({ index, key: `${prefix}_${key}`, value: scaled})
      }
    } else if (type === 'zscore') {
      for(const [key, val] of Object.entries(row)) {
        const mean = values.reduce((sum, x) => sum + x, 0) / extectedFeatures;
        const variance = values.reduce((sum, x) => sum + Math.pow(x - mean, 2), 0) / extectedFeatures
        const std = Math.sqrt(variance)
        const scaled = normalizeZScore(val, mean, std)

        main.pushToMain({ index, key: `${prefix}_${key}`, value: scaled})
      }
    }
}
  