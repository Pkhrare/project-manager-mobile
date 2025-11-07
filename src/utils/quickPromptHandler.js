import { buildClientGuidanceContext } from './clientGuidanceUtils';
import ApiCaller from '../api/apiCaller';

/**
 * Sends a quick prompt to the AI assistant with enhanced client guidance context
 * This is a utility function that can be called from components
 * Returns the response message content as a string
 */
export const sendQuickPrompt = async (
  promptText,
  projectId,
  taskId,
  aiAssistantContext,
  userRole
) => {
  const {
    getFullContext,
    currentProjectId,
    userChatIdentifier
  } = aiAssistantContext;

  try {
    // Build enhanced client guidance context
    const guidanceContext = await buildClientGuidanceContext(projectId, taskId || null);
    
    // Get full context from AI assistant, but exclude conversation history for predetermined questions
    // This ensures each predetermined question is answered in isolation, not based on previous messages
    const fullContext = getFullContext();
    
    // Create context without conversation history for predetermined questions
    // This prevents the AI from answering based on previous task-related questions
    const { conversationHistory, messages, ...contextWithoutHistory } = fullContext;

    // Merge guidance context with context (without conversation history)
    const enrichedContext = {
      ...contextWithoutHistory,
      clientGuidanceContext: guidanceContext,
      isClientGuidance: true,
      // Explicitly set empty conversation history to ensure fresh context
      conversationHistory: [],
      messages: []
    };

    // Determine actual project ID
    const actualProjectId = projectId || 
                           currentProjectId || 
                           fullContext.currentProject || 
                           fullContext.projectData?.id ||
                           fullContext.projectData?.fields?.['Project ID'];

    if (!actualProjectId) {
      throw new Error('Project ID is required to send quick prompt');
    }

    // Get sender name
    const sender = userRole === 'consultant' ? 'Consultant' : 'Client';

    // Use correct endpoint based on user role (clients use client AI, consultants use consultant AI)
    const endpoint = userRole === 'consultant' 
      ? `/ai/consultant/project/${actualProjectId}/assist`
      : `/ai/client/project/${actualProjectId}/assist`;
    
    // Send to appropriate AI endpoint
    const response = await ApiCaller(endpoint, {
      method: 'POST',
      body: JSON.stringify({
        message: promptText,
        sender: sender,
        executeActions: false, // Don't execute actions for guidance questions
        context: enrichedContext,
        userChatIdentifier: userChatIdentifier
      })
    });

    // Handle response
    let messageContent = 'I received your question.';
    
    if (response.type === 'response' || response.type === 'question') {
      if (response.message) {
        if (typeof response.message === 'string') {
          messageContent = response.message;
        } else if (response.message.fields?.message) {
          messageContent = response.message.fields.message;
        } else if (response.message.fields?.message_text) {
          messageContent = response.message.fields.message_text;
        }
      }
    } else if (response.type === 'data_request') {
      // For guidance questions, we shouldn't need to request data
      // But handle it gracefully
      messageContent = response.message || 'I need more information to answer that question.';
    }

    // Return the message content so it can be displayed inline
    return messageContent;

  } catch (error) {
    console.error('Error sending quick prompt:', error);
    const errorMessage = `I encountered an error: ${error.message}. Please try again.`;
    // Return error message so it can be displayed inline
    return errorMessage;
  }
};

