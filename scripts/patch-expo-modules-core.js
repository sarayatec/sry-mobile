const fs = require('fs');
const path = require('path');

const pluginPath = path.join(__dirname, '..', 'node_modules', 'expo-modules-core', 'android', 'ExpoModulesCorePlugin.gradle');

if (!fs.existsSync(pluginPath)) {
  console.log('expo-modules-core not found, skipping patch');
  process.exit(0);
}

let content = fs.readFileSync(pluginPath, 'utf8');

// Fix: components.release is not available synchronously in AGP 8.x with Gradle 8.10+
// Replace the failing afterEvaluate block with a safe version
const before = `  project.afterEvaluate {
    publishing {
      publications {
        release(MavenPublication) {
          from components.release
        }
      }`;

const after = `  project.afterEvaluate {
    def releaseComponent = components.findByName('release')
    if (releaseComponent != null) {
    publishing {
      publications {
        release(MavenPublication) {
          from releaseComponent
        }
      }`;

const closing = `    }
  }
}`;

const closingPatched = `    }
    } // end if releaseComponent
  }
}`;

if (content.includes(before)) {
  content = content.replace(before, after);
  // Also fix the closing braces
  const afterBlock = `      repositories {
        maven {
          url = mavenLocal().url
        }
      }
    }
  }
}`;
  const afterBlockPatched = `      repositories {
        maven {
          url = mavenLocal().url
        }
      }
    } // end publishing
    } // end if releaseComponent
  }
}`;
  content = content.replace(afterBlock, afterBlockPatched);
  fs.writeFileSync(pluginPath, content, 'utf8');
  console.log('Patched expo-modules-core ExpoModulesCorePlugin.gradle (components.release fix)');
} else if (content.includes('releaseComponent')) {
  console.log('expo-modules-core already patched');
} else {
  console.log('Pattern not found in ExpoModulesCorePlugin.gradle, skipping patch');
  console.log('First 200 chars:', content.substring(0, 200));
}
