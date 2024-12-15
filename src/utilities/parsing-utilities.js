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

const indicatorFunctions = {
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

const validateFirstDate = (arr) => arr[0].hasOwnProperty('date') && typeof arr[0].date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(arr[0].date)

export const defaultStudyOptions = {
    midPriceOpenClose: true,
    midPriceHighLow: true,
    sessionIndex: true,
    sessionIntradayIndex: true,
    dayOfTheWeek: true,
    dayOfTheMonth: true,
    weekOfTheMonth: true
}

const getDateInfo = (dateString) => {
    const date = new Date(dateString);
    const day_of_the_week = date.getDay();
    const day_of_the_month = date.getDate();
    const firstDayOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
    const dayOffset = firstDayOfMonth.getDay();
    const week_of_the_month = Math.ceil((day_of_the_month + dayOffset) / 7);

    return {
        day_of_the_week,
        day_of_the_month,
        week_of_the_month
    };
}

export const parseOhlcvToVertical = (input, main, startIndex = 0) => {
    const { len, studyOptions = {}, inputParams } = main

    if (studyOptions) {
        const studyOptionKeys = Object.keys(studyOptions)
        for (let i = 0; i < studyOptionKeys.length; i++) {
            const k = studyOptionKeys[i]
            if (!defaultStudyOptions.hasOwnProperty(k)) {
                throw new Error(`Key ${k} not found in defaultStudyOptions. Available options: ${Object.keys(defaultStudyOptions).join(', ')}`)
            }
        }
    }

    const {
        midPriceOpenClose,
        midPriceHighLow,
        sessionIndex,
        sessionIntradayIndex,
        dayOfTheWeek,
        dayOfTheMonth,
        weekOfTheMonth
    } = studyOptions

    const numberColsKeys = ['open', 'high', 'low', 'close', 'volume']
    if (midPriceOpenClose) numberColsKeys.push('mid_price_open_close')
    if (midPriceHighLow)   numberColsKeys.push('mid_price_high_low')

    const numberColsKeysSet = new Set(numberColsKeys)
    const vert = main.verticalOhlcv

    let isValidDate = false
    if (startIndex === 0) {
        // Fresh initialization
        // Initialize arrays for numerical columns
        for (let i = 0; i < numberColsKeys.length; i++) {
            vert[numberColsKeys[i]] = new Array(len)
        }

        // Extract other keys and initialize their arrays
        const inputKeys = Object.keys(input[0])
        const otherKeys = []
        for (let i = 0; i < inputKeys.length; i++) {
            const key = inputKeys[i]
            if (!numberColsKeysSet.has(key)) {
                vert[key] = new Array(len)
                otherKeys.push(key)
            }
        }
        main.otherKeys = otherKeys

        isValidDate = validateFirstDate(input)

        if (isValidDate) {
            if (sessionIndex) {
                vert['session_index'] = new Array(len)
            }
            if (sessionIntradayIndex) {
                vert['session_intraday_index'] = new Array(len)
            }
            if (dayOfTheWeek) {
                vert['day_of_the_week'] = new Array(len)
            }
            if (dayOfTheMonth) {
                vert['day_of_the_month'] = new Array(len)
            }
            if (weekOfTheMonth) {
                vert['week_of_the_month'] = new Array(len)
            }

            main.prevDateStr = input[0].date.slice(0, 10)
            main.sessionIndexCount = 0
            main.sessionIntradayIndexCount = 0
            main.cachedDayInfo = getDateInfo(main.prevDateStr)
        } else {
            // If no valid date, ensure these are null
            main.prevDateStr = null
            main.sessionIndexCount = null
            main.sessionIntradayIndexCount = null
            main.cachedDayInfo = null
        }
    } else {
        // startIndex > 0
        // We assume arrays and keys are already set
        if (!main.otherKeys) {
            throw new Error("otherKeys not found in main. Ensure you run with startIndex=0 first to initialize.")
        }

        // Validate that state variables needed are present
        if (!main.hasOwnProperty('prevDateStr')) {
            throw new Error("prevDateStr missing in main. Make sure to store state after initial run.")
        }

        // If we had a valid date initially, we continue with date computations
        isValidDate = main.prevDateStr !== null
    }

    // Pre-process indicator params
    const indicatorCalls = []
    if (inputParams && typeof inputParams === 'object') {
        for (const key in inputParams) {
            const technical = inputParams[key]
            if (Array.isArray(technical)) {
                for (let i = 0; i < technical.length; i++) {
                    const params = technical[i];
                    if (Array.isArray(params)) {
                        indicatorCalls.push({
                            key,
                            fn: indicatorFunctions[key],
                            args: params
                        })
                    }
                }
            }
        }
    }

    // Store references for numeric arrays to avoid repeated dictionary lookups
    const vo_open = vert.open
    const vo_high = vert.high
    const vo_low = vert.low
    const vo_close = vert.close
    const vo_volume = vert.volume
    const vo_mid_oc = midPriceOpenClose ? vert.mid_price_open_close : null
    const vo_mid_hl = midPriceHighLow ? vert.mid_price_high_low : null

    // References for other keys arrays
    const otherArrays = {}
    for (let i = 0; i < main.otherKeys.length; i++) {
        const k = main.otherKeys[i]
        otherArrays[k] = vert[k]
    }

    // For date/session logic, use previously stored state if startIndex > 0
    let prevDateStr = main.prevDateStr
    let sessionIndexCount = main.sessionIndexCount
    let sessionIntradayIndexCount = main.sessionIntradayIndexCount
    let cachedDayInfo = main.cachedDayInfo

    // Compute indicators and fill data from startIndex to len
    for (let x = startIndex; x < len; x++) {
        const current = input[x]

        // Assign OHLCV
        vo_open[x] = current.open
        vo_high[x] = current.high
        vo_low[x] = current.low
        vo_close[x] = current.close
        vo_volume[x] = current.volume



        // Mid-price calculations
        if (vo_mid_oc) {
            vo_mid_oc[x] = (current.open + current.close) / 2
        }
        if (vo_mid_hl) {
            vo_mid_hl[x] = (current.high + current.low) / 2
        }

        // Other keys
        for (let i = 0; i < main.otherKeys.length; i++) {
            const k = main.otherKeys[i]
            otherArrays[k][x] = current[k]
        }

        // Date processing for session indices and date fields
        if (isValidDate) {
            const thisDateStr = current.date.slice(0, 10)
            if (thisDateStr !== prevDateStr) {
                prevDateStr = thisDateStr
                sessionIndexCount++
                sessionIntradayIndexCount = 0
                cachedDayInfo = getDateInfo(thisDateStr)
            }

            if (dayOfTheWeek) {
                vert.day_of_the_week[x] = cachedDayInfo.day_of_the_week
            }

            if (dayOfTheMonth) {
                vert.day_of_the_month[x] = cachedDayInfo.day_of_the_month
            }

            if (weekOfTheMonth) {
                vert.week_of_the_month[x] = cachedDayInfo.week_of_the_month
            }

            if (sessionIndex) {
                vert.session_index[x] = sessionIndexCount
            }

            if (sessionIntradayIndex) {
                vert.session_intraday_index[x] = sessionIntradayIndexCount
            }

            sessionIntradayIndexCount++


            // Run indicator functions
            for (let i = 0; i < indicatorCalls.length; i++) {
                const { fn, args, key } = indicatorCalls[i]
                if(key === 'crossPairs' || key === 'lag') continue
                fn(main, x, ...args)
            }

            lag(main, x, inputParams.lag)
            crossPairs(main, x, main.crossPairsList)
        }
    }

    // Store current state so that we can continue from here in subsequent calls
    main.prevDateStr = prevDateStr
    main.sessionIndexCount = sessionIndexCount
    main.sessionIntradayIndexCount = sessionIntradayIndexCount
    main.cachedDayInfo = cachedDayInfo
}
