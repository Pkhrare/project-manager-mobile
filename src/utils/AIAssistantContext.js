import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';

const AIAssistantContext = createContext();

// Helper function to generate userChatIdentifier from user email
const generateUserChatIdentifier = (userEmail, userRole, projectId) => {
  if (userRole === 'client' && projectId) {
    // For clients, use project ID as identifier
    return `client_${projectId}`;
  }
  if (userEmail) {
    // For consultants, use email as identifier
    return userEmail.toLowerCase().trim();
  }
  return null;
};

export const useAIAssistant = () => {
  const context = useContext(AIAssistantContext);
  if (!context) {
    throw new Error('useAIAssistant must be used within an AIAssistantProvider');
  }
  return context;
};

export const AIAssistantProvider = ({ children }) => {
  const { currentUser, userRole } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentProjectId, setCurrentProjectId] = useState(null);
  const [currentTaskId, setCurrentTaskId] = useState(null);
  const [conversationHistory, setConversationHistory] = useState([]);
  const [userChatIdentifier, setUserChatIdentifier] = useState(null);
  const [isHistoryLoaded, setIsHistoryLoaded] = useState(false);
  
  // Store context data from different screens
  const contextDataRef = useRef({
    projects: [],
    tasks: [],
    currentProject: null,
    currentTask: null,
    currentScreen: null,
    projectData: null,
    taskData: null,
    otherData: {}
  });

  // Register context data from screens
  const registerContext = useCallback((data) => {
    contextDataRef.current = {
      ...contextDataRef.current,
      ...data,
      lastUpdated: Date.now()
    };
  }, []);

  // Get full context for AI
  const getFullContext = useCallback(() => {
    return {
      ...contextDataRef.current,
      conversationHistory: conversationHistory,
      messages: messages,
      timestamp: new Date().toISOString()
    };
  }, [conversationHistory, messages]);

  // Add message to conversation
  const addMessage = useCallback((message) => {
    setMessages(prev => {
      const updated = [...prev, message];
      return updated.sort((a, b) => {
        const timeA = new Date(a.timestamp || 0);
        const timeB = new Date(b.timestamp || 0);
        return timeA - timeB;
      });
    });
    setConversationHistory(prev => [...prev.slice(-19), message]); // Keep last 20 messages
  }, []);

  // Load chat history for the user
  const loadChatHistory = useCallback(async (identifier) => {
    if (!identifier || isHistoryLoaded) return;

    try {
      const ApiCaller = (await import('../api/apiCaller')).default;
      const response = await ApiCaller(`/ai/chat-history/${identifier}`);
      
      if (response && response.messages && Array.isArray(response.messages)) {
        setMessages(response.messages);
        setConversationHistory(response.messages.slice(-20));
        setIsHistoryLoaded(true);
        console.log(`Loaded ${response.messages.length} messages from chat history`);
      }
    } catch (error) {
      console.error('Error loading chat history:', error);
      setIsHistoryLoaded(true);
    }
  }, [isHistoryLoaded]);

  // Generate and set userChatIdentifier when user or project changes
  useEffect(() => {
    if (currentUser) {
      const identifier = generateUserChatIdentifier(
        currentUser.email,
        userRole,
        currentProjectId || currentUser.projectId
      );
      setUserChatIdentifier(identifier);
      setIsHistoryLoaded(false);
      setMessages([]);
      setConversationHistory([]);
    } else {
      setUserChatIdentifier(null);
      setMessages([]);
      setConversationHistory([]);
      setIsHistoryLoaded(false);
    }
  }, [currentUser, userRole, currentProjectId]);

  // Load chat history when identifier is available
  useEffect(() => {
    if (userChatIdentifier && !isHistoryLoaded) {
      loadChatHistory(userChatIdentifier);
    }
  }, [userChatIdentifier, isHistoryLoaded, loadChatHistory]);

  // Clear conversation
  const clearConversation = useCallback(() => {
    setMessages([]);
    setConversationHistory([]);
  }, []);

  // Toggle open/closed
  const toggleOpen = useCallback(() => {
    setIsOpen(prev => !prev);
  }, []);

  // Send a message programmatically (opens modal and sends message)
  const sendMessage = useCallback((messageText) => {
    if (messageText && messageText.trim()) {
      // Add the message immediately
      addMessage({
        id: Date.now().toString(),
        type: 'user',
        content: messageText.trim(),
        timestamp: new Date().toISOString()
      });
      // Open the modal if not already open
      if (!isOpen) {
        setIsOpen(true);
      }
    }
  }, [addMessage, isOpen]);

  // Set current project
  const setProject = useCallback((projectId, projectData = null) => {
    setCurrentProjectId(projectId);
    if (projectData) {
      registerContext({ 
        currentProject: projectId,
        projectData: projectData
      });
    }
  }, [registerContext]);

  // Set current task
  const setTask = useCallback((taskId, taskData = null, projectId = null) => {
    setCurrentTaskId(taskId);
    if (taskData) {
      registerContext({
        currentTask: taskId,
        taskData: taskData,
        currentProject: projectId || currentProjectId
      });
    }
  }, [registerContext, currentProjectId]);

  const value = {
    isOpen,
    messages,
    isLoading,
    currentProjectId,
    currentTaskId,
    conversationHistory,
    userChatIdentifier,
    toggleOpen,
    addMessage,
    sendMessage,
    clearConversation,
    registerContext,
    getFullContext,
    setProject,
    setTask,
    setIsLoading,
    setCurrentProjectId,
    setCurrentTaskId
  };

  return (
    <AIAssistantContext.Provider value={value}>
      {children}
    </AIAssistantContext.Provider>
  );
};

