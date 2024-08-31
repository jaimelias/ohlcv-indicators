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

    for(let x = 0; x < len; x++)
    {
        const { open, high, low, close, volume, ...rest } = input[x]
        verticalOhlcv.open[x] = big(open)
        verticalOhlcv.high[x] = big(high)
        verticalOhlcv.low[x] = big(low)
        verticalOhlcv.close[x] = big(close)
        verticalOhlcv.volume[x] = big(volume)
    
        for (const [key, value] of Object.entries(rest)) {
            verticalOhlcv[key][x] = value
        }      
    }
    
    return verticalOhlcv
}  