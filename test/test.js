import OHLCV_INDICATORS from '../index.js'
import { getNasdaqOHLCV } from './utilities/fetchNasdaq.js'

const config = { symbol: 'NVDA', type: 'index', limit: 300, interval: '1d' }

const main = async () => {
    const input = await getNasdaqOHLCV(config)
    const retLogs = true

    const indicators = new OHLCV_INDICATORS({ input })
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
        .crossPairs([{ fast: 'close', slow: 'open' }])

    console.log(indicators.getLastValues())
}

main().catch(error => {
    console.error(error)
    process.exitCode = 1
})
