import { rsi } from "../oscillators/rsi.js"
import { sma } from "../moving-averages/sma.js"
import { ema } from "../moving-averages/ema.js"
import { macd } from "../moving-averages/macd.js"
import { relativeVolume } from "../moving-averages/relativeVolume.js"
import { donchianChannels } from "../moving-averages/donchianChannel.js"
import { bollingerBands } from "../moving-averages/bollingerBands.js"
import { volumeOscillator } from "../oscillators/volumeOscillator.js"
import { candlesStudies } from "../studies/candleStudies.js"
import { lag } from "../studies/lag.js"
import {crossPairs} from "../studies/findCrosses.js"
import { dateTime } from "../studies/dateTime.js"

const indicatorFunctions = {
    dateTime,
    rsi,
    sma,
    ema,
    macd,
    relativeVolume,
    donchianChannels,
    bollingerBands,
    volumeOscillator,
    candlesStudies,
    lag,
}

export const defaultStudyOptions = {
    midPriceOpenClose: false,
    midPriceHighLow: false
}


export const parseOhlcvToVertical = (input, main, startIndex = 0) => {
    const { len, studyOptions = {}, inputParams } = main

    if (studyOptions) {
        const studyOptionKeys = Object.keys(studyOptions);
        for (let i = 0; i < studyOptionKeys.length; i++) {
            const k = studyOptionKeys[i];
            if (!defaultStudyOptions.hasOwnProperty(k)) {
                throw new Error(`Key ${k} not found in defaultStudyOptions. Available options: ${Object.keys(defaultStudyOptions).join(', ')}`);
            }
        }
    }

    const {
        midPriceOpenClose,
        midPriceHighLow,
    } = studyOptions;

    const numberColsKeys = ['open', 'high', 'low', 'close', 'volume'];
    if (midPriceOpenClose) numberColsKeys.push('mid_price_open_close');
    if (midPriceHighLow)   numberColsKeys.push('mid_price_high_low');

    const numberColsKeysSet = new Set(numberColsKeys);

    if (startIndex === 0) {
        // Fresh initialization
        for (let i = 0; i < numberColsKeys.length; i++) {
            main.verticalOhlcv[numberColsKeys[i]] = new Array(len);
        }

        const inputKeys = Object.keys(input[0]);
        const otherKeys = [];
        for (let i = 0; i < inputKeys.length; i++) {
            const key = inputKeys[i];
            if (!numberColsKeysSet.has(key)) {
                main.verticalOhlcv[key] = new Array(len);
                otherKeys.push(key);
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

        main.verticalOhlcv.open[x] = current.open;
        main.verticalOhlcv.high[x] = current.high;
        main.verticalOhlcv.low[x] = current.low;
        main.verticalOhlcv.close[x] = current.close;
        main.verticalOhlcv.volume[x] = current.volume;

        if (midPriceOpenClose) {
            main.verticalOhlcv.mid_price_open_close[x] = (current.open + current.close) / 2;
        }
        if (midPriceHighLow) {
            main.verticalOhlcv.mid_price_high_low[x] = (current.high + current.low) / 2;
        }

        for (let i = 0; i < main.otherKeys.length; i++) {
            const k = main.otherKeys[i];
            main.verticalOhlcv[k][x] = current[k];
        }

        for (let i = 0; i < indicatorCalls.length; i++) {
            const { fn, args, key } = indicatorCalls[i];
            if (key === 'crossPairs' || key === 'lag') continue;
            fn(main, x, ...args);
        }

        lag(main, x, inputParams.lag);
        crossPairs(main, x, main.crossPairsList);
        main.lastComputedIndex++;
    }
};


const processIndicatorCalls = (inputParams) => {
    if (!inputParams || typeof inputParams !== 'object') return [];

    const indicatorCalls = [];
    for (const [key, technical] of Object.entries(inputParams)) {
        if (Array.isArray(technical)) {
            for (const params of technical) {
                if (Array.isArray(params)) {
                    indicatorCalls.push({
                        key,
                        fn: indicatorFunctions[key],
                        args: params,
                    });
                }
            }
        }
    }
    return indicatorCalls;
};
