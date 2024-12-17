import { parseOhlcvToVertical, defaultStudyOptions } from './src/utilities/parsing-utilities.js'
import { correlation } from './src/studies/correlation.js'
import { setIndicatorsFromInputParams } from './src/utilities/setIndicatorsFromInputParams.js'
import { validateDate } from './src/studies/dateTime.js'

export default class OHLCV_INDICATORS {
    constructor({input, ticker = null, studyOptions = null}) {

        if(!Array.isArray(input)) throw Error('input ohlcv must be an array: ' + ticker)
        if(input.length === 0) throw Error('input ohlcv must not be empty: ' + ticker)
        if(!input[0].hasOwnProperty('close')) throw Error('input ohlcv array objects require at least close property: ' + ticker)

        this.lastComputedIndex = 0

        this.input = input
        this.priceBased = ['open', 'high', 'low', 'close', 'mid_price_open_close', 'mid_price_high_low']
        this.len = input.length
        this.studyOptions = (studyOptions === null) ? defaultStudyOptions : studyOptions
        this.lastIndexReplace = false 
        this.instances = {}
        this.crossPairsList = []
        this.verticalOhlcv = {}

        this.inputParams = {
            dateTime: null,
            crossPairs: null,
            lag: null,
            relativeVolume: null,
            ema: null,
            sma: null,
            macd: null,
            bollingerBands: null,
            rsi: null,
            donchianChannels: null,
            candlesStudies: null,
            volumeOscillator: null,
        }

        
        this.studies = {}
        this.utilities = {
            correlation
        }


        this.setIndicatorsFromInputParams = setIndicatorsFromInputParams
    
        return this 
    }
    
    getData() {

        //getData method returns the last object (row) of the new ohlcv with indicators: {open, high, low, close, rsi_14, bollinger_bands_upper}
        this.compute()
        
        const {verticalOhlcv} = this
        const keys = Object.keys(verticalOhlcv);
        const len = verticalOhlcv[keys[0]].length;
        const keysLength = keys.length;
    
        // Pre-allocate array to improve memory efficiency
        const result = [];
    
        // Iterate over the rows
        for (let i = 0; i < len; i++) {
            const row = {};
            let isInvalidValue = false;  // Flag to track if any null value is found
    
            // Loop over keys to fill row data
            for (let x = 0; x < keysLength; x++) {
                const header = keys[x];

                const value = verticalOhlcv[header][i];
    
                // If value is null, mark the row to be skipped and break
                if (value === null || typeof value === 'undefined') {
                    isInvalidValue = true;
                    break;
                }
    
                row[header] =  value
            }
    
            // If no null values were found, add row to result
            if (!isInvalidValue) {
                result.push(row);
            }
        }
    
        return result;
    }
    
    
    getLastValues(){

        return this.getData()[this.getData().length -1]
    
    }

    compute(change) {

        //checks the first row in ohlcv input to verify if the date property is valid
        this.isValidDate = this.input[0].hasOwnProperty('date') && validateDate(this.input[0].date)

         //compute method can be used to process indicators if no arguments are provided
         //compute method can be called to access the .verticalOhlcv object
         //compute method is called automatically if getLastValues or getDate methods are called
        if (this.len > this.lastComputedIndex && !change) {
            parseOhlcvToVertical(this.input, this, 0);
        }        

        //compute method can be used to add new or update the last datapoints if a new ohlcv object is passed with a valid date property
        //valid date properties: "2024-12-16 15:45:00" or "2024-12-16"
        if (change && typeof change === 'object') {

            if (!['open', 'high', 'low', 'close', 'volume', 'date'].every(f => Object.keys(change).includes(f))) {
                throw Error('Invalid ohlcv object sent in "compute". Correct usage: .compute({open: 108.25, high: 108.410004, low: 108.25, close: 99999999, volume: 875903, date: "2024-12-16 15:45:00" || "2024-12-16"})');
            }            
            if(!this.isValidDate)
            {
                throw Error('All the ohlcv rows require a valid date property to access the compute change method. Correct date format: "2024-12-16 15:45:00" or "2024-12-16"')
            }
            if(!validateDate(change.date))
            {
                throw Error('The date in the new ohlcv row is invalid. Correct date format: "2024-12-16 15:45:00" or "2024-12-16"')
            }

            const { date: changeDate } = change;
            const lastIndex = this.len - 1;
            const inputDate = this.input[lastIndex]?.date;
    
            //fallback if .compute(change) is triggered before .compute() alone
            if (this.lastComputedIndex === 0) {
                this.compute()
            }


            if (inputDate !== changeDate) {
                // Add new item
                this.len++
                this.input.push(change)
                parseOhlcvToVertical(this.input, this, this.len)
            } else {
                // Modify the last item
                this.input[lastIndex] = change
                parseOhlcvToVertical(this.input, this, lastIndex)
            }

        }
    

    
        return this;
    }
    
    

    crossPairs(arr)
    {
        this.crossPairsList = [...this.crossPairsList, ...arr]
        this.inputParams.crossPairs ??= []
        this.inputParams.crossPairs.push([this.crossPairsList])
        
        return this
    }


    lag(colKeys = ['close'], lags = 1) {

        this.inputParams.lag ??= []
        this.inputParams.lag.push([colKeys, lags])

        for(let x = 0; x < colKeys.length; x++)
        {
            const key = colKeys[x]

            if(this.priceBased.find(v => key.startsWith(v)))
            {
                this.priceBased.push(key)
            }
        }
        
        return this;
    }
    
    relativeVolume(size) {

        this.inputParams.relativeVolume ??= []
        this.inputParams.relativeVolume.push([size])
 
        return this
    }

    ema(size) {

        if (typeof size !== 'number' || size <= 0) {
            throw new Error('"size" must be a positive number in ema.');
        }

        this.inputParams.ema ??= []
        this.inputParams.ema.push([size])
        this.priceBased.push(`ema_${size}`)

        return this
    }
    sma(size) {

        if (typeof size !== 'number' || size <= 0) {
            throw new Error('"size" must be a positive number in sma.');
        }

        this.inputParams.sma ??= []
        this.inputParams.sma.push([size])
        this.priceBased.push(`sma_${size}`)

        return this 
    }
    macd(fast = 12, slow = 26, signal = 9) {

        if (typeof fast !== 'number' || fast <= 0) {
            throw new Error('"fast" must be a positive number in macd.');
        }
        if (typeof slow !== 'number' || slow <= fast) {
            throw new Error('"slow" must be a positive number greater than "fast" in macd.');
        }
        if (typeof signal !== 'number' || signal <= 0) {
            throw new Error('"signal" must be a positive number in macd.');
        }

        this.inputParams.macd ??= []
        this.inputParams.macd.push([fast, slow, signal])
        
        return this

    }
    bollingerBands(size = 20, times = 2, bollingerBandsStudies) {
        // Validate size and times
        if (typeof size !== 'number' || size <= 0) {
            throw new Error('Invalid parameter: "size" must be a positive number in bollingerBands.');
        }
        if (typeof times !== 'number' || times <= 0) {
            throw new Error('Invalid parameter: "times" must be a positive number in bollingerBands.');
        }
    
        this.inputParams.bollingerBands ??= [];
        this.inputParams.bollingerBands.push([size, times, bollingerBandsStudies]);
        this.priceBased.push('bollinger_bands_middle', 'bollinger_bands_upper', 'bollinger_bands_lower');
    
        return this;
    }
    
    rsi(size)
    {
        // Validate size and times
        if (typeof size !== 'number' || size <= 0) {
            throw new Error('"size" must be a positive number in rsi.');
        }

        this.inputParams.rsi ??= []
        this.inputParams.rsi.push([size])

        return this
    }
    donchianChannels(size = 20, offset = 0)
    {
        if (typeof size !== 'number' || size <= 0) {
            throw new Error('"size" must be a positive number or 0 in donchianChannels.');
        }
    
        if (typeof offset !== 'number' || offset <= 0) {
            throw new Error('"offset" must be a positive number or 0 in donchianChannels.');
        }

        this.inputParams.donchianChannels ??= []
        this.inputParams.donchianChannels.push([size, offset])
        this.priceBased.push('donchian_channel_upper', 'donchian_channel_lower', 'donchian_channel_basis')

        return this       
    }
    candlesStudies(size = 20, classify = true, classificationLevels)
    {

        if (typeof size !== 'number' || size <= 0) {
            throw new Error('"size" must be a positive number or 0 in candlesStudies.');
        }

        if (typeof classify !== 'boolean') {
            throw new Error('"classify" must be a true or false in candlesStudies.');
        }

        this.inputParams.candlesStudies ??= []
        this.inputParams.candlesStudies.push([size, classify, classificationLevels])
        return this       
    }

    volumeOscillator(fastSize = 5, slowSize = 10)
    {


        if (typeof fastSize !== 'number' || fastSize <= 0) {
            throw new Error('fastSize" must be a positive number in volumeOscillator.');
        }

        if (typeof slowSize !== 'number' || slowSize <= fastSize) {
            throw new Error('"slowSize" must be a positive number greater than the "fastSize" in volumeOscillator.');
        }


        this.inputParams.volumeOscillator ??= []
        this.inputParams.volumeOscillator.push([fastSize, slowSize])
        return this           
    }
    dateTime()
    {

        this.inputParams.dateTime ??= []
        this.inputParams.dateTime.push([])
        return this           
    }
}