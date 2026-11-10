import OHLCV_INDICATORS from '../index.js'
import { getNasdaqOHLCV } from './utilities/fetchNasdaq.js'

const config = { symbol: 'GME', type: 'index', limit: 5000, interval: '1d' }

const main = async () => {
    const input = await getNasdaqOHLCV(config)
    const retLogs = true

    const indicators = new OHLCV_INDICATORS({ input })
        .candleFeatures({ colKeys: [], retLogs })
        //.scoreMomentum()
        .volumeDelta()
        .heikenAshi(10, 10, {retLogs})
        .relativeVolume(10, {retLogs})
        .zscore(200, ['ret_log_change'])
        .zscore(190, ['ret_log_upper_wick', 'ret_log_lower_wick', 'ret_log_body', 'ret_log_gap'])
        //.sma(200)
        //.cmf(20)
/*         
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
        
        .donchianChannels(20, 0, {retLogs})
        
        
 */
    console.log(indicators.getLastValues())
}

main().catch(error => {
    console.error(error)
    process.exitCode = 1
})
