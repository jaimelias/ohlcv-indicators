/*!
 * Portions adapted from trading-signals 5.0.4.
 * MIT License
 * Copyright (c) 2020 Benny Neugebauer
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

export class NotEnoughDataError extends Error {
    constructor(message = 'Not enough data') {
        super(message)
        this.name = 'NotEnoughDataError'
    }
}

export class Indicator {
    result

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
    previousResult
    highest
    lowest
    previousHighest
    previousLowest

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
