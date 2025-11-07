import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const ProjectDeactivatedScreen = ({ onBackToLogin }) => {
  return (
    <View style={styles.container}>
      {/* Company Logo */}
      <View style={styles.logoContainer}>
        <Image 
          source={require('../../../assets/company_logo.avif')} 
          style={styles.logo}
          resizeMode="contain"
        />
      </View>
      
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Ionicons name="warning" size={64} color="#EF4444" />
        </View>
        
        <Text style={styles.title}>Project Deactivated</Text>
        
        <Text style={styles.message}>
          Looks like due to inactivity for more than a week, your project has been deactivated.
        </Text>
        
        <Text style={styles.contactText}>
          Please reach out to{' '}
          <Text style={styles.emailLink}>prakhar.khare@waivergroup.com</Text>
        </Text>
        
        <TouchableOpacity 
          style={styles.backButton}
          onPress={onBackToLogin}
        >
          <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
          <Text style={styles.backButtonText}>Back to Login</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  logoContainer: {
    marginBottom: 40,
    backgroundColor: '#F8F9FA',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 12,
  },
  logo: {
    width: 280,
    height: 60,
  },
  content: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 32,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  iconContainer: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#EF4444',
    marginBottom: 16,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  contactText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  emailLink: {
    color: '#3B82F6',
    textDecorationLine: 'underline',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2C2C2C',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});

export default ProjectDeactivatedScreen;
