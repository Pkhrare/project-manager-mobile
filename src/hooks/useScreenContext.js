import { useEffect } from 'react';
import { useAIAssistant } from '../utils/AIAssistantContext';

/**
 * Hook to automatically collect and register screen context
 * Usage: Call this hook in any component to register its data
 */
export const useScreenContext = (contextData) => {
  const { registerContext } = useAIAssistant();

  useEffect(() => {
    if (contextData) {
      registerContext({
        ...contextData,
        timestamp: Date.now()
      });
    }
  }, [contextData, registerContext]);
};

/**
 * Hook for project screens to register project context
 */
export const useProjectContext = (projectId, projectData = null) => {
  const { setProject, registerContext } = useAIAssistant();

  useEffect(() => {
    if (projectId) {
      setProject(projectId, projectData);
      
      if (projectData) {
        registerContext({
          currentProject: projectId,
          projectData: projectData
        });
      }
    }
  }, [projectId, projectData, setProject, registerContext]);
};

/**
 * Hook for task screens to register task context
 */
export const useTaskContext = (taskId, taskData = null, projectId = null) => {
  const { setTask, registerContext } = useAIAssistant();

  useEffect(() => {
    if (taskId) {
      setTask(taskId, taskData, projectId);
      
      if (taskData) {
        registerContext({
          currentTask: taskId,
          taskData: taskData,
          currentProject: projectId
        });
      }
    }
  }, [taskId, taskData, projectId, setTask, registerContext]);
};

