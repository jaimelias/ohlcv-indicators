// Helper to clean non-numeric characters (except "-" at the start and decimal point)
export const cleanNumStr = str => str.replace(/(?!^-)[^0-9.]/g, '');

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