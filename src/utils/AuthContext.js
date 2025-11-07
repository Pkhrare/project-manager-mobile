import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { initializeApp, getApps } from 'firebase/app';

// Import from firebase/auth/web-extension to avoid React Native auto-detection
import { 
  getAuth,
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithCredential
} from 'firebase/auth/web-extension';

import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import Constants from 'expo-constants';

WebBrowser.maybeCompleteAuthSession();

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: Constants.expoConfig?.extra?.firebaseApiKey || '',
  authDomain: Constants.expoConfig?.extra?.firebaseAuthDomain || '',
  projectId: Constants.expoConfig?.extra?.firebaseProjectId || '',
  storageBucket: Constants.expoConfig?.extra?.firebaseStorageBucket || '',
  messagingSenderId: Constants.expoConfig?.extra?.firebaseMessagingSenderId || '',
  appId: Constants.expoConfig?.extra?.firebaseAppId || '',
  measurementId: Constants.expoConfig?.extra?.firebaseMeasurementId || '',
};

// Debug: Log environment variable loading (remove in production)
if (__DEV__) {
  console.log('Environment variables loaded:', {
    hasApiKey: !!firebaseConfig.apiKey,
    hasAuthDomain: !!firebaseConfig.authDomain,
    hasProjectId: !!firebaseConfig.projectId,
    hasBearerToken: !!Constants.expoConfig?.extra?.bearerToken,
  });
}

// Initialize Firebase
let auth;
let firebaseInitialized = false;

try {
  // Check if all required config values are present
  const hasValidConfig = firebaseConfig.apiKey && 
                         firebaseConfig.authDomain && 
                         firebaseConfig.projectId;
  
  if (!hasValidConfig) {
    console.error('Firebase configuration is incomplete. Please check your .env file.');
    console.log('Current config:', {
      apiKey: firebaseConfig.apiKey ? '✓' : '✗',
      authDomain: firebaseConfig.authDomain ? '✓' : '✗',
      projectId: firebaseConfig.projectId ? '✓' : '✗',
    });
  } else {
    // Check if Firebase app already exists
    let app;
    if (getApps().length === 0) {
      app = initializeApp(firebaseConfig);
      console.log('✓ Firebase app initialized');
    } else {
      const { getApp } = require('firebase/app');
      app = getApp();
      console.log('✓ Using existing Firebase app');
    }
    
    // Use getAuth for Expo compatibility (web-extension version)
    auth = getAuth(app);
    firebaseInitialized = true;
    console.log('✓ Firebase Auth initialized successfully (web-extension mode)');
  }
} catch (error) {
  console.error('Error initializing Firebase:', error.message);
  console.error('Error code:', error.code);
  console.error('Full error:', error);
}

// Create the authentication context
const AuthContext = createContext();

// Custom hook to use the auth context
export const useAuth = () => useContext(AuthContext);

// Provider component that wraps the app and makes auth available
export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState(null);
  
  // Google Auth configuration
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: Constants.expoConfig?.extra?.googleWebClientId || '',
  });

  // Handle Google Sign-In response
  useEffect(() => {
    if (response?.type === 'success') {
      if (!firebaseInitialized) {
        console.error('Firebase not initialized, cannot complete Google Sign-In');
        return;
      }
      
      const { id_token } = response.params;
      
      const credential = GoogleAuthProvider.credential(id_token);
      signInWithCredential(auth, credential)
        .then((userCredential) => {
          setCurrentUser(userCredential.user);
          setUserRole('consultant');
          AsyncStorage.setItem('userRole', 'consultant');
        })
        .catch((error) => {
          console.error('Google Sign-In credential error:', error);
        });
    }
  }, [response]);

  // Check if the user is logged in when the app loads
  useEffect(() => {
    const initializeAuth = async () => {
      // Check for stored client session first
      const storedRole = await AsyncStorage.getItem('userRole');
      
      if (storedRole === 'client') {
        // Restore client session
        const clientProjectData = await AsyncStorage.getItem('clientProject');
        if (clientProjectData) {
          try {
            const clientUser = JSON.parse(clientProjectData);
            setCurrentUser(clientUser);
            setUserRole('client');
            setLoading(false);
            return; // Skip Firebase listener for clients
          } catch (error) {
            console.error('Error restoring client session:', error);
            await AsyncStorage.removeItem('clientProject');
            await AsyncStorage.removeItem('userRole');
          }
        }
      }
      
      // For consultant login, use Firebase
      if (!firebaseInitialized) {
        console.error('Firebase not initialized, skipping auth listener');
        setLoading(false);
        return;
      }

      // Subscribe to auth state changes
      const unsubscribe = onAuthStateChanged(auth, async (user) => {
        console.log('Auth state changed:', user ? 'User logged in' : 'No user');
        setCurrentUser(user);
        
        if (user) {
          // User is logged in - check if we have a role stored
          const storedRole = await AsyncStorage.getItem('userRole');
          
          // For Firebase authenticated users, always default to consultant if no valid stored role
          if (!storedRole || storedRole === 'null') {
            setUserRole('consultant');
            await AsyncStorage.setItem('userRole', 'consultant');
          } else if (storedRole === 'client') {
            // This shouldn't happen (client should be handled above), but handle it anyway
            setUserRole('client');
          } else {
            // Default to consultant for any other case
            setUserRole('consultant');
            await AsyncStorage.setItem('userRole', 'consultant');
          }
        } else {
          // If user is null (logged out), clear the role
          console.log('User logged out, clearing role');
          setUserRole(null);
          await AsyncStorage.removeItem('userRole');
        }
        setLoading(false);
      });

      // Cleanup subscription on unmount
      return unsubscribe;
    };

    initializeAuth();
  }, []);

  // Login with email and password
  const loginWithEmail = async (email, password) => {
    if (!firebaseInitialized) {
      throw new Error('Firebase not initialized');
    }

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      setCurrentUser(userCredential.user);
      setUserRole('consultant');
      await AsyncStorage.setItem('userRole', 'consultant');
      return userCredential;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  // Google Sign-In using Expo
  const signInWithGoogle = async () => {
    try {
      // Trigger the Google Sign-In flow
      await promptAsync();
      // The response will be handled in the useEffect hook above
    } catch (error) {
      console.error('Google Sign-In error:', error);
      throw error;
    }
  };

  // Start client session (no Firebase auth needed)
  const startClientSession = async (projectData) => {
    console.log('Starting a client session', projectData);
    setUserRole('client');
    await AsyncStorage.setItem('userRole', 'client');
    
    // Store the client's project data
    if (projectData) {
      const clientUser = {
        email: projectData.fields?.['Client Email'] || '',
        displayName: projectData.fields?.['Project Name'] || '',
        projectId: projectData.id || '',
        projectFields: projectData.fields || {}
      };
      setCurrentUser(clientUser);
      await AsyncStorage.setItem('clientProject', JSON.stringify(clientUser));
    }
  };

  // Logout function
  const logout = async () => {
    try {
      console.log('Logging out user, role:', userRole);
      
      // Clear AsyncStorage first to prevent auto-restore
      await AsyncStorage.removeItem('userRole');
      await AsyncStorage.removeItem('clientProject');
      
      // Clear state immediately
      setCurrentUser(null);
      setUserRole(null);
      
      // If user is a consultant (Firebase auth), sign out
      if (firebaseInitialized && userRole === 'consultant') {
        await signOut(auth);
      }
      
      console.log('Logout complete');
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  };

  // Value object that will be passed to consumers of this context
  const value = {
    currentUser,
    loginWithEmail,
    signInWithGoogle,
    startClientSession,
    logout,
    userRole,
    isAuthenticated: !!currentUser || userRole === 'client',
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
