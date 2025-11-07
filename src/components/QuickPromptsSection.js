import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAIAssistant } from '../utils/AIAssistantContext';
import { useAuth } from '../utils/AuthContext';
import { sendQuickPrompt } from '../utils/quickPromptHandler';

// Quick prompts for tasks
const TASK_QUICK_PROMPTS = [
  { text: "What is the purpose of this task?", icon: "help-circle" },
  { text: "How do I complete this task?", icon: "checkmark-circle" },
  { text: "What happens after I complete this task?", icon: "arrow-forward-circle" },
];

// Quick prompts for projects
const PROJECT_QUICK_PROMPTS = [
  { text: "How do I start?", icon: "play-circle" },
  { text: "Why should I complete these tasks?", icon: "information-circle" },
  { text: "How does this get me closer to completing my application packet?", icon: "trending-up" },
];

const QuickPromptsSection = ({ type = 'task', task = null, project = null }) => {
  const { getFullContext, userChatIdentifier } = useAIAssistant();
  const { userRole } = useAuth();
  
  // State to store responses for each prompt
  const [promptResponses, setPromptResponses] = useState({});
  // State to track loading for each prompt
  const [loadingPrompts, setLoadingPrompts] = useState({});
  
  const prompts = type === 'task' ? TASK_QUICK_PROMPTS : PROJECT_QUICK_PROMPTS;

  const handlePromptPress = async (promptText) => {
    // Set loading state for this specific prompt
    setLoadingPrompts(prev => ({ ...prev, [promptText]: true }));
    
    try {
      // Get project ID
      let projectId = null;
      
      if (type === 'task' && task) {
        // For tasks, get project ID from task
        // First try to get the Airtable record ID (for API calls)
        const projectRecordId = task?.fields?.project_id?.[0] || task?.fields?.['project_id']?.[0];
        // If we have a record ID, use it; otherwise try the human-readable ID
        projectId = projectRecordId || task?.fields?.['Project ID (from project_id)']?.[0];
      } else if (type === 'project' && project) {
        // For projects, get project ID from project
        // Use the Airtable record ID if available, otherwise use the human-readable Project ID
        projectId = project?.id || project?.fields?.['Project ID'];
      }
      
      if (!projectId) {
        throw new Error('Project ID not found');
      }
      
      // Get task ID if this is a task prompt
      const taskId = type === 'task' && task ? task.id : null;
      
      // Get AI assistant context
      const aiAssistantContext = {
        getFullContext,
        currentProjectId: projectId,
        userChatIdentifier: userChatIdentifier
      };
      
      // Send quick prompt and get response
      const response = await sendQuickPrompt(
        promptText,
        projectId,
        taskId,
        aiAssistantContext,
        userRole
      );
      
      // Store the response for inline display
      setPromptResponses(prev => ({ ...prev, [promptText]: response }));
    } catch (error) {
      console.error('Error handling quick prompt:', error);
      setPromptResponses(prev => ({ 
        ...prev, 
        [promptText]: `Error: ${error.message}. Please try again.` 
      }));
    } finally {
      setLoadingPrompts(prev => ({ ...prev, [promptText]: false }));
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="sparkles" size={20} color="#7C3AED" />
        <Text style={styles.title}>Quick Help</Text>
      </View>
      <View style={styles.promptsContainer}>
        {prompts.map((prompt, index) => (
          <View key={index} style={styles.promptItem}>
            <TouchableOpacity
              style={[
                styles.promptButton,
                loadingPrompts[prompt.text] && styles.promptButtonDisabled
              ]}
              onPress={() => handlePromptPress(prompt.text)}
              activeOpacity={0.7}
              disabled={loadingPrompts[prompt.text]}
            >
              {loadingPrompts[prompt.text] ? (
                <ActivityIndicator size="small" color="#7C3AED" />
              ) : (
                <Ionicons name={prompt.icon} size={18} color="#7C3AED" />
              )}
              <Text style={styles.promptText}>
                {loadingPrompts[prompt.text] ? 'Loading...' : prompt.text}
              </Text>
            </TouchableOpacity>
            
            {/* Display response inline below the button */}
            {promptResponses[prompt.text] && (
              <View style={styles.responseContainer}>
                <Text style={styles.responseText}>
                  {promptResponses[prompt.text]}
                </Text>
              </View>
            )}
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  promptsContainer: {
    gap: 12,
  },
  promptItem: {
    gap: 8,
  },
  promptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E9D5FF',
    borderRadius: 10,
    padding: 12,
    gap: 10,
  },
  promptButtonDisabled: {
    opacity: 0.6,
  },
  promptText: {
    fontSize: 14,
    color: '#6B21A8',
    flex: 1,
    lineHeight: 20,
  },
  responseContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E9D5FF',
    marginLeft: 0,
  },
  responseText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
});

export default QuickPromptsSection;

