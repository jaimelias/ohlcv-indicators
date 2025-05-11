export const dateFormaters = {
    dateObject: d => d,
    dateMilliseconds: d => new Date(d),
    dateSeconds: d => new Date(d * 1000),
    dateIncompleteDayString: d => new Date(`${d}  00:00:00`),
    dateCompleteDateString: d => new Date(d)
}

export const selectDateFormatter = value => {

    // Regex for a UTC Time Format where the string ends with "Z".
    const utcRegex = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/i;
    
    // Regex for a Timezone Offset Format,
    // which includes a plus or minus sign followed by HH:MM at the end.
    const offsetRegex = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?([+-]\d{2}:\d{2})$/;
    
    // Regex for a Local Time Format that contains no timezone indicator.
    const localRegex = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?$/;
  
    // Regex for a YYYY-MM-DD Format.
    const YYMMDDRegexDash = /^\d{4}-\d{2}-\d{2}$/;
    const YYMMDDRegexSlash = /^\d{4}\/\d{2}\/\d{2}$/;
  
    const validFormatNames = [
      'Date -> object',
      'Milliseconds Timestamp -> integer',
      'Seconds Timestamp -> integer',
      'UTC Time Format (ISO 8601) -> string',
      'Including a Timezone Offset (ISO 8601) -> string',
      'Local Time Format (ISO 8601) -> string',
      'YYYY/MM/DD or YYYY-MM-DD -> string',
    ]
  
    const errorMessage = () => {
      throw new Error(`Invalid "${typeof value}" date value passed in selectDateFormatter. Supported formats: \n-${validFormatNames.join("\n- ")}`)
    }
  
    if(typeof value === 'object')
    {
      if(value instanceof Date && !isNaN(value.valueOf()))
      {
        return 'dateObject'
      }
      else
      {
        errorMessage()
      }
    }
    else if (typeof value === 'number') {
      // Use a numeric threshold based on the absolute value: typically,
      // if the absolute value is below 1e11, then it's a seconds timestamp.
      // Otherwise, it's a milliseconds timestamp.
      if (Math.abs(value) < 1e11) {
        return 'dateSeconds';
      } else {
        return 'dateMillseconds';
      }
    }
    else if(typeof value === 'string')
    {
      if(utcRegex.test(value) || offsetRegex.test(value) || (localRegex.test(value) && value.length > 10) || YYMMDDRegexSlash.test(value))
      {
        return 'dateCompleteDateString'
      }
      else if(YYMMDDRegexDash.test(value))
      {
        return 'dateIncompleteDayString'
      }
      else
      {
        errorMessage()
      }
    }
    else
    {
      errorMessage()
    }
}