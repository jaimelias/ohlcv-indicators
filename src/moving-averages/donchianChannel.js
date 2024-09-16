export const donchianChannels = (main, period, offset) => {

    const {verticalOhlcv, precision, len} = main
    const {high, low} = verticalOhlcv

    return getDonchianChannels(high, low, period, offset, precision, len)
}

export const getDonchianChannels = (high, low, period, offset, precision, len) => {
    const donchian_channel_upper = new Array(len).fill(null)
    const donchian_channel_lower = new Array(len).fill(null)
    const donchian_channel_basis = new Array(len).fill(null)

    const maxQueue = []
    const minQueue = []

    const avg = (precision) 
        ? ((h, l) => (h.plus(l)).div(2))
        : ((h, l) => (h + l) / 2)

    for (let i = 0; i < len; i++) {

        while (maxQueue.length && maxQueue[0] <= i - period) {
            maxQueue.shift()
        }
        // Remove smaller values from the end
        while (maxQueue.length && high[maxQueue[maxQueue.length - 1]] <= high[i]) {
            maxQueue.pop()
        }
        maxQueue.push(i)

        while (minQueue.length && minQueue[0] <= i - period) {
            minQueue.shift()
        }
        while (minQueue.length && low[minQueue[minQueue.length - 1]] >= low[i]) {
            minQueue.pop()
        }

        minQueue.push(i)

        if (i >= period - 1) {
            const upperValue = high[maxQueue[0]]
            const lowerValue = low[minQueue[0]]
            const basisValue = avg(upperValue, lowerValue)

            const indexWithOffset = i + offset

            if (indexWithOffset >= 0 && indexWithOffset < len) {
                donchian_channel_upper[indexWithOffset] = upperValue
                donchian_channel_lower[indexWithOffset] = lowerValue
                donchian_channel_basis[indexWithOffset] = basisValue
            }
        }
    }

    return { 
        donchian_channel_upper, 
        donchian_channel_lower,
        donchian_channel_basis 
    }
}