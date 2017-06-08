Serverless Webpack Plugin (fork)
=============================


Forked from [serverless-webpack-plugin](https://github.com/asprouse/serverless-webpack-plugin) which is itself forked from [serverless-optimizer-plugin](https://github.com/serverless/serverless-optimizer-plugin). 

This plugin uses webpack to optimize your Serverless Node.js Functions on deployment.


This fork has some bugfixes and behaviour breaks. It no longer handles copying/moving node_modules for you and instead expects them all to handled via webpack

**Note:** Requires Serverless *v0.5.0*.

### Setup

* Install the plugin and webpack in the root of your Serverless Project:
```
npm install @sandfox/serverless-webpack-plugin webpack --save-dev
```

* Add the plugin to the `plugins` array in your Serverless Project's `s-project.json`, like this:

```
plugins: [
    "@sandfox/serverless-webpack-plugin"
]
```

* In the `custom` property of either your `s-project.json` or `s-function.json` add an webpack property. The configPath is relative to the project root.

```javascript
{
    ...
    "custom": {
        "webpack": {
            "configPath": "path/relative/to/project-path"
        }
    }
    ...
}

```


## Webpack config
_TODO: make this example webpack2 or delete_

This plugin allows you to completely customize how your code is optimized by specifying your own webpack config. Heres a sample `webpack.config.js`:

```javascript
var webpack = require('webpack');

module.exports = {
  // entry: provided by serverless
  // output: provided by serverless
  target: 'node',
  externals: [
    'aws-sdk'
  ],
  resolve: {
    extensions: ['', '.js', '.jsx']
  },
  devtool: 'source-map',
  plugins: [
    new webpack.IgnorePlugin(/^\.\/locale$/, /moment$/),
    new webpack.optimize.DedupePlugin(),
    new webpack.optimize.OccurenceOrderPlugin(),
    new webpack.optimize.UglifyJsPlugin({
      compress: {
        unused: true,
        dead_code: true,
        warnings: false,
        drop_debugger: true
      }
    })
  ],
  module: {
    loaders: [
      {
        test: /\.jsx?$/,
        loader: 'babel',
        exclude: /node_modules/,
        query: {
          presets: ['es2015', 'stage-0']
        }
      }
    ]
  }
};
```
**Note:** Some node modules don't play nicely with `webpack.optimize.UglifyJsPlugin` in this case, you can omit it from 
your config, or add the offending modules to `externals`. For more on externals see below.  

### Externals
Externals specified in your webpack config will be properly packaged into the deployment. 
This is useful when working with modules that have binary dependencies, are incompatible with `webpack.optimize.UglifyJsPlugin` 
or if you simply want to improve build performance. Check out [webpack-node-externals](https://github.com/liady/webpack-node-externals) 
for an easy way to externalize all node modules.

### Source Maps
Yes using `devtool: 'source-map'` works, include `require('source-map-support').install();` you'll have pretty stacktraces.

### Loading additional modules before the lambda function module
If you need to load modules before your lambda function module is loaded,
you can specify those modules with entry option in your webpack config.
For example if you need to load the babel-polyfill, you can do that
by adding `entry: ['babel-polyfill']` to your webpack config.
This will first load the babel-polyfill module and then your lambda function module.
 
### Improving deploy performance
  
The plugin builds directly from the source files, using "magic handlers" to include the parent directory (as mentioned in 
the [0.5.0 release notes](https://github.com/serverless/serverless/releases/tag/v0.5.0)) is unnecessary. 
