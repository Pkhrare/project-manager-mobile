import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAIAssistant } from '../../utils/AIAssistantContext';

const AIAssistantButton = () => {
  const { toggleOpen, currentProjectId } = useAIAssistant();

  return (
    <TouchableOpacity
      style={styles.button}
      onPress={toggleOpen}
      activeOpacity={0.8}
    >
      <View style={styles.iconContainer}>
        <Ionicons name="sparkles" size={24} color="#FFFFFF" />
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    bottom: 80,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#7C3AED',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
    zIndex: 1000,
  },
  iconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default AIAssistantButton;

