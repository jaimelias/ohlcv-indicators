import {resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
const __dirname = dirname(fileURLToPath(import.meta.url))


const entry = './index.js'
const output = {
    filename: 'ohlcv-indicators.min.js',
    path: resolve(__dirname, './dist'),
    library: 'OHLCV_INDICATORS'
}

export default {entry, output, mode: 'production', target: 'web'}