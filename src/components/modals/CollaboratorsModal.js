import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
  ActivityIndicator,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ApiCaller from '../../api/apiCaller';

const CollaboratorsModal = ({ 
  isVisible, 
  onClose, 
  projectId, 
  collaborators = [], 
  onCollaboratorsUpdate,
  isConsultant = false 
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [newCollaboratorName, setNewCollaboratorName] = useState('');
  const [newCollaboratorEmail, setNewCollaboratorEmail] = useState('');
  const [existingCollaborators, setExistingCollaborators] = useState([]);
  const [showExisting, setShowExisting] = useState(false);

  // Fetch existing collaborators from the system
  const fetchExistingCollaborators = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await ApiCaller('/collaborators');
      setExistingCollaborators(response || []);
      setShowExisting(true);
    } catch (error) {
      console.error("Failed to fetch collaborators:", error);
      Alert.alert("Error", "Failed to fetch existing collaborators.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Add new collaborator
  const handleAddCollaborator = async () => {
    if (!newCollaboratorName.trim() || !newCollaboratorEmail.trim()) {
      Alert.alert('Validation', 'Name and email are required.');
      return;
    }

    setIsAdding(true);
    try {
      console.log('Creating collaborator with projectId:', projectId);
      
      // Create new collaborator record
      const response = await ApiCaller('/records', {
        method: 'POST',
        body: JSON.stringify({
          tableName: 'collaborators',
          recordsToCreate: [{
            fields: {
              'collaborator_name': newCollaboratorName.trim(),
              'collaborator_email': newCollaboratorEmail.trim(),
              'Projects': [projectId]
            }
          }]
        })
      });

      console.log('Collaborator creation response:', response);

      if (response && response.records && response.records.length > 0) {
        const newCollaborator = response.records[0].fields.collaborator_name;
        console.log('New collaborator name:', newCollaborator);
        
        // The collaborator_name field is computed, so we don't need to update the project
        // The field will automatically reflect the new collaborator
        const updatedCollaborators = [...collaborators, newCollaborator];
        console.log('Updated collaborators list:', updatedCollaborators);

        // Notify parent component to refresh the project data
        if (onCollaboratorsUpdate) {
          onCollaboratorsUpdate(updatedCollaborators);
        }

        // Reset form
        setNewCollaboratorName('');
        setNewCollaboratorEmail('');
        Alert.alert('Success', 'Collaborator added successfully!');
      } else {
        throw new Error('No records returned from collaborator creation');
      }
    } catch (error) {
      console.error('Failed to add collaborator:', error);
      Alert.alert('Error', `Failed to add collaborator: ${error.message || 'Please try again.'}`);
    } finally {
      setIsAdding(false);
    }
  };

  // Add existing collaborator
  const handleAddExistingCollaborator = async (collaborator) => {
    setIsAdding(true);
    try {
      // Check if collaborator is already in the project
      if (collaborators.includes(collaborator.fields.collaborator_name)) {
        Alert.alert('Error', 'This collaborator is already part of the project.');
        setIsAdding(false);
        return;
      }

      console.log('Adding existing collaborator:', collaborator.fields.collaborator_name);

      // Update the collaborator's projects list
      const existingProjects = collaborator.fields.Projects || [];
      const updatedProjects = [...existingProjects, projectId];
      
      await ApiCaller('/records', {
        method: 'PATCH',
        body: JSON.stringify({
          tableName: 'collaborators',
          recordsToUpdate: [{
            id: collaborator.id,
            fields: { 'Projects': updatedProjects }
          }]
        })
      });

      // The collaborator_name field is computed, so we don't need to update the project
      // The field will automatically reflect the new collaborator
      const updatedCollaborators = [...collaborators, collaborator.fields.collaborator_name];

      // Notify parent component to refresh the project data
      if (onCollaboratorsUpdate) {
        onCollaboratorsUpdate(updatedCollaborators);
      }

      setShowExisting(false);
      Alert.alert('Success', 'Collaborator added successfully!');
    } catch (error) {
      console.error('Failed to add existing collaborator:', error);
      Alert.alert('Error', `Failed to add collaborator: ${error.message || 'Please try again.'}`);
    } finally {
      setIsAdding(false);
    }
  };

  // Remove collaborator
  const handleRemoveCollaborator = async (collaboratorName) => {
    Alert.alert(
      'Remove Collaborator',
      `Are you sure you want to remove ${collaboratorName} as a collaborator?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Remove', 
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('Removing collaborator:', collaboratorName);
              
              // Find the collaborator record and remove the project from their Projects list
              // First, we need to fetch the collaborator record
              const collaboratorsResponse = await ApiCaller('/collaborators');
              const collaboratorRecord = collaboratorsResponse.find(c => c.fields.collaborator_name === collaboratorName);
              
              if (collaboratorRecord) {
                const existingProjects = collaboratorRecord.fields.Projects || [];
                const updatedProjects = existingProjects.filter(id => id !== projectId);
                
                await ApiCaller('/records', {
                  method: 'PATCH',
                  body: JSON.stringify({
                    tableName: 'collaborators',
                    recordsToUpdate: [{
                      id: collaboratorRecord.id,
                      fields: { 'Projects': updatedProjects }
                    }]
                  })
                });
              }
              
              // The collaborator_name field is computed, so it will automatically update
              const updatedCollaborators = collaborators.filter(name => name !== collaboratorName);
              console.log('Updated collaborators after removal:', updatedCollaborators);

              // Notify parent component to refresh the project data
              if (onCollaboratorsUpdate) {
                onCollaboratorsUpdate(updatedCollaborators);
              }

              Alert.alert('Success', 'Collaborator removed successfully!');
            } catch (error) {
              console.error('Failed to remove collaborator:', error);
              Alert.alert('Error', `Failed to remove collaborator: ${error.message || 'Please try again.'}`);
            }
          }
        }
      ]
    );
  };

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#374151" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Collaborators</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Current Collaborators */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Current Collaborators</Text>
            {collaborators.length > 0 ? (
              <View style={styles.collaboratorsList}>
                {collaborators.map((name, index) => (
                  <View key={index} style={styles.collaboratorItem}>
                    <View style={styles.collaboratorInfo}>
                      <Ionicons name="person" size={20} color="#6B7280" />
                      <Text style={styles.collaboratorName}>{name}</Text>
                    </View>
                    {isConsultant && (
                      <TouchableOpacity
                        onPress={() => handleRemoveCollaborator(name)}
                        style={styles.removeButton}
                      >
                        <Ionicons name="trash-outline" size={18} color="#EF4444" />
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="people-outline" size={48} color="#9CA3AF" />
                <Text style={styles.emptyText}>No collaborators assigned</Text>
              </View>
            )}
          </View>

          {/* Add Collaborator Section (Only for Consultants) */}
          {isConsultant && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Add New Collaborator</Text>
              
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Name</Text>
                <TextInput
                  style={styles.textInput}
                  value={newCollaboratorName}
                  onChangeText={setNewCollaboratorName}
                  placeholder="Enter collaborator name"
                  placeholderTextColor="#9CA3AF"
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Email</Text>
                <TextInput
                  style={styles.textInput}
                  value={newCollaboratorEmail}
                  onChangeText={setNewCollaboratorEmail}
                  placeholder="Enter collaborator email"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              <TouchableOpacity
                style={[styles.addButton, isAdding && styles.addButtonDisabled]}
                onPress={handleAddCollaborator}
                disabled={isAdding}
              >
                {isAdding ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="add" size={20} color="#FFFFFF" />
                    <Text style={styles.addButtonText}>Add Collaborator</Text>
                  </>
                )}
              </TouchableOpacity>

              {/* Add from Existing */}
              <View style={styles.existingSection}>
                <TouchableOpacity
                  style={styles.existingButton}
                  onPress={fetchExistingCollaborators}
                  disabled={isLoading}
                >
                  <Text style={styles.existingButtonText}>
                    {isLoading ? 'Loading...' : 'Add from existing collaborators'}
                  </Text>
                </TouchableOpacity>

                {showExisting && (
                  <View style={styles.existingList}>
                    {existingCollaborators.length > 0 ? (
                      existingCollaborators.map((collaborator) => (
                        <TouchableOpacity
                          key={collaborator.id}
                          style={styles.existingItem}
                          onPress={() => handleAddExistingCollaborator(collaborator)}
                        >
                          <View style={styles.existingItemInfo}>
                            <Text style={styles.existingItemName}>
                              {collaborator.fields.collaborator_name}
                            </Text>
                            <Text style={styles.existingItemEmail}>
                              {collaborator.fields.collaborator_email}
                            </Text>
                          </View>
                          <Ionicons name="add-circle-outline" size={20} color="#3B82F6" />
                        </TouchableOpacity>
                      ))
                    ) : (
                      <Text style={styles.noExistingText}>No existing collaborators found</Text>
                    )}
                  </View>
                )}
              </View>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  closeButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 16,
  },
  collaboratorsList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  collaboratorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  collaboratorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  collaboratorName: {
    fontSize: 16,
    color: '#374151',
    marginLeft: 12,
    fontWeight: '500',
  },
  removeButton: {
    padding: 8,
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  emptyText: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 12,
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#111827',
  },
  addButton: {
    backgroundColor: '#10B981',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
  },
  addButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  existingSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
  },
  existingButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  existingButtonText: {
    color: '#3B82F6',
    fontSize: 16,
    fontWeight: '500',
  },
  existingList: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 16,
  },
  existingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  existingItemInfo: {
    flex: 1,
  },
  existingItemName: {
    fontSize: 16,
    color: '#374151',
    fontWeight: '500',
  },
  existingItemEmail: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  noExistingText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    paddingVertical: 20,
  },
});

export default CollaboratorsModal;
