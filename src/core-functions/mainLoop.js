import { validateInputParams } from "../utilities/validators.js";
import { rsi } from "../oscillators/rsi.js";
import { movingAverages } from "../moving-averages/movingAverages.js";
import { macd } from "../moving-averages/macd.js";
import { relativeVolume } from "../moving-averages/relativeVolume.js";
import { donchianChannels } from "../moving-averages/donchianChannel.js";
import { bollingerBands } from "../moving-averages/bollingerBands.js";
import { volumeOscillator } from "../oscillators/volumeOscillator.js";
import { lag } from "../studies/lag.js";
import { crossPairs, oneHotCrossPairsSecondLoop } from "../studies/findCrosses.js";
import { dateTime } from "../studies/dateTime.js";
import { scaler } from "../machine-learning/scaler.js";
import { atr } from "../volatility/atr.js";

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
  atr,
  ema: movingAverages,
  sma: movingAverages,
  macd,
  relativeVolume,
  donchianChannels,
  bollingerBands,
  volumeOscillator
};

export const mainLoop = (input, main) => {
  const { len, inputParams, precisionMultiplier, arrayTypes, verticalOhlcv, verticalOhlcvKeyNames, inputTypes, chunkProcess, notNumberKeys, processSecondaryLoop } = main;

  validateInputParams(inputParams, len)

  for(const key of Object.keys(inputTypes))
  {
    verticalOhlcv[key] = buildArray(arrayTypes[key], len)
  }

  const mainInputParams = inputParams.filter(({ key }) => mainFunctions.hasOwnProperty(key))

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
      
        // Run all indicator functions except for the ones processed later
        for (const { key, params } of mainInputParams) {
          mainFunctions[key](main, index, ...params)
        }
    
        // Process these indicators separately (ensuring their execution order)

        for (const { key, params } of inputParams) {
          if(key === 'scaler') scaler(main, index, ...params)
          if(key === 'lag') lag(main, index, ...params)
          if(key === 'crossPairs') crossPairs(main, index, ...params)
        }
      
        input[index] = null //flusing data
      }
  }

  const isSecondaryLoopNeeded = inputParams.some(({ key }) => key === 'regressor' || key === 'classifier')
  const isPcaNeeded = inputParams.some(({ key, params }) => key.startsWith('scaler') && params[2].pca !== null)

  
  if(isSecondaryLoopNeeded || processSecondaryLoop)
  {
    secondaryLoop(main)
  }

  if(isPcaNeeded) {
    pca(main)
  }  

  verticalOhlcvKeyNames.push(...Object.keys(verticalOhlcv))
  
}

export const secondaryLoop = main => {
  const {inputParams, len, instances, invalidValueIndex} = main

  const crossPairMatrix = {}
  let crossPairIsOneHot = false

  if(instances.hasOwnProperty('crossPairs'))
  {
    for(const [crossName, obj] of Object.entries(instances.crossPairs))
    {
      const {min, max, oneHotCols} = obj
      crossPairMatrix[crossName] = {min, max, oneHotCols}
      crossPairIsOneHot = true
    }
  }


  for(let index = invalidValueIndex; index < len; index++)
  {
    if(crossPairIsOneHot) oneHotCrossPairsSecondLoop(main, index, crossPairMatrix)

    //secondary params
      for (const { key, params } of inputParams) {
        if(key === 'regressor') regressor(main, index, ...params)
        if(key === 'classifier') classifier(main, index, ...params)
        if(key === 'scalerSecondary') scaler(main, index, ...params)
        if(key === 'lagSecondary') lag(main, index, ...params)
      }
  }

}