//change between current and prev
export const arrayChange = data => {

    if(!Array.isArray(data))
    {
        throw Error('data param in arrayGt function must be array')
    }

    const output = Array(data.length).fill(0)

    for (let x = 1; x < output.length; x++) {

        if(data[x] === null || data[x - 1] === null)
        {
            output[x] === null
        }
        else
        {
            const curr = data[x]
            const prev = data[x - 1]
            output[x] = (curr - prev) / prev
        }
    }

    return output
}

//tells if array a is greater than array b

export const arrayGt = (a, b) => {

    if(!Array.isArray(a) || !Array.isArray(b))
    {
        throw Error('a and b params in arrayGt function must be arrays')
    }
    if(a.length !== b.length)
    {
        throw Error('array a and b must be the same length in arrayGt function')
    }
    if(a.length < 2)
    {
        throw Error('arrays in arrayGt function must have at least 2 numeric items')
    }

    const output = Array(a.length).fill(0.5)

    for (let x = 1; x < output.length; x++) {

        if(a[x] === null || b[x] === null)
        {
            output[x] = null
        }
        if(a[x] > b[x])
        {
            output[x] = 1
        }
        else if(a[x] < b[x])
        {
            output[x] = 0
        }
    }

    return output
}