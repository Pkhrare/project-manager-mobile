import 'dotenv/config';

export default {
  expo: {
    name: "Waiver On-the-go",
    slug: "project-manager-mobile",
    version: "1.0.0",
    orientation: "portrait",
    scheme: "projectmanager",
    plugins: [
      "expo-web-browser",
      "expo-font"
    ],
    icon: "./assets/expo_icon.png",
    userInterfaceStyle: "light",
    newArchEnabled: true,
    splash: {
      image: "./assets/tab_heading.v5.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff"
    },
    ios: {
      bundleIdentifier: "com.waivergroup.waiveronthego",
      buildNumber: "1",
      supportsTablet: true
    },
    android: {
      package: "com.waivergroup.waiveronthego",
      versionCode: 1,
      adaptiveIcon: {
        foregroundImage: "./assets/512x512_icon.png",
        backgroundColor: "#5a5e5a",
        monochromeImage: "./assets/512x512_icon.png"
      },
      edgeToEdgeEnabled: true
    },
    // Extra configuration for environment variables
    extra: {
      // EAS project ID
      eas: {
        projectId: "1081491a-3920-4c49-92dc-a5505c08a2d6"
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

