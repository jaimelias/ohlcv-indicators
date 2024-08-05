import {Big} from 'trading-signals';


// Function to find crosses between two arrays: fast and slow
export const findCrosses = (fast, slow) => {
    // Map states based on comparison of fast and slow arrays

    fast = fast.filter(o => o instanceof Big)
    slow = slow.filter(o => o instanceof Big)
    const min = Math.min(fast.length, slow.length)

    fast = fast.slice(-min);
    slow = slow.slice(-min);

    let state = fast.map((f, i) => {
        if(f.eq(slow[i])) return 'neutral'
        else if(f.gt(slow[i])) return 'up'
        else if(f.lt(slow[i])) return 'down'
        else throw Error('undefined error in findCrosses')
    })

    const groups = groupConsecutiveValues(state)
    const groupLengths = groups.map(g => g.length)

    return groups.map((group, gIndex) => {
        let initialValue = groupLengths[gIndex]

        return group.map((s, i) => {
            let v = initialValue - i

            if(s === 'neutral')
            {
                v = 0
            }
            if(s === 'up')
            {
                v = v * 1
            }
            if(s === 'down')
            {
                v = v * -1
            }

            return v
        }).reverse()
    }).flat()

}

// Helper function to group consecutive values
const groupConsecutiveValues = arr => {
    if (arr.length === 0) return []

    return arr.reduce((acc, currentValue, index, array) => {
        if (index === 0) {
            // Start the first group with the first element
            acc.push([currentValue])
        } else {
            // Get the previous value
            const prevValue = array[index - 1]
            const currentGroup = acc[acc.length - 1]

            // Check the direction of the previous and current values
            if (currentValue !== prevValue) {
                // Start a new group if the direction changes
                acc.push([currentValue]);
            } else {
                // Otherwise, add to the current group
                currentGroup.push(currentValue);
            }
        }
        return acc
    }, [])
}



export const crossPairs = async (main, arr) => {

    const {ohlcv} = main;
    const slowNumArrCache = {};
    const promises = []

    for (const { fast, slow } of arr) {
        // Validate parameters
        if (!fast || !slow) continue;
    
        // Prepare slowNumArr if 'slow' is a number
        if (typeof slow === 'number' && !slowNumArrCache[slow]) {
            slowNumArrCache[slow] = Array(ohlcv.close.length).fill(new Big(slow))
        }
    
        // Find and add crosses
        if (ohlcv[fast] && ohlcv[slow]) {

            const cross = findCrosses(ohlcv[fast], ohlcv[slow]);

            promises.push(Promise.resolve({[`${fast}_x_${slow}`]: cross}))

        } else if (ohlcv[fast] && slowNumArrCache[slow]) {
            const cross = findCrosses(ohlcv[fast], slowNumArrCache[slow])
            
            promises.push(Promise.resolve({[`${fast}_x_${slow}`]: cross}))

        } else {
            console.log(`Missing ohlcv properties for ${fast} or ${slow}`);
        }
    }

    const resolvedPromises = await Promise.all(promises)
    
    for (let i = 0; i < resolvedPromises.length; i++) {
        const item = resolvedPromises[i];
        const key = Object.keys(item)[0];
        main.addColumn(key, item[key]);
    }

    return true
}