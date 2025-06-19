import { oneHotEncode } from "../machine-learning/ml-utilities.js"

const eq = (fast, slow) => fast === slow
const gt = (fast, slow) => fast > slow
const lt = (fast, slow) => fast < slow


//this class counts how many intervals have passed between crosses: fast crossed slow line, high crossed slow line or low crossed slow line.
//interval === 0 for no crosses yet or the lines are equal
//interval >= 1 for an upwards crosses
//interval <= -1 from downward crosses

class CrossInstance {

    constructor()
    {
        Object.assign(this, {
            interval: 0,
            prevState: 0.5,
            prevFast: NaN,
            prevSlow: NaN,
            prevHigh: NaN,
            prevLow: NaN,
            areHighAndLowUndefined: false,
            crossIndexes: {
                up: [],
                down: []
            }
        })        

    }
    update(index, {fast, high, slow, low})
    {
        let currState = this.prevState

        if(!this.areHighAndLowUndefined)
        {
            if(typeof high === 'undefined' || typeof low === 'undefined')
            {
                this.areHighAndLowUndefined = true
            }
        }

        if(Number.isNaN(fast) || Number.isNaN(slow)){
            currState = 0.5
        }
        else if(eq(fast, slow)) {
            currState = 0.5
        }
        else if(gt(fast, slow)) {

            if(this.areHighAndLowUndefined)
            {
                currState = 1
            }
            else
            {
                if ([low, slow, this.prevLow, this.prevSlow].every(v => !Number.isNaN(v)) && lt(low, slow) && gt(this.prevLow, this.prevSlow))
                {
                    currState = 0
                }
                else
                {
                    currState = 1
                }
            }
        }
        else if(lt(fast, slow)) {

            if(this.areHighAndLowUndefined)
            {
                currState = 0
            }
            else
            {
                if([high, slow, this.prevHigh, this.prevSlow].every(v => !Number.isNaN(v)) && gt(high, slow) && lt(this.prevHigh, this.prevSlow))
                {
                    currState = 1
                }
                else
                {
                    currState = 0
                }
            }
        }

        if(currState === 0.5)
        {
            this.interval = 0
        }
        else if(currState === 1)
        {
            if(this.prevState <= 0.5)
            {
                this.interval = 1
            }
            else
            {
                this.interval++
            }
        }
        else if(currState === 0)
        {
            if(this.prevState >= 0.5)
            {
                this.interval = -1
            }
            else
            {
                this.interval--
            }
        }


        if(this.interval === 1) this.crossIndexes.up.push(index)
        if(this.interval === -1) this.crossIndexes.down.push(index)

        //save prev state
        Object.assign(this, {
            prevState: currState,
            prevFast: fast,
            prevSlow: slow,
            prevHigh: high,
            prevLow: low
        })        
    }

    getResult()
    {
        return this.interval
    }

}

export const crossPairs = (main, index, crossPairsList, {oneHot, oneHotCols, prefix}) => {
  const {verticalOhlcv, verticalOhlcvTempCols, instances, len, arrayTypes, notNumberKeys} = main

  if(index === 0)
  {

    if(oneHot)
    {
         main.processSecondaryLoop = true
    }

    for (const { fast, slow } of crossPairsList)
    {
        const crossName = `${prefix}${fast}_x_${slow}`

        // allow numeric 'slow' as a constant column
        if (typeof slow === "number") {
            const col = `${prefix}${slow.toString()}`
            verticalOhlcvTempCols.add(col)
            notNumberKeys.add(col)
            verticalOhlcv[col] = (oneHot) ? new Array(len).fill(slow) : new Int32Array(len).fill(slow)
            arrayTypes[col] = (oneHot) ? 'Array': 'Int32Array'
        }

        // sanity checks
        if (fast !== "price" && !verticalOhlcv.hasOwnProperty(fast)) {
            throw new Error(`fast "${fast}" not found in crossPairs`)
        }
        if (!verticalOhlcv.hasOwnProperty(slow)) {
            throw new Error(`slow "${slow}" not found in crossPairs`)
        }

        if(!instances.hasOwnProperty('crossPairs'))
        {
            instances.crossPairs = {}
        }

        // create instance + output buffer
        instances.crossPairs[crossName] = {
            run: new CrossInstance(),
            uniqueValues: new Set(),
            min: Infinity,
            max: -Infinity,
            oneHotCols
        }
        
        verticalOhlcv[crossName] = (oneHot) ? new Array(len).fill(NaN) : new Int32Array(len).fill(NaN)
        notNumberKeys.add(crossName)
        arrayTypes[crossName] = (oneHot) ? 'Array' : 'Int32Array'

    }
  }

 

  for (const { fast, slow } of crossPairsList) {

    const crossName = `${prefix}${fast}_x_${slow}`

     const {run, uniqueValues} = instances.crossPairs[crossName]

    // ——— Per-bar update ———
    if (fast === "price") {
      const fastVal = verticalOhlcv.close[index]
      const slowVal = verticalOhlcv[slow][index]
      run.update(index, {
        fast: fastVal,
        slow: slowVal,
        high: verticalOhlcv.high[index],
        low: verticalOhlcv.low[index],
      });
    } else {
      const fastVal = verticalOhlcv[fast][index]
      const slowVal = verticalOhlcv[slow][index]
      run.update(index, { fast: fastVal, slow: slowVal })
    }

    let value = run.getResult()

    if(oneHot)
    {
        if(!uniqueValues.has(value))
        {
            if(value > instances.crossPairs[crossName].max)
            {
                instances.crossPairs[crossName].max = value
            }
            else if(value < instances.crossPairs[crossName].min)
            {
                instances.crossPairs[crossName].min = value
            }
            
            uniqueValues.add(value)
        }

    }

    main.pushToMain({index, key: crossName, value})

  }

  return true
};




export const oneHotCrossPairsSecondLoop = (main, index, crossPairMatrix) => {
  const { verticalOhlcv } = main;

  for (const [key, obj] of Object.entries(crossPairMatrix)) {
    const { oneHotCols, min: rawMin, max: rawMax } = obj;

    let min, max, size;

    if (oneHotCols == null) {
      // no fixed column‐count: use the raw [rawMin…rawMax] bounds
      min  = rawMin;
      max  = rawMax;
      size = max - min + 1;
    } else {
      // fixed column‐count: center a window of length oneHotCols
      const half   = Math.floor(oneHotCols / 2);
      min   = Math.max(rawMin, -half);
      max   = Math.min(rawMax,  half);
      size  = oneHotCols;
    }

    // grab & clamp the raw value into [min…max]
    const raw     = verticalOhlcv[key][index];
    const clamped = raw < min ? min : raw > max ? max : raw;

    // shift into [0…size-1]
    const idx = clamped - min;

    main.pushToMain({
      index,
      key,
      value: oneHotEncode(idx, size)
    });
  }

  return true;
};
