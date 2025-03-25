import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import TerserPlugin from 'terser-webpack-plugin';

const __dirname = dirname(fileURLToPath(import.meta.url));

const entry = './index.js';
const output = {
  filename: 'ohlcv-indicators.min.js',
  path: resolve(__dirname, './dist'),
  library: 'OHLCV_INDICATORS'
};

export default {
  entry,
  output,
  mode: 'production',
  target: 'web',
  optimization: { //TerserPlugin start
    minimize: true,
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          output: {
            beautify: true,  // Beautify the output
            comments: true,  // Preserve comments
          },
        },
      }),
    ],
  }, // TerserPlugin end
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env'],
            plugins: ['@babel/plugin-proposal-class-properties']
          }
        }
      },
      {
        test: /\.js$/,
        include: /node_modules\/trading-signals/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env'],
            plugins: ['@babel/plugin-proposal-class-properties']
          }
        }
      }
    ]
  }
};
