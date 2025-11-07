// Simple script to check if environment variables are loaded correctly
// Run with: node check-env.js

require('dotenv').config();

console.log('\n=== Environment Variables Check ===\n');

const requiredVars = [
  'BEARER_TOKEN',
  'FIREBASE_API_KEY',
  'FIREBASE_AUTH_DOMAIN',
  'FIREBASE_PROJECT_ID',
  'FIREBASE_STORAGE_BUCKET',
  'FIREBASE_MESSAGING_SENDER_ID',
  'FIREBASE_APP_ID',
  'FIREBASE_MEASUREMENT_ID'
];

const optionalVars = [
  'GOOGLE_WEB_CLIENT_ID'
];

let allPresent = true;

console.log('Required Variables:');
requiredVars.forEach(varName => {
  const value = process.env[varName];
  const status = value ? '✓' : '✗';
  const preview = value ? (value.substring(0, 20) + '...') : 'MISSING';
  console.log(`  ${status} ${varName}: ${preview}`);
  if (!value) allPresent = false;
});

console.log('\nOptional Variables:');
optionalVars.forEach(varName => {
  const value = process.env[varName];
  const status = value ? '✓' : '✗';
  const preview = value ? (value.substring(0, 20) + '...') : 'not set';
  console.log(`  ${status} ${varName}: ${preview}`);
});

console.log('\n=== Summary ===');
if (allPresent) {
  console.log('✓ All required environment variables are set!');
  console.log('\nNext steps:');
  console.log('1. Make sure Expo server is stopped');
  console.log('2. Run: npx expo start --clear');
  console.log('3. Check the console for Firebase initialization');
} else {
  console.log('✗ Some required environment variables are missing!');
  console.log('\nPlease check your .env file and make sure all variables are set.');
  console.log('See env.template for reference.');
}
console.log('\n');

