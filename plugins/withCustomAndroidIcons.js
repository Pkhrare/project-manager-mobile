const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Custom plugin to bypass Expo's icon generation that causes permission issues
 * This manually copies pre-existing Android icons without using @expo/image-utils
 */
module.exports = function withCustomAndroidIcons(config) {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const androidPath = config.modRequest.platformProjectRoot;
      const resPath = path.join(androidPath, 'app', 'src', 'main', 'res');
      
      // Ensure res directory exists
      if (!fs.existsSync(resPath)) {
        return config;
      }

      // Define mipmap directories
      const mipmapDirs = [
        'mipmap-mdpi',
        'mipmap-hdpi',
        'mipmap-xhdpi',
        'mipmap-xxhdpi',
        'mipmap-xxxhdpi'
      ];

      // Create mipmap directories if they don't exist
      mipmapDirs.forEach(dir => {
        const dirPath = path.join(resPath, dir);
        if (!fs.existsSync(dirPath)) {
          fs.mkdirSync(dirPath, { recursive: true });
        }
      });

      console.log('Custom Android icon plugin: Skipping icon generation to avoid permission issues');
      
      return config;
    },
  ]);
};

