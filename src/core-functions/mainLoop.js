import { areKeyValuesValid } from "./pushToMain.js";
import { validateInputParams } from "../utilities/validators.js";
import { rsi } from "../oscillators/rsi.js";
import { stochastic } from "../oscillators/stochastic.js";
import { movingAverages } from "../moving-averages/movingAverages.js";
import { vidya } from "../moving-averages/vidya.js";
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
  vidya,
  macd,
  relativeVolume,
  donchianChannels,
  bollingerBands,
  volumeOscillator,
  mapCols,
  scaler,
  crossPairs,
  lag
};

export const mainLoop = (input, main) => {
  const { len, 
    inputParams, 
    arrayTypes, 
    verticalOhlcv, 
    verticalOhlcvKeyNames, 
    inputTypes, 
    chunkProcess, 
    processSecondaryLoop,
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
            const formatedValue = numberFormater[formaterKey](value)

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
          for(let orderIdx = 0; orderIdx <= 9; orderIdx++)
          {
            if(typeof order !== 'number') throw new Error(`order property of ${key} not found: ${params}`)
            if(orderIdx !== order) continue
            mainFunctions[key](main, index, ...params)
          }
        }
      
        input[index] = null //flusing data

        const keyNames = Object.keys(verticalOhlcv)

        // if any value at this index is missing/NaN/null, mark it invalid
        if (!areKeyValuesValid(main, index, keyNames)) {
          main.invalidValueIndex = index
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

export const secondaryLoop = (main) => {
  const {inputParams, len, invalidValueIndex} = main

  const startIndex = invalidValueIndex + 1

  for(let index = startIndex; index < len; index++)
  {
      for (const { key, params, order } of inputParams)
      {
        for(let orderIdx = 10; orderIdx <= 20; orderIdx++) {
          if(typeof order !== 'number') throw new Error(`order property of ${key} not found: ${params}`)
          if(orderIdx !== order) continue
          if(key === 'pca') pca(main, index, ...params)
          if(key === 'classifier') classifier(main, index, ...params)
          if(key === 'regressor') regressor(main, index, ...params)
        }
      }
  }

}