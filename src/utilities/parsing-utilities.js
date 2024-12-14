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
    lag
}

const validateFirstDate = (arr) => arr[0].hasOwnProperty('date') && typeof arr[0].date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(arr[0].date)

export const defaultStudyOptions = {
    midPriceOpenClose: false,
    midPriceHighLow: false,
    sessionIndex: false,
    sessionIntradayIndex: false,
    dayOfTheWeek: false,
    dayOfTheMonth: false,
    weekOfTheMonth: false
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

export const parseOhlcvToVertical = (input, main) => {
    const { len, studyOptions, inputParams } = main

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

    const isValidDate = validateFirstDate(input)
    let prevDateStr
    let sessionIndexCount = 0
    let sessionIntradayIndexCount = 0

    // Initialize date-related arrays if necessary
    if (isValidDate) {
        if (sessionIndex) {
            main.verticalOhlcv['session_index'] = new Array(len)
        }
        if (sessionIntradayIndex) {
            main.verticalOhlcv['session_intraday_index'] = new Array(len)
        }
        if (dayOfTheWeek) {
            main.verticalOhlcv['day_of_the_week'] = new Array(len)
        }
        if (dayOfTheMonth) {
            main.verticalOhlcv['day_of_the_month'] = new Array(len)
        }
        if (weekOfTheMonth) {
            main.verticalOhlcv['week_of_the_month'] = new Array(len)
        }

        prevDateStr = input[0].date.slice(0, 10)
    }

    // Pre-process indicator params
    const indicatorCalls = []
    if (inputParams && typeof inputParams === 'object') {
        for (const key in inputParams) {
            if (key === 'crossPairs') continue
            const technical = inputParams[key]
            if (Array.isArray(technical)) {
                for (let i = 0; i < technical.length; i++) {
                    const params = technical[i];
                    if (Array.isArray(params)) {
                        indicatorCalls.push({
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
    for (let i = 0; i < otherKeys.length; i++) {
        const k = otherKeys[i]
        otherArrays[k] = vert[k]
    }

    // Cached date info for the current date
    let cachedDayInfo = getDateInfo(prevDateStr) // initial date info if needed
    for (let x = 0; x < len; x++) {
        const current = input[x]

        // Assign OHLCV
        vo_open[x] = current.open
        vo_high[x] = current.high
        vo_low[x] = current.low
        vo_close[x] = current.close
        vo_volume[x] = current.volume

        // Run indicator functions
        for (let i = 0; i < indicatorCalls.length; i++) {
            const { fn, args } = indicatorCalls[i]
            fn(main, x, ...args)
        }

        // Mid-price calculations
        if (vo_mid_oc) {
            vo_mid_oc[x] = (current.open + current.close) / 2
        }
        if (vo_mid_hl) {
            vo_mid_hl[x] = (current.high + current.low) / 2
        }

        // Other keys
        for (let i = 0; i < otherKeys.length; i++) {
            const k = otherKeys[i]
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
                main.verticalOhlcv.day_of_the_week[x] = cachedDayInfo.day_of_the_week
            }

            if (dayOfTheMonth) {
                main.verticalOhlcv.day_of_the_month[x] = cachedDayInfo.day_of_the_month
            }

            if (weekOfTheMonth) {
                main.verticalOhlcv.week_of_the_month[x] = cachedDayInfo.week_of_the_month
            }

            if (sessionIndex) {
                main.verticalOhlcv.session_index[x] = sessionIndexCount
            }

            if (sessionIntradayIndex) {
                main.verticalOhlcv.session_intraday_index[x] = sessionIntradayIndexCount
            }

            sessionIntradayIndexCount++
        }
    }
}
