import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { useAuth } from '../utils/AuthContext';

// Import navigators
import AuthNavigator from './AuthNavigator';
import MainNavigator from './MainNavigator';

// Loading component
import { View, ActivityIndicator, StyleSheet } from 'react-native';

const LoadingScreen = () => (
  <View style={styles.container}>
    <ActivityIndicator size={50} color="#1976D2" />
  </View>
);

const AppNavigator = () => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <NavigationContainer>
      {isAuthenticated ? <MainNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
});

export default AppNavigator;