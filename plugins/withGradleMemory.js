// Gradle settings for fast, reliable release builds, applied on every prebuild so the generated
// android/ folder never needs editing by hand:
// - enough memory: the default 2 GB heap / 512 MB metaspace runs out ("OutOfMemoryError: Metaspace")
//   while bundling and dexing the app;
// - the build cache: compiled results are kept in ~/.gradle and reused, even after the android/
//   folder is regenerated, so unchanged parts aren't compiled again;
// - parallel builds of the app's modules.
const { withGradleProperties } = require('expo/config-plugins');

const PROPERTIES = {
  'org.gradle.jvmargs': '-Xmx4g -XX:MaxMetaspaceSize=1g -XX:+HeapDumpOnOutOfMemoryError -Dfile.encoding=UTF-8',
  'org.gradle.caching': 'true',
  'org.gradle.parallel': 'true',
};

module.exports = function withGradleMemory(config) {
  return withGradleProperties(config, (cfg) => {
    const props = cfg.modResults.filter((p) => !(p.type === 'property' && p.key in PROPERTIES));
    for (const [key, value] of Object.entries(PROPERTIES)) props.push({ type: 'property', key, value });
    cfg.modResults = props;
    return cfg;
  });
};
