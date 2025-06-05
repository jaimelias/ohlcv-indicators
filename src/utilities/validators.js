export const validateInputParams = (inputParams, len) => {

    if(!Array.isArray(inputParams))
    {
        throw new Error('Property "inputParams" must be an "Array" or "Set".')
    }

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
    
    if(obj instanceof Object === false)
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
  validateObject(options, 'options', `${callerName}.${paramName}.validateNumber`);

  const { allowDecimals = false, min, max } = options;
  const label = allowDecimals ? 'number' : 'integer';

  // 1) check that value is a number (and integer if decimals not allowed)
  if (typeof value !== 'number' || (allowDecimals === false && !Number.isInteger(value))) {
    throw new Error(
      `Param "${paramName}" must be an ${label} in "${callerName}".`
    );
  }

  // 2) validate types of min and max if they’re provided
  if (min !== undefined && typeof min !== 'number') {
    throw new Error(
      `Param "min" must be a valid ${label} (if provided) in "${callerName}.${paramName}.validateNumber".`
    );
  }
  if (max !== undefined && typeof max !== 'number') {
    throw new Error(
      `Param "max" must be a valid ${label} (if provided) in "${callerName}.${paramName}.validateNumber".`
    );
  }

  // 3) if both were provided, ensure min < max
  if (min !== undefined && max !== undefined && min >= max) {
    throw new Error(
      `Param "min" must be less than "max" in "${callerName}.${paramName}.validateNumber".`
    );
  }

  // 4) check value against min (if set)
  if (min !== undefined && value < min) {
    throw new Error(
      `Param "${paramName}" must be an ${label} ≥ ${min} in "${callerName}".`
    );
  }

  // 5) check value against max (if set)
  if (max !== undefined && value > max) {
    throw new Error(
      `Param "${paramName}" must be an ${label} ≤ ${max} in "${callerName}".`
    );
  }

  return true;
};


export const validateArrayOfRanges = (range, paramName, callerName) => {

    validateArray(range, paramName, callerName)

    if (range.length !== 2) {
        throw new Error(
          `Invalid "${paramName}" array length: expected 2 items, but got ${range.length} in "${callerName}.${paramName}".`
        );
    }

    const [min, max] = range

    validateNumber(min, {min: -100, max, allowDecimals: false}, 'min', callerName)
    validateNumber(max, {min: min, max: 100, allowDecimals: false}, 'max', callerName)

    if(min === max)
    {
        throw new Error(`Invalid "min" can not be equal to "max" property in "${callerName}.${paramName}".`)
    }

    return true
}