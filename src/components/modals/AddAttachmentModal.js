import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import ApiCaller from '../../api/apiCaller';

// Predefined attachment descriptions list (copied from web app)
const ATTACHMENT_DESCRIPTIONS = [
  'Other',
  "Articles of Incorporation/Business Registration",
  "IRS EIN Confirmation",
  "Certificate of Good Standing",
  "Bylaws (if Applicable)",
  "Operating Agreement",
  "Completed Application Form",
  "Licensing Fee Payment Proof",
  "Signed Provider Agreement",
  "Renewal Application (if applicable)",
  "Policy & Procedure Manual",
  "Background Check Clearances (State/FBI)",
  "HIPAA Compliance Agreement",
  "NPI Number",
  "Medicaid/Medicare Enrollment Proof",
  "OSHA Compliance Documentation",
  "Anti-Kickback Statute Compliance Statement",
  "Proof of Financial Stability (Bank Statements, etc.)",
  "Liability, Workers' Comp & Professional Insurance",
  "Audit Reports (if required)",
  "Bond Requirements (if applicable)",
  "Organizational Chart and Staffing Plan",
  "Employee Licenses, Resumes, and Certifications",
  "Accreditation & Medical Director Agreements",
  "Clinical Staff Licenses and Training Certificates",
  "Fire/Health Department Inspection Reports",
  "Lease/Ownership Documentation and Safety Plans",
  "ADA Compliance Documentation",
  "Emergency Preparedness Plan",
  "Provider Participation & Referral Agreements",
  "Vendor/Supplier Contracts",
  "Business Associate Agreements (BAA)",
  "Staff Orientation Materials and Training Records",
  "Medicaid/Medicare Enrollment Applications",
  "CAQH Enrollment (if required)",
  "Medicaid/Medicare P&P Manual",
  "Managed Care Organization (MCO) Contracts",
  "Quality Assurance/Risk Management Plans",
  "Client Satisfaction and Performance Review Forms",
  "Root Cause Analysis Reports (if applicable)",
  "State-Specific Waiver, Special Permits, or Addendums",
  "Local Health Department Approvals",
  "Environmental Impact Assessments (if applicable)",
  "Cybersecurity Policies",
  "Electronic Health Record (EHR) System Documentation",
  "Disaster Recovery Plan",
  "Marketing Materials Approval",
  "Advertising Disclosures"
];

function AddAttachmentModal({ isVisible, onClose, taskId, onAttachmentAdded, task }) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [attachmentDescription, setAttachmentDescription] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Filter descriptions based on search term
  const filteredDescriptions = useMemo(() => {
    if (!searchTerm.trim()) return ATTACHMENT_DESCRIPTIONS;
    return ATTACHMENT_DESCRIPTIONS.filter(desc =>
      desc.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm]);

  const handleFilePick = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        return;
      }

      const file = result.assets[0];
      setSelectedFile(file);
      setError(null);
    } catch (error) {
      console.error('Error picking file:', error);
      Alert.alert('Error', 'Failed to select file. Please try again.');
    }
  };

  const handleDescriptionSelect = (description) => {
    setAttachmentDescription(description);
    setSearchTerm(description);
    setIsDropdownOpen(false);
  };

  const handleSearchChange = (text) => {
    setSearchTerm(text);
    setIsDropdownOpen(true);
  };

  const handleSubmit = async () => {
    if (!selectedFile) {
      setError('Please select a file to upload');
      return;
    }

    if (!attachmentDescription || !attachmentDescription.trim()) {
      setError('Please select or enter an attachment description');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Validate taskId is provided
      if (!taskId) {
        throw new Error('Task ID is required');
      }

      // Debug: Log task object structure
      console.log('=== AddAttachmentModal Debug ===');
      console.log('taskId prop:', taskId);
      console.log('task?.id:', task?.id);
      console.log('task?.fields?.id:', task?.fields?.id);
      console.log('Full task object:', task);
      console.log('==============================');

      // Determine the correct Airtable record ID to use
      // The task_id field in task_attachments expects the Airtable record ID (like "rec...")
      // If taskId looks like a human-readable ID (contains spaces or starts with letter+number), 
      // we need to use task.id instead (the actual Airtable record ID)
      let actualTaskRecordId = taskId;
      
      // Check if taskId looks like a human-readable ID (e.g., "T4 try", "NY-Waiver-20241225P1-T1")
      // Human-readable IDs typically contain spaces, hyphens with letters, or patterns like "T1", "T2"
      if (taskId && (taskId.includes(' ') || /^[A-Z]/.test(taskId)) && task?.id) {
        console.log('Detected human-readable ID, using task.id instead');
        actualTaskRecordId = task.id;
      }
      
      // Final validation: ensure we have a valid record ID
      if (!actualTaskRecordId || (!actualTaskRecordId.startsWith('rec') && task?.id)) {
        console.log('TaskId does not look like Airtable record ID, trying task.id');
        actualTaskRecordId = task?.id || taskId;
      }

      console.log('Using task record ID:', actualTaskRecordId);

      // Step 1: Create a new attachment record
      const attachmentRecord = {
        fields: {
          attachment_description: attachmentDescription.trim(),
          task_id: [actualTaskRecordId]
        }
      };

      console.log('Creating attachment record:', attachmentRecord);
      
      const createResponse = await ApiCaller('/records', {
        method: 'POST',
        body: JSON.stringify({
          recordsToCreate: [attachmentRecord],
          tableName: 'task_attachments'
        })
      });

      console.log('Create response:', createResponse);

      if (!createResponse || !createResponse.records || !createResponse.records[0]) {
        throw new Error('Failed to create attachment record');
      }

      const newAttachment = createResponse.records[0];
      console.log('New attachment created:', newAttachment);

      // Step 2: Sanitize filename for upload
      const sanitizedFileName = selectedFile.name
        ? selectedFile.name
            .replace(/\s+/g, '_')
            .replace(/[<>:"/\\|?*]/g, '_')
            .replace(/_{2,}/g, '_')
            .replace(/^_+|_+$/g, '')
        : 'uploaded_file';

      // Step 3: Upload the file to the new attachment record
      const formData = new FormData();
      formData.append('file', {
        uri: selectedFile.uri,
        type: selectedFile.mimeType || 'application/octet-stream',
        name: sanitizedFileName,
        size: selectedFile.size
      });

      console.log('Uploading file to attachment:', newAttachment.id);
      const uploadResponse = await ApiCaller(`/upload/task_attachments/${newAttachment.id}/Attachments`, {
        method: 'POST',
        body: formData,
      });

      console.log('Upload response:', uploadResponse);

      // Step 4: Fetch the complete attachment data with the uploaded file
      console.log('Fetching complete attachment data');
      const completeAttachment = await ApiCaller(`/records/task_attachments/${newAttachment.id}`);
      console.log('Complete attachment:', completeAttachment);

      // Step 5: Notify parent component
      onAttachmentAdded(completeAttachment);

      // Reset form and close modal
      setSelectedFile(null);
      setAttachmentDescription('Other');
      setSearchTerm('Other');
      setIsDropdownOpen(false);
      onClose();

      Alert.alert('Success', 'Attachment added successfully!');
    } catch (err) {
      console.error('Failed to upload attachment:', err);
      let errorMessage = 'Failed to upload attachment. Please try again.';
      if (err.message) {
        errorMessage = err.message;
      }
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setSelectedFile(null);
      setAttachmentDescription('Other');
      setSearchTerm('Other');
      setIsDropdownOpen(false);
      setError(null);
      onClose();
    }
  };

  if (!isVisible) return null;

  return (
    <Modal
      visible={isVisible}
      transparent={true}
      animationType="slide"
      onRequestClose={handleClose}
    >
      <SafeAreaView style={styles.modalOverlay}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={handleClose}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
            style={styles.modalContainer}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add New Attachment</Text>
              <TouchableOpacity
                onPress={handleClose}
                disabled={isLoading}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <ScrollView 
              style={styles.modalContent} 
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled={true}
              keyboardShouldPersistTaps="handled"
            >
              {/* Attachment Description */}
              <View style={styles.inputSection}>
                <Text style={styles.inputLabel}>Attachment Description</Text>
                <View style={styles.searchContainer}>
                  <TextInput
                    style={styles.searchInput}
                    value={searchTerm}
                    onChangeText={handleSearchChange}
                    onFocus={() => setIsDropdownOpen(true)}
                    placeholder="Search or type attachment description..."
                    placeholderTextColor="#9CA3AF"
                    editable={!isLoading}
                  />
                  <TouchableOpacity
                    style={styles.dropdownIcon}
                    onPress={() => setIsDropdownOpen(!isDropdownOpen)}
                  >
                    <Ionicons
                      name={isDropdownOpen ? 'chevron-up' : 'chevron-down'}
                      size={20}
                      color="#6B7280"
                    />
                  </TouchableOpacity>
                </View>

                {isDropdownOpen && filteredDescriptions.length > 0 && (
                  <View style={styles.dropdownContainer}>
                    <ScrollView
                      style={styles.dropdownScrollView}
                      nestedScrollEnabled={true}
                      scrollEnabled={true}
                      showsVerticalScrollIndicator={true}
                      keyboardShouldPersistTaps="handled"
                      bounces={false}
                    >
                      {filteredDescriptions.map((item, index) => (
                        <TouchableOpacity
                          key={item + index}
                          style={styles.dropdownItem}
                          onPress={() => handleDescriptionSelect(item)}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.dropdownItemText}>{item}</Text>
                          {item === attachmentDescription && (
                            <Ionicons name="checkmark" size={20} color="#3B82F6" />
                          )}
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}

                {isDropdownOpen && filteredDescriptions.length === 0 && (
                  <View style={styles.dropdownContainer}>
                    <Text style={styles.noResultsText}>No matching descriptions found</Text>
                  </View>
                )}
              </View>

              {/* File Selection */}
              <View style={styles.inputSection}>
                <Text style={styles.inputLabel}>Select File</Text>
                <TouchableOpacity
                  style={styles.filePickerButton}
                  onPress={handleFilePick}
                  disabled={isLoading}
                >
                  <Ionicons name="document-attach-outline" size={24} color="#3B82F6" />
                  <Text style={styles.filePickerText}>
                    {selectedFile ? selectedFile.name : 'Tap to select a file'}
                  </Text>
                </TouchableOpacity>
                {selectedFile && (
                  <Text style={styles.fileInfoText}>
                    {selectedFile.size ? `Size: ${(selectedFile.size / 1024).toFixed(2)} KB` : ''}
                  </Text>
                )}
              </View>

              {/* Error Message */}
              {error && (
                <View style={styles.errorContainer}>
                  <Ionicons name="alert-circle" size={20} color="#EF4444" />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              {/* Action Buttons */}
              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={[styles.button, styles.cancelButton]}
                  onPress={handleClose}
                  disabled={isLoading}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.button,
                    styles.submitButton,
                    (!selectedFile || isLoading) && styles.submitButtonDisabled
                  ]}
                  onPress={handleSubmit}
                  disabled={!selectedFile || isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.submitButtonText}>Upload Attachment</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    width: '100%',
    maxWidth: 500,
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1F2937',
  },
  closeButton: {
    padding: 4,
  },
  modalContent: {
    padding: 20,
  },
  inputSection: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  searchContainer: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
  },
  searchInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1F2937',
  },
  dropdownIcon: {
    padding: 12,
  },
  dropdownContainer: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    height: 200,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  dropdownScrollView: {
    flex: 1,
  },
  dropdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  dropdownItemText: {
    fontSize: 14,
    color: '#374151',
    flex: 1,
  },
  noResultsText: {
    padding: 12,
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  filePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderWidth: 2,
    borderColor: '#3B82F6',
    borderStyle: 'dashed',
    borderRadius: 8,
    backgroundColor: '#F0F9FF',
  },
  filePickerText: {
    marginLeft: 12,
    fontSize: 16,
    color: '#3B82F6',
    fontWeight: '500',
    flex: 1,
  },
  fileInfoText: {
    marginTop: 8,
    fontSize: 12,
    color: '#6B7280',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 8,
    marginBottom: 20,
  },
  errorText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#991B1B',
    flex: 1,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  button: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  submitButton: {
    backgroundColor: '#3B82F6',
  },
  submitButtonDisabled: {
    backgroundColor: '#9CA3AF',
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default AddAttachmentModal;

