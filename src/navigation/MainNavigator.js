import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../utils/AuthContext';

// Import screens
import HomeScreen from '../screens/dashboard/HomeScreen';
import ProjectsScreen from '../screens/projects/ProjectsScreen';
import ProjectDetailsScreen from '../screens/projects/ProjectDetailsScreen';
import TemplatesScreen from '../screens/templates/TemplatesScreen';
import ProfileScreen from '../screens/dashboard/ProfileScreen';

// Create navigators
const Tab = createBottomTabNavigator();
const ProjectsStack = createStackNavigator();
const TemplatesStack = createStackNavigator();

// Projects stack navigator
const ProjectsStackNavigator = () => {
  return (
    <ProjectsStack.Navigator
      screenOptions={{
        headerShown: true,
        gestureEnabled: true,
      }}
    >
      <ProjectsStack.Screen 
        name="ProjectsList" 
        component={ProjectsScreen} 
        options={{ title: 'Projects' }}
      />
      <ProjectsStack.Screen 
        name="ProjectDetails" 
        component={ProjectDetailsScreen} 
        options={({ route }) => ({ title: route.params?.projectName || 'Project Details' })}
      />
    </ProjectsStack.Navigator>
  );
};

// Templates stack navigator
const TemplatesStackNavigator = () => {
  return (
    <TemplatesStack.Navigator
      screenOptions={{
        headerShown: true,
        gestureEnabled: true,
      }}
    >
      <TemplatesStack.Screen 
        name="TemplatesList" 
        component={TemplatesScreen} 
        options={{ title: 'Templates' }}
      />
    </TemplatesStack.Navigator>
  );
};

// Main tab navigator
const MainNavigator = () => {
  const { isClient } = useAuth();
  
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Projects') {
            iconName = focused ? 'folder' : 'folder-outline';
          } else if (route.name === 'Templates') {
            iconName = focused ? 'copy' : 'copy-outline';
          } else if (route.name === 'Profile') {
            iconName = focused ? 'person' : 'person-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#1976D2',
        tabBarInactiveTintColor: 'gray',
        headerShown: true,
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen 
        name="Projects" 
        component={ProjectsStackNavigator}
        options={{ headerShown: false }}
      />
      {!isClient && (
        <Tab.Screen 
          name="Templates" 
          component={TemplatesStackNavigator}
          options={{ headerShown: false }}
        />
      )}
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
};

export default MainNavigator;