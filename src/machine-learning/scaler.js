import { normalizeMinMax, normalizeZScore } from "./ml-utilities.js";

const isBadNumber = (v) => v == null || !Number.isFinite(v)

//rowWiseScaler

export const scaler = (main, index, size, colKeys, {type, minMaxRange, lookback, weights, euclideanWeights, byFeatureRange, offset}) => {

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

      for(const weKey of Object.keys(weights)) {
        if (!verticalOhlcv.hasOwnProperty(weKey)) {
          throw new Error(`Target property "${weKey}" not found in verticalOhlcv`);
        }
      }

    }
  
    const { extectedFeatures } = instances.scaler[prefix]
    
    let hasInvalidVal = false
    const row = {}
    const rowValues = []
    let countFeatures = 0

    const sourceIndex = index - offset

    if(sourceIndex < 0) return 

   

    for (let x = 0; x < colKeys.length; x++) {
      const target = colKeys[x]
      const col = verticalOhlcv[target]
      const currWeight = weights?.[target]?.[0] ?? 1
      const currVal = col[sourceIndex]

      if(isBadNumber(currVal))
      {
        hasInvalidVal = true
        break
      }

      row[target] = {
        val: currVal, 
        weight: (euclideanWeights) ? Math.sqrt(currWeight) :  currWeight
      }

      rowValues.push(currVal)
      countFeatures++

      if(lookback > 0) {
        for (let step = 1; step <= lookback; step++) {

          const laggedWeight = weights?.[target]?.[step] ?? 1
          const laggedVal = col[sourceIndex - step]

          if(isBadNumber(laggedVal))
          {
            hasInvalidVal = true
            break
          }

          row[`${target}_lag_${step}`] = {
            val: laggedVal, 
            weight: (euclideanWeights) ? Math.sqrt(laggedWeight) : laggedWeight
          }

          rowValues.push(laggedVal)
          countFeatures++
        }

        if(hasInvalidVal) break
      }
    }

    if(hasInvalidVal || countFeatures !== extectedFeatures) return

    if (type === "minmax") {
      const mn = Math.min(...rowValues);
      const mx = Math.max(...rowValues);

      for (const [key, { val, weight }] of Object.entries(row)) {
        const scaled = normalizeMinMax(val, mn, mx, minMaxRange)
        const weigthed = scaled === 0 ? 0 : scaled * weight
        main.pushToMain({ index, key: `${prefix}_${key}`, value: weigthed });
      }
    }

    if (type === "zscore") {
      const n = rowValues.length;
      const mean = rowValues.reduce((s, x) => s + x, 0) / n;
      const variance = rowValues.reduce((s, x) => s + (x - mean) ** 2, 0) / n;
      const std = Math.sqrt(variance);

      for (const [key, { val, weight }] of Object.entries(row)) {
        const scaled = normalizeZScore(val, mean, std)
        const weigthed = scaled === 0 ? 0 : scaled * weight
        main.pushToMain({ index, key: `${prefix}_${key}`, value: weigthed });
      }
    }

    if(type === "byfeature") {

      const [mn, mx] = byFeatureRange

      for (const [key, { val, weight }] of Object.entries(row)) {

        const scaled = normalizeMinMax(val, mn, mx, minMaxRange)
        const weigthed = scaled === 0 ? 0 : scaled * weight

        main.pushToMain({ index, key: `${prefix}_${key}`, value: weigthed });
      }

    }
}
  