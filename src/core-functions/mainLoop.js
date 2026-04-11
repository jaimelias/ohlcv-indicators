import { areKeyValuesValid } from "./pushToMain.js";
import { validateInputParams } from "../utilities/validators.js";
import { rsi } from "../oscillators/rsi.js";
import { stochastic } from "../oscillators/stochastic.js";
import { movingAverages } from "../moving-averages/movingAverages.js";
import { heikenAshi } from "../moving-averages/heikenAshi.js";
import { vidya } from "../moving-averages/vidya.js";
import { macd } from "../moving-averages/macd.js";
import { relativeVolume } from "../moving-averages/relativeVolume.js";
import { donchianChannels } from "../moving-averages/donchianChannel.js";
import { bollingerBands } from "../moving-averages/bollingerBands.js";
import { volumeOscillator } from "../oscillators/volumeOscillator.js";
import { volumeDelta } from "../oscillators/volumeDelta.js";
import { lag } from "../studies/lag.js";
import { crossPairs } from "../studies/findCrosses.js";
import { dateTime } from "../studies/dateTime.js";
import { scaler } from "../machine-learning/scaler.js";
import { atr } from "../volatility/atr.js";
import { mapCols } from "../studies/mapCols.js";

import { buildArray } from "../utilities/assignTypes.js";
import {  inputNumberFormatter } from "../utilities/numberUtilities.js";
import { dateFormaters } from "../utilities/dateUtilities.js";
import { priceFeatures } from "../studies/priceFeatures.js";


// Map indicator keys to their respective functions
const mainFunctions = {
  priceFeatures,
  dateTime,
  heikenAshi,
  rsi,
  stochastic,
  atr,
  ema: movingAverages,
  sma: movingAverages,
  vidya,
  macd,
  volumeDelta,
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
  const { 
    len, 
    arrayTypes, 
    verticalOhlcv, 
    verticalOhlcvKeyNames, 
    inputTypes, 
    chunkProcess, 
    precisionMultiplier,
    inputParams
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
          let value = curr[key]

          if(typeof value === 'undefined') continue

          if(inputNumberFormatter.hasOwnProperty(formaterKey))
          {
            const formatedValue = inputNumberFormatter[formaterKey](value, precisionMultiplier)

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

        const midPrice = (curr.open + curr.close) / 2
        
        main.pushToMain({index, key: 'mid_price', value: midPrice})
    
        // Process these indicators separately (ensuring their execution in the order of initialization)
        for (const { key, params} of inputParams)
        {
          mainFunctions[key](main, index, ...params)
        }
      
        input[index] = null //flusing data

        const keyNames = Object.keys(verticalOhlcv)

        // if any value at this index is missing/NaN/null, mark it invalid
        if (!areKeyValuesValid(main, index, keyNames)) {
          main.invalidValueIndex = index
        }
      }
  }


  verticalOhlcvKeyNames.push(...Object.keys(verticalOhlcv))
  
}
