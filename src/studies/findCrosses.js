
// Function to find crosses between two arrays: fast and slow
export const findCrosses = ({fast, slow, precision}) => {
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
        else if(eq(f, s)){
            if(gt(fast[x-1], slow[x-1]))
            {
                value = 'up'
            }
            else if(lt(fast[x-1], slow[x-1]))
            {
                value = 'down'
            }
            else
            {
                value = 'neutral'
            }
        }
        else if(gt(f, s)) value = 'up'
        else if(lt(f, s)) value = 'down'

        state[x] = value
    }



    const groups = groupConsecutiveValues(state)
    const groupLengths = groups.map(g => g.length)

    //console.log(JSON.stringify(groups))

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

    const {verticalOhlcv, precision, big, len} = main
    const slowNumArrCache = {};
    const x = {}
    const c = {}

    for (const { fast, slow, count } of arr) {
        // Validate parameters
        if (!fast || !slow) continue;
    
        // Prepare slowNumArr if 'slow' is a number
        if (typeof slow === 'number' && !slowNumArrCache[slow]) {

            slowNumArrCache[slow] = Array(len).fill(big(slow))
        }
    
        const crossName = `${fast}_x_${slow}`
        const countName = `${fast}_c_${slow}`

        const splitCount = arr => (typeof count !== 'undefined') ? (arr.slice(-count)).filter(o => o === 1 || o === -1).length : 0

        //cross already exists
        if(verticalOhlcv[crossName])
        {
            const cross = verticalOhlcv[crossName]
            x[crossName] = cross    
            
            if(typeof count !== 'undefined')
            {
                c[countName] = splitCount(cross)
            }
            
        }
        //cross created from 2 columns
        else if (verticalOhlcv[fast] && verticalOhlcv[slow]) {

            const cross = findCrosses({fast: verticalOhlcv[fast], slow: verticalOhlcv[slow], precision});
            x[crossName] = cross

            if(typeof count !== 'undefined')
            {
                c[countName] = splitCount(cross)
            }

        }
        //cross created from 1 column and an number
        else if (verticalOhlcv[fast] && slowNumArrCache[slow]) {
            const cross = findCrosses({fast: verticalOhlcv[fast], slow: slowNumArrCache[slow], precision})
            x[crossName] = cross

            if(typeof count !== 'undefined'){
                c[countName] = splitCount(cross)
            }

        } else {
            console.log(`Missing ohlcv properties for ${fast} or ${slow}`);
        }
    }

    return {x, c}
}