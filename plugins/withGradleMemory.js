// Gradle settings for fast, reliable release builds, applied on every prebuild so the generated
// android/ folder never needs editing by hand:
// - enough memory: the default 2 GB heap / 512 MB metaspace runs out ("OutOfMemoryError: Metaspace")
//   while bundling and dexing the app;
// - the build cache: compiled results are kept in ~/.gradle and reused, even after the android/
//   folder is regenerated, so unchanged parts aren't compiled again;
// - parallel builds of the app's modules;
// - no "lint vital" checks in release builds: they only analyse code style, take a while for every
//   module, and on Windows they can fail with "file is being used by another process".
const { withGradleProperties, withProjectBuildGradle } = require('expo/config-plugins');

const PROPERTIES = {
  'org.gradle.jvmargs': '-Xmx4g -XX:MaxMetaspaceSize=1g -XX:+HeapDumpOnOutOfMemoryError -Dfile.encoding=UTF-8',
  'org.gradle.caching': 'true',
  'org.gradle.parallel': 'true',
};

const SKIP_LINT_MARKER = '// workout-app: skip lint vital checks';
const SKIP_LINT = `
${SKIP_LINT_MARKER}
gradle.taskGraph.whenReady { graph ->
  graph.allTasks.findAll { it.name.startsWith('lintVital') }.each { it.enabled = false }
}
`;

module.exports = function withGradleMemory(config) {
  config = withGradleProperties(config, (cfg) => {
    const props = cfg.modResults.filter((p) => !(p.type === 'property' && p.key in PROPERTIES));
    for (const [key, value] of Object.entries(PROPERTIES)) props.push({ type: 'property', key, value });
    cfg.modResults = props;
    return cfg;
  });
  return withProjectBuildGradle(config, (cfg) => {
    if (!cfg.modResults.contents.includes(SKIP_LINT_MARKER)) cfg.modResults.contents += SKIP_LINT;
    return cfg;
  });
};
