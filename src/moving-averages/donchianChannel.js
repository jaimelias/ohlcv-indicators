import {FasterSMA} from 'trading-signals'
import { classifySize } from '../utilities/classification.js'


export const donchianChannels = (main, index, size, offset, options) => {

    const highs = main.verticalOhlcv.high
    const lows = main.verticalOhlcv.low
    const {height, range} = options


    // Ensure that the required arrays exist
    if (index === 0) {

        Object.assign(main.verticalOhlcv, {
            donchian_channel_upper: [...main.nullArray],
            donchian_channel_basis: [...main.nullArray],
            donchian_channel_lower: [...main.nullArray],
            ...(height && {
                [`donchian_channel_height`]: [...main.nullArray]
            }),
            ...(range && {
                [`donchian_channel_range`]: [...main.nullArray],
            })
        })

        Object.assign(main.instances, {
            ['donchian_channel']: {
                heightInstance: height ? new FasterSMA((typeof height === 'number' && height > 0) ? height : size) : null
            }
        })
    }

    const { heightInstance } = main.instances['donchian_channel']

    // Compute the slice start and end to get exactly 'size' bars
    const endIdx = (index - offset) + 1          // inclusive end of the slice
    const startIdx = endIdx - size             // start index for slicing

    // If any of these indices is out of bounds, return
    if (startIdx < 0 || endIdx > main.len) return true

    // Extract the relevant chunks of data
    const highChunk = highs.slice(startIdx, endIdx)
    const lowChunk = lows.slice(startIdx, endIdx)

    // Compute the Donchian channels
    const upper = Math.max(...highChunk)
    const lower = Math.min(...lowChunk)
    const basis = (upper + lower) / 2
    const close = main.verticalOhlcv.close[index]
    const rangeValue = (close - lower) / (upper - lower)
    const heightValue = upper - lower

    if(height)
    {
        heightInstance.update(heightValue, main.lastIndexReplace)
    }

    // Place the result at index
    const placementIndex = index

    if (placementIndex >= 0 && placementIndex < main.len) {

        main.verticalOhlcv['donchian_channel_upper'][placementIndex] = upper
        main.verticalOhlcv['donchian_channel_basis'][placementIndex] = basis
        main.verticalOhlcv['donchian_channel_lower'][placementIndex] = lower

        if(range)
        {
            main.verticalOhlcv['donchian_channel_range'][placementIndex] = rangeValue
        }
        if(height)
        {
            let heightMean

            try {
                heightMean = heightInstance.getResult();
            } catch (err) {
                //do nothing
            }

            if(heightMean)
            {
                main.verticalOhlcv['donchian_channel_height'][placementIndex] = classifySize(heightValue, heightMean, 1.5)
            }
        }
    }

    return true
}
