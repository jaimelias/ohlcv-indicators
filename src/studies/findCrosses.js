import {Big} from 'trading-signals';

// Function to find crosses between two arrays: fast and slow
export const findCrosses = (fast, slow, precision) => {
    // Map states based on comparison of fast and slow arrays

    let eq
    let gt
    let lt

    if(precision)
    {
        eq = (a, b) => a.eq(b)
        gt = (a, b) => a.gt(b)
        lt = (a, b) => a.lt(b)

        fast = fast.filter(o => o instanceof Big)
        slow = slow.filter(o => o instanceof Big)
    }
    else
    {
        eq = (a, b) => a === b
        gt = (a, b) => a > b
        lt = (a, b) => a < b
        fast = fast.filter(o => typeof o === 'number')
        slow = slow.filter(o => typeof o === 'number')        
    }

    
    const min = Math.min(fast.length, slow.length)

    fast = fast.slice(-min)
    slow = slow.slice(-min)

    let state = fast.map((f, i) => {


        if(eq(f, slow[i])) return 'neutral'
        else if(gt(f, slow[i])) return 'up'
        else if(lt(f, slow[i])) return 'down'

        throw Error('undefined error in findCrosses')
    })

    const groups = groupConsecutiveValues(state)
    const groupLengths = groups.map(g => g.length)

    //console.log(groups)

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



export const crossPairs = (main, arr) => {

    const {verticalOhlcv, precision, big} = main
    const slowNumArrCache = {};
    const output = {}

    for (const { fast, slow } of arr) {
        // Validate parameters
        if (!fast || !slow) continue;
    
        // Prepare slowNumArr if 'slow' is a number
        if (typeof slow === 'number' && !slowNumArrCache[slow]) {

            slowNumArrCache[slow] = Array(verticalOhlcv.close.length).fill(big(slow))
        }
    
        const keyName = `${fast}_x_${slow}`

        // Find and add crosses
        if (verticalOhlcv[fast] && verticalOhlcv[slow]) {

            const cross = findCrosses(verticalOhlcv[fast], verticalOhlcv[slow], precision);

            output[keyName] = cross
            

        } else if (verticalOhlcv[fast] && slowNumArrCache[slow]) {
            const cross = findCrosses(verticalOhlcv[fast], slowNumArrCache[slow], precision)
            
            output[keyName] = cross

        } else {
            console.log(`Missing ohlcv properties for ${fast} or ${slow}`);
        }
    }

    return output
}