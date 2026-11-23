// Puts the app's JavaScript inside debug builds too (Android Studio's Run button makes a debug build).
// By default debug builds leave it out and load it from Metro, the development server on the
// computer, so without Metro running the app shows "Unable to load script". With the code inside,
// a debug build works on its own; when Metro *is* running, it's still used for live reloading.
const { withAppBuildGradle } = require('expo/config-plugins');

const MARKER = '// workout-app: bundle JS in every variant';

module.exports = function withEmbeddedJsInDebug(config) {
  return withAppBuildGradle(config, (cfg) => {
    const gradle = cfg.modResults.contents;
    if (gradle.includes(MARKER)) return cfg;
    if (!/^react \{$/m.test(gradle)) {
      throw new Error('withEmbeddedJsInDebug: could not find the "react {" block in android/app/build.gradle');
    }
    cfg.modResults.contents = gradle.replace(/^react \{$/m, `react {\n    ${MARKER}\n    debuggableVariants = []`);
    return cfg;
  });
};
