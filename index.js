import BigNumber from 'bignumber.js'
import {EMA} from './src/moving-averages/ema.js'
import {SMA} from './src/moving-averages/sma.js'
import {MACD} from './src/moving-averages/macd.js'
import {BollingerBands} from './src/moving-averages/bollingerBands.js'
import { IchimokuCloud } from './src/moving-averages/ichimokuCloud.js'
import { RSI} from './src/oscillators/rsi.js'
import { MFI} from './src/oscillators/mfi.js'
import { RelativeVolume} from './src/moving-averages/relativeVolume.js'
import { VolumeProfile } from './src/studies/volumeProfile.js'
import {findCrosses} from './src/utilities.js'

export default class OHLCV_INDICATORS {
    constructor() {
        this.BigNumber = BigNumber
        this.VolumeProfile = VolumeProfile
    }

    init(ohlcv) {
        const { BigNumber } = this
    
        this.ohlcv = ohlcv.reduce((acc, { open, high, low, close, volume, ...rest }) => {
            acc.open.push(BigNumber(open))
            acc.high.push(BigNumber(high))
            acc.low.push(BigNumber(low))
            acc.close.push(BigNumber(close))
            acc.volume.push(BigNumber(volume))
            for (const key of Object.keys(rest)) {
                if (!acc[key]) acc[key] = [];
                acc[key].push(rest[key]);
            }
            return acc;
        }, { open: [], high: [], low: [], close: [], volume: [] })
        
        
        return this
    }
    
    getHeaders(){
        return Object.keys(this.ohlcv)
    }

    getData() {
        const {BigNumber, ohlcv} = this
        const output = {}

        for(const[key, arr] of Object.entries(ohlcv))
        {
            output[key] = arr.map(v => (BigNumber.isBigNumber(v)) ? v.toNumber() : v)
        }

        return output
    }
    getLastValues(){
        const output = {}

        for (const [k, arr] of Object.entries(this.ohlcv)) {
            let value = arr[arr.length - 1];
            output[k] = (BigNumber.isBigNumber(value)) ? value.toNumber() : value;
        }

        return output
    }

    addColumn(key, arr) {
        const ohlcvLength = this.ohlcv.open.length;

        if (arr.length > ohlcvLength) {
            throw new Error(`Invalid column data: The length of the new column exceeds the length of the OHLCV data`);
        }
        
        // Use Array.prototype.unshift to add NaN elements efficiently
        const nanArray = new Array(ohlcvLength - arr.length).fill(NaN)
        arr = [...nanArray, ...arr]

        this.ohlcv[key] = arr
    }

    crossPairs(arr)
    {
        const ohlcv = this.ohlcv;
        const slowNumArrCache = {};
        
        // Helper function to create column if it doesn't exist
        const createColumnIfNeeded = (v) => {
            if (!ohlcv.hasOwnProperty(v) && typeof v === 'string') {
                const [funcName, ...params] = v.split('_');
                if (this[funcName.toUpperCase()] && params.length > 0) {
                    this[funcName.toUpperCase()](...params);
                }
            }
        };
        
        for (const { fast, slow } of arr) {
            // Validate parameters
            if (!fast || !slow) continue;
        
            // Create columns if needed
            createColumnIfNeeded(fast);
            createColumnIfNeeded(slow);
        
            // Prepare slowNumArr if 'slow' is a number
            if (typeof slow === 'number' && !slowNumArrCache[slow]) {
                slowNumArrCache[slow] = ohlcv.close.map(() => slow);
            }
        
            // Find and add crosses
            if (ohlcv[fast] && ohlcv[slow]) {
                const cross = findCrosses(this.BigNumber, ohlcv[fast], ohlcv[slow]);
                this.addColumn(`${fast}_x_${slow}`, cross);
            } else if (ohlcv[fast] && slowNumArrCache[slow]) {
                const cross = findCrosses(this.BigNumber, ohlcv[fast], slowNumArrCache[slow]);
                this.addColumn(`${fast}_x_${slow}`, cross);
            } else {
                console.error(`Missing ohlcv properties for ${fast} or ${slow}`);
            }
        }
           
    }

    EMA(size) {
        EMA(this, size)
        return this
    }
    SMA(size) {
        SMA(this, size)
        return this
    }
    MACD(fastLine, slowLine, signalLine) {
        MACD(this, fastLine, slowLine, signalLine)
        return this
    }
    BollingerBands(data, size, times)
    {
        BollingerBands(this, data, size, times)
        return this
    }
    IchimokuCloud(tenkan, kijun, senkou)
    {
        IchimokuCloud(this, tenkan, kijun, senkou)
        return this
    }
    RSI(period, movingAverage, movingAveragePeriod)
    {
        RSI(this, period, movingAverage, movingAveragePeriod)
        return this
    }
    MFI(period)
    {
        MFI(this, period)
        return this
    }
    RelativeVolume(size)
    {
        RelativeVolume(this, size)
        return this
    }
}