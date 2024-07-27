export const findCrosses = (BigNumber, fast, slow) => {
    const states = fast.map((f, i) => {
        if (f.isGreaterThan(slow[i])) {
            return 'up';
        } else if (f.isLessThan(slow[i])) {
            return 'down';
        } else {
            return 'neutral';
        }
    }).reverse();


    console.log(JSON.stringify(states))

    const groups = groupConsecutiveValues(states)

    const crosses = groups.map(chunk => {

        const chunkLength = chunk.length
        return chunk.map((state, index) => {

            let value = chunkLength-index

            if(state === 'down')
            {
                return -value
            }
            else if(state === 'up')
            {
                return value
            }
            else
            {
                return 0
            }

        })

    }).flat()

    return crosses.reverse();
};


function groupConsecutiveValues(arr) {
    if (arr.length === 0) return [];

    return arr.reduce((acc, currentValue, index, array) => {
        if (index === 0) {
            // Start the first group with the first element
            acc.push([currentValue]);
        } else {
            // Get the previous value
            const prevValue = array[index - 1];
            const currentGroup = acc[acc.length - 1];

            // Check the direction of the previous and current values
            if (currentValue !== prevValue) {
                // Start a new group if the direction changes
                acc.push([currentValue]);
            } else {
                // Otherwise, add to the current group
                currentGroup.push(currentValue);
            }
        }
        return acc;
    }, []);
}