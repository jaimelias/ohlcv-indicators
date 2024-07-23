export const findCrosses = (BigNumber, fast, slow) => {
    let crosses = new Array(fast.length).fill(0)
    let state = 0 // 0 for no initial state, 1 for uptrend, -1 for downtrend

    // Determine the initial state based on the first values
    const fast0 = new BigNumber(fast[0])
    const slow0 = new BigNumber(slow[0])

    if (fast0.isGreaterThan(slow0)) {
        state = 1
        crosses[0] = 1
    } else if (fast0.isLessThan(slow0)) {
        state = -1
        crosses[0] = -1
    } else {
        state = 0
        crosses[0] = 0
    }

    for (let i = 1; i < fast.length; i++) {
        const fastI = new BigNumber(fast[i])
        const slowI = new BigNumber(slow[i])
        const fastPrev = new BigNumber(fast[i - 1])
        const slowPrev = new BigNumber(slow[i - 1])

        if (fastI.isGreaterThan(slowI) && fastPrev.isLessThanOrEqualTo(slowPrev)) {
            // CrossUp detected
            state = 1
            crosses[i] = 1
        } else if (fastI.isLessThan(slowI) && fastPrev.isGreaterThanOrEqualTo(slowPrev)) {
            // CrossDown detected
            state = -1
            crosses[i] = -1
        } else {
            // Continue with the previous state
            if (state === 1) {
                crosses[i] = crosses[i - 1] + 1
            } else if (state === -1) {
                crosses[i] = crosses[i - 1] - 1
            } else {
                crosses[i] = 0
            }
        }
    }

    return crosses
}
