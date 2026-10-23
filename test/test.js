import OHLCV_INDICATORS from '../index.js'
import { getNasdaqOHLCV } from './utilities/fetchNasdaq.js'

const config = { symbol: 'RTX', type: 'index', limit: 300, interval: '4h' }

const main = async () => {
    const input = await getNasdaqOHLCV(config)
    const retLogs = true

    const indicators = new OHLCV_INDICATORS({ input })
        .heikenAshi(10, 10)
        //.sma(200)
        //.cmf(20)
/*         .ema(5)
        .ema(5, {retLogs})
        .sma(5, {retLogs})
        .bollingerBands(20, 2, {retLogs})
        .macd(12, 26, 9)
        .relativeVolume(10, {retLogs})
        .volumeDelta()
        .volumeOscillator(5, 10, {retLogs})
        .rsi(14, {retLogs})
        .mfi(14, {retLogs})
        .stochastic(14, 3, 3, {retLogs})
        .atr(14, {retLogs})
        .adx(14, {retLogs})
        .heikenAshi(null, null, {retLogs: false})
        .donchianChannels(20, 0, {retLogs})
        .candleFeatures({ colKeys: ['open'], retLogs })
        
 */
    console.log(indicators.getLastValues())
}

main().catch(error => {
    console.error(error)
    process.exitCode = 1
})
