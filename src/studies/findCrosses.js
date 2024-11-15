const eq = ({f, fb, fc, s}) => (fb && fc) ? f === s || fb === s || fc === s: f === s
const gt = ({f, fb, fc, s}) => (fb && fc) ? f > s || fb > s || fc > s: f > s
const lt = ({f, fb, fc, s}) => (fb && fc) ? f < s || fb < s || fc < s: f < s


// Function to find crosses between two arrays: fast and slow
export const findCrosses = ({fast, fastB, fastC, slow}) => {
    // Map states based on comparison of fast and slow arrays


    console.log({fastB, fastC})

    const dataLength = fast.length

    if(dataLength ==! slow.length)
    {
        throw Error('fast and slow do not have the same length')
    }

    const state = new Array(dataLength).fill(null)

    for(let x = 0; x < dataLength; x++)
    {
        const f = fast[x]
        const s = slow[x]

        const prevF = fast[x-1]
        const prevS = slow[x-1]

        const fb = fastB?.[x] || false;
        const fc = fastC?.[x] || false;
        
        const prevFb = fastB?.[x - 1] || false;
        const prevFc = fastC?.[x - 1] || false;
        
        let value

        if(f === null || s === null) value = 'neutral'
        else if(eq({f, fb, fc, s})){
            if(gt({f: prevF, fb: prevFb, fc: prevFc, s: prevS}))
            {
                value = 1 //up
            }
            else if(lt({f: prevF, fb: prevFb, fc: prevFc, s: prevS}))
            {
                value = 0 //down
            }
            else
            {
                value = 0.5 //neutral
            }
        }
        else if(gt({f, fb, fc, s})) value = 1
        else if(lt({f, fb, fc, s})) value = 0

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
                fastB: verticalOhlcv.low, 
                fastC: verticalOhlcv.high, 
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

            if(gt({f: curr, s: prev}))
            {
                state[x] = 1 //up
            }
            else if(lt({f: curr, s: prev}))
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