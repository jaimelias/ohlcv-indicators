const eq = (f, s) => f === s
const gt = (f, s) => f > s
const lt = (f, s) => f < s



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
            throw Error(`Missing ohlcv properties for ${fast} or ${slow}`);
        }
    }

    return {x, c}
}


// Function to find crosses between two arrays: fast and slow
const findCrosses = ({fast, high, low, slow}) => {
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
    const result = [];
    
    for (const group of groups) {
        const length = group.length;
        
        for (let i = length - 1; i >= 0; i--) {
            const s = group[i];
            const offset = length - i;
            result.push(
                s === 0.5 ? 0 : offset * (s === 1 ? 1 : -1)
            );
        }
    }
    
    return result;
}


// Helper function to group consecutive values
const groupConsecutiveValues = (arr) => {
    const length = arr.length;
    if (length === 0) return [];

    const result = [];
    let currentGroup = [arr[0]];

    for (let i = 1; i < length; i++) {
        const currentValue = arr[i];
        const prevValue = arr[i - 1];

        if (currentValue === prevValue) {
            // Same value, continue the current group
            currentGroup.push(currentValue);
        } else {
            // Value changed, finalize the current group and start a new one
            result.push(currentGroup);
            currentGroup = [currentValue];
        }
    }

    // Push the last group
    result.push(currentGroup);

    return result;
};