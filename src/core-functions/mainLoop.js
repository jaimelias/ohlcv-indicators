import { validateInputParams } from "../utilities/validators.js";
import { rsi } from "../oscillators/rsi.js";
import { stochastic } from "../oscillators/stochastic.js";
import { movingAverages } from "../moving-averages/movingAverages.js";
import { macd } from "../moving-averages/macd.js";
import { relativeVolume } from "../moving-averages/relativeVolume.js";
import { donchianChannels } from "../moving-averages/donchianChannel.js";
import { bollingerBands } from "../moving-averages/bollingerBands.js";
import { volumeOscillator } from "../oscillators/volumeOscillator.js";
import { lag } from "../studies/lag.js";
import { crossPairs } from "../studies/findCrosses.js";
import { dateTime } from "../studies/dateTime.js";
import { scaler } from "../machine-learning/scaler.js";
import { atr } from "../volatility/atr.js";
import { mapCols } from "../studies/mapCols.js";

import { buildArray } from "../utilities/assignTypes.js";
import {  numberFormater } from "../utilities/numberUtilities.js";
import { dateFormaters } from "../utilities/dateUtilities.js";

import { pca } from "../machine-learning/pca.js";
import { regressor } from "../machine-learning/regressor.js";
import { classifier } from "../machine-learning/classifier.js";

// Map indicator keys to their respective functions
const mainFunctions = {
  dateTime,
  rsi,
  stochastic,
  atr,
  ema: movingAverages,
  sma: movingAverages,
  macd,
  relativeVolume,
  donchianChannels,
  bollingerBands,
  volumeOscillator,
  mapCols,
  scaler,
  crossPairs,
  lag,
  regressor,
  classifier,
  pca
};

export const mainLoop = (input, main) => {
  const { len, 
    inputParams, 
    precisionMultiplier, 
    arrayTypes, 
    verticalOhlcv, 
    verticalOhlcvKeyNames, 
    inputTypes, 
    chunkProcess, 
    notNumberKeys, 
    processSecondaryLoop,
    invalidsByKey,
  } = main;

  validateInputParams(inputParams, len)

  for(const key of Object.keys(inputTypes))
  {
    verticalOhlcv[key] = buildArray(arrayTypes[key], len)
  }
  // Process each row in the input
  for (let chunkStart = 0; chunkStart < len; chunkStart += chunkProcess) {

      const chunkEnd = Math.min(chunkStart + chunkProcess, len);

      for (let index = chunkStart; index < chunkEnd; index++) {
        const curr = input[index]
      
        for(const [key, formaterKey] of Object.entries(inputTypes))
        {
          const value = curr[key]

          if(numberFormater.hasOwnProperty(formaterKey))
          {
            let formatedValue = numberFormater[formaterKey](value)

            if(precisionMultiplier > 1 && !notNumberKeys.has(key))
            {
              formatedValue = formatedValue * precisionMultiplier
            }

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
    
        // Process these indicators separately (ensuring their execution order)
        for (const { key, params, order } of inputParams)
        {
          for(let orderIdx = 0; orderIdx < 9; orderIdx++)
          {
            if(typeof order !== 'number') throw new Error(`order property of ${key} not found: ${params}`)
            if(orderIdx !== order) continue
            mainFunctions[key](main, index, ...params)
          }
        }
      
        input[index] = null //flusing data

        let hasInvalidValues = false

        for(const [key, arr] of Object.entries(verticalOhlcv))
        {
          if(!invalidsByKey.hasOwnProperty(key)) invalidsByKey[key] = -1
          const val = arr[index]
          
          if(typeof val === 'undefined' || val === null || Number.isNaN(val))
          {
            hasInvalidValues = true
            invalidsByKey[key]++
          }
        }

        if(hasInvalidValues)
        {
          main.invalidValueIndex++
        }
      }
  }

  const isSecondaryLoopNeeded = inputParams.some(({ key }) => key === 'regressor' || key === 'classifier' || key === 'pca')

  if(isSecondaryLoopNeeded || processSecondaryLoop)
  {
    secondaryLoop(main)
  }

  verticalOhlcvKeyNames.push(...Object.keys(verticalOhlcv))
  
}

export const secondaryLoop = main => {
  const {inputParams, len, invalidValueIndex} = main

  for(let index = invalidValueIndex; index < len; index++)
  {
      for (const { key, params, order } of inputParams)
      {
        for(let orderIdx = 10; orderIdx < 20; orderIdx++) {
          if(typeof order !== 'number') throw new Error(`order property of ${key} not found: ${params}`)
          if(orderIdx !== order) continue
          mainFunctions[key](main, index, ...params)
        }
      }
      
  }

}