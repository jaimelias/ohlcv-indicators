export default class ChartPatterns {
    
    constructor(ohlcv, period = 100) {
        const validProps = ['open', 'high', 'low', 'close'];
        this.ohlcv = {};
    
        for (let key of Object.keys(ohlcv)) {
            if (validProps.includes(key)) {
                this.ohlcv[key] = ohlcv[key].slice(-period);
            }
        }
    }

    init() {
      const length = this.ohlcv.close.length;
      if (length < 50) {
        console.log('PatternRecognizer requires at least 50 datapoints')
        return { chart_pattern: 'Neutral', chart_score: 0 };
      }
  
      const patterns = [
        { name: 'Bullish Flag', condition: this.isBullishFlag.bind(this), score: 2 },
        { name: 'Bearish Flag', condition: this.isBearishFlag.bind(this), score: -2 },
        { name: 'Bullish Pennant', condition: this.isBullishPennant.bind(this), score: 2 },
        { name: 'Bearish Pennant', condition: this.isBearishPennant.bind(this), score: -2 },
        { name: 'Bearish Double Top', condition: this.isDoubleTop.bind(this), score: -1 },
        { name: 'Bullish Double Bottom', condition: this.isDoubleBottom.bind(this), score: 1 },
        { name: 'Bearish Triple Top', condition: this.isTripleTop.bind(this), score: -1 },
        { name: 'Bullish Triple Bottom', condition: this.isTripleBottom.bind(this), score: 1 },
        { name: 'Bearish Head And Shoulders', condition: this.isHeadAndShoulders.bind(this), score: -1 },
        { name: 'Bullish Inverse Head And Shoulders', condition: this.isInverseHeadAndShoulders.bind(this), score: 1 },
        { name: 'Bearish Rising Wedge', condition: this.isRisingWedge.bind(this), score: -1 },
        { name: 'Bullish Falling Wedge', condition: this.isFallingWedge.bind(this), score: 1 },
        { name: 'Bullish Triangle', condition: this.isBullishTriangle.bind(this), score: 1 },
        { name: 'Bearish Triangle', condition: this.isBearishTriangle.bind(this), score: -1 },
        { name: 'Bullish Rectangle', condition: this.isBullishRectangle.bind(this), score: 1 },
        { name: 'Bearish Rectangle', condition: this.isBearishRectangle.bind(this), score: -1 },
    ];
  
      for (const { name, condition, score } of patterns) {
        if (condition()) {
          return { chart_pattern: name, chart_score: score };
        }
      }
  
      return { chart_pattern: 'Neutral', chart_score: 0 };
    }
  

    // Implementation of Bullish Flag
    // https://www.tradingview.com/support/solutions/43000653209/

    isBullishFlag() {
       
        // A Bullish Flag is characterized by a sharp price rise followed by a period of consolidation that has a downward slant.
        const length = this.ohlcv.close.length;
        const flagpoleLength = Math.floor(length / 3); // Roughly the first third of the data
        const consolidationLength = Math.floor(flagpoleLength / 2); // Roughly half the length of the flagpole

        // Sharp price rise (flagpole)
        const flagpoleStart = this.ohlcv.close[length - flagpoleLength * 2];
        const flagpoleEnd = this.ohlcv.close[length - flagpoleLength];
        const flagpoleGain = (flagpoleEnd - flagpoleStart) / flagpoleStart;

        if (flagpoleGain < 0.15) { // A significant gain, at least 15%
            return false;
        }

        // Consolidation period
        const consolidationStart = this.ohlcv.close[length - flagpoleLength];
        const consolidationEnd = this.ohlcv.close[length - 1];
        const consolidationDrop = (consolidationStart - consolidationEnd) / consolidationStart;

        if (consolidationDrop > 0.05) { // A downward slant, less than 5%
            return false;
        }

        // Ensure that the consolidation period has lower highs and lower lows
        for (let i = length - flagpoleLength; i < length - 1; i++) {
            if (this.ohlcv.high[i] > this.ohlcv.high[i + 1] || this.ohlcv.low[i] > this.ohlcv.low[i + 1]) {
                return false;
            }
        }

        return true;
    }
  
    // Implementation of Bearish Flag
    // https://www.tradingview.com/support/solutions/43000653209-chart-pattern-bullish-flag/
    isBearishFlag() {
        // A Bearish Flag is characterized by a sharp price decline followed by a period of consolidation that has an upward slant.
        const length = this.ohlcv.close.length;
        const flagpoleLength = Math.floor(length / 3); // Roughly the first third of the data
        const consolidationLength = Math.floor(flagpoleLength / 2); // Roughly half the length of the flagpole

        // Sharp price decline (flagpole)
        const flagpoleStart = this.ohlcv.close[length - flagpoleLength * 2];
        const flagpoleEnd = this.ohlcv.close[length - flagpoleLength];
        const flagpoleDrop = (flagpoleStart - flagpoleEnd) / flagpoleStart;

        if (flagpoleDrop < 0.15) { // A significant drop, at least 15%
            return false;
        }

        // Consolidation period
        const consolidationStart = this.ohlcv.close[length - flagpoleLength];
        const consolidationEnd = this.ohlcv.close[length - 1];
        const consolidationGain = (consolidationEnd - consolidationStart) / consolidationStart;

        if (consolidationGain > 0.05) { // An upward slant, less than 5%
            return false;
        }

        // Ensure that the consolidation period has higher lows and higher highs
        for (let i = length - flagpoleLength; i < length - 1; i++) {
            if (this.ohlcv.high[i] < this.ohlcv.high[i + 1] || this.ohlcv.low[i] < this.ohlcv.low[i + 1]) {
                return false;
            }
        }

        return true;
    }

     // Implementation of Bullish Pennant
    // https://www.tradingview.com/support/solutions/43000653215-chart-pattern-bullish-pennant/
    isBullishPennant() {
        // A Bullish Pennant is characterized by a sharp price rise followed by a small symmetrical triangle consolidation.
        const length = this.ohlcv.close.length;
        const flagpoleLength = Math.floor(length / 3); // Roughly the first third of the data
        const pennantLength = Math.floor(flagpoleLength / 2); // Roughly half the length of the flagpole

        // Sharp price rise (flagpole)
        const flagpoleStart = this.ohlcv.close[length - flagpoleLength * 2];
        const flagpoleEnd = this.ohlcv.close[length - flagpoleLength];
        const flagpoleGain = (flagpoleEnd - flagpoleStart) / flagpoleStart;

        if (flagpoleGain < 0.15) { // A significant gain, at least 15%
            return false;
        }

        // Small symmetrical triangle consolidation
        const pennantStart = this.ohlcv.close[length - flagpoleLength];
        const pennantEnd = this.ohlcv.close[length - 1];
        const pennantDrop = (pennantStart - pennantEnd) / pennantStart;

        if (pennantDrop > 0.05) { // A downward slant, less than 5%
            return false;
        }

        // Ensure the consolidation period forms a small symmetrical triangle
        for (let i = length - pennantLength; i < length - 1; i++) {
            if ((this.ohlcv.high[i] < this.ohlcv.high[i + 1] && this.ohlcv.low[i] < this.ohlcv.low[i + 1]) ||
                (this.ohlcv.high[i] > this.ohlcv.high[i + 1] && this.ohlcv.low[i] > this.ohlcv.low[i + 1])) {
                return false;
            }
        }

        return true;
    }
  
    // Implementation of Bearish Pennant
    // https://www.tradingview.com/support/solutions/43000697937-chart-pattern-bearish-pennant/
    isBearishPennant() {
        const length = this.ohlcv.close.length;
        const flagpoleLength = Math.floor(length / 3); // Roughly the first third of the data
        const pennantLength = Math.floor(flagpoleLength / 2); // Roughly half the length of the flagpole

        // Sharp price decline (flagpole)
        const flagpoleStart = this.ohlcv.close[length - flagpoleLength * 2];
        const flagpoleEnd = this.ohlcv.close[length - flagpoleLength];
        const flagpoleDrop = (flagpoleStart - flagpoleEnd) / flagpoleStart;

        if (flagpoleDrop < 0.15) { // A significant drop, at least 15%
            return false;
        }

        // Small symmetrical triangle consolidation
        const pennantStart = this.ohlcv.close[length - flagpoleLength];
        const pennantEnd = this.ohlcv.close[length - 1];
        const pennantGain = (pennantEnd - pennantStart) / pennantStart;

        if (pennantGain > 0.05) { // An upward slant, less than 5%
            return false;
        }

        // Ensure the consolidation period forms a small symmetrical triangle
        for (let i = length - pennantLength; i < length - 1; i++) {
            if ((this.ohlcv.high[i] > this.ohlcv.high[i + 1] && this.ohlcv.low[i] > this.ohlcv.low[i + 1]) ||
                (this.ohlcv.high[i] < this.ohlcv.high[i + 1] && this.ohlcv.low[i] < this.ohlcv.low[i + 1])) {
                return false;
            }
        }

        return true;
    }

    // Implementation of Double Top
    // https://www.tradingview.com/support/solutions/43000653211-chart-pattern-double-top/
    isDoubleTop() {
        const length = this.ohlcv.close.length;
        const midpoint = Math.floor(length / 2);

        const firstPeak = Math.max(...this.ohlcv.close.slice(0, midpoint));
        const secondPeak = Math.max(...this.ohlcv.close.slice(midpoint));

        if (firstPeak <= 0 || secondPeak <= 0) {
            return false;
        }

        const firstValley = Math.min(...this.ohlcv.close.slice(0, midpoint));
        const secondValley = Math.min(...this.ohlcv.close.slice(midpoint));

        const dropFromFirstPeak = (firstPeak - firstValley) / firstPeak;
        const dropFromSecondPeak = (secondPeak - secondValley) / secondPeak;

        if (dropFromFirstPeak < 0.1 || dropFromSecondPeak < 0.1) {
            return false;
        }

        return Math.abs(firstPeak - secondPeak) / firstPeak < 0.03;
    }

    // Implementation of Double Bottom
    // https://www.tradingview.com/support/solutions/43000690659-chart-pattern-double-bottom/
    isDoubleBottom() {
        const length = this.ohlcv.close.length;
        const midpoint = Math.floor(length / 2);

        const firstValley = Math.min(...this.ohlcv.close.slice(0, midpoint));
        const secondValley = Math.min(...this.ohlcv.close.slice(midpoint));

        if (firstValley <= 0 || secondValley <= 0) {
            return false;
        }

        const firstPeak = Math.max(...this.ohlcv.close.slice(0, midpoint));
        const secondPeak = Math.max(...this.ohlcv.close.slice(midpoint));

        const riseFromFirstValley = (firstPeak - firstValley) / firstValley;
        const riseFromSecondValley = (secondPeak - secondValley) / secondValley;

        if (riseFromFirstValley < 0.1 || riseFromSecondValley < 0.1) {
            return false;
        }

        return Math.abs(firstValley - secondValley) / firstValley < 0.03;
    }

    // Implementation of Triple Top
    // https://www.tradingview.com/support/solutions/43000653218-chart-pattern-triple-top/
    isTripleTop() {
        const length = this.ohlcv.close.length;
        const third = Math.floor(length / 3);

        const firstPeak = Math.max(...this.ohlcv.close.slice(0, third));
        const secondPeak = Math.max(...this.ohlcv.close.slice(third, third * 2));
        const thirdPeak = Math.max(...this.ohlcv.close.slice(third * 2));

        if (firstPeak <= 0 || secondPeak <= 0 || thirdPeak <= 0) {
            return false;
        }

        const dropFromFirstPeak = (firstPeak - Math.min(...this.ohlcv.close.slice(0, third))) / firstPeak;
        const dropFromSecondPeak = (secondPeak - Math.min(...this.ohlcv.close.slice(third, third * 2))) / secondPeak;
        const dropFromThirdPeak = (thirdPeak - Math.min(...this.ohlcv.close.slice(third * 2))) / thirdPeak;

        if (dropFromFirstPeak < 0.1 || dropFromSecondPeak < 0.1 || dropFromThirdPeak < 0.1) {
            return false;
        }

        return Math.abs(firstPeak - secondPeak) / firstPeak < 0.03 && Math.abs(firstPeak - thirdPeak) / firstPeak < 0.03;
    }

    // Implementation of Triple Bottom
    // https://www.tradingview.com/support/solutions/43000690660-chart-pattern-triple-bottom/
    isTripleBottom() {
        const length = this.ohlcv.close.length;
        const third = Math.floor(length / 3);

        const firstValley = Math.min(...this.ohlcv.close.slice(0, third));
        const secondValley = Math.min(...this.ohlcv.close.slice(third, third * 2));
        const thirdValley = Math.min(...this.ohlcv.close.slice(third * 2));

        if (firstValley <= 0 || secondValley <= 0 || thirdValley <= 0) {
            return false;
        }

        const riseFromFirstValley = (Math.max(...this.ohlcv.close.slice(0, third)) - firstValley) / firstValley;
        const riseFromSecondValley = (Math.max(...this.ohlcv.close.slice(third, third * 2)) - secondValley) / secondValley;
        const riseFromThirdValley = (Math.max(...this.ohlcv.close.slice(third * 2)) - thirdValley) / thirdValley;

        if (riseFromFirstValley < 0.1 || riseFromSecondValley < 0.1 || riseFromThirdValley < 0.1) {
            return false;
        }

        return Math.abs(firstValley - secondValley) / firstValley < 0.03 && Math.abs(firstValley - thirdValley) / firstValley < 0.03;
    }

    // Implementation of Head and Shoulders
    // https://www.tradingview.com/support/solutions/43000653213-chart-pattern-head-and-shoulders/
    isHeadAndShoulders() {
        const length = this.ohlcv.close.length;
        const third = Math.floor(length / 3);

        const leftShoulder = Math.max(...this.ohlcv.close.slice(0, third));
        const head = Math.max(...this.ohlcv.close.slice(third, third * 2));
        const rightShoulder = Math.max(...this.ohlcv.close.slice(third * 2));

        if (leftShoulder <= 0 || head <= 0 || rightShoulder <= 0) {
            return false;
        }

        const leftValley = Math.min(...this.ohlcv.close.slice(0, third));
        const middleValley = Math.min(...this.ohlcv.close.slice(third, third * 2));
        const rightValley = Math.min(...this.ohlcv.close.slice(third * 2));

        const dropFromHead = (head - middleValley) / head;
        const riseFromValleys = (Math.max(leftValley, rightValley) - Math.min(leftValley, rightValley)) / Math.min(leftValley, rightValley);

        return dropFromHead > 0.15 && riseFromValleys < 0.03;
    }

    // Implementation of Inverse Head and Shoulders
    // https://www.tradingview.com/support/solutions/43000690666-chart-pattern-inverse-head-and-shoulders/
    isInverseHeadAndShoulders() {
        const length = this.ohlcv.close.length;
        const third = Math.floor(length / 3);

        const leftShoulder = Math.min(...this.ohlcv.close.slice(0, third));
        const head = Math.min(...this.ohlcv.close.slice(third, third * 2));
        const rightShoulder = Math.min(...this.ohlcv.close.slice(third * 2));

        if (leftShoulder <= 0 || head <= 0 || rightShoulder <= 0) {
            return false;
        }

        const leftPeak = Math.max(...this.ohlcv.close.slice(0, third));
        const middlePeak = Math.max(...this.ohlcv.close.slice(third, third * 2));
        const rightPeak = Math.max(...this.ohlcv.close.slice(third * 2));

        const riseFromHead = (middlePeak - head) / head;
        const dropFromPeaks = (Math.min(leftPeak, rightPeak) - Math.max(leftPeak, rightPeak)) / Math.max(leftPeak, rightPeak);

        return riseFromHead > 0.15 && dropFromPeaks < 0.03;
    }

    // Implementation of Rising Wedge
    // https://www.tradingview.com/support/solutions/43000653219-chart-pattern-rising-wedge/
    isRisingWedge() {
        const length = this.ohlcv.close.length;
        const third = Math.floor(length / 3);

        const firstPeak = Math.max(...this.ohlcv.close.slice(0, third));
        const secondPeak = Math.max(...this.ohlcv.close.slice(third, third * 2));
        const thirdPeak = Math.max(...this.ohlcv.close.slice(third * 2));

        const firstValley = Math.min(...this.ohlcv.close.slice(0, third));
        const secondValley = Math.min(...this.ohlcv.close.slice(third, third * 2));
        const thirdValley = Math.min(...this.ohlcv.close.slice(third * 2));

        const risingPeaks = firstPeak < secondPeak && secondPeak < thirdPeak;
        const risingValleys = firstValley < secondValley && secondValley < thirdValley;

        return risingPeaks && risingValleys;
    }

    // Implementation of Falling Wedge
    // https://www.tradingview.com/support/solutions/43000697938-chart-pattern-falling-wedge/
    isFallingWedge() {
        const length = this.ohlcv.close.length;
        const third = Math.floor(length / 3);

        const firstPeak = Math.max(...this.ohlcv.close.slice(0, third));
        const secondPeak = Math.max(...this.ohlcv.close.slice(third, third * 2));
        const thirdPeak = Math.max(...this.ohlcv.close.slice(third * 2));

        const firstValley = Math.min(...this.ohlcv.close.slice(0, third));
        const secondValley = Math.min(...this.ohlcv.close.slice(third, third * 2));
        const thirdValley = Math.min(...this.ohlcv.close.slice(third * 2));

        const fallingPeaks = firstPeak > secondPeak && secondPeak > thirdPeak;
        const fallingValleys = firstValley > secondValley && secondValley > thirdValley;

        return fallingPeaks && fallingValleys;
    }

    // Implementation of Bullish Triangle
    // https://www.tradingview.com/support/solutions/43000653217/
    isBullishTriangle() {
        const length = this.ohlcv.close.length;
        const half = Math.floor(length / 2);

        const firstHalfHigh = Math.max(...this.ohlcv.high.slice(0, half));
        const secondHalfHigh = Math.max(...this.ohlcv.high.slice(half));

        const firstHalfLow = Math.min(...this.ohlcv.low.slice(0, half));
        const secondHalfLow = Math.min(...this.ohlcv.low.slice(half));

        const contractingHighs = firstHalfHigh > secondHalfHigh;
        const risingLows = firstHalfLow < secondHalfLow;

        return contractingHighs && risingLows;
    }

    // Implementation of Bearish Triangle
    // https://www.tradingview.com/support/solutions/43000653217/
    isBearishTriangle() {
        const length = this.ohlcv.close.length;
        const half = Math.floor(length / 2);

        const firstHalfHigh = Math.max(...this.ohlcv.high.slice(0, half));
        const secondHalfHigh = Math.max(...this.ohlcv.high.slice(half));

        const firstHalfLow = Math.min(...this.ohlcv.low.slice(0, half));
        const secondHalfLow = Math.min(...this.ohlcv.low.slice(half));

        const contractingLows = firstHalfLow < secondHalfLow;
        const fallingHighs = firstHalfHigh > secondHalfHigh;

        return contractingLows && fallingHighs;
    }

    // Implementation of Bullish Rectangle
    // https://www.tradingview.com/support/solutions/43000653216/
    isBullishRectangle() {
        const length = this.ohlcv.close.length;
        const third = Math.floor(length / 3);

        const firstSectionHigh = Math.max(...this.ohlcv.high.slice(0, third));
        const secondSectionHigh = Math.max(...this.ohlcv.high.slice(third, third * 2));
        const thirdSectionHigh = Math.max(...this.ohlcv.high.slice(third * 2));

        const firstSectionLow = Math.min(...this.ohlcv.low.slice(0, third));
        const secondSectionLow = Math.min(...this.ohlcv.low.slice(third, third * 2));
        const thirdSectionLow = Math.min(...this.ohlcv.low.slice(third * 2));

        const stableHighs = Math.abs(firstSectionHigh - secondSectionHigh) / firstSectionHigh < 0.03 &&
                            Math.abs(secondSectionHigh - thirdSectionHigh) / secondSectionHigh < 0.03;
        const stableLows = Math.abs(firstSectionLow - secondSectionLow) / firstSectionLow < 0.03 &&
                           Math.abs(secondSectionLow - thirdSectionLow) / secondSectionLow < 0.03;

        return stableHighs && stableLows;
    }

    // Implementation of Bearish Rectangle
    // https://www.tradingview.com/support/solutions/43000653216/
    isBearishRectangle() {
        const length = this.ohlcv.close.length;
        const third = Math.floor(length / 3);

        const firstSectionHigh = Math.max(...this.ohlcv.high.slice(0, third));
        const secondSectionHigh = Math.max(...this.ohlcv.high.slice(third, third * 2));
        const thirdSectionHigh = Math.max(...this.ohlcv.high.slice(third * 2));

        const firstSectionLow = Math.min(...this.ohlcv.low.slice(0, third));
        const secondSectionLow = Math.min(...this.ohlcv.low.slice(third, third * 2));
        const thirdSectionLow = Math.min(...this.ohlcv.low.slice(third * 2));

        const stableHighs = Math.abs(firstSectionHigh - secondSectionHigh) / firstSectionHigh < 0.03 &&
                            Math.abs(secondSectionHigh - thirdSectionHigh) / secondSectionHigh < 0.03;
        const stableLows = Math.abs(firstSectionLow - secondSectionLow) / firstSectionLow < 0.03 &&
                           Math.abs(secondSectionLow - thirdSectionLow) / secondSectionLow < 0.03;

        return stableHighs && stableLows;
    }
  }