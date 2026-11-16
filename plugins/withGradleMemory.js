// Gives Gradle enough memory for release builds. The default 2 GB heap / 512 MB metaspace runs out
// ("OutOfMemoryError: Metaspace") while bundling and dexing the app. Applied on every prebuild, so
// the generated android/ folder never needs editing by hand.
const { withGradleProperties } = require('expo/config-plugins');

const JVM_ARGS = '-Xmx4g -XX:MaxMetaspaceSize=1g -XX:+HeapDumpOnOutOfMemoryError -Dfile.encoding=UTF-8';

module.exports = function withGradleMemory(config) {
  return withGradleProperties(config, (cfg) => {
    const props = cfg.modResults.filter((p) => !(p.type === 'property' && p.key === 'org.gradle.jvmargs'));
    props.push({ type: 'property', key: 'org.gradle.jvmargs', value: JVM_ARGS });
    cfg.modResults = props;
    return cfg;
  });
};
