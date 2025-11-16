const fs = require('fs');
const path = require('path');

/**
 * Custom plugin to create .expo/web directory early in the config phase
 * This prevents @expo/image-utils permission errors during icon/splash generation
 * 
 * This plugin runs during config evaluation, before prebuild, to create
 * the directory that @expo/image-utils needs.
 */
module.exports = function withCustomAndroidIcons(config) {
  // Create directory immediately during config evaluation
  // This runs before prebuild, so we're in the build working directory
  const cwd = process.cwd();
  const expoPath = path.join(cwd, '.expo');
  const webPath = path.join(expoPath, 'web');
  
  try {
    // Try to create with maximum permissions
    if (!fs.existsSync(expoPath)) {
      fs.mkdirSync(expoPath, { recursive: true, mode: 0o777 });
    }
    if (!fs.existsSync(webPath)) {
      fs.mkdirSync(webPath, { recursive: true, mode: 0o777 });
    }
    console.log(`✓ Created .expo/web directory at: ${webPath}`);
  } catch (error) {
    // If we can't create it, log but don't fail - the build might still work
    console.warn(`⚠ Could not create .expo/web directory: ${error.message}`);
    console.warn(`  Attempted path: ${webPath}`);
    console.warn(`  Current working directory: ${cwd}`);
  }
  
  return config;
};

