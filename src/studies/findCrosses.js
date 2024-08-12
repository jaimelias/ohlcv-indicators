import {Big} from 'trading-signals';

// Function to find crosses between two arrays: fast and slow
export const findCrosses = (fast, slow, precision) => {
    // Map states based on comparison of fast and slow arrays

    const dataLength = fast.length

    if(dataLength ==! slow.length)
    {
        throw Error('fast and slow do not have the same length')
    }

    let eq
    let gt
    let lt

    if(precision)
    {
        eq = (a, b) => a.eq(b)
        gt = (a, b) => a.gt(b)
        lt = (a, b) => a.lt(b)
    }
    else
    {
        eq = (a, b) => a === b
        gt = (a, b) => a > b
        lt = (a, b) => a < b     
    }


    const state = new Array(dataLength).fill(null)

    for(let x = 0; x < dataLength; x++)
    {
        const f = fast[x]
        const s = slow[x]
        let value

        if(f === null || s === null) value = 'neutral'
        else if(eq(f, s)) value = 'neutral'
        else if(gt(f, s)) value = 'up'
        else if(lt(f, s)) value = 'down'

        state[x] = value
    }

    const groups = groupConsecutiveValues(state)
    const groupLengths = groups.map(g => g.length)

    //console.log(groups)

    return groups.flatMap((group, gIndex) => {
        const initialValue = groupLengths[gIndex];
        
        return group.map((s, i) => {
            const v = initialValue - i;
            
            switch (s) {
                case 'neutral':
                    return 0;
                case 'up':
                    return v;
                case 'down':
                    return -v;
                default:
                    return v;  // Assuming 'v' is returned if none of the cases match
            }
        }).reverse();
    });
    

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