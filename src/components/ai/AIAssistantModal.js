import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAIAssistant } from '../../utils/AIAssistantContext';
import { useAuth } from '../../utils/AuthContext';
import ApiCaller from '../../api/apiCaller';
import AIMessage from './AIMessage';
import AITypingIndicator from './AITypingIndicator';
import { buildClientGuidanceContext } from '../../utils/clientGuidanceUtils';
import { renderMarkdownToHtml } from '../../utils/aiUtils';

// Quick prompt buttons for common questions
const QUICK_PROMPTS = [
  { text: "How do I start?", icon: "play-circle" },
  { text: "What is the purpose of this task?", icon: "help-circle" },
  { text: "How do I complete this task?", icon: "checkmark-circle" },
  { text: "What happens after I complete this task?", icon: "arrow-forward-circle" },
  { text: "Why should I complete these tasks?", icon: "information-circle" },
  { text: "How does this get me closer to completing my application packet?", icon: "trending-up" }
];

const AIAssistantModal = () => {
  const {
    isOpen,
    messages,
    isLoading,
    currentProjectId,
    currentTaskId,
    userChatIdentifier,
    toggleOpen,
    addMessage,
    clearConversation,
    getFullContext,
    setIsLoading
  } = useAIAssistant();

  const { userRole, currentUser } = useAuth();
  const [input, setInput] = useState('');
  const scrollViewRef = useRef(null);
  const inputRef = useRef(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (scrollViewRef.current && messages.length > 0) {
      // Use a longer timeout to ensure content is rendered
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 300);
    }
  }, [messages, isLoading]);

  // Track which messages have been sent to avoid duplicates
  const sentMessagesRef = useRef(new Set());

  // Auto-send pending user messages when modal opens
  useEffect(() => {
    if (isOpen && messages.length > 0 && !isLoading) {
      const lastMessage = messages[messages.length - 1];
      // If the last message is a user message and hasn't been sent yet, send it
      if (lastMessage && lastMessage.type === 'user' && !sentMessagesRef.current.has(lastMessage.id)) {
        // Check if there's already an AI response after this message
        const lastMessageIndex = messages.indexOf(lastMessage);
        const hasResponse = messages.slice(lastMessageIndex + 1).some(msg => msg.type === 'ai');
        
        if (!hasResponse) {
          sentMessagesRef.current.add(lastMessage.id);
          // Small delay to ensure modal is fully rendered
          setTimeout(() => {
            handleSendMessage(lastMessage.content, true); // Skip adding message since it's already added
          }, 500);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, messages.length]); // Only check when modal opens or message count changes

  // Helper function to sanitize context
  const sanitizeContext = (obj, seen = new WeakSet()) => {
    if (obj === null || obj === undefined) return null;
    if (typeof obj !== 'object') return obj;
    if (seen.has(obj)) return '[Circular Reference]';
    if (obj instanceof Date) return obj.toISOString();
    
    if (Array.isArray(obj)) {
      seen.add(obj);
      return obj.map(item => sanitizeContext(item, seen));
    }
    
    seen.add(obj);
    const sanitized = {};
    
    for (const key in obj) {
      if (!obj.hasOwnProperty(key)) continue;
      const value = obj[key];
      
      if (typeof value === 'function') continue;
      if (value && typeof value === 'object') {
        if (value.nodeType || value.$$typeof) continue;
        if (value.current !== undefined && typeof value.current === 'object') continue;
        sanitized[key] = sanitizeContext(value, seen);
      } else {
        sanitized[key] = value;
      }
    }
    
    return sanitized;
  };

  const handleSendMessage = async (messageText = null, skipAddingMessage = false) => {
    const textToSend = messageText || input.trim();
    if (!textToSend) return;

    // Clear input
    if (!messageText) {
      setInput('');
    }

    // Get project ID
    const projectId = currentProjectId || 
                     getFullContext().currentProject ||
                     getFullContext().projectData?.id ||
                     getFullContext().projectData?.fields?.['Project ID'];

    if (!projectId) {
      Alert.alert(
        'No Project Selected',
        'Please open a project first to use the AI assistant.',
        [{ text: 'OK' }]
      );
      return;
    }

    // Add user message only if not skipping
    if (!skipAddingMessage) {
      const userMessage = {
        id: Date.now(),
        type: 'user',
        content: textToSend,
        timestamp: new Date().toISOString()
      };
      addMessage(userMessage);
    }

    // Set loading state
    setIsLoading(true);

    try {
      // Build client guidance context if this looks like a guidance question
      const isGuidanceQuestion = QUICK_PROMPTS.some(p => 
        textToSend.toLowerCase().includes(p.text.toLowerCase().replace('?', ''))
      );

      let enrichedContext = getFullContext();
      
      if (isGuidanceQuestion || userRole === 'client') {
        const guidanceContext = await buildClientGuidanceContext(projectId, currentTaskId);
        const { conversationHistory, messages, ...contextWithoutHistory } = enrichedContext;
        
        enrichedContext = {
          ...contextWithoutHistory,
          clientGuidanceContext: guidanceContext,
          isClientGuidance: true,
          conversationHistory: [],
          messages: []
        };
      }

      // Sanitize context
      const sanitizedContext = sanitizeContext(enrichedContext);

      // Get sender name
      const sender = userRole === 'consultant' 
        ? 'Consultant' 
        : (getFullContext().projectData?.fields?.['Project Name'] || 'Client');

      // Determine endpoint based on user role
      const isConsultant = userRole === 'consultant';
      const endpoint = isConsultant
        ? `/ai/consultant/project/${projectId}/assist`
        : `/ai/client/project/${projectId}/assist`;

      // Send to AI endpoint
      const response = await ApiCaller(endpoint, {
        method: 'POST',
        body: JSON.stringify({
          message: textToSend,
          sender: sender,
          executeActions: isConsultant, // Only consultants can execute actions
          context: sanitizedContext,
          userChatIdentifier: userChatIdentifier
        })
      });

      // Handle response - log for debugging
      console.log('AI Response:', JSON.stringify(response, null, 2));
      console.log('Response type:', response.type);
      console.log('Response message:', response.message);
      
      // Helper function to extract text from Lexical JSON
      const extractTextFromLexical = (lexicalJson) => {
        try {
          const parsed = typeof lexicalJson === 'string' ? JSON.parse(lexicalJson) : lexicalJson;
          if (parsed && parsed.root && parsed.root.children) {
            return parsed.root.children
              .map(paragraph => 
                (paragraph.children || [])
                  .map(child => child.text || '')
                  .join('')
              )
              .join('\n');
          }
        } catch (e) {
          // Not Lexical JSON, return as-is
        }
        return null;
      };
      
      let messageContent = 'I received your question.';
      
      if (response.type === 'response' || response.type === 'question') {
        if (response.message) {
          if (typeof response.message === 'string') {
            // Check if it's Lexical JSON
            const lexicalText = extractTextFromLexical(response.message);
            messageContent = lexicalText || response.message;
          } else if (response.message.fields?.message) {
            const msg = response.message.fields.message;
            const lexicalText = extractTextFromLexical(msg);
            messageContent = lexicalText || (typeof msg === 'string' ? msg : JSON.stringify(msg));
          } else if (response.message.fields?.message_text) {
            const msg = response.message.fields.message_text;
            const lexicalText = extractTextFromLexical(msg);
            messageContent = lexicalText || (typeof msg === 'string' ? msg : JSON.stringify(msg));
          } else if (typeof response.message === 'object') {
            // Try to extract message from object
            const msg = response.message.message || response.message.text || JSON.stringify(response.message);
            const lexicalText = extractTextFromLexical(msg);
            messageContent = lexicalText || (typeof msg === 'string' ? msg : msg);
          }
        }
      } else if (response.type === 'data_request') {
        messageContent = response.message || 'I need more information to answer that question.';
      } else if (response.action) {
        // Action was executed
        messageContent = response.message || 'Action completed successfully.';
      } else if (response.message) {
        // Fallback: if there's a message field, use it
        const msg = typeof response.message === 'string' ? response.message : JSON.stringify(response.message);
        const lexicalText = extractTextFromLexical(msg);
        messageContent = lexicalText || msg;
      }

      console.log('Extracted message content:', messageContent);
      console.log('Message content length:', messageContent?.length || 0);

      // Add AI response
      addMessage({
        id: Date.now() + 1,
        type: 'assistant',
        content: messageContent,
        timestamp: new Date().toISOString(),
        action: response.action,
        result: response.result
      });

    } catch (error) {
      console.error('Error sending message to AI:', error);
      const errorMessage = `I encountered an error: ${error.message || 'Unknown error'}. Please try again.`;
      addMessage({
        id: Date.now() + 1,
        type: 'assistant',
        content: errorMessage,
        timestamp: new Date().toISOString(),
        isError: true
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickPrompt = (promptText) => {
    handleSendMessage(promptText);
  };

  const renderMessage = (message) => {
    if (message.type === 'user') {
      return (
        <View key={message.id} style={styles.userMessageContainer}>
          <View style={styles.userMessage}>
            <Text style={styles.userMessageText}>{message.content}</Text>
            <Text style={styles.messageTimestamp}>
              {new Date(message.timestamp).toLocaleTimeString([], { 
                hour: '2-digit', 
                minute: '2-digit' 
              })}
            </Text>
          </View>
        </View>
      );
    } else {
      // AI message - render with better formatting
      // Helper to extract text from various formats
      const extractMessageText = (content) => {
        if (!content) return '';
        
        // If it's a string, check if it's Lexical JSON
        if (typeof content === 'string') {
          // Try to parse as Lexical JSON
          try {
            const parsed = JSON.parse(content);
            if (parsed && parsed.root && parsed.root.children) {
              return parsed.root.children
                .map(paragraph => 
                  (paragraph.children || [])
                    .map(child => child.text || '')
                    .join('')
                )
                .join('\n');
            }
          } catch (e) {
            // Not JSON, return as string
          }
          return content;
        }
        
        // If it's an object, try to extract message
        if (typeof content === 'object') {
          return content.message || content.text || content.content || JSON.stringify(content);
        }
        
        return String(content);
      };
      
      const messageContent = extractMessageText(message.content);
      
      // Debug: Log message content
      console.log('AI Message Content:', messageContent);
      console.log('Message Object:', JSON.stringify(message, null, 2));
      console.log('Message Content Type:', typeof message.content);
      
      // If message content is empty or undefined, show a placeholder
      if (!messageContent || (typeof messageContent === 'string' && messageContent.trim() === '')) {
        return (
          <View key={message.id} style={styles.aiMessageContainer}>
            <View style={styles.aiMessageBubble}>
              <View style={styles.aiMessageHeader}>
                <View style={styles.aiAvatar}>
                  <Ionicons name="sparkles" size={16} color="#FFFFFF" />
                </View>
                <Text style={styles.aiName}>Waiverlyn</Text>
                {message.isError && (
                  <Ionicons name="alert-circle" size={16} color="#EF4444" style={{ marginLeft: 4 }} />
                )}
              </View>
              <Text style={styles.aiMessageText}>
                No response received. Please try again.
              </Text>
              <Text style={styles.aiMessageTimestamp}>
                {new Date(message.timestamp).toLocaleTimeString([], { 
                  hour: '2-digit', 
                  minute: '2-digit' 
                })}
              </Text>
            </View>
          </View>
        );
      }
      
      return (
        <View key={message.id} style={styles.aiMessageContainer}>
          <View style={styles.aiMessageBubble}>
            <View style={styles.aiMessageHeader}>
              <View style={styles.aiAvatar}>
                <Ionicons name="sparkles" size={16} color="#FFFFFF" />
              </View>
              <Text style={styles.aiName}>Waiverlyn</Text>
              {message.isError && (
                <Ionicons name="alert-circle" size={16} color="#EF4444" style={{ marginLeft: 4 }} />
              )}
            </View>
            <Text style={styles.aiMessageText}>
              {messageContent}
            </Text>
            <Text style={styles.aiMessageTimestamp}>
              {new Date(message.timestamp).toLocaleTimeString([], { 
                hour: '2-digit', 
                minute: '2-digit' 
              })}
            </Text>
          </View>
        </View>
      );
    }
  };

  return (
    <Modal
      visible={isOpen}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={toggleOpen}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.avatarContainer}>
              <Ionicons name="sparkles" size={24} color="#7C3AED" />
            </View>
            <View>
              <Text style={styles.headerTitle}>Waiverlyn AI</Text>
              <Text style={styles.headerSubtitle}>
                {currentProjectId ? 'Project Assistant' : 'AI Assistant'}
              </Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity
              onPress={clearConversation}
              style={styles.headerButton}
            >
              <Ionicons name="trash-outline" size={20} color="#6B7280" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={toggleOpen}
              style={styles.headerButton}
            >
              <Ionicons name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Messages Area */}
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={true}
          nestedScrollEnabled={false}
          scrollEnabled={true}
        >
          {messages.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="chatbubbles-outline" size={64} color="#D1D5DB" />
              <Text style={styles.emptyStateTitle}>Welcome to Waiverlyn AI</Text>
              <Text style={styles.emptyStateText}>
                I can help you with your projects, tasks, and answer questions about the application process.
              </Text>
              {currentProjectId && (
                <Text style={styles.emptyStateProject}>
                  Working with project: {currentProjectId}
                </Text>
              )}

              {/* Quick Prompts */}
              <View style={styles.quickPromptsContainer}>
                <Text style={styles.quickPromptsTitle}>Quick Questions:</Text>
                {QUICK_PROMPTS.map((prompt, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.quickPromptButton}
                    onPress={() => handleQuickPrompt(prompt.text)}
                  >
                    <Ionicons name={prompt.icon} size={20} color="#7C3AED" />
                    <Text style={styles.quickPromptText}>{prompt.text}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : (
            <>
              {messages.map(renderMessage)}
              {isLoading && (
                <View style={styles.aiMessageContainer}>
                  <AITypingIndicator isTyping={true} />
                </View>
              )}
            </>
          )}
        </ScrollView>

        {/* Input Area */}
        <View style={styles.inputContainer}>
          <TextInput
            ref={inputRef}
            style={styles.input}
            placeholder="Ask Waiverlyn anything..."
            placeholderTextColor="#9CA3AF"
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={1000}
            onSubmitEditing={() => handleSendMessage()}
            blurOnSubmit={false}
          />
          <TouchableOpacity
            style={[styles.sendButton, (!input.trim() || isLoading) && styles.sendButtonDisabled]}
            onPress={() => handleSendMessage()}
            disabled={!input.trim() || isLoading}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Ionicons name="send" size={20} color="#FFFFFF" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    paddingTop: Platform.OS === 'ios' ? 50 : 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3E8FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#6B7280',
  },
  headerRight: {
    flexDirection: 'row',
    gap: 8,
  },
  headerButton: {
    padding: 8,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    paddingBottom: 40,
    flexGrow: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    paddingHorizontal: 32,
    marginBottom: 8,
  },
  emptyStateProject: {
    fontSize: 12,
    color: '#7C3AED',
    fontWeight: '500',
    marginTop: 8,
  },
  quickPromptsContainer: {
    width: '100%',
    marginTop: 32,
    paddingHorizontal: 16,
  },
  quickPromptsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  quickPromptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3E8FF',
    borderWidth: 1,
    borderColor: '#C084FC',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    gap: 12,
  },
  quickPromptText: {
    fontSize: 14,
    color: '#6B21A8',
    flex: 1,
  },
  userMessageContainer: {
    alignItems: 'flex-end',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  userMessage: {
    backgroundColor: '#7C3AED',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 12,
    maxWidth: '85%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  userMessageText: {
    color: '#FFFFFF',
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '400',
  },
  messageTimestamp: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  aiMessageContainer: {
    alignItems: 'flex-start',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  aiMessageBubble: {
    backgroundColor: '#F3E8FF',
    borderRadius: 18,
    padding: 14,
    maxWidth: '85%',
    borderWidth: 1,
    borderColor: '#E9D5FF',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  aiMessageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  aiAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#7C3AED',
    justifyContent: 'center',
    alignItems: 'center',
  },
  aiName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B21A8',
  },
  aiMessageContent: {
    marginBottom: 10,
    width: '100%',
  },
  aiMessageText: {
    fontSize: 15,
    lineHeight: 22,
    color: '#1F2937',
    marginTop: 4,
    flexWrap: 'wrap',
    flexShrink: 1,
  },
  aiMessageTimestamp: {
    fontSize: 11,
    color: '#9CA3AF',
    alignSelf: 'flex-end',
    marginTop: 6,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    gap: 8,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111827',
    maxHeight: 100,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#7C3AED',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#D1D5DB',
  },
});

export default AIAssistantModal;

