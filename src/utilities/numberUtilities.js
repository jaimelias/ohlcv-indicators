// Helper to clean non-numeric characters (except "-" at the start and decimal point)
export const sanitizeDirtyNumberString = str => str.replace(/(?!^-)[^0-9.]/g, '');

export const numberFormater = {
  number: n => n,
  numberCleanString: n => Number(n),
  numberDirtyString: n => Number(sanitizeDirtyNumberString(n))
}

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

// Parses a number from either a numeric or string input, applying a multiplier to fix precision issues
export const parseNumber = (num, type, precisionMultiplier) => {
  const addMultiplier = cNum => precisionMultiplier > 1 ? cNum * precisionMultiplier : cNum;

  return addMultiplier(numberFormater[type](num))

};

export const classifyNum = (num, throwError = false) => {
  // 1) true numbers
  if (typeof num === 'number' && !Number.isNaN(num)) {
    return 'number';
  }

  // 2) strings
  if (typeof num === 'string') {
    const str = num.trim();
    const cleanRe = /^-?\d+(\.\d+)?$/;

    // a) clean numeric string: only digits and an optional single period
    if (cleanRe.test(str)) {
      return 'numberCleanString';
    }

    // b) dirty numeric string: contains non-digits (dollar, commas, letters, etc.)
    //    but once you strip those out, you're left with a valid number
    const stripped = str.replace(/[^0-9.]/g, '');
    if (stripped && cleanRe.test(stripped)) {
      return 'numberDirtyString';
    }
  }


  if(throwError)
  {
    throw new TypeError(
      'Invalid input: expected a number or numeric string'
    );
  }

  return typeof num
};
