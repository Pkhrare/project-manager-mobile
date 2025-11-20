import 'dotenv/config';

export default {
  expo: {
    name: "Waiver On-the-go",
    slug: "project-manager-mobile",
    version: "1.0.2",
    orientation: "portrait",
    scheme: "projectmanager",
    plugins: [
      "expo-web-browser"
    ],
    icon: "./assets/1024x1024_icon.png",
    userInterfaceStyle: "light",
    newArchEnabled: true,
    splash: {
      image: "./assets/1024x1024_icon.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff"
    },
    ios: {
      bundleIdentifier: "com.waivergroup.waiveronthego",
      buildNumber: "3",
      supportsTablet: true,
      icon: "./assets/1024x1024_icon.png"
    },
    android: {
      package: "com.waivergroup.waiveronthego",
      versionCode: 3,
      icon: "./assets/1024x1024_icon.png",
      adaptiveIcon: {
        foregroundImage: "./assets/1024x1024_icon.png",
        backgroundColor: "#FFFFFF"
      },
      edgeToEdgeEnabled: true
    },
    web: {
      favicon: "./assets/favicon.png"
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



