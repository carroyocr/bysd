// craco.config.js
const path = require("path");
const webpack = require("webpack");
const { execSync } = require("child_process");
require("dotenv").config();

// Version y revision de la app, para poder saber que build tiene alguien en el
// telefono cuando reporta algo. La version sale de package.json y la revision
// del commit; si git no esta disponible (algun entorno de build no lo tiene),
// se queda vacia en vez de romper la compilacion.
const { version: APP_VERSION } = require("./package.json");
let APP_REVISION = "";
try {
  APP_REVISION = execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] })
    .toString()
    .trim();
} catch {
  APP_REVISION = "";
}
const APP_BUILD_DATE = new Date().toISOString().slice(0, 10);

// Environment variable overrides
const config = {
  disableHotReload: process.env.DISABLE_HOT_RELOAD === "true",
  enableVisualEdits: process.env.REACT_APP_ENABLE_VISUAL_EDITS === "true",
  enableHealthCheck: process.env.ENABLE_HEALTH_CHECK === "true",
};

// OG meta tag middleware (always loaded for dynamic WhatsApp/social previews)
const { setupOgMiddleware } = require("./plugins/og-middleware");

// Conditionally load visual editing modules only if enabled
let babelMetadataPlugin;
let setupDevServer;

if (config.enableVisualEdits) {
  babelMetadataPlugin = require("./plugins/visual-edits/babel-metadata-plugin");
  setupDevServer = require("./plugins/visual-edits/dev-server-setup");
}

// Conditionally load health check modules only if enabled
let WebpackHealthPlugin;
let setupHealthEndpoints;
let healthPluginInstance;

if (config.enableHealthCheck) {
  WebpackHealthPlugin = require("./plugins/health-check/webpack-health-plugin");
  setupHealthEndpoints = require("./plugins/health-check/health-endpoints");
  healthPluginInstance = new WebpackHealthPlugin();
}

const webpackConfig = {
  webpack: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      // El plugin de push trae una implementación para navegador que importa
      // el SDK web de Firebase. En el navegador no hay push (solo en la app
      // instalada), así que se apunta a un sustituto vacío en vez de instalar
      // el SDK completo. Ver src/live/firebaseWebStub.js.
      'firebase/app': path.resolve(__dirname, 'src/live/firebaseWebStub.js'),
      'firebase/messaging': path.resolve(__dirname, 'src/live/firebaseWebStub.js'),
    },
    configure: (webpackConfig) => {
      webpackConfig.plugins.push(
        new webpack.DefinePlugin({
          "process.env.REACT_APP_VERSION": JSON.stringify(APP_VERSION),
          "process.env.REACT_APP_REVISION": JSON.stringify(APP_REVISION),
          "process.env.REACT_APP_BUILD_DATE": JSON.stringify(APP_BUILD_DATE),
        })
      );

      // Disable hot reload completely if environment variable is set
      if (config.disableHotReload) {
        // Remove hot reload related plugins
        webpackConfig.plugins = webpackConfig.plugins.filter(plugin => {
          return !(plugin.constructor.name === 'HotModuleReplacementPlugin');
        });

        // Disable watch mode
        webpackConfig.watch = false;
        webpackConfig.watchOptions = {
          ignored: /.*/, // Ignore all files
        };
      } else {
        // Add ignored patterns to reduce watched directories
        webpackConfig.watchOptions = {
          ...webpackConfig.watchOptions,
          ignored: [
            '**/node_modules/**',
            '**/.git/**',
            '**/build/**',
            '**/dist/**',
            '**/coverage/**',
            '**/public/**',
          ],
        };
      }

      // Add health check plugin to webpack if enabled
      if (config.enableHealthCheck && healthPluginInstance) {
        webpackConfig.plugins.push(healthPluginInstance);
      }

      return webpackConfig;
    },
  },
};

// Only add babel plugin if visual editing is enabled
if (config.enableVisualEdits) {
  webpackConfig.babel = {
    plugins: [babelMetadataPlugin],
  };
}

// Setup dev server with OG middleware (always), visual edits and/or health check (conditional)
webpackConfig.devServer = (devServerConfig) => {
  // Always apply OG meta middleware for social media previews
  devServerConfig = setupOgMiddleware(devServerConfig);

  // Apply visual edits dev server setup if enabled
  if (config.enableVisualEdits && setupDevServer) {
    devServerConfig = setupDevServer(devServerConfig);
  }

  // Add health check endpoints if enabled
  if (config.enableHealthCheck && setupHealthEndpoints && healthPluginInstance) {
    const originalSetupMiddlewares = devServerConfig.setupMiddlewares;

    devServerConfig.setupMiddlewares = (middlewares, devServer) => {
      // Call original setup if exists
      if (originalSetupMiddlewares) {
        middlewares = originalSetupMiddlewares(middlewares, devServer);
      }

      // Setup health endpoints
      setupHealthEndpoints(devServer, healthPluginInstance);

      return middlewares;
    };
  }

  return devServerConfig;
};

module.exports = webpackConfig;
