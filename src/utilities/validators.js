export const validateInputParams = main => {

    const {inputParams, len} = main

    for (const { params } of inputParams) {
        for (const v of params) {
            if (typeof v === 'number' && v > len) {
                console.log(v, len);
                throw new Error('At least one of the params of the indicator is greater than the input OHLCV length. Make sure to have enough datapoints in the input OHLCV.');
            }
        }
    }
}

export const isAlreadyComputed = main => {
    if(main.isComputed === true) throw Error('ohlcv is already computed, you can not add new indicators after "compute", "getLastValues" , "getDataAsCols" or "getData" methods are called.')
}

export const validateArray = (arr, paramName, callerName) => {
    
    if(!Array.isArray(arr))
    {
        throw new Error(`Param "${paramName}" must be an array in "${callerName}".`)
    }

    return true
}

export const validateObject = (obj, paramName, callerName) => {
    
    if(!Boolean(obj) || !typeof obj == 'object')
    {
        throw new Error(`Param "${paramName}" must be an object in "${callerName}".`)
    }

    return true
}

export const validateArrayOptions  = (arrayOptions, value, paramName, callerName) => {

    validateArray(arrayOptions, 'arrayOptions', `${callerName}.${paramName}.validateArrayOptions`)

    if(!arrayOptions.includes(value.toString()))
    {
        throw new Error(`Param "${paramName}" must be any of the following values [${arrayOptions.join(', ')}] in "${callerName}".`)
    }

    return true
}

export const validateBoolean = (value, paramName, callerName) => {

    if(typeof value !== 'boolean')
    {
        throw new Error(`Param "${paramName}" must be an boolean in "${callerName}".`)
    }

    return true
}

export const validateNumber = (value, options, paramName, callerName) => {

    validateObject(options, 'options', `${callerName}.${paramName}.validateNumber`)

    const {allowDecimals = false, min, max} = options

    const label = (allowDecimals) ? 'number' : 'integer'

    if(typeof value !== 'number' || (allowDecimals === false && !Number.isInteger(value)))
    {
        throw new Error(`Param "${paramName}" must be an integer in "${callerName}".`)
    }

    if(typeof min !== 'number' || typeof max !== 'number' || min >= max)
    {
        throw new Error(`Param "min" must be a valid ${label} lower than "max" "${callerName}.${paramName}.validateNumber".`)
    }

    if(value < min)
    {
        throw new Error(`Param "${paramName}" must be an ${label} greater than or equal to ${min} in "${callerName}".`)
    }

    if(value > max)
    {
        throw new Error(`Param "${paramName}" must be an ${label} lower than or equal to ${max} in "${callerName}".`)
    }

    return true
}

