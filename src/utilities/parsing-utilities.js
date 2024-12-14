

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


//true if first row date starts with yyyy-mm-dd date
const validateFirstDate = arr => arr[0].hasOwnProperty('date') && typeof arr[0].date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(arr[0].date)

export const defaultStudyOptions = {
    midPriceOpenClose: false,
    midPriceHighLow: false,
    sessionIndex: false,
    sessionIntradayIndex: false,
    dayOfTheWeek: false,
    dayOfTheMonth: false,
    weekOfTheMonth: false
}

export const parseOhlcvToVertical = (input, main) => {

    const {len, studyOptions, inputParams} = main

    if(Boolean(studyOptions))
    {
        for(let k in studyOptions)
        {
            if(!defaultStudyOptions.hasOwnProperty(k))
            {
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

    if(midPriceOpenClose)
    {
        numberColsKeys.push('mid_price_open_close')
    }

    if(midPriceHighLow)
    {
        numberColsKeys.push('mid_price_high_low')
    }

    const numberColsKeysSet = new Set(numberColsKeys)

    // Initialize arrays for numerical columns
    for (const key of numberColsKeys) {
        main.verticalOhlcv[key] = new Array(len)
    }

    // Extract other keys and initialize their arrays
    const inputKeys = Object.keys(input[0])
    const otherKeys = []

    for (const key of inputKeys) {
        if (!numberColsKeysSet.has(key)) {
            main.verticalOhlcv[key] = new Array(len)
            otherKeys.push(key)
        }
    }


    let prevDateStr
    let sessionIndexCount = 0
    let sessionIntradayIndexCount = 0
    const isValidDate = validateFirstDate(input)

    if(isValidDate)
    {
        if(sessionIndex)
        {
            main.verticalOhlcv['session_index'] = new Array(len)
        }
        
        if(sessionIntradayIndex)
        {
            main.verticalOhlcv['session_intraday_index'] = new Array(len)
        }
        
        if(dayOfTheWeek)
        {
            main.verticalOhlcv['day_of_the_week'] = new Array(len)
        }
        
        if(dayOfTheMonth)
        {
            main.verticalOhlcv['day_of_the_month'] = new Array(len)
        }
        
        if(weekOfTheMonth)
        {
            main.verticalOhlcv['week_of_the_month'] = new Array(len)
        }
        
        prevDateStr = input[0].date.slice(0, 10)
    }
    
    for (let x = 0; x < len; x++) {
        const current = input[x]

        main.verticalOhlcv.open[x] = current.open
        main.verticalOhlcv.high[x] = current.high
        main.verticalOhlcv.low[x] = current.low
        main.verticalOhlcv.close[x] = current.close
        main.verticalOhlcv.volume[x] = current.volume

        //indicators
/*         indicatorFunctions.rsi(main, x, 14)
        indicatorFunctions.sma(main, x, 7)
        indicatorFunctions.ema(main, x, 7)
        indicatorFunctions.macd(main, x, 12, 26, 9)
        indicatorFunctions.relativeVolume(main, x, 10)
        indicatorFunctions.donchianChannels(main, x, 0)
        indicatorFunctions.bollingerBands(main, x, 20, 2)
        indicatorFunctions.volumeOscillator(main, x, 5, 10)
        indicatorFunctions.candlesStudies(main, x, 20)
        indicatorFunctions.lag(main, x, ['close'], 20) */

        //indicatorFunctions.rsi(main, x, ...inputParams.rsi[0])


        for(const [key, technical] of Object.entries(inputParams))
        {
            if(['crossPairs'].includes(key)) continue

            if (Array.isArray(technical)) {
                for (let i = 0; i < technical.length; i++) {
                    const params = technical[i];
    
                    if (Array.isArray(params)) {
                        if (params.length > 0) {
                            indicatorFunctions[key](main, x, ...params);
                        } else {
                           indicatorFunctions[key](main, x);
                        }
                    }
                }
            }

        }

        if(midPriceOpenClose)
        {
            main.verticalOhlcv.mid_price_open_close[x] = (current.open + current.close) / 2
        }

        if(midPriceHighLow)
        {
            main.verticalOhlcv.mid_price_high_low[x] = (current.high + current.low) / 2
        }
       
        // Process other keys
        for (const key of otherKeys) {
            main.verticalOhlcv[key][x] = current[key]
        }

        // Date processing for session indices
        if (isValidDate) {
            const thisDateStr = current.date.slice(0, 10)

            if (thisDateStr !== prevDateStr) {
                prevDateStr = thisDateStr
                sessionIndexCount++
                sessionIntradayIndexCount = 0
            }

            const {
                day_of_the_week,
                day_of_the_month,
                week_of_the_month
            } = getDateInfo(thisDateStr)

            if(dayOfTheWeek)
            {
                main.verticalOhlcv.day_of_the_week[x] = day_of_the_week
            }
            
            if(dayOfTheMonth)
            {
                main.verticalOhlcv.day_of_the_month[x] = day_of_the_month
            }
            
            if(weekOfTheMonth)
            {
                main.verticalOhlcv.week_of_the_month[x] = week_of_the_month
            }

            if(sessionIndex)
            {
                main.verticalOhlcv.session_index[x] = sessionIndexCount
            }
            
            if(sessionIntradayIndex)
            {
                main.verticalOhlcv.session_intraday_index[x] = sessionIntradayIndexCount
            }

            sessionIntradayIndexCount++
        }
    }
}


const getDateInfo = dateString => {
    const date = new Date(dateString);
  
    // Get day of the week (0 for Sunday, 1 for Monday, etc.)
    const day_of_the_week = date.getDay()
  
    // Get day of the month
    const day_of_the_month = date.getDate();
  
    // Calculate the week of the month
    const firstDayOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
    const dayOffset = firstDayOfMonth.getDay(); // Day of the week for the 1st day of the month
    const week_of_the_month = Math.ceil((day_of_the_month + dayOffset) / 7);
  
    return {
        day_of_the_week,
        day_of_the_month,
        week_of_the_month
    };
  }