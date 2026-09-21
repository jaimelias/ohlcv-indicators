import { NumberIndicator } from './indicator.js'

export class FasterEMA extends NumberIndicator {
    constructor(interval) {
        super()
        this.interval = interval
        this.pricesCounter = 0
        this.weightFactor = 2 / (interval + 1)
    }

    update(price, replace = false) {
        if (!replace || this.pricesCounter === 0) this.pricesCounter++

        const previous = replace && this.previousResult !== undefined
            ? this.previousResult
            : this.result !== undefined ? this.result : price

        return this.setResult(price * this.weightFactor + previous * (1 - this.weightFactor), replace)
    }

    get isStable() {
        return this.pricesCounter >= this.interval
    }
}

export class FasterSMA extends NumberIndicator {
    constructor(interval) {
        super()
        this.interval = interval
        this.prices = new Float64Array(interval)
        this.count = 0
        this.head = 0
    }

    update(price, replace = false) {
        // Custom columns may contain raw values after their validated first row.
        // Retain JavaScript addition/coercion semantics without slowing numeric windows.
        if (typeof price !== 'number' && !Array.isArray(this.prices)) {
            this.prices = Array.from(this.prices)
        }
        const { interval, prices } = this

        if (replace && this.count) {
            let last = this.head + this.count - 1
            if (last >= interval) last -= interval
            prices[last] = price
        } else if (this.count < interval) {
            prices[this.count++] = price
        } else {
            prices[this.head] = price
            if (++this.head === interval) this.head = 0
        }

        if (this.count === interval) {
            // Preserve chronological addition order, including NaN/Infinity recovery.
            let sum = 0
            for (let i = this.head; i < interval; i++) sum += prices[i]
            for (let i = 0; i < this.head; i++) sum += prices[i]
            return this.setResult(sum / interval, replace)
        }
    }
}

export class FasterWSMA extends NumberIndicator {
    constructor(interval) {
        super()
        this.interval = interval
        this.indicator = new FasterSMA(interval)
        this.smoothingFactor = 1 / interval
    }

    update(price, replace = false) {
        if (this.result === undefined) {
            // The existing FasterWSMA appends seed samples even for replacement updates.
            const sma = this.indicator.update(price)
            if (sma !== undefined) {
                this.indicator = undefined
                return this.setResult(sma, replace)
            }
        } else if (replace && this.previousResult !== undefined) {
            const smoothed = (price - this.previousResult) * this.smoothingFactor
            return this.setResult(smoothed + this.previousResult, replace)
        } else if (!replace) {
            const smoothed = (price - this.result) * this.smoothingFactor
            return this.setResult(smoothed + this.result, replace)
        }
    }
}
