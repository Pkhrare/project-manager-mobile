import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';

// Import authentication screens
import LoginScreen from '../screens/auth/LoginScreen';
import ClientLoginScreen from '../screens/auth/ClientLoginScreen';

const Stack = createStackNavigator();

const AuthNavigator = () => {
  return (
    <Stack.Navigator
      initialRouteName="Login"
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="ClientLogin" component={ClientLoginScreen} />
    </Stack.Navigator>
  );
};

export default AuthNavigator;
