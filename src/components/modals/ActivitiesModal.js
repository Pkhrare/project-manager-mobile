import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import ApiCaller from '../../api/apiCaller';

// Import DEFAULT_ACTIVITIES from mobile validations
import { DEFAULT_ACTIVITIES } from '../../utils/validations';

const ActivitiesModal = ({ 
  isVisible, 
  onClose, 
  projectData, 
  userRole = 'consultant' 
}) => {
  const [activities, setActivities] = useState([]);
  const [isLoadingActivities, setIsLoadingActivities] = useState(true);
  const [changedActivities, setChangedActivities] = useState({ 
    toCreate: new Map(), 
    toUpdate: new Map() 
  });
  const [editingCell, setEditingCell] = useState(null);
  const [activeEditingDate, setActiveEditingDate] = useState(null);
  const [isUpdatingActivities, setIsUpdatingActivities] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [selectedActivityForStatus, setSelectedActivityForStatus] = useState(null);

  const isClientView = userRole === 'client';

  const formatDate = (dateString) => {
    if (!dateString || dateString === 'Not set') return 'Not set';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
      });
    } catch (error) {
      return dateString;
    }
  };

  const fetchAndProcessActivities = useCallback(async () => {
    if (!projectData?.fields?.['Project ID']) return;
    setIsLoadingActivities(true);
    setChangedActivities({ toCreate: new Map(), toUpdate: new Map() });
    
    try {
      const activityRecords = await ApiCaller(`/records/filter/${projectData.fields['Project ID']}/activities`);
      const fetchedActivities = Array.isArray(activityRecords?.records)
        ? activityRecords.records
        : Array.isArray(activityRecords)
          ? activityRecords
          : [];

      const fetchedActivitiesMap = new Map();
      fetchedActivities.forEach(act => {
        const apiName = act.fields.name?.trim();
        if (apiName) {
          fetchedActivitiesMap.set(apiName, act);
        }
      });

      const finalActivities = DEFAULT_ACTIVITIES.map((name, index) => {
        const existingActivity = fetchedActivitiesMap.get(name);
        if (existingActivity) {
          return existingActivity;
        } else {
          return {
            id: `default-${index}`,
            fields: {
              name: name,
              dueDate: 'Not set',
              status: 'Not started',
              completed: false,
            }
          };
        }
      });
      setActivities(finalActivities);

    } catch (error) {
      console.error("Failed to fetch or process activities:", error);
      const defaultList = DEFAULT_ACTIVITIES.map((name, index) => ({
        id: `default-error-${index}`,
        fields: {
          name: name,
          dueDate: 'Not set',
          status: 'Not started',
          completed: false,
        }
      }));
      setActivities(defaultList);
    } finally {
      setIsLoadingActivities(false);
    }
  }, [projectData]);

  useEffect(() => {
    if (isVisible && projectData) {
      fetchAndProcessActivities();
    }
  }, [isVisible, projectData, fetchAndProcessActivities]);

  const handleActivityChange = (activityId, field, value) => {
    if (isClientView) return; // Clients cannot edit

    const updatedActivities = activities.map(act => {
      if (act.id === activityId) {
        return { ...act, fields: { ...act.fields, [field]: value } };
      }
      return act;
    });
    setActivities(updatedActivities);

    const activity = updatedActivities.find(a => a.id === activityId);

    if (activity.id.startsWith('default-')) {
      setChangedActivities(prev => {
        const toCreate = new Map(prev.toCreate);
        const fields = { ...activity.fields, 'Project ID': [projectData.id] };
        if (fields.dueDate === 'Not set') {
          delete fields.dueDate;
        }
        toCreate.set(activity.id, { fields });
        return { ...prev, toCreate };
      });
    } else {
      setChangedActivities(prev => {
        const toUpdate = new Map(prev.toUpdate);
        const existingUpdate = toUpdate.get(activity.id) || { id: activity.id, fields: {} };
        existingUpdate.fields[field] = value;
        toUpdate.set(activity.id, existingUpdate);
        return { ...prev, toUpdate };
      });
    }
  };

  const handleSaveActivities = async () => {
    if (isClientView) return;

    setIsUpdatingActivities(true);
    try {
      const recordsToCreate = Array.from(changedActivities.toCreate.values());
      const recordsToUpdate = Array.from(changedActivities.toUpdate.values());

      // Clean up the data before sending (match web app logic)
      recordsToCreate.forEach(rec => {
        if (rec.fields.dueDate === 'Not set') {
          rec.fields.dueDate = null;
        }
      });

      // Use the exact same API structure as the web app
      const promises = [];
      if (recordsToCreate.length > 0) {
        console.log('Creating activities:', recordsToCreate);
        promises.push(ApiCaller('/records', {
          method: 'POST',
          body: JSON.stringify({ 
            recordsToCreate, 
            tableName: 'activities' 
          }),
        }));
      }
      if (recordsToUpdate.length > 0) {
        console.log('Updating activities:', recordsToUpdate);
        promises.push(ApiCaller('/records', {
          method: 'PATCH',
          body: JSON.stringify({ 
            recordsToUpdate, 
            tableName: 'activities' 
          }),
        }));
      }

      await Promise.all(promises);
      setChangedActivities({ toCreate: new Map(), toUpdate: new Map() });
      await fetchAndProcessActivities();
      Alert.alert('Success', 'Activities updated successfully!');
    } catch (error) {
      console.error('Failed to save activities:', error);
      Alert.alert('Error', 'Failed to save activities. Please try again.');
    } finally {
      setIsUpdatingActivities(false);
    }
  };

  const handleDateCellClick = (activity) => {
    if (isClientView) return;
    
    setEditingCell({ id: activity.id, field: 'dueDate' });
    const currentDate = activity.fields.dueDate === 'Not set' 
      ? new Date() 
      : new Date(activity.fields.dueDate);
    setActiveEditingDate(currentDate);
    setSelectedDate(currentDate);
    setShowDatePicker(true);
  };

  const handleDateChange = (event, selectedDate) => {
    setShowDatePicker(false);
    if (event.type === 'set' && selectedDate && editingCell) {
      const formattedDate = selectedDate.toISOString().split('T')[0];
      handleActivityChange(editingCell.id, 'dueDate', formattedDate);
      setEditingCell(null);
    }
  };

  const handleStatusCellClick = (activity) => {
    if (isClientView) return;
    setSelectedActivityForStatus(activity);
    setShowStatusModal(true);
  };

  const handleStatusSelect = (status) => {
    if (selectedActivityForStatus) {
      handleActivityChange(selectedActivityForStatus.id, 'status', status);
    }
    setShowStatusModal(false);
    setSelectedActivityForStatus(null);
  };

  const StatusBadge = ({ status }) => {
    const getStatusStyle = (status) => {
      switch (status?.toLowerCase()) {
        case 'completed':
        case 'finalized':
          return { backgroundColor: '#dcfce7', color: '#166534' };
        case 'in progress':
          return { backgroundColor: '#fef3c7', color: '#92400e' };
        case 'not started':
          return { backgroundColor: '#f1f5f9', color: '#475569' };
        case 'not applicable':
          return { backgroundColor: '#fef2f2', color: '#991b1b' };
        default:
          return { backgroundColor: '#f1f5f9', color: '#475569' };
      }
    };

    const style = getStatusStyle(status);
    return (
      <View style={[styles.statusBadge, { backgroundColor: style.backgroundColor }]}>
        <Text style={[styles.statusText, { color: style.color }]}>
          {status || 'N/A'}
        </Text>
      </View>
    );
  };

  const hasChanges = changedActivities.toCreate.size > 0 || changedActivities.toUpdate.size > 0;

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
          <Text style={styles.title}>Activities</Text>
          {!isClientView && hasChanges && (
            <TouchableOpacity
              onPress={handleSaveActivities}
              disabled={isUpdatingActivities}
              style={[styles.saveButton, isUpdatingActivities && styles.saveButtonDisabled]}
            >
              {isUpdatingActivities ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.saveButtonText}>Save</Text>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Content */}
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {isLoadingActivities ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#3B82F6" />
              <Text style={styles.loadingText}>Loading activities...</Text>
            </View>
          ) : (
            <View style={styles.activitiesContainer}>
              {activities.map((activity, index) => (
                <View key={activity.id} style={styles.activityCard}>
                  {/* Activity Header */}
                  <View style={styles.activityHeader}>
                    <Text style={styles.activityTitle} numberOfLines={0}>
                      {activity.fields.name}
                    </Text>
                    <TouchableOpacity
                      onPress={() => handleActivityChange(activity.id, 'completed', !activity.fields.completed)}
                      disabled={isClientView}
                      style={[
                        styles.checkbox,
                        activity.fields.completed && styles.checkboxChecked,
                        isClientView && styles.checkboxDisabled
                      ]}
                    >
                      {activity.fields.completed && (
                        <Ionicons name="checkmark" size={16} color="#ffffff" />
                      )}
                    </TouchableOpacity>
                  </View>

                  {/* Activity Details */}
                  <View style={styles.activityDetails}>
                    {/* Due Date */}
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Due Date:</Text>
                      <TouchableOpacity
                        style={styles.detailValueContainer}
                        onPress={() => handleDateCellClick(activity)}
                        disabled={isClientView}
                      >
                        {editingCell?.id === activity.id && editingCell?.field === 'dueDate' ? (
                          <Text style={styles.editingText}>Tap to select date</Text>
                        ) : (
                          <Text style={styles.detailValue}>{formatDate(activity.fields.dueDate)}</Text>
                        )}
                        {!isClientView && (
                          <Ionicons name="calendar-outline" size={16} color="#6B7280" style={styles.detailIcon} />
                        )}
                      </TouchableOpacity>
                    </View>

                    {/* Status */}
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Status:</Text>
                      <TouchableOpacity
                        style={styles.detailValueContainer}
                        onPress={() => handleStatusCellClick(activity)}
                        disabled={isClientView}
                      >
                        <StatusBadge status={activity.fields.status} />
                        {!isClientView && (
                          <Ionicons name="chevron-down" size={16} color="#6B7280" style={styles.detailIcon} />
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}
        </ScrollView>

        {/* Date Picker Modal */}
        {showDatePicker && (
          <Modal
            transparent={true}
            animationType="fade"
            visible={showDatePicker}
            onRequestClose={() => setShowDatePicker(false)}
          >
            <TouchableOpacity 
              style={styles.datePickerOverlay}
              activeOpacity={1}
              onPress={() => setShowDatePicker(false)}
            >
              <TouchableOpacity 
                style={styles.datePickerContainer}
                activeOpacity={1}
                onPress={(e) => e.stopPropagation()}
              >
                <View style={styles.datePickerHeader}>
                  <Text style={styles.datePickerTitle}>Select Due Date</Text>
                  <TouchableOpacity
                    onPress={() => setShowDatePicker(false)}
                    style={styles.datePickerCloseButton}
                  >
                    <Ionicons name="close" size={24} color="#6B7280" />
                  </TouchableOpacity>
                </View>
                <DateTimePicker
                  value={selectedDate}
                  mode="date"
                  display="default"
                  onChange={handleDateChange}
                  style={styles.datePicker}
                />
                <View style={styles.datePickerActions}>
                  <TouchableOpacity
                    onPress={() => setShowDatePicker(false)}
                    style={styles.datePickerCancelButton}
                  >
                    <Text style={styles.datePickerCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      if (editingCell) {
                        handleActivityChange(editingCell.id, 'dueDate', 'Not set');
                        setEditingCell(null);
                      }
                      setShowDatePicker(false);
                    }}
                    style={styles.datePickerClearButton}
                  >
                    <Text style={styles.datePickerClearText}>Clear</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      if (editingCell) {
                        const formattedDate = selectedDate.toISOString().split('T')[0];
                        handleActivityChange(editingCell.id, 'dueDate', formattedDate);
                        setEditingCell(null);
                      }
                      setShowDatePicker(false);
                    }}
                    style={styles.datePickerConfirmButton}
                  >
                    <Text style={styles.datePickerConfirmText}>Confirm</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            </TouchableOpacity>
          </Modal>
        )}

        {/* Status Selection Modal */}
        <Modal
          visible={showStatusModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowStatusModal(false)}
        >
          <View style={styles.statusModalOverlay}>
            <View style={styles.statusModalContent}>
              <Text style={styles.statusModalTitle}>Select Status</Text>
              <Text style={styles.statusModalSubtitle}>
                {selectedActivityForStatus?.fields?.name}
              </Text>
              
              <View style={styles.statusOptionsContainer}>
                <TouchableOpacity
                  style={styles.statusOptionButton}
                  onPress={() => handleStatusSelect('Not started')}
                >
                  <Text style={styles.statusOptionText}>Not started</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.statusOptionButton}
                  onPress={() => handleStatusSelect('In progress')}
                >
                  <Text style={styles.statusOptionText}>In progress</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.statusOptionButton}
                  onPress={() => handleStatusSelect('Finalized')}
                >
                  <Text style={styles.statusOptionText}>Finalized</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.statusOptionButton}
                  onPress={() => handleStatusSelect('Not Applicable')}
                >
                  <Text style={styles.statusOptionText}>Not Applicable</Text>
                </TouchableOpacity>
              </View>
              
              <TouchableOpacity
                style={styles.statusModalCancelButton}
                onPress={() => setShowStatusModal(false)}
              >
                <Text style={styles.statusModalCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
  },
  closeButton: {
    padding: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  saveButton: {
    backgroundColor: '#10b981',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  saveButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6b7280',
  },
  activitiesContainer: {
    padding: 16,
  },
  activityCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  activityTitle: {
    fontSize: 16,
    color: '#111827',
    fontWeight: '600',
    lineHeight: 24,
    flex: 1,
    marginRight: 12,
  },
  activityDetails: {
    gap: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
    flex: 1,
  },
  detailValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'flex-end',
  },
  detailValue: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  detailIcon: {
    marginLeft: 8,
  },
  editingText: {
    fontSize: 14,
    color: '#3b82f6',
    fontWeight: '500',
  },
  statusModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  statusModalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  statusModalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
  },
  statusModalSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  statusOptionsContainer: {
    marginBottom: 24,
  },
  statusOptionButton: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  statusOptionText: {
    fontSize: 16,
    color: '#374151',
    fontWeight: '500',
    textAlign: 'center',
  },
  statusModalCancelButton: {
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  statusModalCancelText: {
    fontSize: 16,
    color: '#6b7280',
    fontWeight: '500',
    textAlign: 'center',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    alignSelf: 'center',
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: '#d1d5db',
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#10b981',
    borderColor: '#10b981',
  },
  checkboxDisabled: {
    opacity: 0.5,
  },
  datePickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  datePickerContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  datePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  datePickerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  datePickerCloseButton: {
    padding: 4,
  },
  datePicker: {
    alignSelf: 'center',
    marginBottom: 20,
  },
  datePickerActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  datePickerCancelButton: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  datePickerCancelText: {
    fontSize: 16,
    color: '#6b7280',
    fontWeight: '500',
  },
  datePickerClearButton: {
    flex: 1,
    backgroundColor: '#fef3c7',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  datePickerClearText: {
    fontSize: 16,
    color: '#d97706',
    fontWeight: '500',
  },
  datePickerConfirmButton: {
    flex: 1,
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  datePickerConfirmText: {
    fontSize: 16,
    color: '#ffffff',
    fontWeight: '500',
  },
});

export default ActivitiesModal;
