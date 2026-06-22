const { withProjectBuildGradle } = require('@expo/config-plugins');

// Force Kotlin 1.9.25 to match Compose Compiler 1.5.15 requirements.
// react-native's libs.versions.toml specifies kotlin 1.9.24, which conflicts.
const withKotlinVersion = (config) => {
  return withProjectBuildGradle(config, (config) => {
    const contents = config.modResults.contents;

    // Replace: classpath('org.jetbrains.kotlin:kotlin-gradle-plugin')
    // With:    classpath("org.jetbrains.kotlin:kotlin-gradle-plugin:${kotlinVersion}")
    const patched = contents.replace(
      "classpath('org.jetbrains.kotlin:kotlin-gradle-plugin')",
      "classpath(\"org.jetbrains.kotlin:kotlin-gradle-plugin:${kotlinVersion}\")"
    );

    if (patched !== contents) {
      config.modResults.contents = patched;
    }

    return config;
  });
};

module.exports = withKotlinVersion;
