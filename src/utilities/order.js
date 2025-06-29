
import { validateArray, validateString } from "./validators.js"

export const getOrderFromArray = (arr, methodName) => {

    validateArray(arr, 'arr', 'getOrderFromArray')
    validateString(methodName, 'methodName', 'getOrderFromArray')
    
    if(arr.every(v => ['open', 'high', 'low', 'close', 'volume', 'date'].includes(v)))
    {
        return 0
    }

    let order = 1
    const weights1 = ['_x_', 'zscore', 'minmax', 'lag']

    for(const k of weights1)
    {
        if(arr.some(v => v.includes(k)))
        {
            order++
        }
    }

    const weights2 = ['prediction', 'regressor', 'classifier', 'pca']

    if(!arr.some(v => weights2.includes(v)) && !weights2.includes(methodName))
    {
        return order
    }

    order = 10

    for(const k of weights2)
    {
        if(arr.some(v => v.includes(k)))
        {
            order++
        }
    }

    return order
}