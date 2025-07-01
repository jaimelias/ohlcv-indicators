
import { validateArray, validateString } from "./validators.js"

export const getOrderFromArray = (arr, methodName) => {

    validateArray(arr, 'arr', 'getOrderFromArray')
    validateString(methodName, 'methodName', 'getOrderFromArray')

    const level2Methods = ['regressor', 'classifier', 'pca']
    const baseKeys = ['open', 'high', 'low', 'close', 'volume', 'date']

    // 1. Level-2: does this method live in your level-2 list?
    const isSecondary = level2Methods.includes(methodName);

    // 2. Level-0: is every field one of the primitives *and* not level-2?
    const isPrimary = arr.every(v => baseKeys.includes(v)) && !isSecondary;

    if(isPrimary)
    {
        return 0
    }

    let order = 1
    const level1Prefixes = ['_x_', 'zscore_', 'minmax_', 'lag_']

    for(const k of level1Prefixes)
    {
        if(arr.some(v => v.includes(k)))
        {
            order++
        }
    }

    if(!isSecondary)
    {
        return order
    }

    const level2Prefixes = ['prediction_', 'reg_', 'cla_', 'pca_']
    order = 10

    for(const k of level2Prefixes)
    {
        if(arr.some(v => v.includes(k)))
        {
            order++
        }
    }

    return order
}