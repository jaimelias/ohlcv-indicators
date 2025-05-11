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
import { Scaler } from "../studies/scaler.js";

import { buildArray } from "../utilities/assignTypes.js";
import {  numberFormater } from "../utilities/numberUtilities.js";
import { dateFormaters } from "../utilities/dateUtilities.js";

// Map indicator keys to their respective functions
const indicatorFunctions = {
  dateTime,
  rsi,
  ema: movingAverages,
  sma: movingAverages,
  macd,
  relativeVolume,
  donchianChannels,
  bollingerBands,
  volumeOscillator,
  Scaler
};

// Processes the inputParams into a list of indicator calls
const processIndicatorCalls = inputParams =>
  Array.isArray(inputParams)
    ? inputParams.map(({ key, params }) => ({
        key,
        fn: indicatorFunctions[key],
        args: params
      }))
    : [];

export const mainLoop = (input, main) => {
  const { len, inputParams, priceBased, precisionMultiplier, arrayTypes } = main;

  validateInputParams(main)

  for(const key of Object.keys(main.inputTypes))
  {
    main.verticalOhlcv[key] = buildArray(arrayTypes[key], len)
  }

  // Prepare the list of indicator function calls
  const indicatorCalls = processIndicatorCalls(inputParams);

  // Process each row in the input
  for (let x = 0; x < len; x++) {
    const curr = input[x]

    processThisRow({x, main, curr, indicatorCalls, priceBased, precisionMultiplier})
  }
}

const processThisRow = ({x, main, curr, indicatorCalls, priceBased, precisionMultiplier}) => {


  for(const [key, formaterKey] of Object.entries(main.inputTypes))
    {
      const value = curr[key]

      if(numberFormater.hasOwnProperty(formaterKey))
      {
        let formatedValue = numberFormater[formaterKey](value)

        if(precisionMultiplier > 1 && priceBased.includes(key))
        {
          formatedValue = formatedValue * precisionMultiplier
        }

        main.pushToMain({index: x, key, value: formatedValue})
      }
      else if(dateFormaters.hasOwnProperty(formaterKey))
      {
        main.pushToMain({index: x, key, value: dateFormaters[formaterKey](value)})
      }
      else
      {
        main.pushToMain({index: x, key, value})
      }
    }

    // Run all indicator functions except for the ones processed later
    for (const { key, fn, args } of indicatorCalls) {
      if (['crossPairs', 'lag'].includes(key)) continue;
      fn(main, x, ...args)
    }

    // Process these indicators separately (ensuring their execution order)
    lag(main, x)
    crossPairs(main, x)

    main.lastComputedIndex++
}