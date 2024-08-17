export const parseOhlcvToVertical = (input, len, big) => {

    const keysToTrack = ['open', 'high', 'low', 'close', 'volume']
    const verticalOhlcv = {}
    
    for (const key of keysToTrack) {
        verticalOhlcv[key] = new Array(len)
    }
    
    for (const key of Object.keys(input[0])) {
        if (!keysToTrack.includes(key)) {
            verticalOhlcv[key] = new Array(len)
        }
    }
    
    input.forEach(({ open, high, low, close, volume, ...rest }, index) => {
        verticalOhlcv.open[index] = big(open)
        verticalOhlcv.high[index] = big(high)
        verticalOhlcv.low[index] = big(low)
        verticalOhlcv.close[index] = big(close)
        verticalOhlcv.volume[index] = big(volume)
    
        for (const key in rest) {
            verticalOhlcv[key][index] = rest[key];
        }
    })
    
    return verticalOhlcv
}  