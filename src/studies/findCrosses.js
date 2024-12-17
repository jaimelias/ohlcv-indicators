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
            prevFast: null,
            prevSlow: null,
            prevHigh: null,
            prevLow: null,
            areHighAndLowUndefined: false,
            index: 0,
            crossIndexes: {
                up: [],
                down: []
            }
        })        

    }
    update({fast, high, slow, low})
    {
        let currState = this.prevState

        if(!this.areHighAndLowUndefined)
        {
            if(typeof high === 'undefined' || typeof low === 'undefined')
            {
                this.areHighAndLowUndefined = true
            }
        }

        if(fast === null || slow === null){
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
                if ([low, slow, this.prevLow, this.prevSlow].every(v => v !== null) && lt(low, slow) && gt(this.prevLow, this.prevSlow))
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
                if([high, slow, this.prevHigh, this.prevSlow].every(v => v !== null) && gt(high, slow) && lt(this.prevHigh, this.prevSlow))
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


        if(this.interval === 1) this.crossIndexes.up.push(this.index)
        if(this.interval === -1) this.crossIndexes.down.push(this.index)

        //save prev state
        Object.assign(this, {
            index: this.index + 1,
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

export const crossPairs = (main, index) => {

    const {crossPairsList} = main

    if(!crossPairsList) return

    for (const { fast, slow } of crossPairsList)
    {
        if (!fast || !slow) continue

        let crossName = `${fast}_x_${slow}`

        if(index === 0)
        {
            if(typeof slow === 'number')
            {
                main.verticalOhlcv[slow] = new Array(main.len).fill(slow)
            }
            
            if(fast !== 'price' && !main.verticalOhlcv.hasOwnProperty(fast)) throw Error(`fast "${fast} not found in crossPairs"`)
            if(!main.verticalOhlcv.hasOwnProperty(slow)) throw Error(`slow "${slow} not found in crossPairs"`)


            main.instances[crossName] = new CrossInstance()
            main.verticalOhlcv[crossName] = [...main.nullArray]
        }

        let fastValue
        let closeValue
        let highValue
        let lowValue
        let slowValue

        if(fast === 'price')
        {
            closeValue = main.verticalOhlcv.close[index]
            highValue = main.verticalOhlcv.high[index]
            lowValue = main.verticalOhlcv.low[index]
            slowValue = main.verticalOhlcv[slow][index]

            main.instances[crossName].update({fast: closeValue, slow: slowValue, high: highValue, low: lowValue})

        } else
        {
            fastValue = main.verticalOhlcv[fast][index]
            slowValue = main.verticalOhlcv[slow][index]

            main.instances[crossName].update({fast: fastValue, slow: slowValue})
        }

        main.verticalOhlcv[crossName][index] = main.instances[crossName].getResult()
    }

}