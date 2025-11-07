import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  StyleSheet, 
  TouchableOpacity, 
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
  FlatList,
  Image,
  Dimensions,
  SafeAreaView,
  Platform,
  StatusBar,
  Linking
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import SignatureScreen from 'react-native-signature-canvas';
import * as DocumentPicker from 'expo-document-picker';
import io from 'socket.io-client';
import ApiCaller from '../../api/apiCaller';
import { useAuth } from '../../utils/AuthContext';
import RichTextRenderer from '../../components/RichTextRenderer';
import { loadContent } from '../../utils/contentUtils';
import AddAttachmentModal from '../../components/modals/AddAttachmentModal';
import QuickPromptsSection from '../../components/QuickPromptsSection';

// Add Checklist Modal Component
function AddChecklistModal({ visible, onClose, taskId, onChecklistAdded }) {
  const [checklistItems, setChecklistItems] = useState(['']);
  const [loading, setLoading] = useState(false);

  const addItem = () => {
    setChecklistItems([...checklistItems, '']);
  };

  const removeItem = (index) => {
    if (checklistItems.length > 1) {
      setChecklistItems(checklistItems.filter((_, i) => i !== index));
    }
  };

  const updateItem = (index, value) => {
    const newItems = [...checklistItems];
    newItems[index] = value;
    setChecklistItems(newItems);
  };

  const handleSubmit = async () => {
    const validItems = checklistItems.filter(item => item.trim());
    if (validItems.length === 0) {
      Alert.alert('Error', 'Please add at least one checklist item.');
      return;
    }

    setLoading(true);
    try {
      const recordsToCreate = validItems.map((item, index) => ({
        fields: {
          task_id: [taskId],
          checklist_description: item.trim(),
          order_number: index + 1,
          completed: false,
        },
      }));

      await ApiCaller('/records', {
        method: 'POST',
        body: JSON.stringify({
          recordsToCreate,
          tableName: 'task_checklists',
        }),
      });

      onChecklistAdded();
      Alert.alert('Success', 'Checklist items added successfully!');
    } catch (error) {
      console.error('Error adding checklist:', error);
      Alert.alert('Error', 'Failed to add checklist items. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose} style={styles.modalCloseButton}>
            <Text style={styles.modalCloseButtonText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Add Checklist Items</Text>
          <TouchableOpacity onPress={handleSubmit} style={styles.modalSaveButton} disabled={loading}>
            <Text style={[styles.modalSaveButtonText, loading && styles.disabledText]}>
              {loading ? 'Adding...' : 'Save'}
            </Text>
          </TouchableOpacity>
        </View>
        
        <ScrollView style={styles.modalContent}>
          <Text style={styles.modalDescription}>
            Add checklist items for this task. Each item will appear as a checkbox that can be marked as complete.
          </Text>
          
          {checklistItems.map((item, index) => (
            <View key={index} style={styles.checklistItemRow}>
              <TextInput
                style={styles.checklistItemInput}
                placeholder={`Checklist item ${index + 1}`}
                value={item}
                onChangeText={(text) => updateItem(index, text)}
                multiline
              />
              {checklistItems.length > 1 && (
                <TouchableOpacity onPress={() => removeItem(index)} style={styles.removeItemButton}>
                  <Ionicons name="trash-outline" size={20} color="#EF4444" />
                </TouchableOpacity>
              )}
            </View>
          ))}
          
          <TouchableOpacity onPress={addItem} style={styles.addItemButton}>
            <Ionicons name="add-circle-outline" size={20} color="#3B82F6" />
            <Text style={styles.addItemButtonText}>Add Another Item</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// Add Attachment Placeholder Modal Component (for creating attachment descriptions only)
function AddAttachmentPlaceholderModal({ visible, onClose, taskId, onAttachmentAdded }) {
  const [descriptions, setDescriptions] = useState(['']);
  const [loading, setLoading] = useState(false);

  const addDescription = () => {
    setDescriptions([...descriptions, '']);
  };

  const removeDescription = (index) => {
    if (descriptions.length > 1) {
      setDescriptions(descriptions.filter((_, i) => i !== index));
    }
  };

  const updateDescription = (index, value) => {
    const newDescriptions = [...descriptions];
    newDescriptions[index] = value;
    setDescriptions(newDescriptions);
  };

  const handleSubmit = async () => {
    const validDescriptions = descriptions.filter(desc => desc.trim());
    if (validDescriptions.length === 0) {
      Alert.alert('Error', 'Please add at least one attachment description.');
      return;
    }

    setLoading(true);
    try {
      const recordsToCreate = validDescriptions.map(desc => ({
        fields: {
          task_id: [taskId],
          attachment_description: desc.trim(),
        },
      }));

      await ApiCaller('/records', {
        method: 'POST',
        body: JSON.stringify({
          recordsToCreate,
          tableName: 'task_attachments',
        }),
      });

      onAttachmentAdded();
      Alert.alert('Success', 'Attachment placeholders created successfully! You can now upload files to them.');
    } catch (error) {
      console.error('Error adding attachments:', error);
      Alert.alert('Error', 'Failed to add attachments. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose} style={styles.modalCloseButton}>
            <Text style={styles.modalCloseButtonText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Add Attachments</Text>
          <TouchableOpacity onPress={handleSubmit} style={styles.modalSaveButton} disabled={loading}>
            <Text style={[styles.modalSaveButtonText, loading && styles.disabledText]}>
              {loading ? 'Adding...' : 'Save'}
            </Text>
          </TouchableOpacity>
        </View>
        
        <ScrollView style={styles.modalContent}>
          <Text style={styles.modalDescription}>
            Create attachment placeholders for this task. After saving, you can upload files to each attachment.
          </Text>
          
          {descriptions.map((desc, index) => (
            <View key={index} style={styles.attachmentItemRow}>
              <TextInput
                style={styles.attachmentItemInput}
                placeholder={`Attachment description ${index + 1}`}
                value={desc}
                onChangeText={(text) => updateDescription(index, text)}
                multiline
              />
              {descriptions.length > 1 && (
                <TouchableOpacity onPress={() => removeDescription(index)} style={styles.removeItemButton}>
                  <Ionicons name="trash-outline" size={20} color="#EF4444" />
                </TouchableOpacity>
              )}
            </View>
          ))}
          
          <TouchableOpacity onPress={addDescription} style={styles.addItemButton}>
            <Ionicons name="add-circle-outline" size={20} color="#3B82F6" />
            <Text style={styles.addItemButtonText}>Add Another Attachment</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// Add Approval Modal Component
function AddApprovalModal({ visible, onClose, taskId, onApprovalAdded }) {
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!description.trim()) {
      Alert.alert('Error', 'Please provide an approval description.');
      return;
    }

    setLoading(true);
    try {
      await ApiCaller('/records', {
        method: 'POST',
        body: JSON.stringify({
          recordsToCreate: [{
            fields: {
              task_id: [taskId],
              approval_description: description.trim(),
            }
          }],
          tableName: 'task_approval',
        }),
      });

      onApprovalAdded();
      Alert.alert('Success', 'Approval added successfully!');
    } catch (error) {
      console.error('Error adding approval:', error);
      Alert.alert('Error', 'Failed to add approval. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose} style={styles.modalCloseButton}>
            <Text style={styles.modalCloseButtonText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Add Approval</Text>
          <TouchableOpacity onPress={handleSubmit} style={styles.modalSaveButton} disabled={loading}>
            <Text style={[styles.modalSaveButtonText, loading && styles.disabledText]}>
              {loading ? 'Adding...' : 'Save'}
            </Text>
          </TouchableOpacity>
        </View>
        
        <ScrollView style={styles.modalContent}>
          <Text style={styles.modalDescription}>
            Add an approval requirement for this task. The approval will appear in the approvals section where signatures can be collected.
          </Text>
          
          <View style={styles.approvalInputContainer}>
            <Text style={styles.inputLabel}>Approval Description</Text>
            <TextInput
              style={styles.approvalTextInput}
              placeholder="Describe what needs to be approved..."
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// Add Forms Modal Component
function AddFormsModal({ visible, onClose, taskId, onFormAdded }) {
  const [forms, setForms] = useState([]);
  const [selectedForm, setSelectedForm] = useState('');
  const [loading, setLoading] = useState(false);
  const [isLoadingForms, setIsLoadingForms] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Fetch available forms
  useEffect(() => {
    const fetchForms = async () => {
      try {
        const data = await ApiCaller('/all/task_forms');
        setForms(data || []);
      } catch (error) {
        console.error('Error fetching forms:', error);
        Alert.alert('Error', 'Failed to load forms. Please try again.');
      } finally {
        setIsLoadingForms(false);
      }
    };

    if (visible) {
      fetchForms();
    }
  }, [visible]);

  const handleAttach = async () => {
    if (selectedForm === 'create_new') {
      setShowCreateForm(true);
      return;
    }

    if (!selectedForm) {
      Alert.alert('Error', 'Please select a form to attach.');
      return;
    }

    setLoading(true);
    try {
      const formToAttach = forms.find(form => form.id === selectedForm);
      if (!formToAttach) {
        Alert.alert('Error', 'Selected form not found.');
        return;
      }

      // Get form fields
      const fieldIds = formToAttach.fields.task_forms_fields;
      if (!Array.isArray(fieldIds) || fieldIds.length === 0) {
        Alert.alert('Error', 'This form has no fields linked to it and cannot be attached.');
        return;
      }

      // Fetch the full field records
      const formFieldsResponse = await ApiCaller('/records/by-ids', {
        method: 'POST',
        body: JSON.stringify({
          recordIds: fieldIds,
          tableName: 'task_forms_fields'
        }),
      });
      const formFields = formFieldsResponse.records;

      if (!formFields || formFields.length === 0) {
        Alert.alert('Error', 'Could not fetch the details for the form fields.');
        return;
      }

      // Create a unique submission ID
      const submissionId = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Create submission records for each field
      const recordsToCreate = formFields.map(field => ({
        fields: {
          submission_id: submissionId,
          form: [formToAttach.id],
          field: [field.id],
          task_id: [taskId],
          value: '--EMPTY--',
        }
      }));

      await ApiCaller('/records', {
        method: 'POST',
        body: JSON.stringify({
          recordsToCreate,
          tableName: 'task_forms_submissions'
        })
      });

      onFormAdded();
      Alert.alert('Success', 'Form attached successfully!');
    } catch (error) {
      console.error('Error attaching form:', error);
      Alert.alert('Error', 'Failed to attach form. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (showCreateForm) {
    return (
      <CreateNewFormModal
        visible={showCreateForm}
        onClose={() => setShowCreateForm(false)}
        onFormCreated={(newForm) => {
          setShowCreateForm(false);
          // Attach the newly created form
          setSelectedForm(newForm.id);
          handleAttach();
        }}
      />
    );
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose} style={styles.modalCloseButton}>
            <Text style={styles.modalCloseButtonText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Attach a Form</Text>
          <TouchableOpacity onPress={handleAttach} style={styles.modalSaveButton} disabled={loading || !selectedForm}>
            <Text style={[styles.modalSaveButtonText, (loading || !selectedForm) && styles.disabledText]}>
              {loading ? 'Attaching...' : 'Attach'}
            </Text>
          </TouchableOpacity>
        </View>
        
        <ScrollView style={styles.modalContent}>
          <Text style={styles.modalDescription}>
            Select an existing form to attach to this task, or create a new form.
          </Text>
          
          {isLoadingForms ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#3B82F6" />
              <Text style={styles.loadingText}>Loading forms...</Text>
            </View>
          ) : (
            <View style={styles.formSelectionContainer}>
              <Text style={styles.inputLabel}>Select a Form</Text>
              <View style={styles.formPickerContainer}>
                <TouchableOpacity 
                  style={styles.formPickerButton}
                  onPress={() => {
                    // Show form selection modal
                    Alert.alert(
                      'Select Form',
                      'Choose a form to attach',
                      [
                        ...forms.map(form => ({
                          text: form.fields.form_name,
                          onPress: () => setSelectedForm(form.id)
                        })),
                        {
                          text: 'Create New Form',
                          onPress: () => setSelectedForm('create_new')
                        },
                        { text: 'Cancel', style: 'cancel' }
                      ]
                    );
                  }}
                >
                  <Text style={styles.formPickerText}>
                    {selectedForm === 'create_new' 
                      ? '-- Create a new form --'
                      : selectedForm 
                        ? forms.find(f => f.id === selectedForm)?.fields.form_name || 'Select a form'
                        : 'Select a form'
                    }
                  </Text>
                  <Ionicons name="chevron-down" size={20} color="#6B7280" />
                </TouchableOpacity>
              </View>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// Create New Form Modal Component
function CreateNewFormModal({ visible, onClose, onFormCreated }) {
  const [formName, setFormName] = useState('');
  const [fields, setFields] = useState([
    { id: `field_${Date.now()}_1`, field_label: '', field_type: 'Single line text' }
  ]);
  const [loading, setLoading] = useState(false);

  const addField = () => {
    setFields([...fields, { 
      id: `field_${Date.now()}_${fields.length + 1}`, 
      field_label: '', 
      field_type: 'Single line text' 
    }]);
  };

  const removeField = (id) => {
    if (fields.length > 1) {
      setFields(fields.filter(field => field.id !== id));
    }
  };

  const updateField = (id, field, value) => {
    setFields(fields.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  const handleSubmit = async () => {
    if (!formName.trim()) {
      Alert.alert('Error', 'Form name is required.');
      return;
    }

    if (fields.some(field => !field.field_label.trim())) {
      Alert.alert('Error', 'All field labels are required.');
      return;
    }

    setLoading(true);
    try {
      // Create the form
      const formResponse = await ApiCaller('/records', {
        method: 'POST',
        body: JSON.stringify({
          recordsToCreate: [{
            fields: {
              form_name: formName.trim(),
            }
          }],
          tableName: 'task_forms',
        }),
      });

      const newForm = formResponse.records[0];

      // Create form fields
      const fieldRecords = fields.map(field => ({
        fields: {
          field_label: field.field_label.trim(),
          field_type: field.field_type,
          form: [newForm.id],
        }
      }));

      const fieldsResponse = await ApiCaller('/records', {
        method: 'POST',
        body: JSON.stringify({
          recordsToCreate: fieldRecords,
          tableName: 'task_forms_fields',
        }),
      });

      const newFields = fieldsResponse.records;

      // Update the form with field references
      await ApiCaller(`/records/task_forms/${newForm.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          fields: {
            task_forms_fields: newFields.map(field => field.id),
          }
        }),
      });

      onFormCreated(newForm);
      Alert.alert('Success', 'Form created successfully!');
    } catch (error) {
      console.error('Error creating form:', error);
      Alert.alert('Error', 'Failed to create form. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose} style={styles.modalCloseButton}>
            <Text style={styles.modalCloseButtonText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Create New Form</Text>
          <TouchableOpacity onPress={handleSubmit} style={styles.modalSaveButton} disabled={loading}>
            <Text style={[styles.modalSaveButtonText, loading && styles.disabledText]}>
              {loading ? 'Creating...' : 'Create'}
            </Text>
          </TouchableOpacity>
        </View>
        
        <ScrollView style={styles.modalContent}>
          <Text style={styles.modalDescription}>
            Create a new form with custom fields for this task.
          </Text>
          
          <View style={styles.formInputContainer}>
            <Text style={styles.inputLabel}>Form Name</Text>
            <TextInput
              style={styles.formNameInput}
              placeholder="Enter form name..."
              value={formName}
              onChangeText={setFormName}
            />
          </View>

          <View style={styles.fieldsContainer}>
            <Text style={styles.inputLabel}>Form Fields</Text>
            {fields.map((field, index) => (
              <View key={field.id} style={styles.fieldRow}>
                <View style={styles.fieldInputs}>
                  <TextInput
                    style={styles.fieldLabelInput}
                    placeholder={`Field ${index + 1} label`}
                    value={field.field_label}
                    onChangeText={(text) => updateField(field.id, 'field_label', text)}
                  />
                  <TouchableOpacity 
                    style={styles.fieldTypeButton}
                    onPress={() => {
                      Alert.alert(
                        'Field Type',
                        'Select field type',
                        [
                          { text: 'Single line text', onPress: () => updateField(field.id, 'field_type', 'Single line text') },
                          { text: 'Multi-line text', onPress: () => updateField(field.id, 'field_type', 'Multi-line text') },
                          { text: 'Number', onPress: () => updateField(field.id, 'field_type', 'Number') },
                          { text: 'Date', onPress: () => updateField(field.id, 'field_type', 'Date') },
                          { text: 'Cancel', style: 'cancel' }
                        ]
                      );
                    }}
                  >
                    <Text style={styles.fieldTypeText}>{field.field_type}</Text>
                    <Ionicons name="chevron-down" size={16} color="#6B7280" />
                  </TouchableOpacity>
                </View>
                {fields.length > 1 && (
                  <TouchableOpacity onPress={() => removeField(field.id)} style={styles.removeFieldButton}>
                    <Ionicons name="trash-outline" size={20} color="#EF4444" />
                  </TouchableOpacity>
                )}
              </View>
            ))}
            
            <TouchableOpacity onPress={addField} style={styles.addFieldButton}>
              <Ionicons name="add-circle-outline" size={20} color="#3B82F6" />
              <Text style={styles.addFieldButtonText}>Add Field</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

export default function TaskDetailsScreen({ task, onClose, onTaskUpdate, isClientView = false, isEditable = false }) {
  const { currentUser } = useAuth();
  const [taskData, setTaskData] = useState(task);
  const [loading, setLoading] = useState(false);
  const [projectData, setProjectData] = useState(null);
  const [assigneeOptions, setAssigneeOptions] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [checklistItems, setChecklistItems] = useState([]);
  const [initialChecklistItems, setInitialChecklistItems] = useState([]); // For locking
  const [formSubmissions, setFormSubmissions] = useState([]);
  const [initialFormSubmissions, setInitialFormSubmissions] = useState([]); // For tracking changes
  const [approvals, setApprovals] = useState([]);
  const [loadingAttachments, setLoadingAttachments] = useState(true);
  const [loadingChecklist, setLoadingChecklist] = useState(true);
  const [loadingForms, setLoadingForms] = useState(true);
  const [loadingApprovals, setLoadingApprovals] = useState(true);
  
  // Description content state
  const [descriptionContent, setDescriptionContent] = useState(null);
  const [loadingDescription, setLoadingDescription] = useState(true);
  
  // Permission check - clients can only edit if task is assigned to them
  const canEdit = !isClientView || isEditable;
  
  // Client-specific locking rules
  const isChecklistLockedForClient = useMemo(() => {
    return isClientView && initialChecklistItems.some(item => item.completed);
  }, [isClientView, initialChecklistItems]);

  const isFormLockedForClient = useMemo(() => {
    return isClientView && formSubmissions.length > 0 && 
      formSubmissions.some(sub => sub.fields.submission === 'Completed' || sub.fields.submission === 'Updated');
  }, [isClientView, formSubmissions]);

  // Group form submissions by submission_id
  const groupedForms = useMemo(() => {
    const formsMap = new Map();
    formSubmissions.forEach(submission => {
      const submissionId = submission.fields.submission_id;
      if (!formsMap.has(submissionId)) {
        formsMap.set(submissionId, []);
      }
      formsMap.get(submissionId).push(submission);
    });
    return Array.from(formsMap.entries());
  }, [formSubmissions]);
  
  // Edit mode states
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedFields, setEditedFields] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [showPicker, setShowPicker] = useState(null); // 'status', 'priority', 'assignee', 'actionType', or null
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  
  // Signature modal states
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [currentApproval, setCurrentApproval] = useState(null);
  const [signatureImage, setSignatureImage] = useState(null);
  const signatureRef = useRef(null);
  
  // File upload states
  const [uploadingAttachmentId, setUploadingAttachmentId] = useState(null);
  
  // WebSocket integration
  const socketRef = useRef(null);
  const [refetchCounter, setRefetchCounter] = useState(0);
  const forceRefetch = () => setRefetchCounter(c => c + 1);
  
  // Add Task Fields modal states
  const [showAddChecklistModal, setShowAddChecklistModal] = useState(false);
  const [showAddAttachmentModal, setShowAddAttachmentModal] = useState(false);
  const [showAddApprovalModal, setShowAddApprovalModal] = useState(false);
  const [showAddFormsModal, setShowAddFormsModal] = useState(false);
  
  // Add New Attachment modal state
  const [showAddNewAttachmentModal, setShowAddNewAttachmentModal] = useState(false);

  // Initialize edited fields when entering edit mode
  useEffect(() => {
    if (isEditMode && task?.fields) {
      setEditedFields({
        task_status: task.fields.task_status || 'Not Started',
        due_date: task.fields.due_date || '',
        assigned_to: task.fields.assigned_to || '',
        Action_type: task.fields.Action_type || 'Default',
        // task_description: removed - descriptions are read-only in mobile app
      });
    }
  }, [isEditMode, task]);

  const handleFieldChange = (field, value) => {
    setEditedFields(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleDateChange = (event, selectedDate) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate && selectedDate instanceof Date) {
      const formattedDate = selectedDate.toISOString().split('T')[0]; // YYYY-MM-DD format
      handleFieldChange('due_date', formattedDate);
    }
  };

  const handleConfirmDate = () => {
    if (selectedDate && selectedDate instanceof Date) {
      const formattedDate = selectedDate.toISOString().split('T')[0]; // YYYY-MM-DD format
      handleFieldChange('due_date', formattedDate);
    }
    setShowDatePicker(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Description editing disabled in mobile app - descriptions are read-only

      // Update the task with edited fields (excluding description - saved as attachment)
      // Only send fields that exist in Airtable and match the web app
      // Filter out empty values and only send fields that have been changed
      const updatableFields = {};
      
      if (editedFields.assigned_to !== undefined && editedFields.assigned_to !== task.fields.assigned_to) {
        updatableFields.assigned_to = editedFields.assigned_to || null;
      }
      
      if (editedFields.task_status !== undefined && editedFields.task_status !== task.fields.task_status) {
        updatableFields.task_status = editedFields.task_status;
      }
      
      if (editedFields.due_date !== undefined && editedFields.due_date !== task.fields.due_date) {
        updatableFields.due_date = editedFields.due_date || null;
      }
      
      if (editedFields.Action_type !== undefined && editedFields.Action_type !== task.fields.Action_type) {
        updatableFields.Action_type = editedFields.Action_type;
      }

      console.log('Sending task update with fields:', updatableFields);
      console.log('Task ID:', task.id);
      console.log('Original task fields:', task.fields);

      // Only send update if there are fields to update
      if (Object.keys(updatableFields).length > 0) {
        await ApiCaller(`/records/tasks/${task.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ fields: updatableFields }),
        });
      } else {
        console.log('No fields to update, skipping task update');
      }

      // Update form submissions if any were edited
      const formUpdates = [];
      const modifiedSubmissionIds = new Set();
      
      Object.keys(editedFields).forEach(key => {
        if (key.startsWith('form_')) {
          const formId = key.replace('form_', '');
          
          // Find the form submission to get its submission_id and current status
          const formSubmission = formSubmissions.find(f => f.id === formId);
          if (formSubmission) {
            modifiedSubmissionIds.add(formSubmission.fields.submission_id);
            
            formUpdates.push({
              id: formId,
              fields: {
                value: editedFields[key],
                submission: formSubmission.fields.submission=='Incomplete' ? 'Completed' : 'Updated'
              }
            });
          }
        }
      });

      if (formUpdates.length > 0) {
        // Update form field values
        await ApiCaller('/records', {
          method: 'PATCH',
          body: JSON.stringify({
            recordsToUpdate: formUpdates,
            tableName: 'task_forms_submissions'
          })
        });

        // Update submission status for each modified form
        const statusUpdates = [];
        modifiedSubmissionIds.forEach(submissionId => {
          // Find all fields with this submission_id to get current status
          const fieldsInSubmission = formSubmissions.filter(f => f.fields.submission_id === submissionId);
          if (fieldsInSubmission.length > 0) {
            const currentStatus = fieldsInSubmission[0].fields.submission;
            let newStatus = currentStatus;
            
            // Determine new status based on current status
            if (currentStatus === 'Incomplete') {
              newStatus = 'Completed';
            } else if (currentStatus === 'Completed') {
              newStatus = 'Updated';
            }
            // If already 'Updated', keep it as 'Updated'
            
            // Update all fields in this submission with the new status
            fieldsInSubmission.forEach(field => {
              statusUpdates.push({
                id: field.id,
                fields: {
                  submission: newStatus
                }
              });
            });
          }
        });

        if (statusUpdates.length > 0) {
          await ApiCaller('/records', {
            method: 'PATCH',
            body: JSON.stringify({
              recordsToUpdate: statusUpdates,
              tableName: 'task_forms_submissions'
            })
          });
        }
      }

      // Emit real-time updates
      if (socketRef.current) {
        // Emit task update
        if (Object.keys(updatableFields).length > 0) {
          socketRef.current.emit('taskUpdate', {
            projectId: task.fields['Project ID (from project_id)']?.[0] || task.fields.project_id?.[0],
            taskId: task.id,
            updateType: 'task_updated',
            data: updatableFields,
            userId: 'unknown'
          });
        }

        // Emit form updates
        if (formUpdates.length > 0) {
          formUpdates.forEach(update => {
            socketRef.current.emit('formUpdated', {
              taskId: task.id,
              submissionId: update.id,
              value: update.fields.value,
              userId: 'unknown'
            });
          });
        }
      }

      Alert.alert('Success', 'Task updated successfully!');
      
      // Refresh the description content to show the updated rich text
      await fetchDescriptionContent();
      
      setIsEditMode(false);
      
      // Refresh task data
      if (onTaskUpdate) {
        onTaskUpdate();
      }
    } catch (error) {
      console.error('Error saving task:', error);
      Alert.alert('Error', 'Failed to save task changes. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setIsEditMode(false);
    setEditedFields({});
  };

  // Delete handlers
  const handleDeleteTask = () => {
    Alert.alert(
      'Delete Task',
      'Are you sure you want to delete this task? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await ApiCaller('/records/tasks', {
                method: 'DELETE',
                body: JSON.stringify({
                  recordIds: [task.id]
                })
              });
              
              Alert.alert('Success', 'Task deleted successfully!');
              onTaskUpdate(); // This will close the modal and refresh the task list
            } catch (error) {
              console.error('Error deleting task:', error);
              Alert.alert('Error', 'Failed to delete task. Please try again.');
            }
          }
        }
      ]
    );
  };

  const handleDeleteChecklistItem = (itemId) => {
    Alert.alert(
      'Delete Checklist Item',
      'Are you sure you want to delete this checklist item? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await ApiCaller('/records/task_checklists', {
                method: 'DELETE',
                body: JSON.stringify({ recordIds: [itemId] })
              });
              
              // Remove from local state
              setChecklistItems(prev => prev.filter(item => item.id !== itemId));
              setInitialChecklistItems(prev => prev.filter(item => item.id !== itemId));
              
              Alert.alert('Success', 'Checklist item deleted successfully!');
            } catch (error) {
              console.error('Error deleting checklist item:', error);
              Alert.alert('Error', 'Failed to delete checklist item. Please try again.');
            }
          }
        }
      ]
    );
  };

  const handleDeleteForm = (submissionId) => {
    // Find all submissions with the same submission_id (same form)
    const formToDelete = formSubmissions.find(sub => sub.id === submissionId);
    if (!formToDelete) return;

    const submissionIdToDelete = formToDelete.fields.submission_id;
    const formsToDelete = formSubmissions.filter(sub => sub.fields.submission_id === submissionIdToDelete);

    Alert.alert(
      'Delete Form',
      `Are you sure you want to delete this entire form? This will remove ${formsToDelete.length} form fields and cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const recordIds = formsToDelete.map(sub => sub.id);
              await ApiCaller('/records/task_forms_submissions', {
                method: 'DELETE',
                body: JSON.stringify({ recordIds })
              });
              
              // Remove all form submissions for this form
              setFormSubmissions(prev => prev.filter(sub => sub.fields.submission_id !== submissionIdToDelete));
              setInitialFormSubmissions(prev => prev.filter(sub => sub.fields.submission_id !== submissionIdToDelete));
              
              Alert.alert('Success', 'Form deleted successfully!');
            } catch (error) {
              console.error('Error deleting form:', error);
              Alert.alert('Error', 'Failed to delete form. Please try again.');
            }
          }
        }
      ]
    );
  };

  const handleDeleteAttachment = (attachmentId) => {
    Alert.alert(
      'Delete Attachment',
      'Are you sure you want to delete this attachment? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await ApiCaller('/records/task_attachments', {
                method: 'DELETE',
                body: JSON.stringify({ recordIds: [attachmentId] })
              });
              
              // Remove from local state
              setAttachments(prev => prev.filter(att => att.id !== attachmentId));
              
              Alert.alert('Success', 'Attachment deleted successfully!');
            } catch (error) {
              console.error('Error deleting attachment:', error);
              Alert.alert('Error', 'Failed to delete attachment. Please try again.');
            }
          }
        }
      ]
    );
  };

  // Handle new attachment added
  const handleNewAttachmentAdded = (newAttachment) => {
    // Add the new attachment to the local state
    setAttachments(prev => [...prev, newAttachment]);
    
    // Update the parent task's task_attachments field array
    if (onTaskUpdate && task?.id) {
      onTaskUpdate(prevTask => {
        const existingAttachmentIds = prevTask.fields?.task_attachments || [];
        return {
          ...prevTask,
          fields: {
            ...prevTask.fields,
            task_attachments: [...existingAttachmentIds, newAttachment.id]
          }
        };
      });
    }
    
    // Emit real-time update for new attachment
    if (socketRef.current) {
      socketRef.current.emit('attachmentUpdated', {
        taskId: task.id,
        attachmentId: 'new_attachments',
        attachmentData: [newAttachment],
        userId: 'unknown'
      });
    }
    
    // Refetch attachments to ensure consistency
    fetchAttachments();
  };

  const handleDeleteApproval = (approvalId) => {
    Alert.alert(
      'Delete Approval',
      'Are you sure you want to delete this approval? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await ApiCaller('/records/task_approval', {
                method: 'DELETE',
                body: JSON.stringify({ recordIds: [approvalId] })
              });
              
              // Remove from local state
              setApprovals(prev => prev.filter(approval => approval.id !== approvalId));
              
              Alert.alert('Success', 'Approval deleted successfully!');
            } catch (error) {
              console.error('Error deleting approval:', error);
              Alert.alert('Error', 'Failed to delete approval. Please try again.');
            }
          }
        }
      ]
    );
  };
  
  // File upload handling
  const handleFileUpload = async (attachment) => {
    // Check permissions
    if (!canEdit) {
      Alert.alert('Permission Denied', 'You do not have permission to upload files to this task.');
      return;
    }
    console.log('attachment.fields.Attachments:', attachment.fields.Attachments? true : false);
    // For consultants, if a file exists, ask for confirmation before replacing
    const hasExisting = attachment.fields.Attachments? true : false;
    // console.log('attachment.fields.Attachments:', attachment.fields.Attachments);
    // console.log('attachment.fields.Attachments.length:', attachment.fields.Attachments.length);
    console.log('hasExisting:', hasExisting);
    console.log('isClientView:', isClientView);

    if ( hasExisting) {
        console.log('hasExisting: true bleh');
      Alert.alert(
        'Replace File',
        `Are you sure you want to replace "${attachment.fields.Attachments[0].filename}"? This action cannot be undone.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Replace', style: 'destructive', onPress: () => pickAndUploadFile(attachment, hasExisting) }
        ]
      );
    } else {
      pickAndUploadFile(attachment, hasExisting);
    }
  };
  
  const pickAndUploadFile = async (attachment, hasExisting) => {
    try {
      // Pick a document
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });
      
      if (result.canceled) {
        return;
      }
      
      const file = result.assets[0];
      
      console.log('Selected file details:', {
        uri: file.uri,
        name: file.name,
        mimeType: file.mimeType,
        size: file.size
      });
      
      console.log('Task object structure:', {
        'task.id': task?.id,
        'task.fields.id': task?.fields?.id,
        'full task': task
      });
      
      // Sanitize filename: replace spaces and other problematic characters for upload compatibility
      // This ensures files with spaces like "Waiver Ats.pdf" work correctly
      const sanitizedFileName = file.name 
        ? file.name
            .replace(/\s+/g, '_')           // Replace spaces with underscores
            .replace(/[<>:"/\\|?*]/g, '_')  // Replace invalid filename characters
            .replace(/_{2,}/g, '_')         // Replace multiple underscores with single underscore
            .replace(/^_+|_+$/g, '')        // Remove leading/trailing underscores
        : 'uploaded_file';
      
      console.log('Filename sanitization:', {
        original: file.name,
        sanitized: sanitizedFileName
      });
      
      // Create FormData for upload
      const formData = new FormData();
      
      // React Native FormData format
      // Use sanitized filename to avoid issues with spaces in filenames
      formData.append('file', {
        uri: file.uri,
        type: file.mimeType || 'application/octet-stream',
        name: sanitizedFileName,
        size: file.size
      });
      
      setUploadingAttachmentId(attachment.id);
      
      // Determine endpoint
      const endpoint = (hasExisting && !isClientView)
        ? `/replace/task_attachments/${attachment.id}/Attachments`
        : `/upload/task_attachments/${attachment.id}/Attachments`;
      
      console.log('=== UPLOAD REQUEST ===');
      console.log('Endpoint:', endpoint);
      console.log('Attachment ID:', attachment.id);
      console.log('Mode:', (hasExisting && !isClientView) ? 'REPLACE' : 'UPLOAD');
      console.log('======================');
      
      await ApiCaller(endpoint, {
        method: 'POST',
        body: formData,
      });
      
      // Emit real-time update for file upload
      if (socketRef.current) {
        console.log('Emitting attachmentUpdated for file upload:', {
          taskId: task.id,
          attachmentId: attachment.id,
          filename: file.name
        });
        socketRef.current.emit('attachmentUpdated', {
          taskId: task.id,
          attachmentId: attachment.id,
          attachmentData: { 
            uploaded: true, 
            timestamp: new Date().toISOString(),
            filename: file.name,
            fileSize: file.size,
            fileType: file.mimeType
          },
          userId: 'unknown'
        });
      } else {
        console.log('Socket not available for real-time update');
      }

      // Mirror web behavior: don't depend on response shape; refetch from server
      Alert.alert('Success', 'File uploaded successfully!', [{ text: 'OK' }]);

      // Immediate refetch to sync UI
    

      // Follow-up refetches to catch Airtable propagation delays
      fetchAttachments();

    
      
    } catch (error) {
      console.error('❌ File upload error:', error);
      
      let errorMessage = 'Failed to upload file. Please try again.';
      
      if (error.message.includes('Network')) {
        errorMessage = 'Network error. Please check your internet connection.';
      } else if (error.message.includes('413')) {
        errorMessage = 'File is too large. Please choose a smaller file.';
      } else if (error.message.includes('415')) {
        errorMessage = 'File type not supported.';
      } else if (error.message.includes('500')) {
        errorMessage = 'Server error. Please try again later.';
      }
      
      Alert.alert('Upload Failed', errorMessage);
    } finally {
      setUploadingAttachmentId(null);
    }
  };

  // Signature handling functions
  const handleOpenSignature = (approval) => {
    setCurrentApproval(approval);
    setSignatureImage(null);
    setShowSignatureModal(true);
  };

  const handleSignatureEnd = (signature) => {
    console.log('Signature captured:', signature ? 'YES' : 'NO');
    setSignatureImage(signature);
  };

  const handleSignatureClear = () => {
    console.log('Clearing signature');
    setSignatureImage(null);
  };

  const handleSignatureEmpty = () => {
    console.log('Signature is empty');
    setSignatureImage(null);
  };

  const handleSubmitSignature = async () => {
    if (!signatureImage || !currentApproval) {
      Alert.alert('Error', 'Please provide a signature first.');
      return;
    }

    setIsSaving(true);
    try {
      // Convert base64 to blob
      const response = await fetch(signatureImage);
      const blob = await response.blob();
      
      // Create FormData
      const formData = new FormData();
      formData.append('file', {
        uri: signatureImage,
        type: 'image/png',
        name: 'signature.png',
      });

      // Upload signature
      await ApiCaller(`/upload/task_approval/${currentApproval.id}/signature_attachment`, {
        method: 'POST',
        body: formData,
      });

      // Emit real-time update for signature added
      if (socketRef.current) {
        socketRef.current.emit('signatureAdded', {
          taskId: task.id,
          approvalId: currentApproval.id,
          signatureUrl: signatureImage,
          userId: 'unknown'
        });
      }

      // Refresh approvals
      const refreshResponse = await ApiCaller(`/records/filter/${task.fields.id}/task_approval`);
      const refreshedApprovals = Array.isArray(refreshResponse?.records) ? refreshResponse.records : [];
      setApprovals(refreshedApprovals);

      Alert.alert('Success', 'Signature submitted successfully!');
      setShowSignatureModal(false);
      setCurrentApproval(null);
      setSignatureImage(null);
    } catch (error) {
      console.error('Error submitting signature:', error);
      Alert.alert('Error', 'Failed to submit signature. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Fetch task attachments function (extracted so it can be called from upload handler)
  const fetchAttachments = async () => {
    if (!task?.fields?.id) {
      console.log('fetchAttachments: No task ID');
      return;
    }
    console.log('fetchAttachments: Fetching for task ID:', task.fields.id);
    setLoadingAttachments(true);
    try {
      // Explicitly request all fields including Attachments with cache busting
      const cacheBuster = Date.now();
      
      // First try direct record fetch for each attachment (more reliable)
      if (attachments && attachments.length > 0) {
        console.log('Attempting direct record fetch for each attachment...');
        const directFetchPromises = attachments.map(attachment => 
          ApiCaller(`/records/task_attachments/${attachment.id}?fields[]=*&_t=${cacheBuster}`)
        );
        
        try {
          const directResults = await Promise.all(directFetchPromises);
          console.log('Direct fetch results:', directResults.length);
          
          if (directResults && directResults.length > 0) {
            console.log('Using direct fetch results');
            setAttachments(directResults);
            setLoadingAttachments(false);
            return;
          }
        } catch (directError) {
          console.log('Direct fetch failed, falling back to filter endpoint:', directError);
        }
      }
      
      // Fall back to filter endpoint
      const response = await ApiCaller(`/records/filter/${task.fields.id}/task_attachments?fields[]=*&_t=${cacheBuster}`);
      console.log('fetchAttachments: Raw response:', JSON.stringify(response, null, 2));
      console.log('fetchAttachments: Response keys:', Object.keys(response || {}));
      const files = Array.isArray(response?.records) ? response.records : [];
      console.log('fetchAttachments: Parsed files:', files.length, 'attachments');
      console.log('fetchAttachments: First file keys:', files[0] ? Object.keys(files[0]) : 'No files');
      files.forEach((file, index) => {
        console.log(`Attachment ${index} FULL DETAILS:`, JSON.stringify(file, null, 2));
        console.log(`Attachment ${index} SUMMARY:`, {
          id: file.id,
          description: file.fields?.attachment_description,
          hasFiles: file.fields?.Attachments?.length > 0,
          fileCount: file.fields?.Attachments?.length || 0,
          files: file.fields?.Attachments
        });
      });
      setAttachments(files);
    } catch (error) {
      console.error('Error fetching attachments:', error);
      // Attachments endpoint might not exist for all tasks, that's okay
      setAttachments([]);
    } finally {
      setLoadingAttachments(false);
    }
  };


  // Load description content from attachment or fallback to field
  const fetchDescriptionContent = async () => {
    if (!task?.id) return;
    setLoadingDescription(true);
    try {
      // Try to load from attachment first (new system)
      const content = await loadContent('tasks', task.id, 'description');
      
      if (content) {
        setDescriptionContent(content);
      } else {
        // Fallback to old description field
        const fallbackContent = task.fields?.task_description || task.fields?.description || '';
        setDescriptionContent(fallbackContent);
      }
    } catch (error) {
      console.error("Failed to load description content:", error);
      // Fallback to old description field
      const fallbackContent = task.fields?.task_description || task.fields?.description || '';
      setDescriptionContent(fallbackContent);
    } finally {
      setLoadingDescription(false);
    }
  };

  // Fetch task attachments on mount
  useEffect(() => {
    fetchAttachments();
  }, [task?.fields?.id, refetchCounter]);

  // Load description content on mount
  useEffect(() => {
    fetchDescriptionContent();
  }, [task?.id]);

  // Fetch task checklist function
  const fetchChecklist = async () => {
    console.log('fetchChecklist called, task ID:', task?.fields?.id);
    if (!task?.fields?.id) return;
    setLoadingChecklist(true);
    try {
      const response = await ApiCaller(`/records/filter/${task.fields.id}/task_checklists`);
      const items = Array.isArray(response?.records) ? response.records : [];
      // Sort by order_number like the web app does
      const sortedItems = items.sort((a, b) => 
        (a.fields.order_number || 0) - (b.fields.order_number || 0)
      );
      setChecklistItems(sortedItems);
      // Store initial state for locking logic
      setInitialChecklistItems(JSON.parse(JSON.stringify(sortedItems)));
    } catch (error) {
      console.error('Error fetching checklist:', error);
      // Checklist endpoint might not exist for all tasks, that's okay
      setChecklistItems([]);
      setInitialChecklistItems([]);
    } finally {
      setLoadingChecklist(false);
    }
  };

  // Fetch task checklist
  useEffect(() => {
    fetchChecklist();
  }, [task?.fields?.id, refetchCounter]);

  // Fetch task form submissions function
  const fetchForms = async () => {
    if (!task?.fields?.id) return;
    setLoadingForms(true);
    try {
      const response = await ApiCaller(`/records/filter/${task.fields.id}/task_forms_submissions`);
      const forms = Array.isArray(response?.records) ? response.records : [];
      setFormSubmissions(forms);
      // Store initial state for tracking changes
      setInitialFormSubmissions(JSON.parse(JSON.stringify(forms)));
    } catch (error) {
      console.error('Error fetching form submissions:', error);
      // Form submissions endpoint might not exist for all tasks
      setFormSubmissions([]);
      setInitialFormSubmissions([]);
    } finally {
      setLoadingForms(false);
    }
  };

  // Fetch task form submissions
  useEffect(() => {
    fetchForms();
  }, [task?.fields?.id, refetchCounter]);

  // Fetch task approvals/signatures
  // Fetch task approvals function
  const fetchApprovals = async () => {
    console.log('fetchApprovals called, task ID:', task?.fields?.id);
    if (!task?.fields?.id) return;
    setLoadingApprovals(true);
    try {
      const response = await ApiCaller(`/records/filter/${task.fields.id}/task_approval`);
      const sigs = Array.isArray(response?.records) ? response.records : [];
      setApprovals(sigs);
    } catch (error) {
      console.error('Error fetching approvals:', error);
      // Approvals endpoint might not exist for all tasks
      setApprovals([]);
    } finally {
      setLoadingApprovals(false);
    }
  };

  useEffect(() => {
    fetchApprovals();
  }, [task?.fields?.id, refetchCounter]);

  // Fetch project data to get assignee options
  useEffect(() => {
    const fetchProjectData = async () => {
      if (!task?.fields?.project_id || !Array.isArray(task.fields.project_id) || !task.fields.project_id[0]) {
        console.log('No project ID found, skipping project data fetch');
        return;
      }
      
      try {
        const response = await ApiCaller(`/records/projects/${task.fields.project_id[0]}`);
        setProjectData(response);
        
        // Create assignee options from project data
        if (response && response.fields) {
          const {
            'Assigned Consultant': assignedConsultant,
            'Supervising Consultant': supervisingConsultant,
            'collaborator_name': collaborators,
          } = response.fields;
          
          const options = new Set();
          if (assignedConsultant && typeof assignedConsultant === 'string') {
            options.add(assignedConsultant);
          }
          if (supervisingConsultant && typeof supervisingConsultant === 'string') {
            options.add(supervisingConsultant);
          }
          if (Array.isArray(collaborators)) {
            collaborators.forEach(c => {
              if (c && typeof c === 'string') {
                options.add(c.trim());
              }
            });
          }
          
          setAssigneeOptions(Array.from(options).filter(Boolean));
        } else {
          console.log('No project fields found, setting empty assignee options');
          setAssigneeOptions([]);
        }
      } catch (error) {
        console.error('Error fetching project data:', error);
        setAssigneeOptions([]);
      }
    };

    fetchProjectData();
  }, [task?.fields?.project_id]);

  // WebSocket connection for real-time updates
  useEffect(() => {
    if (!task?.id) return;
    
    // Initialize socket connection
    socketRef.current = io('https://ats-backend-805977745256.us-central1.run.app');

    socketRef.current.on('connect', () => {
      console.log('Connected to task socket server');
      socketRef.current.emit('joinTaskRoom', task.id);
    });

    socketRef.current.on('joinedTaskRoom', (data) => {
      console.log('Successfully joined task room:', data);
    });

    // Real-time update listeners
    socketRef.current.on('taskUpdated', (data) => {
      console.log('Task updated received:', data);
      if (data.taskId === task.id) {
        console.log('Refreshing task data due to real-time update');
        if (onTaskUpdate) {
          onTaskUpdate();
        }
      }
    });

    socketRef.current.on('signatureAdded', (data) => {
      console.log('Signature added received:', data);
      if (data.taskId === task.id) {
        console.log('Updating approvals due to signature change');
        setApprovals(prev => prev.map(approval => 
          approval.id === data.approvalId 
            ? { 
                ...approval, 
                fields: { 
                  ...approval.fields, 
                  signature_attachment: [{ url: data.signatureUrl, filename: 'signature.png' }] 
                } 
              }
            : approval
        ));
      }
    });

    socketRef.current.on('checklistUpdated', (data) => {
      console.log('Checklist updated received:', data);
      if (data.taskId === task.id) {
        console.log('Updating checklist due to real-time change');
        setChecklistItems(prev =>
          prev.map(item => (item.id === data.itemId ? { ...item, completed: data.completed } : item))
        );
      }
    });

    socketRef.current.on('formUpdated', (data) => {
      console.log('Form updated received:', data);
      if (data.taskId === task.id) {
        console.log('Updating form submissions due to real-time change');
        setFormSubmissions(prev =>
          prev.map(submission =>
            submission.id === data.submissionId 
              ? { ...submission, fields: { ...submission.fields, value: data.value } } 
              : submission
          )
        );
      }
    });

    socketRef.current.on('attachmentUpdated', (data) => {
      console.log('Attachment updated received:', data);
      if (data.taskId === task.id) {
        console.log('Updating attachments due to real-time change');
        if (data.attachmentId === 'new_attachments') {
          console.log('Adding new attachments:', data.attachmentData);
          setAttachments(prev => [...prev, ...data.attachmentData]);
        } else if (data.attachmentData?.uploaded) {
          console.log('File upload detected, refetching attachments for attachment:', data.attachmentId);
          forceRefetch();
        } else {
          console.log('Updating specific attachment:', data.attachmentId);
          setAttachments(prev => prev.map(att => 
            att.id === data.attachmentId 
              ? { ...att, ...data.attachmentData }
              : att
          ));
        }
      }
    });

    // Error listeners
    socketRef.current.on('taskUpdateError', (error) => {
      console.error('Task update error:', error);
      Alert.alert('Task Update Error', error.error);
    });

    socketRef.current.on('signatureUpdateError', (error) => {
      console.error('Signature update error:', error);
      Alert.alert('Signature Update Error', error.error);
    });

    socketRef.current.on('checklistUpdateError', (error) => {
      console.error('Checklist update error:', error);
      Alert.alert('Checklist Update Error', error.error);
    });

    socketRef.current.on('formUpdateError', (error) => {
      console.error('Form update error:', error);
      Alert.alert('Form Update Error', error.error);
    });

    socketRef.current.on('attachmentUpdateError', (error) => {
      console.error('Attachment update error:', error);
      Alert.alert('Attachment Update Error', error.error);
    });

    return () => {
      if (task?.id) {
        socketRef.current.emit('leaveTaskRoom', task.id);
      }
      socketRef.current.disconnect();
    };
  }, [task?.id, onTaskUpdate]);

  const getStatusColor = (status) => {
    switch (status) {
      case 'Completed': return '#10B981';
      case 'In Progress': return '#F59E0B';
      case 'Blocked': return '#EF4444';
      case 'In Review': return '#3B82F6';
      default: return '#6B7280';
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'High': return '#EF4444';
      case 'Medium': return '#F59E0B';
      case 'Low': return '#10B981';
      default: return '#6B7280';
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Not set';
    return new Date(dateString).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  const handleChecklistToggle = async (item) => {
    // Check permissions first
    if (!canEdit) {
      Alert.alert('Permission Denied', 'You do not have permission to edit this task.');
      return;
    }

    // Check if checklist is locked for client
    if (isChecklistLockedForClient) {
      Alert.alert('Checklist Locked', 'Once a checklist item is completed, the checklist becomes locked.');
      return;
    }

    // Only allow toggling in edit mode
    if (!isEditMode) {
      Alert.alert('Edit Mode Required', 'Please tap the edit button to modify checklist items.');
      return;
    }

    try {
      const newCompletedStatus = !item.fields.completed;
      
      // Optimistic update
      setChecklistItems(prev => 
        prev.map(i => 
          i.id === item.id 
            ? { ...i, fields: { ...i.fields, completed: newCompletedStatus } }
            : i
        )
      );

      // API call
      await ApiCaller('/records', {
        method: 'PATCH',
        body: JSON.stringify({
          recordsToUpdate: [{
            id: item.id,
            fields: { completed: newCompletedStatus }
          }],
          tableName: 'task_checklists'
        })
      });

      // Emit real-time update for checklist changes
      if (socketRef.current) {
        socketRef.current.emit('checklistUpdated', {
          taskId: task.id,
          itemId: item.id,
          completed: newCompletedStatus,
          userId: 'unknown'
        });
      }
    } catch (error) {
      console.error('Error updating checklist item:', error);
      Alert.alert('Error', 'Failed to update checklist item');
      // Revert optimistic update
      setChecklistItems(prev => 
        prev.map(i => 
          i.id === item.id 
            ? { ...i, fields: { ...i.fields, completed: !item.fields.completed } }
            : i
        )
      );
    }
  };

  const fields = taskData?.fields || {};
  const taskTitle = String(fields.task_title || 'Untitled Task');
  const taskStatus = String(fields.task_status || 'Not Started');
  const taskPriority = String(fields.task_priority || 'Medium');
  const taskDescription = String(fields.task_description || 'No description provided.');
  const dueDate = fields.due_date;
  const startDate = fields.start_date;
  const assignee = fields.assigned_to ? String(fields.assigned_to) : 'Unassigned';
  const actionType = fields.Action_type ? String(fields.Action_type) : 'Default';
  const projectName = fields['Project Name (from project_id)'] && Array.isArray(fields['Project Name (from project_id)']) 
    ? String(fields['Project Name (from project_id)'][0]) 
    : '';

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {isEditMode ? 'Edit Task' : 'Task Details'}
        </Text>
        <View style={styles.headerRight}>
          {canEdit && !isEditMode ? (
            <TouchableOpacity 
              onPress={() => setIsEditMode(true)} 
              style={styles.editButton}
            >
              <Ionicons name="create-outline" size={24} color="#D4AF37" />
            </TouchableOpacity>
          ) : canEdit && isEditMode ? (
            <View style={styles.editActions}>
              <TouchableOpacity 
                onPress={handleCancel} 
                style={styles.cancelButton}
                disabled={isSaving}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={handleSave} 
                style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.saveButtonText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Task Title */}
        <View style={styles.titleSection}>
          <Text style={styles.taskTitle}>{taskTitle}</Text>
          {!!projectName && (
            <Text style={styles.projectName}>📁 {projectName}</Text>
          )}
        </View>

        {/* Status and Priority Badges */}
        <View style={styles.badgesRow}>
          {isEditMode && !isClientView ? (
            <TouchableOpacity 
              key="status-badge-editable"
              style={[styles.badge, styles.editableBadge, { backgroundColor: `${getStatusColor(editedFields.task_status || taskStatus)}20` }]}
              onPress={() => setShowPicker('status')}
            >
              <View style={[styles.badgeDot, { backgroundColor: getStatusColor(editedFields.task_status || taskStatus) }]} />
              <Text style={[styles.badgeText, { color: getStatusColor(editedFields.task_status || taskStatus) }]}>
                {editedFields.task_status || taskStatus}
              </Text>
              <Ionicons name="chevron-down" size={16} color={getStatusColor(editedFields.task_status || taskStatus)} />
            </TouchableOpacity>
          ) : (
            <React.Fragment key="badges-fragment">
              <View key="status-badge" style={[styles.badge, { backgroundColor: `${getStatusColor(taskStatus)}20` }]}>
                <View style={[styles.badgeDot, { backgroundColor: getStatusColor(taskStatus) }]} />
                <Text style={[styles.badgeText, { color: getStatusColor(taskStatus) }]}>
                  {taskStatus}
                </Text>
              </View>
              <View key="priority-badge" style={[styles.badge, { backgroundColor: `${getPriorityColor(taskPriority)}20` }]}>
                <Ionicons 
                  name="flag" 
                  size={14} 
                  color={getPriorityColor(taskPriority)} 
                />
                <Text style={[styles.badgeText, { color: getPriorityColor(taskPriority) }]}>
                  {String(taskPriority)} Priority
                </Text>
              </View>
            </React.Fragment>
          )}
        </View>

        {/* Add Task Fields Section - Only show in edit mode for consultants */}
        {isEditMode && !isClientView && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Add Task Fields</Text>
            <View style={styles.addTaskFieldsContainer}>
              <TouchableOpacity 
                key="add-checklist-button"
                style={styles.addTaskFieldButton}
                onPress={() => setShowAddChecklistModal(true)}
              >
                <Ionicons name="checkmark-circle-outline" size={20} color="#3B82F6" />
                <Text style={styles.addTaskFieldButtonText}>Add Checklist</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                key="add-attachment-button"
                style={styles.addTaskFieldButton}
                onPress={() => setShowAddAttachmentModal(true)}
              >
                <Ionicons name="attach-outline" size={20} color="#3B82F6" />
                <Text style={styles.addTaskFieldButtonText}>Add Attachment</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                key="add-approval-button"
                style={styles.addTaskFieldButton}
                onPress={() => setShowAddApprovalModal(true)}
              >
                <Ionicons name="document-text-outline" size={20} color="#3B82F6" />
                <Text style={styles.addTaskFieldButtonText}>Add Approval</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                key="add-forms-button"
                style={styles.addTaskFieldButton}
                onPress={() => setShowAddFormsModal(true)}
              >
                <Ionicons name="clipboard-outline" size={20} color="#3B82F6" />
                <Text style={styles.addTaskFieldButtonText}>Add Forms</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Key Information Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Key Information</Text>
          
          {/* Assignee */}
          <View style={styles.infoRow}>
            <View style={styles.infoIcon}>
              <Ionicons name="person-outline" size={20} color="#6B7280" />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Assignee</Text>
              {isEditMode && !isClientView ? (
                <TouchableOpacity 
                  style={styles.editableField}
                  onPress={() => setShowPicker('assignee')}
                >
                  <Text style={styles.editableFieldText}>
                    {editedFields.assigned_to || 'Unassigned'}
                  </Text>
                  <Ionicons name="chevron-down" size={16} color="#6B7280" />
                </TouchableOpacity>
              ) : (
                <Text style={styles.infoValue}>{assignee}</Text>
              )}
            </View>
          </View>

          {/* Start Date (Read-only) */}
          <View style={styles.infoRow}>
            <View style={styles.infoIcon}>
              <Ionicons name="calendar-outline" size={20} color="#6B7280" />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Start Date</Text>
              <Text style={styles.infoValue}>{formatDate(startDate)}</Text>
            </View>
          </View>

          {/* Due Date */}
          <View style={styles.infoRow}>
            <View style={styles.infoIcon}>
              <Ionicons name="calendar-outline" size={20} color="#6B7280" />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Due Date</Text>
              {isEditMode && !isClientView ? (
                <TouchableOpacity 
                  style={styles.editableField}
                  onPress={() => {
                    if (editedFields.due_date) {
                      setSelectedDate(new Date(editedFields.due_date));
                    }
                    setShowDatePicker(true);
                  }}
                >
                  <Text style={styles.editableFieldText}>
                    {editedFields.due_date ? formatDate(editedFields.due_date) : 'Not set'}
                  </Text>
                  <Ionicons name="chevron-down" size={16} color="#6B7280" />
                </TouchableOpacity>
              ) : (
                <Text style={styles.infoValue}>{formatDate(dueDate)}</Text>
              )}
            </View>
          </View>

          {/* Call to Action */}
          <View style={styles.infoRow}>
            <View style={styles.infoIcon}>
              <Ionicons name="flash-outline" size={20} color="#6B7280" />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Call to Action</Text>
              {isEditMode && !isClientView ? (
                <TouchableOpacity 
                  style={styles.editableField}
                  onPress={() => setShowPicker('actionType')}
                >
                  <Text style={styles.editableFieldText}>
                    {editedFields.Action_type || 'Default'}
                  </Text>
                  <Ionicons name="chevron-down" size={16} color="#6B7280" />
                </TouchableOpacity>
              ) : (
                <Text style={styles.infoValue}>{actionType}</Text>
              )}
            </View>
          </View>
        </View>

        {/* Quick Help Section - Only for Clients */}
        {isClientView && (
          <QuickPromptsSection type="task" task={task} />
        )}

        {/* Description Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Description</Text>
          {loadingDescription ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#3B82F6" />
              <Text style={styles.loadingText}>Loading description...</Text>
            </View>
          ) : (
            descriptionContent ? (
              <RichTextRenderer
                content={descriptionContent}
                style={styles.descriptionContainer}
                maxHeight={400}
              />
            ) : (
              <Text style={styles.emptyDescriptionText}>No description provided.</Text>
            )
          )}
        </View>

        {/* Checklist Card */}
        {loadingChecklist ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Checklist</Text>
            <ActivityIndicator size="small" color="#D4AF37" style={styles.loader} />
          </View>
        ) : checklistItems.length > 0 ? (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Checklist</Text>
              <View style={styles.checklistProgress}>
                <Text style={styles.checklistProgressText}>
                  {checklistItems.filter(i => i.fields.completed).length}/{checklistItems.length}
                </Text>
              </View>
            </View>
            {checklistItems.map((item, index) => (
              <View key={item.id || `checklist-${index}`} style={styles.checklistItemContainer}>
                <TouchableOpacity
                  style={styles.checklistItem}
                  onPress={() => handleChecklistToggle(item)}
                  activeOpacity={0.7}
                >
                  <View style={[
                    styles.checkbox,
                    item.fields.completed && styles.checkboxCompleted
                  ]}>
                    {item.fields.completed && (
                      <Ionicons name="checkmark" size={16} color="#FFF" />
                    )}
                  </View>
                  <Text style={[
                    styles.checklistItemText,
                    item.fields.completed && styles.checklistItemTextCompleted
                  ]}>
                    {String(item.fields.checklist_description || 'Checklist item')}
                  </Text>
                </TouchableOpacity>
                {!isClientView && (
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => handleDeleteChecklistItem(item.id)}
                  >
                    <Ionicons name="trash-outline" size={20} color="#EF4444" />
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        ) : null}

        {/* Attachments Card */}
        {loadingAttachments ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Attachments</Text>
            <ActivityIndicator size="small" color="#D4AF37" style={styles.loader} />
          </View>
        ) : attachments.length > 0 ? (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>📎 Attachments</Text>
              <View style={styles.attachmentHeaderRight}>
                <View style={styles.attachmentCount}>
                  <Text style={styles.attachmentCountText}>{attachments.length}</Text>
                </View>
                <TouchableOpacity
                  style={styles.refreshButton}
                  onPress={async () => {
                    console.log('Manual refresh triggered by user');
                    await fetchAttachments();
                    Alert.alert('Refreshed', 'Attachments have been refreshed from the server.');
                  }}
                >
                  <Ionicons name="refresh" size={16} color="#6B7280" />
                </TouchableOpacity>
              </View>
            </View>
            {attachments.map((attachment, index) => (
              <View key={attachment.id || `attachment-${index}`} style={styles.attachmentContainer}>
                <View style={styles.attachmentHeader}>
                  <Text style={styles.attachmentDescription}>
                    {String(attachment.fields.attachment_description || 'Attachment')}
                  </Text>
                  {!isClientView && (
                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={() => handleDeleteAttachment(attachment.id)}
                    >
                      <Ionicons name="trash-outline" size={20} color="#EF4444" />
                    </TouchableOpacity>
                  )}
                </View>
                {attachment.fields.Attachments && attachment.fields.Attachments.length > 0 ? (
                  <View style={styles.attachmentFilesContainer}>
                    {attachment.fields.Attachments.map((file, fileIndex) => (
                      <TouchableOpacity
                        key={file.id || file.url || `file-${attachment.id || index}-${fileIndex}`}
                        style={styles.attachmentFileButton}
                        onPress={() => {
                          // TODO: Open file URL
                          Alert.alert('File', `Opening: ${file.filename}\n\nURL: ${file.url}`);
                        }}
                      >
                        <Ionicons name="document-attach-outline" size={16} color="#3B82F6" />
                        <Text style={styles.attachmentFileName} numberOfLines={1}>
                          {String(file.filename || 'File')}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.attachmentNoFile}>No file uploaded</Text>
                )}
                {canEdit && (
                  <TouchableOpacity
                    style={[
                      styles.uploadButton,
                      uploadingAttachmentId === attachment.id && styles.uploadButtonDisabled
                    ]}
                    onPress={() => handleFileUpload(attachment)}
                    disabled={uploadingAttachmentId === attachment.id}
                  >
                    {uploadingAttachmentId === attachment.id ? (
                      <React.Fragment key="uploading-fragment">
                        <ActivityIndicator size="small" color="#D4AF37" />
                        <Text style={styles.uploadButtonText}>Uploading...</Text>
                      </React.Fragment>
                    ) : (
                      <React.Fragment key="upload-ready-fragment">
                        <Ionicons name="cloud-upload-outline" size={20} color="#D4AF37" />
                        <Text style={styles.uploadButtonText}>
                          {attachment.fields.Attachments && attachment.fields.Attachments.length > 0 
                            ? (isClientView ? 'Add File' : 'Replace File')
                            : 'Upload File'}
                        </Text>
                      </React.Fragment>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            ))}
            {/* Add New Attachment Button */}
            {canEdit && (
              <View style={styles.addNewAttachmentSection}>
                <TouchableOpacity
                  style={styles.addNewAttachmentButton}
                  onPress={() => setShowAddNewAttachmentModal(true)}
                >
                  <Ionicons name="add-circle-outline" size={20} color="#3B82F6" />
                  <Text style={styles.addNewAttachmentButtonText}>Add New Attachment</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ) : canEdit ? (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>📎 Attachments</Text>
            </View>
            <View style={styles.emptyAttachmentsContainer}>
              <Text style={styles.emptyAttachmentsText}>No attachments yet</Text>
              <TouchableOpacity
                style={styles.addNewAttachmentButtonEmpty}
                onPress={() => setShowAddNewAttachmentModal(true)}
              >
                <Ionicons name="add-circle-outline" size={20} color="#3B82F6" />
                <Text style={styles.addNewAttachmentButtonText}>Add New Attachment</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {/* Form Submissions Card */}
        {loadingForms ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Forms</Text>
            <ActivityIndicator size="small" color="#D4AF37" style={styles.loader} />
          </View>
        ) : formSubmissions.length > 0 ? (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>📋 Forms</Text>
              <View style={styles.formCount}>
                <Text style={styles.formCountText}>
                  {(() => {
                    // Count unique forms by submission_id
                    const uniqueSubmissionIds = new Set(formSubmissions.map(f => f.fields.submission_id));
                    return uniqueSubmissionIds.size;
                  })()}
                </Text>
              </View>
            </View>
            {groupedForms.map(([submissionId, formFields], formIndex) => {
              const firstField = formFields[0];
              const formName = String(firstField?.fields['form_name (from form)']?.[0] || 'Unnamed Form');
              const submissionStatus = String(firstField?.fields.submission || 'Incomplete');
              const lastUpdated = firstField?.fields.last_updated;
              const isFormLocked = submissionStatus === 'Updated' || (isClientView && isFormLockedForClient);
              
              return (
                <View key={submissionId || `form-${formIndex}`} style={styles.formContainer}>
                  <View style={styles.formHeader}>
                    <View style={styles.formTitleContainer}>
                      <Text style={styles.formTitle}>{formName}</Text>
                      <View style={[styles.formStatusBadge, {
                        backgroundColor: submissionStatus === 'Completed' ? '#10B981' :
                                       submissionStatus === 'Updated' ? '#3B82F6' : '#F59E0B'
                      }]}>
                        <Text style={styles.formStatusText}>{submissionStatus}</Text>
                      </View>
                    </View>
                    {!isClientView && (
                      <TouchableOpacity
                        style={styles.deleteButton}
                        onPress={() => handleDeleteForm(firstField.id)}
                      >
                        <Ionicons name="trash-outline" size={20} color="#EF4444" />
                      </TouchableOpacity>
                    )}
                  </View>
                  {!!lastUpdated && (submissionStatus === 'Completed' || submissionStatus === 'Updated') && (
                    <Text style={styles.formTimestamp}>
                      {String(new Date(lastUpdated).toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric', 
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      }))}
                    </Text>
                  )}
                  {isFormLocked && (
                    <View style={styles.formLockedBanner}>
                      <Ionicons name="lock-closed" size={16} color="#EF4444" />
                      <Text style={styles.formLockedText}>
                        {submissionStatus === 'Updated' 
                          ? 'This form has been updated and is now locked from further editing.'
                          : 'This form has been completed and is locked.'}
                      </Text>
                    </View>
                  )}
                  <View style={styles.formFieldsContainer}>
                    {formFields.map((field, fieldIndex) => (
                      <View key={field.id || `field-${submissionId || formIndex}-${fieldIndex}`} style={styles.formField}>
                        <Text style={styles.formFieldLabel}>
                          {String(field.fields['field_label (from Notes)']?.[0] || 'Unnamed Field')}
                        </Text>
                        {isEditMode && !isFormLocked && canEdit ? (
                          <TextInput
                            style={styles.formFieldInput}
                            value={editedFields[`form_${field.id}`] !== undefined 
                              ? editedFields[`form_${field.id}`]
                              : (field.fields.value === '--EMPTY--' ? '' : field.fields.value || '')
                            }
                            onChangeText={(text) => handleFieldChange(`form_${field.id}`, text)}
                            placeholder="Enter value..."
                            placeholderTextColor="#9CA3AF"
                            multiline
                          />
                        ) : (
                          <Text style={[styles.formFieldValue, isFormLocked && styles.formFieldValueLocked]}>
                            {String(field.fields.value === '--EMPTY--' ? '(Not filled)' : field.fields.value || '(No value)')}
                          </Text>
                        )}
                      </View>
                    ))}
                  </View>
                </View>
              );
            })}
          </View>
        ) : null}

        {/* Approvals/Signatures Card */}
        {loadingApprovals ? (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>✍️ Signatures & Approvals</Text>
              <ActivityIndicator size="small" color="#D4AF37" />
            </View>
          </View>
        ) : approvals.length > 0 ? (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>✍️ Signatures & Approvals</Text>
              <View style={styles.approvalCount}>
                <Text style={styles.approvalCountText}>{approvals.length}</Text>
              </View>
            </View>
            {approvals.map((approval, index) => {
              const hasSignature = approval.fields.signature_attachment && 
                                  approval.fields.signature_attachment.length > 0;
              return (
                <View key={approval.id || `approval-${index}`} style={styles.approvalItem}>
                  <View style={styles.approvalHeaderRow}>
                    <Text style={styles.approvalDescription}>
                      {String(approval.fields.approval_description || 'Approval Required')}
                    </Text>
                    {!isClientView && (
                      <TouchableOpacity
                        style={styles.deleteButton}
                        onPress={() => handleDeleteApproval(approval.id)}
                      >
                        <Ionicons name="trash-outline" size={20} color="#EF4444" />
                      </TouchableOpacity>
                    )}
                  </View>
                  <View style={styles.approvalContent}>
                    {hasSignature ? (
                      <View style={styles.approvalSignedContainer}>
                        <View style={styles.approvalSignedBadge}>
                          <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                          <Text style={styles.approvalSignedText}>Signed</Text>
                        </View>
                        <TouchableOpacity
                          style={styles.viewSignatureButton}
                          onPress={() => {
                            const signatureUrl = approval.fields.signature_attachment[0].url;
                            Alert.alert(
                              'Signature',
                              'Opening signature...',
                              [
                                {
                                  text: 'View in Browser',
                                  onPress: () => {
                                    if (signatureUrl) {
                                      Linking.openURL(signatureUrl);
                                    }
                                  }
                                },
                                { text: 'Cancel', style: 'cancel' }
                              ]
                            );
                          }}
                        >
                          <Text style={styles.viewSignatureText}>View Signature</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <View style={styles.approvalPendingContainer}>
                        <View style={styles.approvalPendingBadge}>
                          <Ionicons name="time-outline" size={16} color="#F59E0B" />
                          <Text style={styles.approvalPendingText}>Pending Signature</Text>
                        </View>
                        {isEditMode && canEdit && (
                          <TouchableOpacity
                            style={styles.signButton}
                            onPress={() => handleOpenSignature(approval)}
                          >
                            <Ionicons name="create-outline" size={18} color="#FFFFFF" />
                            <Text style={styles.signButtonText}>Sign</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        ) : !loadingApprovals ? (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>✍️ Signatures & Approvals</Text>
              <View style={styles.approvalCount}>
                <Text style={styles.approvalCountText}>0</Text>
              </View>
            </View>
            <View style={styles.emptyState}>
              <Ionicons name="document-text-outline" size={48} color="#9CA3AF" />
              <Text style={styles.emptyStateText}>No approvals required</Text>
            </View>
          </View>
        ) : null}

        {/* Delete Task Button - Only for Consultants */}
        {!isClientView && (
          <View style={styles.deleteTaskSection}>
            <TouchableOpacity
              style={styles.deleteTaskButton}
              onPress={handleDeleteTask}
            >
              <Ionicons name="trash-outline" size={20} color="#FFFFFF" />
              <Text style={styles.deleteTaskButtonText}>Delete Task</Text>
            </TouchableOpacity>
            <Text style={styles.deleteTaskWarning}>
              This action cannot be undone
            </Text>
          </View>
        )}

        {/* Spacer at bottom */}
        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Picker Modal */}
      <Modal
        visible={showPicker !== null}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowPicker(null)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowPicker(null)}
        >
          <View style={styles.pickerContainer}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>
                {(() => {
                  switch (showPicker) {
                    case 'status': return 'Select Status';
                    case 'priority': return 'Select Priority';
                    case 'assignee': return 'Select Assignee';
                    case 'actionType': return 'Select Call to Action';
                    default: return 'Select Option';
                  }
                })()}
              </Text>
              <TouchableOpacity onPress={() => setShowPicker(null)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={(() => {
                switch (showPicker) {
                  case 'status':
                    return ['Not Started', 'In Progress', 'Completed'];
                  case 'priority':
                    return ['Low', 'Medium', 'High', 'Urgent'];
                  case 'assignee':
                    return ['Unassigned', ...(assigneeOptions || [])];
                  case 'actionType':
                    return ['Attach Files', 'Complete Form', 'Complete Checklist', 'Require Approval', 'Default', 'Review Only'];
                  default:
                    return [];
                }
              })()}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.pickerItem}
                  onPress={() => {
                    switch (showPicker) {
                      case 'status':
                        handleFieldChange('task_status', item);
                        break;
                      case 'assignee':
                        handleFieldChange('assigned_to', item === 'Unassigned' ? '' : item);
                        break;
                      case 'actionType':
                        handleFieldChange('Action_type', item);
                        break;
                    }
                    setShowPicker(null);
                  }}
                >
                  <Text style={styles.pickerItemText}>{item}</Text>
                  {(() => {
                    switch (showPicker) {
                      case 'status':
                        return item === (editedFields.task_status || taskStatus);
                      case 'assignee':
                        return item === (editedFields.assigned_to || 'Unassigned');
                      case 'actionType':
                        return item === (editedFields.Action_type || 'Default');
                      default:
                        return false;
                    }
                  })() && (
                    <Ionicons name="checkmark" size={24} color="#D4AF37" />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Date Picker Modal */}
      <Modal
        visible={showDatePicker}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowDatePicker(false)}
      >
        <View style={styles.datePickerModalOverlay}>
          <View style={styles.datePickerModalContainer}>
            <View style={styles.datePickerModalHeader}>
              <Text style={styles.datePickerModalTitle}>Select Due Date</Text>
              <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <DateTimePicker
              value={selectedDate}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={handleDateChange}
              style={styles.datePicker}
            />
            {Platform.OS === 'ios' && (
              <View style={styles.datePickerModalActions}>
                <TouchableOpacity onPress={() => setShowDatePicker(false)} style={styles.datePickerCancelButton}>
                  <Text style={styles.datePickerCancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleConfirmDate} style={styles.datePickerConfirmButton}>
                  <Text style={styles.datePickerConfirmButtonText}>Confirm</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Signature Modal */}
      <Modal
        visible={showSignatureModal}
        animationType="slide"
        onRequestClose={() => setShowSignatureModal(false)}
        presentationStyle="fullScreen"
      >
        <SafeAreaView style={styles.signatureModalContainer}>
          <StatusBar barStyle="dark-content" />
          
          {/* Header */}
          <View style={styles.signatureModalHeader}>
            <View style={styles.signatureHeaderContent}>
              <View>
                <Text style={styles.signatureModalTitle}>Sign Document</Text>
                <Text style={styles.signatureModalSubtitle}>Draw your signature below</Text>
              </View>
              <TouchableOpacity 
                onPress={() => setShowSignatureModal(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close-circle" size={32} color="#6B7280" />
              </TouchableOpacity>
            </View>
          </View>
          
          {/* Canvas Container */}
          <View style={styles.signatureCanvasWrapper}>
            <View style={styles.signatureCanvasContainer}>
              <SignatureScreen
                ref={signatureRef}
                onOK={handleSignatureEnd}
                onEmpty={handleSignatureEmpty}
                onClear={handleSignatureClear}
                descriptionText=""
                clearText="Clear"
                confirmText="Done"
                autoClear={false}
                imageType="image/png"
                webStyle={`
                  body {
                    margin: 0;
                    padding: 0;
                    background-color: #F3F4F6;
                  }
                  .m-signature-pad {
                    box-shadow: none;
                    border: none;
                    margin: 0;
                    padding: 16px;
                    height: 100%;
                    background-color: #F3F4F6;
                  }
                  .m-signature-pad--body {
                    border: 3px dashed #D1D5DB;
                    background-color: #FFFFFF;
                    border-radius: 12px;
                    position: relative;
                    background-image: 
                      repeating-linear-gradient(
                        0deg,
                        transparent,
                        transparent 39px,
                        #E5E7EB 39px,
                        #E5E7EB 40px
                      );
                    background-size: 100% 40px;
                    background-position: 0 20px;
                  }
                  .m-signature-pad--body::before {
                    content: '✍️ Sign here';
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    font-size: 24px;
                    color: #D1D5DB;
                    font-weight: 600;
                    pointer-events: none;
                    z-index: 0;
                    opacity: 0.5;
                  }
                  .m-signature-pad--body canvas {
                    border-radius: 8px;
                    position: relative;
                    z-index: 1;
                  }
                  .m-signature-pad--footer {
                    position: fixed;
                    bottom: 0;
                    left: 0;
                    right: 0;
                    display: flex;
                    justify-content: center;
                    gap: 12px;
                    padding: 16px;
                    background-color: #F9FAFB;
                    border-top: 1px solid #E5E7EB;
                  }
                  .m-signature-pad--footer .button {
                    flex: 1;
                    max-width: 150px;
                    background-color: #10B981;
                    color: white;
                    border: none;
                    border-radius: 12px;
                    padding: 14px 24px;
                    font-size: 16px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    text-align: center;
                  }
                  .m-signature-pad--footer .button:active {
                    transform: scale(0.98);
                  }
                  .m-signature-pad--footer .button.clear {
                    background-color: #EF4444;
                  }
                  .m-signature-pad--footer .description {
                    display: none;
                  }
                `}
              />
            </View>
            
            {/* Instructions Overlay */}
            <View style={styles.instructionsOverlay}>
              <View style={styles.instructionsBadge}>
                <Ionicons name="create-outline" size={16} color="#6B7280" />
                <Text style={styles.instructionsText}>
                  Draw your signature, then tap "Done"
                </Text>
              </View>
            </View>
          </View>

          {/* Bottom Actions */}
          <View style={styles.signatureModalActions}>
            <TouchableOpacity
              style={[
                styles.signatureSubmitButton,
                (!signatureImage || isSaving) && styles.signatureSubmitButtonDisabled
              ]}
              onPress={handleSubmitSignature}
              disabled={!signatureImage || isSaving}
            >
              {isSaving ? (
                <React.Fragment key="signature-saving-fragment">
                  <ActivityIndicator color="#FFFFFF" size="small" />
                  <Text style={styles.signatureSubmitButtonText}>Uploading...</Text>
                </React.Fragment>
              ) : (
                <React.Fragment key="signature-ready-fragment">
                  <Ionicons 
                    name={signatureImage ? "checkmark-circle" : "alert-circle-outline"} 
                    size={22} 
                    color="#FFFFFF" 
                  />
                  <Text style={styles.signatureSubmitButtonText}>
                    {signatureImage ? 'Submit Signature' : 'Draw & tap "Done" first'}
                  </Text>
                </React.Fragment>
              )}
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Add Checklist Modal */}
      <AddChecklistModal
        visible={showAddChecklistModal}
        onClose={() => setShowAddChecklistModal(false)}
        taskId={task?.id}
        onChecklistAdded={() => {
          setShowAddChecklistModal(false);
          // Refresh checklist data
          console.log('Calling fetchChecklist from modal callback');
          fetchChecklist();
        }}
      />

      {/* Add Attachment Placeholder Modal (for Add Task Fields section) */}
      <AddAttachmentPlaceholderModal
        visible={showAddAttachmentModal}
        onClose={() => setShowAddAttachmentModal(false)}
        taskId={task?.id}
        onAttachmentAdded={() => {
          setShowAddAttachmentModal(false);
          // Refresh attachment data
          fetchAttachments();
        }}
      />

      {/* Add Approval Modal */}
      <AddApprovalModal
        visible={showAddApprovalModal}
        onClose={() => setShowAddApprovalModal(false)}
        taskId={task?.id}
        onApprovalAdded={() => {
          setShowAddApprovalModal(false);
          // Refresh approval data
          console.log('Calling fetchApprovals from modal callback');
          fetchApprovals();
        }}
      />

      {/* Add Forms Modal */}
      <AddFormsModal
        visible={showAddFormsModal}
        onClose={() => setShowAddFormsModal(false)}
        taskId={task?.id}
        onFormAdded={() => {
          setShowAddFormsModal(false);
          // Refresh form data
          console.log('Calling fetchForms from modal callback');
          fetchForms();
        }}
      />

      {/* Add New Attachment Modal */}
      <AddAttachmentModal
        isVisible={showAddNewAttachmentModal}
        onClose={() => setShowAddNewAttachmentModal(false)}
        taskId={task?.id}
        onAttachmentAdded={handleNewAttachmentAdded}
        task={task} // Pass full task object for debugging
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 8,
  },
  headerRight: {
    minWidth: 40,
    flexShrink: 0,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  titleSection: {
    marginBottom: 16,
  },
  taskTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
  },
  projectName: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  badgesRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  badgeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
  },
  addTaskFieldsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  addTaskFieldButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    minWidth: 120,
  },
  addTaskFieldButtonText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '500',
    color: '#3B82F6',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  infoIcon: {
    width: 40,
    alignItems: 'center',
    paddingTop: 2,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 15,
    color: '#1F2937',
    fontWeight: '500',
  },
  descriptionText: {
    fontSize: 15,
    color: '#374151',
    lineHeight: 22,
  },
  descriptionContainer: {
    minHeight: 60,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
  },
  loadingText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#6B7280',
  },
  checklistProgress: {
    backgroundColor: '#D4AF3720',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  checklistProgressText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#D4AF37',
  },
  checklistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    flex: 1, // Take up available space
    minWidth: 0, // Allow shrinking
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  checkboxCompleted: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  checklistItemText: {
    flex: 1,
    fontSize: 15,
    color: '#374151',
    marginRight: 8, // Add margin to separate from delete button
  },
  checklistItemTextCompleted: {
    textDecorationLine: 'line-through',
    color: '#9CA3AF',
  },
  attachmentCount: {
    backgroundColor: '#D4AF3720',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  attachmentCountText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#D4AF37',
  },
  attachmentHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  refreshButton: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  attachmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  attachmentIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  attachmentInfo: {
    flex: 1,
  },
  attachmentName: {
    fontSize: 15,
    color: '#1F2937',
    fontWeight: '500',
    marginBottom: 2,
  },
  attachmentSize: {
    fontSize: 13,
    color: '#6B7280',
  },
  loader: {
    marginVertical: 12,
  },
  // Form Submission Styles
  formCount: {
    backgroundColor: '#3B82F620',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  formCountText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#3B82F6',
  },
  formItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  formIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  formInfo: {
    flex: 1,
  },
  formName: {
    fontSize: 15,
    color: '#1F2937',
    fontWeight: '500',
    marginBottom: 4,
  },
  formDate: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 4,
  },
  formStatusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 4,
  },
  formStatusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  // Approval/Signature Styles
  approvalCount: {
    backgroundColor: '#10B98120',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  approvalCountText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#10B981',
  },
  approvalItem: {
    flexDirection: 'column', // Change to column layout
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    overflow: 'hidden', // Prevent content from overflowing
  },
  approvalIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  approvalInfo: {
    flex: 1,
  },
  approvalName: {
    fontSize: 15,
    color: '#1F2937',
    fontWeight: '600',
    marginBottom: 2,
  },
  approvalRole: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 4,
  },
  approvalDate: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  approvalStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  approvalStatusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  bottomSpacer: {
    height: 32,
  },
  // Updated Form Styles
  formContainer: {
    backgroundColor: '#1F2937',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    overflow: 'hidden', // Prevent content from overflowing
  },
  formHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  formTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    flex: 1,
    marginRight: 8,
  },
  formTimestamp: {
    fontSize: 12,
    color: '#FFFFFF',
    opacity: 0.75,
    marginBottom: 12,
  },
  formFieldsContainer: {
    gap: 12,
  },
  formField: {
    marginBottom: 8,
  },
  formFieldLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  formFieldValue: {
    fontSize: 14,
    color: '#FFFFFF',
    opacity: 0.9,
    backgroundColor: '#374151',
    padding: 10,
    borderRadius: 8,
  },
  formFieldInput: {
    fontSize: 14,
    color: '#FFFFFF',
    backgroundColor: '#1F2937',
    borderWidth: 1,
    borderColor: '#4B5563',
    borderRadius: 8,
    padding: 10,
    minHeight: 40,
    textAlignVertical: 'top',
  },
  formFieldValueLocked: {
    opacity: 0.6,
  },
  formLockedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
    marginBottom: 8,
    gap: 8,
  },
  formLockedText: {
    flex: 1,
    fontSize: 13,
    color: '#991B1B',
    fontWeight: '500',
  },
  // Updated Attachment Styles
  attachmentContainer: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    overflow: 'hidden', // Prevent content from overflowing
  },
  attachmentDescription: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
    marginBottom: 8,
    flex: 1, // Take up available space
    marginRight: 8, // Add margin to separate from delete button
  },
  attachmentFilesContainer: {
    gap: 6,
  },
  attachmentFileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    padding: 8,
    borderRadius: 6,
    gap: 6,
  },
  attachmentFileName: {
    fontSize: 13,
    color: '#3B82F6',
    flex: 1,
  },
  attachmentNoFile: {
    fontSize: 13,
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
  // Updated Approval Styles
  approvalContent: {
    marginTop: 8, // Add some spacing from the header
  },
  approvalDescription: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
    flex: 1, // Take up available space
    marginRight: 8, // Add margin to separate from delete button
  },
  approvalSignedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  approvalSignedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  approvalSignedText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#10B981',
  },
  viewSignatureButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#EFF6FF',
    borderRadius: 6,
  },
  viewSignatureText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#3B82F6',
  },
  approvalPendingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  approvalPendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  approvalPendingText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#F59E0B',
  },
  // Edit Mode Styles
  editButton: {
    padding: 8,
  },
  editActions: {
    flexDirection: 'row',
    gap: 8,
  },
  cancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#D4AF37',
    borderRadius: 8,
    minWidth: 70,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  editableBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  descriptionInput: {
    fontSize: 15,
    color: '#374151',
    lineHeight: 22,
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    minHeight: 100,
    textAlignVertical: 'top',
  },
  // Picker Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  pickerContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '50%',
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  pickerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  pickerItemText: {
    fontSize: 16,
    color: '#374151',
  },
  // Upload Button Styles
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1F2937',
    borderWidth: 1,
    borderColor: '#D4AF37',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginTop: 12,
    gap: 8,
  },
  uploadButtonDisabled: {
    opacity: 0.5,
    gap: 8,
  },
  uploadButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#D4AF37',
  },
  // Sign Button Styles
  signButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D4AF37',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    gap: 6,
  },
  signButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  // Signature Modal Styles
  signatureModalContainer: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  signatureModalHeader: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingHorizontal: 20,
    paddingVertical: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  signatureHeaderContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  signatureModalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  signatureModalSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '400',
  },
  closeButton: {
    padding: 4,
  },
  signatureCanvasWrapper: {
    flex: 1,
    position: 'relative',
  },
  signatureCanvasContainer: {
    flex: 1,
    margin: 20,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  instructionsOverlay: {
    position: 'absolute',
    top: 32,
    left: 0,
    right: 0,
    alignItems: 'center',
    pointerEvents: 'none',
  },
  instructionsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  instructionsText: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  signatureModalActions: {
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 20 : 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  signatureSubmitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10B981',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 24,
    gap: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#10B981',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  signatureSubmitButtonDisabled: {
    backgroundColor: '#9CA3AF',
    opacity: 0.7,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.1,
      },
    }),
  },
  signatureSubmitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  // Editable Field Styles
  editableField: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 40,
  },
  editableFieldText: {
    fontSize: 15,
    color: '#374151',
    fontWeight: '500',
    flex: 1,
  },
  // Date Picker Modal Styles
  datePickerModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  datePickerModalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    margin: 20,
    minWidth: 300,
    maxWidth: 400,
  },
  datePickerModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  datePickerModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  datePicker: {
    alignSelf: 'center',
  },
  datePickerModalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    gap: 12,
  },
  datePickerCancelButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    alignItems: 'center',
  },
  datePickerCancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  datePickerConfirmButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: '#D4AF37',
    borderRadius: 8,
    alignItems: 'center',
  },
  datePickerConfirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  emptyDescriptionText: {
    fontStyle: 'italic',
    color: '#9CA3AF',
    textAlign: 'center',
    paddingVertical: 20,
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalCloseButton: {
    padding: 8,
  },
  modalCloseButtonText: {
    fontSize: 16,
    color: '#6B7280',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  modalSaveButton: {
    padding: 8,
  },
  modalSaveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3B82F6',
  },
  disabledText: {
    color: '#9CA3AF',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  modalDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 20,
    lineHeight: 20,
  },
  checklistItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 8,
  },
  checklistItemInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#FFFFFF',
    minHeight: 44,
  },
  attachmentItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 8,
  },
  attachmentItemInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#FFFFFF',
    minHeight: 44,
  },
  removeItemButton: {
    padding: 8,
    marginTop: 4,
  },
  addItemButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginTop: 8,
  },
  addItemButtonText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '500',
    color: '#3B82F6',
  },
  approvalInputContainer: {
    marginTop: 8,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  approvalTextInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#FFFFFF',
    textAlignVertical: 'top',
  },
  // Form modal styles
  loadingContainer: {
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#6B7280',
  },
  formSelectionContainer: {
    marginTop: 20,
  },
  formPickerContainer: {
    marginTop: 8,
  },
  formPickerButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#FFFFFF',
  },
  formPickerText: {
    fontSize: 16,
    color: '#111827',
    flex: 1,
  },
  formInputContainer: {
    marginTop: 20,
  },
  formNameInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#FFFFFF',
    marginTop: 8,
  },
  fieldsContainer: {
    marginTop: 20,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  fieldInputs: {
    flex: 1,
    marginRight: 12,
  },
  fieldLabelInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 6,
    padding: 8,
    fontSize: 14,
    backgroundColor: '#FFFFFF',
    marginBottom: 8,
  },
  fieldTypeButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 6,
    padding: 8,
    backgroundColor: '#FFFFFF',
  },
  fieldTypeText: {
    fontSize: 14,
    color: '#111827',
  },
  removeFieldButton: {
    padding: 8,
  },
  addFieldButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderStyle: 'dashed',
  },
  addFieldButtonText: {
    marginLeft: 8,
    fontSize: 16,
    color: '#3B82F6',
    fontWeight: '500',
  },
  // Delete button styles
  deleteButton: {
    padding: 8,
    marginLeft: 8,
    flexShrink: 0, // Prevent button from shrinking
  },
  checklistItemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%', // Ensure full width
    paddingHorizontal: 4, // Add some padding to prevent overflow
  },
  attachmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    width: '100%', // Ensure full width
    paddingHorizontal: 4, // Add some padding to prevent overflow
  },
  formTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8, // Add margin to separate from delete button
  },
  approvalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
    width: '100%', // Ensure full width
    paddingHorizontal: 4, // Add some padding to prevent overflow
  },
  deleteTaskSection: {
    marginTop: 32,
    marginBottom: 16,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  deleteTaskButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EF4444',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 200,
  },
  deleteTaskButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  deleteTaskWarning: {
    marginTop: 8,
    fontSize: 12,
    color: '#6B7280',
    fontStyle: 'italic',
  },
  // Empty state styles
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    paddingHorizontal: 16,
  },
  emptyStateText: {
    marginTop: 12,
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  // Add New Attachment styles
  addNewAttachmentSection: {
    paddingTop: 16,
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  addNewAttachmentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#3B82F6',
    borderStyle: 'dashed',
    borderRadius: 8,
    gap: 8,
  },
  addNewAttachmentButtonEmpty: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#3B82F6',
    borderStyle: 'dashed',
    borderRadius: 8,
    gap: 8,
    marginTop: 16,
  },
  addNewAttachmentButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#3B82F6',
  },
  emptyAttachmentsContainer: {
    padding: 20,
    alignItems: 'center',
  },
  emptyAttachmentsText: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
  },
});
