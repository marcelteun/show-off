const path = require('path');
const TerserPlugin = require('terser-webpack-plugin');

module.exports = {
  entry: './show-off.js',
  optimization: {
    minimize: true,
    minimizer: [new TerserPlugin()],
  },
  output: {
    filename: 'show-off-bundle.js',
    path: path.resolve(__dirname, 'dist')
  },
  mode: 'production'
};
