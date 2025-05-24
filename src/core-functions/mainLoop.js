import { validateInputParams } from "../utilities/validators.js";
import { rsi } from "../oscillators/rsi.js";
import { movingAverages } from "../moving-averages/movingAverages.js";
import { macd } from "../moving-averages/macd.js";
import { relativeVolume } from "../moving-averages/relativeVolume.js";
import { donchianChannels } from "../moving-averages/donchianChannel.js";
import { bollingerBands } from "../moving-averages/bollingerBands.js";
import { volumeOscillator } from "../oscillators/volumeOscillator.js";
import { lag } from "../studies/lag.js";
import { crossPairs } from "../studies/findCrosses.js";
import { dateTime } from "../studies/dateTime.js";
import { scaler } from "../studies/scaler.js";
import { atr } from "../volatility/atr.js";

import { buildArray } from "../utilities/assignTypes.js";
import {  numberFormater } from "../utilities/numberUtilities.js";
import { dateFormaters } from "../utilities/dateUtilities.js";

// Map indicator keys to their respective functions
const indicatorFunctions = {
  dateTime,
  rsi,
  atr,
  ema: movingAverages,
  sma: movingAverages,
  macd,
  relativeVolume,
  donchianChannels,
  bollingerBands,
  volumeOscillator,
  scaler
};


export const mainLoop = (input, main) => {
  const { len, inputParams, priceBased, precisionMultiplier, arrayTypes, verticalOhlcv, verticalOhlcvKeyNames, inputTypes, chunkProcess } = main;

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

            if(precisionMultiplier > 1 && priceBased.has(key))
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
        for (const { key, params } of inputParams) {
          if (key === 'lag' || key === 'crossPairs') continue;
          // resolve fn on-demand, no per-item object allocation here
          indicatorFunctions[key](main, index, ...params)
        }
    
        // Process these indicators separately (ensuring their execution order)
        lag(main, index)
        crossPairs(main, index)
        input[index] = null //flusing data
      }
  }

  verticalOhlcvKeyNames.push(...Object.keys(verticalOhlcv))
}