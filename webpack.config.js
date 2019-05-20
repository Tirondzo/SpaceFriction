const {resolve} = require('path');
// eslint-disable-next-line import/no-extraneous-dependencies
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin= require('copy-webpack-plugin');

const CONFIG = {
  mode: 'development',

  entry: {
    app: resolve('./app.js')
  },
  node: {
    fs: "empty"
  },

  plugins: [
    new HtmlWebpackPlugin({title: 'Instancing',template: 'index.html'}),
    new CopyWebpackPlugin([
      {
        from: './resources',
        to: './resources'
      },
      {
        from: './css',
        to: './css'
      }
    ])
  ]
};

// This line enables bundling against src in this repo rather than installed module
//module.exports = env => (env ? require('../../webpack.config.local')(CONFIG)(env) : CONFIG);
module.exports = CONFIG;