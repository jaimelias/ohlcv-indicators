export class NotEnoughDataError extends Error {
    constructor(message = 'Not enough data') {
        super(message)
        this.name = 'NotEnoughDataError'
    }
}

export class Indicator {
    constructor() {
        this.result = undefined
    }

    get isStable() {
        return this.result !== undefined
    }

    getResult() {
        if (!this.isStable) throw new NotEnoughDataError()
        return this.result
    }
}

// Keep the public result/extrema and replacement semantics without price history.
export class NumberIndicator extends Indicator {
    constructor() {
        super()
        this.previousResult = undefined
        this.highest = undefined
        this.lowest = undefined
        this.previousHighest = undefined
        this.previousLowest = undefined
    }

    setResult(value, replace = false) {
        if (replace) {
            this.highest = this.previousHighest
            this.lowest = this.previousLowest
            this.result = this.previousResult
        }
        if (this.highest === undefined) this.highest = value
        else {
            this.previousHighest = this.highest
            if (value > this.highest) this.highest = value
        }
        if (this.lowest === undefined) this.lowest = value
        else {
            this.previousLowest = this.lowest
            if (value < this.lowest) this.lowest = value
        }
        this.previousResult = this.result
        this.result = value
        return value
    }

    replace(input) {
        return this.update(input, true)
    }

    updates(prices) {
        prices.forEach(price => this.update(price))
        return this.result
    }
}
