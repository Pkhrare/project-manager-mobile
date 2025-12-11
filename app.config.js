import 'dotenv/config';

export default {
  expo: {
    name: "Waiver On-the-go",
    slug: "project-manager-mobile",
    version: "1.0.4",
    orientation: "portrait",
    scheme: "projectmanager",
    platforms: ["ios", "android"],
    plugins: [
      "expo-font",
      "expo-web-browser",
      "./plugins/withCustomAndroidIcons.js"
    ],
    userInterfaceStyle: "light",
    newArchEnabled: true,
    ios: {
      bundleIdentifier: "com.waivergroup.waiveronthego",
      buildNumber: "6",
      supportsTablet: true
    },
    android: {
      package: "com.waivergroup.waiveronthego",
      versionCode: 5,
      permissions: [],
      edgeToEdgeEnabled: true,
      playStoreUrl: "https://play.google.com/store/apps/details?id=com.waivergroup.waiveronthego"
    },
    // Extra configuration for environment variables
    extra: {
      // EAS project ID
      eas: {
        projectId: "b2efae6f-d8d3-47c6-b8d4-2384830305f1"
      },
      // Read from EAS environment variables (set via: eas env:create --name BEARER_TOKEN --value "token")
      // This is marked as sensitive and won't appear in build logs
      bearerToken: process.env.BEARER_TOKEN || '',
      // Firebase configuration
      firebaseApiKey: process.env.FIREBASE_API_KEY || '',
      firebaseAuthDomain: process.env.FIREBASE_AUTH_DOMAIN || '',
      firebaseProjectId: process.env.FIREBASE_PROJECT_ID || '',
      firebaseStorageBucket: process.env.FIREBASE_STORAGE_BUCKET || '',
      firebaseMessagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '',
      firebaseAppId: process.env.FIREBASE_APP_ID || '',
      firebaseMeasurementId: process.env.FIREBASE_MEASUREMENT_ID || '',
      // Google Sign-In
      googleWebClientId: process.env.GOOGLE_WEB_CLIENT_ID || '',
    }
  }
};



