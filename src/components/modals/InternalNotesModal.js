import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  Platform,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ApiCaller from '../../api/apiCaller';

const InternalNotesModal = ({ 
  isVisible, 
  onClose, 
  projectId, 
  projectRecordId,
  userRole = 'consultant' 
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [newNoteContent, setNewNoteContent] = useState(null);
  const [internalNotes, setInternalNotes] = useState([]);
  const notesEditorRef = useRef(null);

  // Load internal notes content
  const loadInternalNotes = useCallback(async () => {
    if (!projectId) return;
    
    setIsLoading(true);
    try {
      // Fetch internal notes using the same approach as the web app
      // Note: projectId here should be the human-readable Project ID, not the Airtable record ID
      const response = await ApiCaller(`/records/filter/${projectId}/internal_notes`);
      console.log('Internal notes API response:', response);
      console.log('Using projectId for internal notes:', projectId);
      
      const notes = Array.isArray(response?.records) ? response.records : [];
      console.log('Parsed notes:', notes);
      console.log('Number of notes found:', notes.length);
      
      // Sort by created time, newest first
      const sortedNotes = notes.sort((a, b) => new Date(b.createdTime) - new Date(a.createdTime));
      console.log('Sorted notes:', sortedNotes);
      setInternalNotes(sortedNotes);
    } catch (error) {
      console.error('Failed to load internal notes:', error);
      setInternalNotes([]);
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  // Convert plain text to Lexical JSON format
  const convertTextToLexical = (text) => {
    if (!text || text.trim() === '') {
      return '{"root":{"children":[{"children":[],"direction":null,"format":"","indent":0,"type":"paragraph","version":1}],"direction":null,"format":"","indent":0,"type":"root","version":1}}';
    }
    
    // Create a simple Lexical JSON structure for plain text
    return JSON.stringify({
      root: {
        children: [{
          children: [{
            detail: 0,
            format: 0,
            mode: "normal",
            style: "",
            text: text.trim(),
            type: "text",
            version: 1
          }],
          direction: "ltr",
          format: "",
          indent: 0,
          type: "paragraph",
          version: 1,
          textFormat: 0,
          textStyle: ""
        }],
        direction: "ltr",
        format: "",
        indent: 0,
        type: "root",
        version: 1
      }
    });
  };

  // Add new internal note
  const handleAddNote = async () => {
    if (!newNoteContent || !newNoteContent.trim() || !projectRecordId) {
      Alert.alert('Error', 'Please enter a note before saving.');
      return;
    }

    setIsSaving(true);
    try {
      // Convert plain text to Lexical JSON format to match web app
      const lexicalContent = convertTextToLexical(newNoteContent);
      
      // Save as a new internal note record, similar to the web app
      await ApiCaller('/records', {
        method: 'POST',
        body: JSON.stringify({
          tableName: 'internal_notes',
          recordsToCreate: [{
            fields: {
              'Projects': [projectRecordId], // Use the Airtable record ID for the Projects field
              'Notes': lexicalContent,
              'User': 'Mobile App' // You might want to pass the actual user name
            }
          }]
        })
      });

      // Refresh the notes list
      await loadInternalNotes();
      
      // Reset the form
      setNewNoteContent(null);
      setIsAddingNote(false);
      Alert.alert('Success', 'Internal note added successfully!');
    } catch (error) {
      console.error('Failed to add internal note:', error);
      Alert.alert('Error', 'Failed to add internal note. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Format timestamp for display
  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Load notes when modal opens
  useEffect(() => {
    if (isVisible) {
      loadInternalNotes();
      setIsAddingNote(false);
      setNewNoteContent(null);
    }
  }, [isVisible, loadInternalNotes]);

  // Simple rich text renderer for mobile
  const renderRichText = (content) => {
    if (!content) return <Text style={styles.emptyText}>No internal notes available</Text>;
    
    try {
      const parsed = JSON.parse(content);
      if (parsed.root && parsed.root.children) {
        return parsed.root.children.map((child, index) => {
          if (child.type === 'paragraph' && child.children) {
            return (
              <Text key={index} style={styles.paragraph}>
                {child.children.map((textNode, textIndex) => {
                  let textStyle = styles.text;
                  if (textNode.format) {
                    if (textNode.format & 1) textStyle = { ...textStyle, fontWeight: 'bold' };
                    if (textNode.format & 2) textStyle = { ...textStyle, fontStyle: 'italic' };
                    if (textNode.format & 8) textStyle = { ...textStyle, textDecorationLine: 'underline' };
                  }
                  return (
                    <Text key={textIndex} style={textStyle}>
                      {textNode.text || ''}
                    </Text>
                  );
                })}
              </Text>
            );
          }
          return null;
        });
      }
    } catch (error) {
      console.error('Error parsing rich text:', error);
    }
    
    return <Text style={styles.emptyText}>No internal notes available</Text>;
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
          <Text style={styles.headerTitle}>Internal Notes</Text>
          <View style={styles.headerActions}>
            {/* Header actions removed - now handled in the content area */}
          </View>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#3B82F6" />
              <Text style={styles.loadingText}>Loading internal notes...</Text>
            </View>
          ) : (
            <View style={styles.notesContainer}>
              {/* Add Note Button */}
              {!isAddingNote && userRole === 'consultant' && (
                <TouchableOpacity 
                  style={styles.addNoteButton}
                  onPress={() => setIsAddingNote(true)}
                >
                  <Ionicons name="add" size={20} color="#3B82F6" />
                  <Text style={styles.addNoteButtonText}>Add Note</Text>
                </TouchableOpacity>
              )}

              {/* Add Note Form */}
              {isAddingNote && (
                <View style={styles.addNoteForm}>
                  <Text style={styles.addNoteFormTitle}>Add Internal Note</Text>
                  <TextInput
                    style={styles.noteTextInput}
                    placeholder="Enter your internal note here..."
                    placeholderTextColor="#9CA3AF"
                    value={newNoteContent}
                    onChangeText={setNewNoteContent}
                    multiline={true}
                    numberOfLines={4}
                    textAlignVertical="top"
                    autoFocus={true}
                    returnKeyType="default"
                    blurOnSubmit={false}
                  />
                  <View style={styles.addNoteActions}>
                    <TouchableOpacity 
                      style={styles.cancelButton}
                      onPress={() => {
                        setIsAddingNote(false);
                        setNewNoteContent(null);
                      }}
                    >
                      <Text style={styles.cancelButtonText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.saveButton, (!newNoteContent || !newNoteContent.trim() || isSaving) && styles.saveButtonDisabled]}
                      onPress={handleAddNote}
                      disabled={!newNoteContent || !newNoteContent.trim() || isSaving}
                    >
                      <Text style={styles.saveButtonText}>
                        {isSaving ? 'Adding...' : 'Add Note'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Notes List */}
              {internalNotes.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="document-text-outline" size={48} color="#9CA3AF" />
                  <Text style={styles.emptyStateText}>No internal notes yet.</Text>
                  <Text style={styles.emptyStateSubtext}>Add the first note to start logging project changes.</Text>
                </View>
              ) : (
                <View style={styles.notesList}>
                  {internalNotes.map((note) => (
                    <View key={note.id} style={styles.noteCard}>
                      <View style={styles.noteHeader}>
                        <View style={styles.noteUserInfo}>
                          <View style={styles.userAvatar}>
                            <Text style={styles.userInitial}>
                              {note.fields.User ? note.fields.User.charAt(0).toUpperCase() : 'U'}
                            </Text>
                          </View>
                          <View>
                            <Text style={styles.noteUser}>{note.fields.User || 'Unknown User'}</Text>
                            <Text style={styles.noteTimestamp}>
                              {formatTimestamp(note.fields.Created || note.createdTime)}
                            </Text>
                          </View>
                        </View>
                      </View>
                      <View style={styles.noteContent}>
                        {renderRichText(note.fields.Notes)}
                      </View>
                    </View>
                  ))}
                </View>
              )}
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
    flex: 1,
    textAlign: 'center',
  },
  headerActions: {
    width: 80,
    alignItems: 'flex-end',
  },
  editButton: {
    padding: 8,
  },
  editActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#10B981',
  },
  saveButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 16,
  },
  notesContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  editorContainer: {
    padding: 20,
  },
  editorLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 16,
  },
  editorPlaceholder: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
  },
  editorPlaceholderText: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 12,
    textAlign: 'center',
  },
  editorNote: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 8,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  viewerContainer: {
    padding: 20,
  },
  viewerLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 16,
  },
  notesContent: {
    minHeight: 200,
  },
  paragraph: {
    marginBottom: 12,
    lineHeight: 24,
  },
  text: {
    fontSize: 16,
    color: '#374151',
  },
  emptyText: {
    fontSize: 16,
    color: '#9CA3AF',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 40,
  },
  addNoteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  addNoteButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#3B82F6',
    marginLeft: 8,
  },
  addNoteForm: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  addNoteFormTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E40AF',
    marginBottom: 12,
  },
  noteTextInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#374151',
    backgroundColor: '#FFFFFF',
    minHeight: 100,
    textAlignVertical: 'top',
  },
  addNoteActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 16,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#6B7280',
    marginTop: 12,
    textAlign: 'center',
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 4,
    textAlign: 'center',
  },
  notesList: {
    gap: 16,
  },
  noteCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  noteHeader: {
    marginBottom: 12,
  },
  noteUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  userInitial: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  noteUser: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  noteTimestamp: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  noteContent: {
    marginTop: 8,
  },
});

export default InternalNotesModal;
