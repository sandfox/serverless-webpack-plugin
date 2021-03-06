"use strict";
const path = require("path");
const os = require('os')
const webpack = require("webpack");
const Promise = require("bluebird");
const fs = Promise.promisifyAll(require("fs-extra"));
const Pqueue = require("p-queue");
const getConfig = require("./lib/getConfig");

const debugOutput = process.env['DEBUG_SERVERLESS_WEBPACK_PLUGIN'] != undefined

function runWebpack(config) {
  return new Promise((resolve, reject) => {
    webpack(config).run((err, stats) => {
      if (err) {
        return reject(err);
      }
      resolve(stats);
    });
  });
}

module.exports = function getPlugin(S) {
  const SCli = require(S.getServerlessPath("utils/cli"));

  function logStats(stats) {
    const { time, assets, warnings } = stats.toJson({
        hash: false,
        version: false,
        chunks: false,
        children: false,
        chunks: false,
        cached: false,
        children: false,
        modules: false,
        performance: false
      })
    // clear output bug
    SCli.spinner().stop(true)
    SCli.log(`Webpack compile time: ${time/1000} s`)
    assets.forEach(({name, size}) => {
      SCli.log(`Webpack output: ${name}, ${formatSize(size)}`)
    });

    if(debugOutput) {
      console.log(stats.toString('verbose'))
    }

    if(debugOutput && stats.hasWarnings()) {
      warnings.forEach( warning => {
        console.log('WARNING:', warning)
      })
    }

  }

  class ServerlessWebpack extends S.classes.Plugin {
    static getName() {
      return `com.serverless.${ServerlessWebpack.name}`;
    }

    constructor() {
      super()
      // Terrible hack to prevent swamping of the processor
      // when building large numbers of functions
      this._workQueue = new Pqueue({concurrency: Math.max(1, os.cpus().length - 1) })
    }

    registerHooks() {
      S.addHook(evt => {
        return this._workQueue.add(() => this.optimize(evt))
      }, {
        action: "codeDeployLambda",
        event: "pre"
      });

      return Promise.resolve();
    }

    optimize(evt) {
      // Validate: Check Serverless version
      if (parseInt(S._version.split(".")[1], 10) < 5) {
        SCli.log(
          "WARNING: This version of the Serverless Optimizer Plugin " +
            "will not work with a version of Serverless that is less than v0.5"
        );
      }

      // Get function
      const project = S.getProject();
      const func = project.getFunction(evt.options.name);

      if (func.runtime && func.runtime.indexOf("nodejs") === 0) {
        const projectPath = S.config.projectPath;
        const config = getConfig(
          projectPath,
          project.toObjectPopulated(evt.options),
          func.toObjectPopulated(evt.options)
        );

        if (config.webpackConfig) {
          const pathDist = evt.options.pathDist;
          const optimizedPath = path.join(pathDist, "optimized");
          const optimizedModulesPath = path.join(optimizedPath, "node_modules");

          const webpackConfig = Object.assign({}, config.webpackConfig);
          const handlerName = func.getHandler().split(".")[0];
          const handlerFileName = `${handlerName}.${config.handlerExt}`;
          const handlerEntryPath = `./${handlerFileName}`;

          // override entry and output
          webpackConfig.context = path.dirname(func.getFilePath());
          if (webpackConfig.entry != null) {
            if (Array.isArray(webpackConfig.entry)) {
              // clone and add our entry
              webpackConfig.entry = webpackConfig.entry.slice(0)
              webpackConfig.entry.push(handlerEntryPath);
            } else {
              webpackConfig.entry = [webpackConfig.entry, handlerEntryPath];
            }
          } else {
            webpackConfig.entry = handlerEntryPath;
          }

          const outputConfig = {
            libraryTarget: "commonjs2",
            path: optimizedPath,
            filename: handlerFileName
          }

          webpackConfig.output = Object.assign({}, webpackConfig.output, outputConfig)

          // copy generated handler so we can build directly from the source directory
          const generatedHandler = path.join(
            webpackConfig.context,
            handlerFileName
          );

          return (
            fs
              .copyAsync(path.join(pathDist, handlerFileName), generatedHandler)
              .then(() => fs.mkdirsAsync(optimizedModulesPath))
              .then(() => runWebpack(webpackConfig))
              .then(stats => {
                logStats(stats);

                if(stats.hasErrors()) {
                  console.log(stats.toString('errors-only'))
                  throw new Error('webpack compilation error')
                }
              })
              .then(() => {
              evt.options.pathDist = optimizedPath; // eslint-disable-line
                return evt;
              })
              // delete generated handler we copied above
              .finally(() => fs.removeAsync(generatedHandler))
          );
        }
      }

      return Promise.resolve(evt);
    }
  }

  return ServerlessWebpack;
};

/*
  MIT License http://www.opensource.org/licenses/mit-license.php
  Author Sean Larkin @thelarkinn
*/
function formatSize (size) {
  if(size <= 0) {
    return "0 bytes";
  }

  const abbreviations = ["bytes", "kB", "MB", "GB"];
  const index = Math.floor(Math.log(size) / Math.log(1000));

  return `${+(size / Math.pow(1000, index)).toPrecision(3)} ${abbreviations[index]}`;
};
