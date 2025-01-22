const path = require("path");

module.exports = {
  mode: "production", // Avoid Manifest V3 (security) issues using prod mode and setting devtool to false
  entry: {
    background: "./src/background.js", // Entry for background script
    popup: "./src/popup.js", // Entry for popup script
  },
  output: {
    path: path.resolve(__dirname, "dist"), // Output directory
    filename: "[name].bundle.js", // Dynamic filename based on entry (e.g., popup.bundle.js)
    clean: true, // Clean the output directory before building
  },
  resolve: {
    extensions: [".js"], // Resolve .js files
  },
  module: {
    rules: [
      {
        test: /\.js$/, // Apply Babel to .js files
        exclude: /node_modules/,
        use: {
          loader: "babel-loader",
          options: {
            presets: ["@babel/preset-env"], // Transpile modern JS to ES5
          },
        },
      },
    ],
  },
  devtool: false, 
};
