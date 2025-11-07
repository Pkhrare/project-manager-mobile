import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  ScrollView, 
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import io from 'socket.io-client';
import ApiCaller from '../../api/apiCaller';
import AIDropdown from '../ai/AIDropdown';
import AITypingIndicator from '../ai/AITypingIndicator';
import AIMessage from '../ai/AIMessage';
import MessageBubble from './MessageBubble';
import { 
  isAIMessage, 
  isConsultantMessage, 
  isClientMessage, 
  shouldTriggerAI, 
  validateAIRequest, 
  createAIRequestPayload,
  debounce 
} from '../../utils/aiUtils';

const ProjectChat = ({ projectData, userRole, style = {} }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [chatAttachment, setChatAttachment] = useState(null);
  const [isUploadingChatFile, setIsUploadingChatFile] = useState(false);
  const [isAIMode, setIsAIMode] = useState(false);
  const [isAITyping, setIsAITyping] = useState(false);
  const [aiRequestInProgress, setAiRequestInProgress] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Debug logging
  useEffect(() => {
    console.log('ProjectChat - projectData:', projectData);
    console.log('ProjectChat - userRole:', userRole);
    console.log('ProjectChat - loading:', loading);
    console.log('ProjectChat - messages count:', messages.length);
  }, [projectData, userRole, loading, messages.length]);
  
  const socketRef = useRef(null);
  const scrollViewRef = useRef(null);
  const chatFileInputRef = useRef(null);

  // Debounced AI request handler
  const debouncedAIRequest = useCallback(
    debounce(async (projectId, message, sender) => {
      if (!socketRef.current) return;
      
      const validation = validateAIRequest(projectId, message, sender);
      if (!validation.isValid) {
        Alert.alert('AI Request Error', validation.error);
        return;
      }

      setAiRequestInProgress(true);
      const payload = createAIRequestPayload(projectId, message, sender);
      
      console.log('Sending AI request:', payload);
      socketRef.current.emit('waiverlyn:request', payload);
    }, 2000), // 2 second debounce
    [socketRef]
  );

  // Fetch project messages
  const fetchProjectMessages = useCallback(async () => {
    if (!projectData?.fields?.['Project ID']) {
      // For demo purposes, create some sample messages
      const sampleMessages = [
        {
          id: 'msg1',
          createdTime: new Date(Date.now() - 60000).toISOString(),
          fields: {
            sender: 'Consultant',
            message_text: 'Welcome to the project chat! How can I help you today?',
            is_read: true
          }
        },
        {
          id: 'msg2',
          createdTime: new Date(Date.now() - 30000).toISOString(),
          fields: {
            sender: projectData?.fields?.['Project Name'] || 'Client',
            message_text: 'Hi! I have a question about the project timeline.',
            is_read: true
          }
        }
      ];
      setMessages(sampleMessages);
      setLoading(false);
      return;
    }
    
    try {
      const { records } = await ApiCaller(`/messages/${projectData.fields['Project ID']}/project_messages`);
      const sortedMessages = records.sort((a, b) => new Date(a.createdTime) - new Date(b.createdTime));
      setMessages(sortedMessages);
    } catch (err) {
      console.error('Failed to load project chat history:', err);
      Alert.alert('Error', 'Failed to load chat history');
    } finally {
      setLoading(false);
    }
  }, [projectData?.fields?.['Project ID'], projectData?.fields?.['Project Name']]);

  // Socket.IO connection and event handlers
  useEffect(() => {
    // For demo purposes, we'll skip socket connection if no project data
    if (!projectData?.id) {
      console.log('ProjectChat - No project data, skipping socket connection');
      return;
    }

    socketRef.current = io("https://ats-backend-805977745256.us-central1.run.app");

    socketRef.current.on('connect', () => {
      console.log('Connected to project socket server');
      socketRef.current.emit('joinProjectRoom', projectData.id);
    });

    socketRef.current.on('receiveProjectMessage', (message) => {
      setMessages(prevMessages => {
        const newMessages = [...prevMessages, message];
        // When a new message is received, check if it should be marked as read immediately
        if (message.fields.sender === 'Consultant') {
          setTimeout(() => {
            socketRef.current.emit('markMessagesAsRead', {
              messageIds: [message.id],
              tableName: 'project_messages'
            });
          }, 1000);
        }
        return newMessages.map(m =>
          m.id === message.id && message.fields.sender === 'Consultant'
            ? { ...m, fields: { ...m.fields, is_read: true } }
            : m
        );
      });
    });

    socketRef.current.on('sendProjectMessageError', (error) => {
      console.error("Error sending project message:", error);
      Alert.alert('Error', 'Failed to send message');
    });

    // AI-related socket events
    socketRef.current.on('waiverlyn:typing', (data) => {
      setIsAITyping(data.isTyping);
    });

    socketRef.current.on('waiverlyn:response', (data) => {
      console.log('Received Waiverlyn response:', data);
      setAiRequestInProgress(false);
      setIsAITyping(false);
      
      // Sanitize AI response to ensure raw Lexical JSON (strip code fences, etc.)
      if (data?.message?.fields?.message_text && typeof data.message.fields.message_text === 'string') {
        try {
          const { sanitizeLexicalJsonString } = require('../../utils/aiUtils');
          data.message.fields.message_text = sanitizeLexicalJsonString(data.message.fields.message_text);
        } catch (e) {
          console.warn('Failed to sanitize AI response, using as-is', e);
        }
      }

      // Add the AI response to the messages
      if (data.message) {
        setMessages(prevMessages => [...prevMessages, data.message]);
      }
    });

    socketRef.current.on('waiverlyn:error', (data) => {
      console.error('Waiverlyn error:', data);
      setAiRequestInProgress(false);
      setIsAITyping(false);
      
      Alert.alert('AI Error', data.error);
    });

    return () => {
      if (projectData?.id) {
        socketRef.current.emit('leaveProjectRoom', projectData.id);
      }
      socketRef.current.disconnect();
    };
  }, [projectData?.id]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollViewRef.current && messages.length > 0) {
      setTimeout(() => {
        scrollViewRef.current.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  // Load messages on mount
  useEffect(() => {
    fetchProjectMessages();
  }, [fetchProjectMessages]);

  // Mark messages as read
  useEffect(() => {
    if (messages.length > 0 && socketRef.current && projectData) {
      const unreadMessageIds = messages
        .filter(msg => !msg.fields.is_read && msg.fields.sender === 'Consultant')
        .map(msg => msg.id);

      if (unreadMessageIds.length > 0) {
        socketRef.current.emit('markMessagesAsRead', {
          messageIds: unreadMessageIds,
          tableName: 'project_messages'
        });
        // Optimistic update
        setMessages(prevMessages =>
          prevMessages.map(msg =>
            unreadMessageIds.includes(msg.id)
              ? { ...msg, fields: { ...msg.fields, is_read: true } }
              : msg
          )
        );
      }
    }
  }, [messages, projectData]);

  const handleSendMessage = async () => {
    const messageContent = newMessage.trim();
    
    // Allow sending if either there's a message or an attachment
    if (!messageContent && !chatAttachment) return;
    
    const senderName = userRole === 'client' 
      ? (projectData?.fields?.['Project Name'] || 'Client')
      : 'Consultant';
    
    // For demo purposes, if no socket connection, just add message locally
    if (!socketRef.current) {
      const newMsg = {
        id: `demo_${Date.now()}`,
        createdTime: new Date().toISOString(),
        fields: {
          sender: senderName,
          message_text: messageContent,
          is_read: true
        }
      };
      setMessages(prev => [...prev, newMsg]);
      setNewMessage('');
      setChatAttachment(null);
      return;
    }
    
    try {
      setIsUploadingChatFile(true);
      
      let attachmentUrl = null;
      
      // If there's a file attachment, upload it first
      if (chatAttachment) {
        const formData = new FormData();
        formData.append('file', chatAttachment);
        formData.append('sourceTable', 'project_messages');
        formData.append('sourceRecordId', projectData.id);
        
        const response = await ApiCaller('/upload-image', {
          method: 'POST',
          body: formData,
        });
        
        console.log('Upload response:', response);
        
        // Try different ways to access the URL
        if (response && typeof response === 'object') {
          if (response.url) {
            attachmentUrl = response.url;
          } else if (response.data && response.data.url) {
            attachmentUrl = response.data.url;
          } else if (typeof response === 'string' && response.includes('http')) {
            attachmentUrl = response;
          } else {
            // Try to find any URL-like string in the response
            const responseStr = JSON.stringify(response);
            const urlMatch = responseStr.match(/(https?:\/\/[^\s"]+)/);
            if (urlMatch) {
              attachmentUrl = urlMatch[0];
            }
          }
        }
      }
      
      // Send the message with optional attachment
      const messageData = {
        projectId: projectData.id,
        message: messageContent || (chatAttachment ? chatAttachment.name : ''),
        sender: senderName,
        attachmentUrl: attachmentUrl || null,
        attachmentName: chatAttachment ? chatAttachment.name : null,
        attachmentType: chatAttachment ? chatAttachment.type : null,
        attachment_url: attachmentUrl || null,
        attachment_name: chatAttachment ? chatAttachment.name : null,
        attachment_type: chatAttachment ? chatAttachment.type : null,
      };
      
      console.log('Sending project message with data:', messageData);
      socketRef.current.emit('sendProjectMessage', messageData);
      
      // Trigger AI response if in AI mode and conditions are met
      if (isAIMode && shouldTriggerAI(messageContent, true) && !aiRequestInProgress) {
        debouncedAIRequest(projectData.id, messageContent, senderName);
      }
      
      // Clear the input
      setNewMessage('');
      setChatAttachment(null);
    } catch (error) {
      console.error('Failed to send message with attachment:', error);
      Alert.alert('Error', 'Failed to upload attachment. Please try again.');
    } finally {
      setIsUploadingChatFile(false);
    }
  };

  const handleFilePick = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        setChatAttachment({
          name: file.name,
          type: file.mimeType,
          uri: file.uri,
        });
      }
    } catch (error) {
      console.error('Error picking file:', error);
      Alert.alert('Error', 'Failed to pick file');
    }
  };

  const removeAttachment = () => {
    setChatAttachment(null);
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer, style]}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loadingText}>Loading chat...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={[styles.container, style]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Debug Info */}
      <View style={{ padding: 10, backgroundColor: 'lightgreen' }}>
        <Text style={{ color: 'black', fontSize: 12 }}>
          DEBUG ProjectChat: projectData={projectData ? 'YES' : 'NO'}, messages={messages.length}, loading={loading.toString()}
        </Text>
      </View>
      
      {/* Chat Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>💬 General Discussion</Text>
        <AIDropdown 
          isAIMode={isAIMode}
          onToggle={setIsAIMode}
          disabled={isUploadingChatFile || aiRequestInProgress}
        />
      </View>

      {/* AI Mode Indicator */}
      {isAIMode && (
        <View style={styles.aiIndicator}>
          <Ionicons name="information-circle" size={16} color="#7C3AED" />
          <Text style={styles.aiIndicatorText}>AI responses use redacted project context</Text>
        </View>
      )}

      {/* Messages */}
      <ScrollView 
        ref={scrollViewRef}
        style={styles.messagesContainer}
        showsVerticalScrollIndicator={false}
      >
        {messages.map((msg) => {
          const isAI = isAIMessage(msg);
          const isConsultant = isConsultantMessage(msg);
          const isClient = isClientMessage(msg, projectData.fields['Project Name']);
          
          if (isAI) {
            return <AIMessage key={msg.id} message={msg} />;
          }
          
          return (
            <MessageBubble 
              key={msg.id} 
              message={msg} 
              userRole={userRole}
              projectName={projectData.fields['Project Name']}
            />
          );
        })}
        
        {/* AI Typing Indicator */}
        <AITypingIndicator isTyping={isAITyping} />
      </ScrollView>

      {/* Attachment Preview */}
      {chatAttachment && (
        <View style={styles.attachmentPreview}>
          <View style={styles.attachmentInfo}>
            <Ionicons name="document" size={20} color="#3B82F6" />
            <Text style={styles.attachmentName} numberOfLines={1}>
              {chatAttachment.name}
            </Text>
          </View>
          <TouchableOpacity onPress={removeAttachment} style={styles.removeAttachment}>
            <Ionicons name="close" size={20} color="#6B7280" />
          </TouchableOpacity>
        </View>
      )}

      {/* Message Input */}
      <View style={styles.inputContainer}>
        <View style={styles.inputRow}>
          <TextInput
            style={[
              styles.textInput,
              isAIMode && styles.aiTextInput
            ]}
            value={newMessage}
            onChangeText={setNewMessage}
            placeholder={isAIMode ? "Ask Waiverlyn about your project..." : "Type a message..."}
            placeholderTextColor="#9CA3AF"
            multiline
            maxLength={1000}
            editable={!isUploadingChatFile && !aiRequestInProgress}
          />
          
          <TouchableOpacity 
            onPress={handleFilePick}
            style={[
              styles.attachmentButton,
              (isUploadingChatFile || chatAttachment) && styles.disabledButton
            ]}
            disabled={isUploadingChatFile || !!chatAttachment}
          >
            <Ionicons 
              name="attach" 
              size={20} 
              color={isUploadingChatFile || chatAttachment ? "#9CA3AF" : "#6B7280"} 
            />
          </TouchableOpacity>
          
          <TouchableOpacity 
            onPress={handleSendMessage}
            style={[
              styles.sendButton,
              isAIMode ? styles.aiSendButton : styles.regularSendButton,
              (isUploadingChatFile || aiRequestInProgress) && styles.disabledButton
            ]}
            disabled={isUploadingChatFile || aiRequestInProgress}
          >
            {isUploadingChatFile || aiRequestInProgress ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Ionicons name="send" size={20} color="white" />
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
  },
  aiIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    backgroundColor: '#F3E8FF',
    borderBottomWidth: 1,
    borderBottomColor: '#C084FC',
    gap: 6,
  },
  aiIndicatorText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#7C3AED',
  },
  messagesContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  attachmentPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#EFF6FF',
    borderTopWidth: 1,
    borderTopColor: '#DBEAFE',
  },
  attachmentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  attachmentName: {
    fontSize: 14,
    color: '#3B82F6',
    fontWeight: '500',
    flex: 1,
  },
  removeAttachment: {
    padding: 4,
  },
  inputContainer: {
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#374151',
    backgroundColor: 'white',
    maxHeight: 100,
  },
  aiTextInput: {
    borderColor: '#C084FC',
  },
  attachmentButton: {
    padding: 10,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
  },
  sendButton: {
    padding: 10,
    borderRadius: 12,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  regularSendButton: {
    backgroundColor: '#3B82F6',
  },
  aiSendButton: {
    backgroundColor: '#7C3AED',
  },
  disabledButton: {
    opacity: 0.5,
  },
});

export default ProjectChat;
