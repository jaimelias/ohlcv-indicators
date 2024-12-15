const avg = (h, l) => (h + l) / 2;

export const donchianChannels = (main, index, size, offset) => {

    const highs = main.verticalOhlcv.high;
    const lows = main.verticalOhlcv.low;

    // Ensure that the required arrays exist
    if (index === 0) {
        
        main.instances['donchian_channels'] = {};

        Object.assign(main.verticalOhlcv, {
            donchian_channel_upper: new Array(main.len).fill(null),
            donchian_channel_basis: new Array(main.len).fill(null),
            donchian_channel_lower: new Array(main.len).fill(null),
        })
    }


    // Compute the slice start and end to get exactly 'size' bars
    const endIdx = (index - offset) + 1;          // inclusive end of the slice
    const startIdx = endIdx - size;             // start index for slicing

    // If any of these indices is out of bounds, return
    if (startIdx < 0 || endIdx > main.len) return true;

    // Extract the relevant chunks of data
    const highChunk = highs.slice(startIdx, endIdx)
    const lowChunk = lows.slice(startIdx, endIdx)

    // Compute the Donchian channels
    const upper = Math.max(...highChunk);
    const lower = Math.min(...lowChunk);
    const basis = avg(upper, lower);

    // Place the result at index
    const placementIndex = index;

    if (placementIndex >= 0 && placementIndex < main.len) {
        main.verticalOhlcv['donchian_channel_upper'][placementIndex] = upper;
        main.verticalOhlcv['donchian_channel_basis'][placementIndex] = basis;
        main.verticalOhlcv['donchian_channel_lower'][placementIndex] = lower;
    }

    return true;
};
