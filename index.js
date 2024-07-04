import BigNumber from 'bignumber.js'
import {EMA} from './src/moving-averages/ema.js'
import {SMA} from './src/moving-averages/sma.js'
import {MACD} from './src/moving-averages/macd.js'
import {BollingerBands} from './src/moving-averages/bollingerBands.js'
import { IchimokuCloud } from './src/moving-averages/ichimokuCloud.js'
import { RSI} from './src/oscillators/rsi.js'
import { MFI} from './src/oscillators/mfi.js'
import { RelativeVolume} from './src/moving-averages/relativeVolume.js'
import {findCrosses} from './src/utilities.js'

export default class OHLCV_INDICATORS {
    constructor() {
        this.BigNumber = BigNumber
    }

    init(ohlcv) {
        const { BigNumber } = this
    
        const ohlcvObj = ohlcv.map(({ open, high, low, close, volume, ...rest }) => ({
            open: BigNumber(open),
            high: BigNumber(high),
            low: BigNumber(low),
            close: BigNumber(close),
            volume: BigNumber(volume),
            ...rest
        }));
        
        this.ohlcv = ohlcvObj.reduce((acc, { open, high, low, close, volume, ...rest }) => {
            acc.open.push(open);
            acc.high.push(high);
            acc.low.push(low);
            acc.close.push(close);
            acc.volume.push(volume);
            Object.keys(rest).forEach(key => {
                if (!acc[key]) acc[key] = [];
                acc[key].push(rest[key]);
            });
            return acc;
        }, { open: [], high: [], low: [], close: [], volume: [] });
        
        
        return this
    }
    
    getHeaders(){
        return Object.keys(this.getData())
    }

    getData() {
        return this.ohlcv
    }
    getLastValues(){
        const output = {}

        for(let k in this.ohlcv)
        {
            const arr = this.ohlcv[k]
            output[k] = arr[arr.length - 1]
        }

        return output
    }

    addColumn(key, arr) {
        const ohlcvLength = this.ohlcv.open.length

        if (arr.length > ohlcvLength) {
            throw new Error(`Invalid column data: The length of the new column exceeds the length of the OHLCV data`)
        }

        //fulls arr with NaN until it has the same lenght as ohlcvLength

        while (arr.length < ohlcvLength) {
            arr.unshift(NaN)
        }

        this.ohlcv[key] = arr.map(o => isNaN(o) ? o : o.toNumber())
    }

    crossPairs(arr)
    {

        //crossing single column pairs 
        const ohlcv = this.getData()
        let slowNumArr = []

        //each parameter [{fast, slow}, {fast, slow}]

        arr.forEach(o => {
            const {fast, slow} = o

            //validates both are destructured correctly
            if(!fast || !slow)
            {
                return
            }
            
            //if the column does not exist, will try to create a new one
            //this code can only add single column output indicators such as SMA and EMA
            [fast, slow].forEach((v, i) => {
                if (!ohlcv.hasOwnProperty(v) && typeof v === 'string') {
                    const arr = v.split('_')
                    if (arr.length > 0) {
                        const funcName = arr[0].toUpperCase()
                        const params = arr.slice(1)
            
                        if (typeof this[funcName] === 'function' && params.length > 0) {
                            this[funcName](...params)
                        }
                    }
                }
                else if(typeof v === 'number' && i === 1)
                {
                    slowNumArr = ohlcv.close.map(o => 30)
                }
            })            
        
            //finds the cross and adds is to the columns
            if (ohlcv.hasOwnProperty(fast) && ohlcv.hasOwnProperty(slow)) {
                const cross = findCrosses(this.BigNumber, ohlcv[fast], ohlcv[slow])
                this.addColumn(`${fast}_x_${slow}`, cross)
            }
            else if(ohlcv.hasOwnProperty(fast) && slowNumArr.length > 0)
            {
                const cross = findCrosses(this.BigNumber, ohlcv[fast], slowNumArr)
                this.addColumn(`${fast}_x_${slow}`, cross)
            }
            else {
                console.error(`Missing ohlcv properties for ${fast} or ${slow}`)
            }
        })
        
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