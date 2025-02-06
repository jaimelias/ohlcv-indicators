import { validateInputParams } from "./validators.js"
import { rsi } from "../oscillators/rsi.js"
import { sma } from "../moving-averages/sma.js"
import { ema } from "../moving-averages/ema.js"
import { macd } from "../moving-averages/macd.js"
import { relativeVolume } from "../moving-averages/relativeVolume.js"
import { donchianChannels } from "../moving-averages/donchianChannel.js"
import { bollingerBands } from "../moving-averages/bollingerBands.js"
import { volumeOscillator } from "../oscillators/volumeOscillator.js"
import { candleStudies } from "../studies/candleStudies.js"
import { lag } from "../studies/lag.js"
import {crossPairs} from "../studies/findCrosses.js"
import { dateTime } from "../studies/dateTime.js"
import { priceVariations } from "../studies/priceVariations.js"
import { relativePositions } from "../studies/relativePosition.js"


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
}


export const parseOhlcvToVertical = (input, main, startIndex = 0) => {
    const { len, inputParams, precisionMultiplier } = main

    const parseNumber = num => (precisionMultiplier > 1) ? num * precisionMultiplier : num

    main.nullArray = new Array(len).fill(null)

    if (startIndex === 0) {

        validateInputParams(main)

        const baseKeys = ['open', 'high', 'low', 'close', 'volume'];
        const baseKeysSet = new Set(baseKeys);

        // Fresh initialization
        for (let i = 0; i < baseKeys.length; i++) {
            main.verticalOhlcv[baseKeys[i]] = [...main.nullArray]
        }

        const inputKeys = Object.keys(input[0]);
        const otherKeys = [];
        for (let i = 0; i < inputKeys.length; i++) {
            const key = inputKeys[i]
            if (!baseKeysSet.has(key)) {
                main.verticalOhlcv[key] = [...main.nullArray]
                otherKeys.push(key)
            }
        }
        main.otherKeys = otherKeys;


    } else {
        if (!main.otherKeys) {
            throw new Error("otherKeys not found in main. Ensure you run with startIndex=0 first to initialize.");
        }
    }

    const indicatorCalls = processIndicatorCalls(inputParams);


    for (let x = startIndex; x < len; x++) {
        const current = input[x];

        main.verticalOhlcv.open[x] = parseNumber(current.open);
        main.verticalOhlcv.high[x] = parseNumber(current.high);
        main.verticalOhlcv.low[x] = parseNumber(current.low);
        main.verticalOhlcv.close[x] = parseNumber(current.close);
        main.verticalOhlcv.volume[x] = current.volume;

        for (let i = 0; i < main.otherKeys.length; i++) {
            const k = main.otherKeys[i];
            main.verticalOhlcv[k][x] = current[k];
        }

        for (let i = 0; i < indicatorCalls.length; i++) {
            const { fn, args, key } = indicatorCalls[i];
            if (key === 'crossPairs' || key === 'lag' || key === 'relativePositions') continue;

            fn(main, x, ...args)
        }

        relativePositions(main, x)
        lag(main, x);
        crossPairs(main, x);
        main.lastComputedIndex++;
    }
};


const processIndicatorCalls = inputParams => {
    if (!inputParams || typeof inputParams !== 'object') return []

    const indicatorCalls = []

    for(let x = 0; x < inputParams.length; x++)
    {
        const {key, params} = inputParams[x]
        indicatorCalls.push({key, fn: indicatorFunctions[key], args: params})
    }

    return indicatorCalls;
};
