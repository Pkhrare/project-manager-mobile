import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const TemplatesScreen = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Templates</Text>
      <Text style={styles.subtitle}>Your project templates will appear here</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#212121',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#757575',
  },
});

export default TemplatesScreen;