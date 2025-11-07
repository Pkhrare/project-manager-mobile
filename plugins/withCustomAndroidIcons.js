const { withPlugins } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Custom plugin to create .expo/web directory before other plugins run
 * This prevents @expo/image-utils permission errors during icon/splash generation
 */
function withExpoWebDirectory(config) {
  // Create .expo/web directory early to prevent permission errors
  const projectRoot = config._internal?.projectRoot || process.cwd();
  const expoPath = path.join(projectRoot, '.expo');
  const webPath = path.join(expoPath, 'web');
  
  try {
    if (!fs.existsSync(expoPath)) {
      fs.mkdirSync(expoPath, { recursive: true });
    }
    if (!fs.existsSync(webPath)) {
      fs.mkdirSync(webPath, { recursive: true });
    }
    console.log('Created .expo/web directory to prevent permission issues');
  } catch (error) {
    console.warn('Could not create .expo/web directory:', error.message);
  }
  
  return config;
}

module.exports = function withCustomAndroidIcons(config) {
  // Run this plugin first to create the directory before other plugins
  return withPlugins(config, [
    withExpoWebDirectory,
  ]);
};

