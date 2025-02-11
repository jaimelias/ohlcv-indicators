import { validateInputParams } from "./validators.js";
import { rsi } from "../oscillators/rsi.js";
import { sma } from "../moving-averages/sma.js";
import { ema } from "../moving-averages/ema.js";
import { macd } from "../moving-averages/macd.js";
import { relativeVolume } from "../moving-averages/relativeVolume.js";
import { donchianChannels } from "../moving-averages/donchianChannel.js";
import { bollingerBands } from "../moving-averages/bollingerBands.js";
import { volumeOscillator } from "../oscillators/volumeOscillator.js";
import { candleStudies } from "../studies/candleStudies.js";
import { lag } from "../studies/lag.js";
import { crossPairs } from "../studies/findCrosses.js";
import { dateTime } from "../studies/dateTime.js";
import { priceVariations } from "../studies/priceVariations.js";

// Helper to clean non-numeric characters (except "-" at the start and decimal point)
const cleanNumStr = str => str.replace(/(?!^-)[^0-9.]/g, '');

// Map indicator keys to their respective functions
const indicatorFunctions = {
  dateTime,
  priceVariations,
  rsi,
  sma,
  ema,
  macd,
  relativeVolume,
  donchianChannels,
  bollingerBands,
  volumeOscillator,
  candleStudies
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

// Sets the input types for each key based on the first row of data
const setInputTypes = (row0, main) => {
  const isValidNumberString = str => /^(\d+(\.\d*)?|\.\d+)$/.test(str);

  for (const key of Object.keys(main.inputTypes)) {
    if (!(key in row0)) {
      throw new Error(`Property "${key}" not found in ohlcv array. ${main.ticker}`);
    }

    let value = row0[key];

    

    if (typeof value === 'number' && value > 0) {
      main.inputTypes[key] = 'number';
    } else if (typeof value === 'string' && isValidNumberString(value)) {
      main.inputTypes[key] = 'string';
      value = cleanNumStr(value);
    } else {
      throw new Error(`Invalid property "${key}" in ohlcv array. ${main.ticker}`);
    }

    // Determine precisionMultiplier if not already set
    if (main.precisionMultiplier === 0) {
      const [, decimals = ''] = String(value).split('.');
      const decimalPrecision = Math.max(4, decimals.length);
      main.precisionMultiplier = decimalPrecision > 1 ? Math.pow(10, decimalPrecision - 1) : 1;
    }
  }
};

// Parses a number from either a numeric or string input, applying a multiplier to fix precision issues
const parseNumber = (num, type, precisionMultiplier) => {
  const addMultiplier = cNum =>
    precisionMultiplier > 1 ? cNum * precisionMultiplier : cNum;

  if (type === 'number') {
    return addMultiplier(num);
  } else if (type === 'string') {
    const cleanedStr = cleanNumStr(num);
    return addMultiplier(Number(cleanedStr));
  } else
  {
    return 0 // Optionally: throw an error if type is not recognized
  }
  
};

const parseVolume = (volume, type) => {

  if(type === 'number') return volume
  else if(type === 'string'){
    return Number(cleanNumStr(volume))
  }
  else
  {
    return 0 // Optionally: throw an error if type is not recognized
  }
}

export const parseOhlcvToVertical = (input, main, startIndex = 0) => {
  const { len, inputParams } = main;
  main.nullArray = new Array(len).fill(null);

  const BASE_KEYS = ['open', 'high', 'low', 'close', 'volume'];
  const baseKeysSet = new Set(BASE_KEYS);

  if (startIndex === 0) {
    // Validate parameters and initialize base keys in verticalOhlcv
    validateInputParams(main);
    BASE_KEYS.forEach(key => {
      main.verticalOhlcv[key] = [...main.nullArray];
    });

    // Identify any additional keys from the first input row and initialize them
    const inputKeys = Object.keys(input[0]);
    const otherKeys = inputKeys.filter(key => !baseKeysSet.has(key));
    otherKeys.forEach(key => {
      main.verticalOhlcv[key] = [...main.nullArray];
    });
    main.otherKeys = otherKeys;

    // Set the input types once using the first row
    setInputTypes(input[0], main);
  } else if (!main.otherKeys) {
    throw new Error(
      "otherKeys not found in main. Ensure you run with startIndex=0 first to initialize."
    );
  }

  // Prepare the list of indicator function calls
  const indicatorCalls = processIndicatorCalls(inputParams);

  // Process each row in the input
  for (let x = startIndex; x < len; x++) {
    const current = input[x];
    // Destructure the base keys and use the rest for other properties
    const { open, high, low, close, volume, ...rest } = current
    const {precisionMultiplier} = main

    const parsedOpen = parseNumber(open, main.inputTypes.open, precisionMultiplier)
    const parsedHigh = parseNumber(open, main.inputTypes.high, precisionMultiplier)
    const parsedLow = parseNumber(open, main.inputTypes.low, precisionMultiplier)
    const parsedClose = parseNumber(open, main.inputTypes.close, precisionMultiplier)
    const parsedVolume = parseVolume (volume, main.inputTypes.volume)

    main.pushToMain({index: x, key: 'open', value: parsedOpen})
    main.pushToMain({index: x, key: 'high', value: parsedHigh})
    main.pushToMain({index: x, key: 'low', value: parsedLow})
    main.pushToMain({index: x, key: 'close', value: parsedClose})
    main.pushToMain({index: x, key: 'volume', value: parsedVolume})


    // Populate any extra keys identified during initialization
    for (const key of main.otherKeys) {
      main.pushToMain({index: x, key, value: rest[key]})
    }

    // Run all indicator functions except for the ones processed later
    for (const { key, fn, args } of indicatorCalls) {
      if (['crossPairs', 'lag'].includes(key)) continue;
      fn(main, x, ...args);
    }

    // Process these indicators separately (ensuring their execution order)
    lag(main, x);
    crossPairs(main, x);

    main.lastComputedIndex++;
  }
};
