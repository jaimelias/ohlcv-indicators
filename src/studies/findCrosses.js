const eq = (f, s) => f === s
const gt = (f, s) => f > s
const lt = (f, s) => f < s


// Function to find crosses between two arrays: fast and slow
export const findCrosses = ({fast, high, low, slow}) => {
    // Map states based on comparison of fast and slow arrays

    const dataLength = fast.length

    if(dataLength ==! slow.length)
    {
        throw Error('fast and slow do not have the same length')
    }

    const state = new Array(dataLength).fill(0.5)

    for(let x = 0; x < dataLength; x++)
    {
        const prevState = state?.[x-1] || 0.5
        const f = fast[x]
        const s = slow[x]
        const hi = high?.[x]
        const lo = low?.[x]

        if(high || low)
        {
            if(typeof hi === 'undefined' || typeof lo === 'undefined') continue
        }

        const prevS = slow[x - 1]
        const prevHi = high?.[x-1]
        const prevLo = low?.[x-1]

        if(high || low)
        {
            if(typeof prevHi === 'undefined' || typeof prevLo === 'undefined' || typeof prevS === 'undefined') continue
        }
        
        let value

        if(f === null || s === null) value = 0.5

        else if(eq(f, s)) {
            value = prevState
        }
        else if(gt(f, s)) {

            if(lt(lo, s) && gt(prevLo, prevS))
            {
                value = 0
            }
            else
            {
                value = 1
            }
        }
        else if(lt(f, s)) {

            if(gt(hi, s) && lt(prevHi, prevS))
            {
                value = 1
            }
            else
            {
                value = 0
            }
        }
        
        state[x] = value
    }



    const groups = groupConsecutiveValues(state)

    return flatGroupsToNumArr(groups)
}


const flatGroupsToNumArr = groups => {

    const groupLengths = groups.map(g => g.length)

    return groups.map((group, gIndex) => {
        let initialValue = groupLengths[gIndex]

        return group.map((s, i) => {
            let v = initialValue - i

            if(s === 0.5)
            {
                v = 0
            }
            if(s === 1)
            {
                v = v * 1
            }
            if(s === 0)
            {
                v = v * -1
            }

            return v
        }).reverse()
    }).flat()
}


// Helper function to group consecutive values
export const groupConsecutiveValues = arr => {
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



    const {verticalOhlcv, len} = main
    const slowNumArrCache = {};
    const x = {}
    const c = {}

    for (const { fast, slow, count } of arr) {
        // Validate parameters
        if (!fast || !slow) continue;
    
        // Prepare slowNumArr if 'slow' is a number
        if (typeof slow === 'number' && !slowNumArrCache[slow]) {

            slowNumArrCache[slow] = Array(len).fill(slow)
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
        else if ((verticalOhlcv[fast] || fast === 'price') && verticalOhlcv[slow]) {

            const cross = (fast === 'price') 
            ? findCrosses({
                fast: verticalOhlcv.close, 
                high: verticalOhlcv.high, 
                low: verticalOhlcv.low, 
                slow: verticalOhlcv[slow]}
            ) 
            : findCrosses({fast: verticalOhlcv[fast], slow: verticalOhlcv[slow]})

            x[crossName] = cross

            if(typeof count !== 'undefined')
            {
                c[countName] = splitCount(cross)
            }

        }
        //cross created from 1 column and an number
        else if (verticalOhlcv[fast] && slowNumArrCache[slow]) {
            const cross = findCrosses({fast: verticalOhlcv[fast], slow: slowNumArrCache[slow]})
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


export const findLinearDirection = (main, keyName) => {
 
    const {verticalOhlcv} = main

    if(!verticalOhlcv.hasOwnProperty(keyName)) throw Error(`property ${keyName} not found in verticalOhlcv. Invoked by findDirectionCross.`)

    const arr = verticalOhlcv[keyName]
    const len = arr.length
    const state = new Array(len).fill(null)

   
    for(let x = 0; x < len; x++)
    {
        if(x > 0 && arr[x] !== null)
        {
            let curr = arr[x]
            let prev = arr[x-1]

            if(gt(curr, prev))
            {
                state[x] = 1 //up
            }
            else if(lt(curr, prev))
            {
                state[x] = 0 //down
            }
            else
            {
                state[x] = 0.5 //neutral
            }
        }
    }

    return state
}

export const findDirectionCross = (main, keyName) => {


    const {verticalOhlcv} = main

    if(!verticalOhlcv.hasOwnProperty(keyName)) throw Error(`property ${keyName} not found in verticalOhlcv. Invoked by findDirectionCross.`)

    const state = findLinearDirection(main, keyName)
    const groups = groupConsecutiveValues(state)

    return flatGroupsToNumArr(groups)
}