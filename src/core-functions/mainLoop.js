import { areKeyValuesValid } from "./pushToMain.js";
import { validateInputParams } from "../utilities/validators.js";
import { rsi } from "../oscillators/rsi.js";
import { mfi } from "../oscillators/mfi.js";
import { stochastic } from "../oscillators/stochastic.js";
import { movingAverages } from "../moving-averages/movingAverages.js";
import { heikenAshi } from "../moving-averages/heikenAshi.js";
import { macd } from "../moving-averages/macd.js";
import { relativeVolume } from "../moving-averages/relativeVolume.js";
import { donchianChannels } from "../moving-averages/donchianChannel.js";
import { bollingerBands } from "../moving-averages/bollingerBands.js";
import { volumeOscillator } from "../oscillators/volumeOscillator.js";
import { volumeDelta } from "../oscillators/volumeDelta.js";
import { lag } from "../studies/lag.js";
import { crossPairs } from "../studies/findCrosses.js";
import { dateTime } from "../studies/dateTime.js";
import { atr } from "../volatility/atr.js";
import { adx } from "../volatility/adx.js";
import { mapCols } from "../studies/mapCols.js";

import { buildArray } from "../utilities/assignTypes.js";
import {  inputNumberFormatter } from "../utilities/numberUtilities.js";
import { dateFormaters } from "../utilities/dateUtilities.js";
import { candleFeatures } from "../studies/candleFeatures.js";
import { getPrecisionDecimals } from "../utilities/precisionMultiplier.js";


// Map indicator keys to their respective functions
const mainFunctions = {
  candleFeatures,
  dateTime,
  heikenAshi,
  rsi,
  mfi,
  stochastic,
  atr,
  adx,
  ema: movingAverages,
  sma: movingAverages,
  macd,
  volumeDelta,
  relativeVolume,
  donchianChannels,
  bollingerBands,
  volumeOscillator,
  mapCols,
  crossPairs,
  lag
};

export const mainLoop = (input, main) => {
  const { 
    len, 
    arrayTypes, 
    verticalOhlcv, 
    verticalOhlcvKeyNames, 
    inputTypes, 
    chunkProcess, 
    precisionMultiplier,
    executionParams
  } = main;


  validateInputParams(executionParams, len)
  for (const { key } of executionParams) {
    if (!Object.prototype.hasOwnProperty.call(mainFunctions, key)) {
      throw new Error(`Unknown indicator "${key}" in configuration.`)
    }
  }

  for(const key of Object.keys(inputTypes))
  {
    verticalOhlcv[key] = buildArray(arrayTypes[key], len)
  }

  // Callbacks can modify inputTypes through main; retain dynamic lookup for them.
  const inputColumns = executionParams.some(({ key }) => key === 'mapCols')
    ? null
    : Object.entries(inputTypes).map(([key, formatterKey]) => {
        const numeric = inputNumberFormatter.hasOwnProperty(formatterKey)
        const formatter = numeric
          ? inputNumberFormatter[formatterKey]
          : dateFormaters.hasOwnProperty(formatterKey) ? dateFormaters[formatterKey] : null
        return { key, formatter, numeric }
      })
  const precisionDecimals = typeof precisionMultiplier === 'number'
    ? getPrecisionDecimals(precisionMultiplier) : undefined
  let validationColumns = null

  // Process each row in the input
  for (let chunkStart = 0; chunkStart < len; chunkStart += chunkProcess) {

      const chunkEnd = Math.min(chunkStart + chunkProcess, len);

      for (let index = chunkStart; index < chunkEnd; index++) {
        const curr = input[index]
      
        if (inputColumns !== null) {
          for (const { key, formatter, numeric } of inputColumns) {
            const value = curr[key]
            if (typeof value === 'undefined') continue

            const formattedValue = formatter === null ? value
              : numeric ? formatter(value, precisionMultiplier, precisionDecimals) : formatter(value)
            main.pushToMain({ index, key, value: formattedValue })
          }
        } else {
          for(const [key, formaterKey] of Object.entries(inputTypes))
          {
            let value = curr[key]

            if(typeof value === 'undefined') continue

            if(inputNumberFormatter.hasOwnProperty(formaterKey))
            {
              const formatedValue = inputNumberFormatter[formaterKey](value, precisionMultiplier, precisionDecimals)

              main.pushToMain({index, key, value: formatedValue})
            }
            else if(dateFormaters.hasOwnProperty(formaterKey))
            {
              main.pushToMain({index, key, value: dateFormaters[formaterKey](value)})
            }
            else
            {
              main.pushToMain({index, key, value})
            }
          }
        }

        const midPrice = (verticalOhlcv.open[index] + verticalOhlcv.close[index]) / 2
        
        main.pushToMain({index, key: 'mid_price', value: midPrice})
    
        // Process these indicators separately (ensuring their execution in the order of initialization)
        for (const { key, params} of executionParams)
        {
          mainFunctions[key](main, index, ...params)
        }
      
        input[index] = null //flusing data

        // All built-in outputs (including generated lags) exist after row zero.
        // Custom callbacks may add/delete columns or replace their buffers, so
        // retain the dynamic lookup path whenever mapCols is registered.
        if (inputColumns !== null && validationColumns === null) {
          validationColumns = Object.values(verticalOhlcv)
        }
        const keyNames = validationColumns === null ? Object.keys(verticalOhlcv) : null

        // Preserve the missing/NaN/null predicate, including Infinity behavior.
        if (!areKeyValuesValid(main, index, keyNames, validationColumns)) {
          main.invalidValueIndex = index
        }
      }
  }


  verticalOhlcvKeyNames.push(...Object.keys(verticalOhlcv))
  
}
