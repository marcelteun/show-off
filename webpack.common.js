const path = require('path');

module.exports = {
  entry: './show-off.js',
  output: {
    filename: 'show-off-bundle.js',
    path: path.resolve(__dirname, 'dist')
  },
};
