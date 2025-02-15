export const divideByMultiplier = ({row, precisionMultiplier, priceBased}) => {
    const output = {}

    for(const [key, value] of Object.entries(row))
    {

        let newValue = value

        if(priceBased.includes(key))
        {
            newValue = newValue / precisionMultiplier
        }

        output[key] = newValue
    }

    return output
} 