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
