import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar, ScrollView, ActivityIndicator, RefreshControl, TextInput, Modal, Image, Linking, Alert, Platform, Animated, LayoutAnimation, UIManager } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
// (duplicate import removed)
import { format } from 'date-fns';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import ApiCaller from './src/api/apiCaller';
import io from 'socket.io-client';
import { AuthProvider, useAuth } from './src/utils/AuthContext';
import { AIAssistantProvider } from './src/utils/AIAssistantContext';
import LoginScreen from './src/screens/auth/LoginScreen';
import { projectTemplates } from './src/utils/projectTemplates';
import ClientLoginScreen from './src/screens/auth/ClientLoginScreen';
import TaskDetailsScreen from './src/screens/tasks/TaskDetailsScreen';
import TemplateDetailsScreen from './src/screens/templates/TemplateDetailsScreen';
import { AboutUsSection } from './src/components/AboutUs';
import { ActivitiesModal, CollaboratorsModal, InternalNotesModal } from './src/components/modals';
import ProjectDeactivatedScreen from './src/screens/projects/ProjectDeactivatedScreen';
import AIAssistantModal from './src/components/ai/AIAssistantModal';
import AIAssistantButton from './src/components/ai/AIAssistantButton';
import { useAIAssistant } from './src/utils/AIAssistantContext';
import QuickPromptsSection from './src/components/QuickPromptsSection';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android') {
  if (UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }
}

// Main app component that uses authentication
function AppContent() {
  const { isAuthenticated, currentUser, userRole, logout, loading: authLoading } = useAuth();
  const { setProject, setTask } = useAIAssistant();
  const [currentScreen, setCurrentScreen] = useState('Home');
  const [isProjectEditing, setIsProjectEditing] = useState(false);
  const [editedProjectFields, setEditedProjectFields] = useState({});
  const [isAdditionalInfoEditing, setIsAdditionalInfoEditing] = useState(false);
  const [editedAdditionalInfoFields, setEditedAdditionalInfoFields] = useState({});
  const [pickerState, setPickerState] = useState({ open: false, field: null, options: [] });
  const [incompleteActions, setIncompleteActions] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [taskData, setTaskData] = useState({ groups: [], ungroupedTasks: [] });
  const [tasksLoading, setTasksLoading] = useState(false);
  
  // Task management state
  const [isTaskEditMode, setIsTaskEditMode] = useState(false);
  const [selectedTasks, setSelectedTasks] = useState(new Set());
  const [isMoveMode, setIsMoveMode] = useState(false);
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [showMoveModal, setShowMoveModal] = useState(false);
  
  // Collapsible task groups state - start with all groups collapsed
  const [collapsedGroups, setCollapsedGroups] = useState(new Set());
  const [navigationStack, setNavigationStack] = useState(['Home']);
  const [authScreen, setAuthScreen] = useState('ConsultantLogin'); // 'ConsultantLogin' or 'ClientLogin'
  const [searchQuery, setSearchQuery] = useState('');
  const [filterField, setFilterField] = useState('Project Name');
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showActivitiesModal, setShowActivitiesModal] = useState(false);
  const [showCollaboratorsModal, setShowCollaboratorsModal] = useState(false);
  const [showInternalNotesModal, setShowInternalNotesModal] = useState(false);
  const [activeProjectTab, setActiveProjectTab] = useState('active'); // 'active' or 'deactivated'
  const [isProjectInfoCollapsed, setIsProjectInfoCollapsed] = useState(true); // Collapsed by default for clients
  const [isFinancialInfoCollapsed, setIsFinancialInfoCollapsed] = useState(true); // Collapsed by default for clients
  
  // Chat-related state
  const [projectMessages, setProjectMessages] = useState([]);
  const [newProjectMessage, setNewProjectMessage] = useState('');
  const [projectChatAttachment, setProjectChatAttachment] = useState(null);
  const [isUploadingProjectChatFile, setIsUploadingProjectChatFile] = useState(false);
  const [isAIMode, setIsAIMode] = useState(false);
  const [isAITyping, setIsAITyping] = useState(false);
  const [aiRequestInProgress, setAiRequestInProgress] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const projectSocketRef = useRef(null);
  const projectChatContainerRef = useRef(null);

  // Actions-related states
  const [pendingActions, setPendingActions] = useState([]);
  const [activeActions, setActiveActions] = useState([]);
  const [completedActions, setCompletedActions] = useState([]);
  const [isLoadingActions, setIsLoadingActions] = useState(true);
  const [isAddingAction, setIsAddingAction] = useState(false);
  const [newAction, setNewAction] = useState({ description: '', estCompletion: '' });
  // project details date picker
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());

  // Searchable fields for projects
  const searchableFields = useMemo(() => [
    'Project Name',
    'Project ID',
    'Client Email',
    'States',
    'Project Type',
    'Assigned Consultant',
    'Status',
    'Project Manager'
  ], []);

  // Filter projects based on search query and active/deactivated status
  const filteredProjects = useMemo(() => {
    // First filter by operation status based on active tab
    let operationFilteredData = projects;
    if (activeProjectTab === 'active') {
      operationFilteredData = projects.filter(project => 
        project.fields['Operation'] === 'Active' || !project.fields['Operation']
      );
    } else if (activeProjectTab === 'deactivated') {
      operationFilteredData = projects.filter(project => 
        project.fields['Operation'] === 'Deactivated'
      );
    }
    
    // Then apply search filter
    if (!searchQuery.trim()) {
      return operationFilteredData;
    }
    return operationFilteredData.filter(project => {
      const fieldValue = project.fields[filterField];
      if (typeof fieldValue === 'string') {
        return fieldValue.toLowerCase().includes(searchQuery.toLowerCase());
      }
      if (typeof fieldValue === 'number') {
        return fieldValue.toString().toLowerCase().includes(searchQuery.toLowerCase());
      }
      return false;
    });
  }, [projects, searchQuery, filterField, activeProjectTab]);

  // Fetch incomplete actions for dashboard (MOVED BEFORE EARLY RETURN)
  const fetchIncompleteActions = useCallback(async () => {
    try {
      const data = await ApiCaller('/actions/incomplete');
      setIncompleteActions(data);
    } catch (error) {
      console.error("Error fetching incomplete actions:", error);
      // Keep using mock data if API fails
    }
  }, []);

  // Fetch all projects
  const fetchProjects = useCallback(async () => {
    try {
      const data = await ApiCaller('/records');
      setProjects(data);
    } catch (error) {
      console.error("Error fetching projects:", error);
      // Keep using mock data if API fails
    }
  }, []);

  // Fetch single project record (by record ID) and update selectedProject
  const refreshSelectedProject = useCallback(async (recordId) => {
    if (!recordId) return;
    try {
      const data = await ApiCaller(`/records/projects/${recordId}`);
      if (data) {
        setSelectedProject(data);
      }
    } catch (err) {
      console.error('Error refreshing selected project:', err);
    }
  }, []);

  // Fetch detailed actions for a specific project (Pending, Active, Completed)
  const fetchProjectDetailedActions = useCallback(async (project) => {
    if (!project) {
      console.log('No project provided for detailed actions');
      return;
    }
    
    const projectId = project.fields?.['Project ID'];
    
    if (!projectId) {
      console.log('No Project ID field found in project');
      return;
    }
    
    console.log('Fetching detailed actions for Project ID:', projectId);
    setIsLoadingActions(true);
    try {
      const response = await ApiCaller(`/records/filter/${projectId}/actions`);
      console.log('Detailed Actions API response:', response);
      
      const allActions = Array.isArray(response?.records) ? response.records : [];
      console.log('All actions fetched:', allActions.length, 'actions');

      // Categorize actions
      setPendingActions(allActions.filter(a => a.fields.pending_action && !a.fields.completed));
      setActiveActions(allActions.filter(a => !a.fields.pending_action && !a.fields.completed));
      setCompletedActions(allActions.filter(a => a.fields.completed));
      
      console.log('Actions categorized:', {
        pending: allActions.filter(a => a.fields.pending_action && !a.fields.completed).length,
        active: allActions.filter(a => !a.fields.pending_action && !a.fields.completed).length,
        completed: allActions.filter(a => a.fields.completed).length
      });
    } catch (error) {
      console.error("Error fetching detailed project actions:", error);
      setPendingActions([]);
      setActiveActions([]);
      setCompletedActions([]);
    } finally {
      setIsLoadingActions(false);
    }
  }, []);

  // Fetch tasks for a specific project (with groups)
  const fetchProjectTasks = useCallback(async (project) => {
    if (!project) {
      console.log('No project provided for tasks');
      return;
    }
    
    const projectId = project.fields?.['Project ID'];
    
    if (!projectId) {
      console.log('No Project ID field found in project');
      return;
    }
    
    console.log('Fetching tasks and groups for Project ID:', projectId);
    setTasksLoading(true);
    try {
      // Fetch both groups and tasks in parallel
      const [groupsResponse, tasksResponse] = await Promise.all([
        ApiCaller(`/records/filter/${projectId}/task_groups`),
        ApiCaller(`/records/filter/${projectId}/tasks`)
      ]);

      const allGroups = Array.isArray(groupsResponse?.records) ? groupsResponse.records : [];
      const allTasks = Array.isArray(tasksResponse?.records) ? tasksResponse.records : [];

      console.log('Fetched:', allGroups.length, 'groups and', allTasks.length, 'tasks');

      // Initialize groupsMap with all groups
      const groupsMap = new Map();
      allGroups.forEach(group => {
        groupsMap.set(group.id, {
          id: group.id,
          name: group.fields.group_name || 'Unnamed Group',
          order: group.fields.group_order || 0,
          tasks: []
        });
      });

      const ungrouped = [];

      // Organize tasks into groups or ungrouped
      allTasks.forEach(task => {
        const groupId = task.fields.task_groups?.[0];
        if (groupId && groupsMap.has(groupId)) {
          groupsMap.get(groupId).tasks.push(task);
        } else {
          ungrouped.push(task);
        }
      });

      // Sort groups by order
      const sortedGroups = Array.from(groupsMap.values()).sort((a, b) => a.order - b.order);

      // Sort tasks within each group
      sortedGroups.forEach(group => {
        group.tasks.sort((a, b) => (a.fields.order || 0) - (b.fields.order || 0));
      });

      // Sort ungrouped tasks
      const sortedUngrouped = ungrouped.sort((a, b) => (a.fields.order || 0) - (b.fields.order || 0));

      setTaskData({ groups: sortedGroups, ungroupedTasks: sortedUngrouped });

      // Collapse all groups by default when tasks are loaded
      const allGroupIds = new Set(sortedGroups.map(group => group.id));
      setCollapsedGroups(allGroupIds);

    } catch (error) {
      console.error("Error fetching project tasks:", error);
      setTaskData({ groups: [], ungroupedTasks: [] });
    } finally {
      setTasksLoading(false);
    }
  }, []);

  // Initial data load
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchIncompleteActions(), fetchProjects()]);
      setLoading(false);
    };
    loadData();
  }, [fetchIncompleteActions, fetchProjects]);

  // Reset Project Information and Financial Information collapsed state when project changes
  useEffect(() => {
    if (selectedProject && userRole === 'client') {
      setIsProjectInfoCollapsed(true); // Reset to collapsed when new project is selected
      setIsFinancialInfoCollapsed(true); // Reset to collapsed when new project is selected
    }
  }, [selectedProject?.id, userRole]);

  // Pull to refresh handler
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchIncompleteActions(), fetchProjects()]);
    setRefreshing(false);
  }, [fetchIncompleteActions, fetchProjects]);

  // Navigation helpers
  const navigateToProjectDetails = useCallback((project) => {
    console.log('Navigating to project:', project?.fields?.['Project Name']);
    console.log('Project ID (custom):', project?.fields?.['Project ID']);
    console.log('Record ID:', project?.id);
    
    setSelectedProject(project);
    setIsProjectEditing(false);
    setEditedProjectFields({});
    setNavigationStack([...navigationStack, 'ProjectDetails']);
    setCurrentScreen('ProjectDetails');
    
    // Register project context with AI assistant
    if (project?.id) {
      setProject(project.id, project);
    }
    // Fetch tasks and detailed actions for this project
    if (project) {
      fetchProjectTasks(project);
      fetchProjectDetailedActions(project);
    } else {
      console.error('No project available!');
    }
  }, [navigationStack, fetchProjectTasks, fetchProjectDetailedActions]);

  // --- Socket.IO: Project-level realtime updates ---
  // Note: projectSocketRef is already declared above and used for project chat
  // We'll extend the existing socket logic to handle project updates

  const handleProjectFieldChange = (field, value) => {
    setEditedProjectFields(prev => ({ ...prev, [field]: value }));
  };

  const validateEmail = (email) => {
    if (!email) return true;
    const re = /[^\s@]+@[^\s@]+\.[^\s@]+/;
    return re.test(String(email).toLowerCase());
  };

  const isDateLike = (val) => {
    if (!val) return true;
    return /^\d{4}-\d{2}-\d{2}$/.test(val);
  };

  // Task management functions
  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) {
      Alert.alert('Error', 'Please enter a group name');
      return;
    }

    try {
      const response = await ApiCaller('/records', {
        method: 'POST',
        body: JSON.stringify({
          recordsToCreate: [{
            fields: {
              group_name: newGroupName.trim(),
              project_id: [selectedProject.id],
              group_order: taskData.groups.length
            }
          }],
          tableName: 'task_groups'
        })
      });

      if (response.records && response.records.length > 0) {
        const newGroup = {
          id: response.records[0].id,
          name: newGroupName.trim(),
          order: taskData.groups.length,
          tasks: []
        };
        
        setTaskData(prev => ({
          ...prev,
          groups: [...prev.groups, newGroup]
        }));
        
        // Ensure new group starts collapsed (consistent with default behavior)
        setCollapsedGroups(prev => {
          const newSet = new Set(prev);
          newSet.add(response.records[0].id);
          return newSet;
        });
        
        setNewGroupName('');
        setShowCreateGroupModal(false);
        Alert.alert('Success', 'Group created successfully!');
      }
    } catch (error) {
      console.error('Failed to create group:', error);
      Alert.alert('Error', 'Failed to create group. Please try again.');
    }
  };

  const handleDeleteGroup = async (groupId, tasksInGroup) => {
    Alert.alert(
      'Delete Group',
      `This group contains ${tasksInGroup} task(s). What would you like to do with them?`,
      [
        {
          text: 'Delete Tasks',
          style: 'destructive',
          onPress: () => deleteGroup(groupId, true)
        },
        {
          text: 'Move to Ungrouped',
          onPress: () => deleteGroup(groupId, false)
        },
        {
          text: 'Cancel',
          style: 'cancel'
        }
      ]
    );
  };

  const deleteGroup = async (groupId, deleteTasks) => {
    try {
      if (deleteTasks) {
        // Delete all tasks in the group
        const group = taskData.groups.find(g => g.id === groupId);
        if (group && group.tasks.length > 0) {
          const taskIds = group.tasks.map(task => task.id);
          await ApiCaller('/records/tasks', {
            method: 'DELETE',
            body: JSON.stringify({ recordIds: taskIds })
          });
        }
      } else {
        // Move tasks to ungrouped
        const group = taskData.groups.find(g => g.id === groupId);
        if (group && group.tasks.length > 0) {
          const taskUpdates = group.tasks.map(task => ({
            id: task.id,
            fields: { task_groups: [] }
          }));
          
          await ApiCaller('/records', {
            method: 'PATCH',
            body: JSON.stringify({
              recordsToUpdate: taskUpdates,
              tableName: 'tasks'
            })
          });
        }
      }

      // Delete the group
      await ApiCaller('/records/task_groups', {
        method: 'DELETE',
        body: JSON.stringify({ recordIds: [groupId] })
      });

      // Update local state
      setTaskData(prev => {
        const group = prev.groups.find(g => g.id === groupId);
        const updatedGroups = prev.groups.filter(g => g.id !== groupId);
        
        if (!deleteTasks && group) {
          return {
            groups: updatedGroups,
            ungroupedTasks: [...prev.ungroupedTasks, ...group.tasks]
          };
        }
        
        return { ...prev, groups: updatedGroups };
      });

      Alert.alert('Success', 'Group deleted successfully!');
    } catch (error) {
      console.error('Failed to delete group:', error);
      Alert.alert('Error', 'Failed to delete group. Please try again.');
    }
  };

  const handleTaskSelect = (taskId) => {
    const newSelected = new Set(selectedTasks);
    if (newSelected.has(taskId)) {
      newSelected.delete(taskId);
    } else {
      newSelected.add(taskId);
    }
    setSelectedTasks(newSelected);
  };

  const handleMoveTasks = () => {
    if (selectedTasks.size === 0) {
      Alert.alert('No Tasks Selected', 'Please select tasks to move.');
      return;
    }
    setShowMoveModal(true);
  };

  const moveTasksToGroup = async (targetGroupId) => {
    try {
      const taskUpdates = Array.from(selectedTasks).map(taskId => ({
        id: taskId,
        fields: { task_groups: targetGroupId ? [targetGroupId] : [] }
      }));

      await ApiCaller('/records', {
        method: 'PATCH',
        body: JSON.stringify({
          recordsToUpdate: taskUpdates,
          tableName: 'tasks'
        })
      });

      // Update local state
      setTaskData(prev => {
        const movedTasks = [];
        const updatedGroups = prev.groups.map(group => {
          const tasksToMove = group.tasks.filter(task => selectedTasks.has(task.id));
          movedTasks.push(...tasksToMove);
          return {
            ...group,
            tasks: group.tasks.filter(task => !selectedTasks.has(task.id))
          };
        });

        const updatedUngrouped = prev.ungroupedTasks.filter(task => !selectedTasks.has(task.id));

        if (targetGroupId) {
          const targetGroup = updatedGroups.find(g => g.id === targetGroupId);
          if (targetGroup) {
            targetGroup.tasks.push(...movedTasks);
          }
        } else {
          updatedUngrouped.push(...movedTasks);
        }

        return {
          groups: updatedGroups,
          ungroupedTasks: updatedUngrouped
        };
      });

      setSelectedTasks(new Set());
      setShowMoveModal(false);
      Alert.alert('Success', 'Tasks moved successfully!');
    } catch (error) {
      console.error('Failed to move tasks:', error);
      Alert.alert('Error', 'Failed to move tasks. Please try again.');
    }
  };

  // Toggle group collapse state
  const toggleGroupCollapse = (groupId) => {
    setCollapsedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupId)) {
        newSet.delete(groupId);
      } else {
        newSet.add(groupId);
      }
      return newSet;
    });
  };

  const handleReorderTask = async (taskId, direction) => {
    // Find the task and its current group
    let currentGroup = null;
    let taskIndex = -1;
    
    for (const group of taskData.groups) {
      const index = group.tasks.findIndex(t => t.id === taskId);
      if (index !== -1) {
        currentGroup = group;
        taskIndex = index;
        break;
      }
    }

    if (!currentGroup || taskIndex === -1) return;

    const newIndex = direction === 'up' ? taskIndex - 1 : taskIndex + 1;
    if (newIndex < 0 || newIndex >= currentGroup.tasks.length) return;

    // Configure animation
    LayoutAnimation.configureNext({
      duration: 300,
      create: { type: 'easeInEaseOut', property: 'opacity' },
      update: { type: 'easeInEaseOut', property: 'scaleXY' },
      delete: { type: 'easeInEaseOut', property: 'opacity' }
    });

    // Swap tasks
    const tasks = [...currentGroup.tasks];
    [tasks[taskIndex], tasks[newIndex]] = [tasks[newIndex], tasks[taskIndex]];

    // Update local state first for immediate visual feedback
    setTaskData(prev => ({
      ...prev,
      groups: prev.groups.map(group => 
        group.id === currentGroup.id 
          ? { ...group, tasks }
          : group
      )
    }));

    // Update order numbers
    const taskUpdates = tasks.map((task, index) => ({
      id: task.id,
      fields: { order: index }
    }));

    try {
      await ApiCaller('/records', {
        method: 'PATCH',
        body: JSON.stringify({
          recordsToUpdate: taskUpdates,
          tableName: 'tasks'
        })
      });
    } catch (error) {
      console.error('Failed to reorder task:', error);
      Alert.alert('Error', 'Failed to reorder task. Please try again.');
      // Revert the change on error
      setTaskData(prev => ({
        ...prev,
        groups: prev.groups.map(group => 
          group.id === currentGroup.id 
            ? { ...group, tasks: currentGroup.tasks }
            : group
        )
      }));
    }
  };

  const exitTaskEditMode = () => {
    setIsTaskEditMode(false);
    setSelectedTasks(new Set());
    setIsMoveMode(false);
  };

  const saveEditedProject = async () => {
    if (!selectedProject) return;
    if (editedProjectFields['Client Email'] !== undefined && !validateEmail(editedProjectFields['Client Email'])) {
      Alert.alert('Validation', 'Please enter a valid client email.');
      return;
    }
    if (editedProjectFields['Start Date'] !== undefined && !isDateLike(editedProjectFields['Start Date'])) {
      Alert.alert('Validation', 'Start Date must be in yyyy-mm-dd format.');
      return;
    }
    const original = selectedProject.fields || {};
    const toSend = {};
    Object.keys(editedProjectFields).forEach(k => {
      if (editedProjectFields[k] !== original[k]) {
        toSend[k] = editedProjectFields[k] === '' ? null : editedProjectFields[k];
      }
    });
    if (Object.keys(toSend).length === 0) {
      setIsProjectEditing(false);
      return;
    }
    try {
      await ApiCaller(`/records/projects/${selectedProject.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ fields: toSend })
      });
      // update local
      setSelectedProject(prev => prev ? { ...prev, fields: { ...prev.fields, ...toSend } } : prev);
      setIsProjectEditing(false);
      setEditedProjectFields({});
      Alert.alert('Success', 'Project updated');
    } catch (e) {
      console.error('Failed to update project:', e);
      Alert.alert('Error', 'Failed to update project');
    }
  };

  // Dropdown options (mirrors web validations)
  const STATUS_OPTIONS = ['Active','Preparatory Stage with Consultant','Waiting on Client','Submitted to State','Under State Review','Provisional Approval','Completed'];
  const PROJECT_TYPES = ['Licensing & Medicaid','Licensing Only','Technical (Other)','Market Research','Medicaid Enrollment Only','Policy & Procedure Manual','PA','Home Health'];
  const ASSIGNED_CONSULTANTS = ['Michael Tarr','Sheikh Konneh','Varlee Massalay','Amara M Kamara','Michelle Gottlieb','Fatu Kaba'];
  const SUPERVISING_CONSULTANTS = ['Amara M Kamara','Michelle Gottlieb'];

  // Additional Information editing handlers
  const handleAdditionalInfoFieldChange = (field, value) => {
    setEditedAdditionalInfoFields(prev => ({ ...prev, [field]: value }));
  };

  const saveEditedAdditionalInfo = async () => {
    if (!selectedProject) return;
    
    try {
      const response = await ApiCaller(`/records/projects/${selectedProject.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ fields: editedAdditionalInfoFields }),
      });
      
      if (response) {
        // Update the selected project with new data
        setSelectedProject(prev => ({
          ...prev,
          fields: { ...prev.fields, ...editedAdditionalInfoFields }
        }));
        
        // Update the projects list
        setProjects(prev => prev.map(p => 
          p.id === selectedProject.id 
            ? { ...p, fields: { ...p.fields, ...editedAdditionalInfoFields } }
            : p
        ));
        
        setIsAdditionalInfoEditing(false);
        setEditedAdditionalInfoFields({});
        Alert.alert('Success', 'Additional information updated successfully!');
      }
    } catch (error) {
      console.error('Error updating additional information:', error);
      Alert.alert('Error', 'Failed to update additional information. Please try again.');
    }
  };

  const navigateToTaskDetails = useCallback((task) => {
    console.log('Navigating to task:', task?.fields?.['task_title']);
    setSelectedTask(task);
    setNavigationStack([...navigationStack, 'TaskDetails']);
    setCurrentScreen('TaskDetails');
    
    // Register task context with AI assistant
    if (task?.id) {
      const projectId = selectedProject?.id || task?.fields?.['project_id']?.[0];
      setTask(task.id, task, projectId);
    }
  }, [navigationStack, selectedProject, setTask]);

  const navigateBack = useCallback(() => {
    if (navigationStack.length > 1) {
      const newStack = [...navigationStack];
      newStack.pop();
      setNavigationStack(newStack);
      setCurrentScreen(newStack[newStack.length - 1]);
      if (newStack[newStack.length - 1] !== 'ProjectDetails') {
        setSelectedProject(null);
        setCollapsedGroups(new Set());
      }
      if (newStack[newStack.length - 1] !== 'TaskDetails') {
        setSelectedTask(null);
      }
    }
  }, [navigationStack]);

  // Handle client login - navigate to project details
  const handleClientLogin = useCallback((projectData) => {
    console.log('Client logged in, navigating to project:', projectData);
    // Automatically navigate to project details for the client
    navigateToProjectDetails(projectData);
  }, [navigateToProjectDetails]);

  // Action handling functions
  const handleActionChange = useCallback(async (action, field, value) => {
    const updates = {
      id: action.id,
      fields: { [field]: value }
    };
    
    // If a pending action is completed, it's no longer pending.
    if (field === 'completed' && value && action.fields.pending_action) {
      updates.fields.pending_action = false;
    }
    
    try {
      await ApiCaller('/records', {
        method: 'PATCH',
        body: JSON.stringify({ recordsToUpdate: [updates], tableName: 'actions' })
      });
      // Refetch actions to ensure UI is in sync with the database
      if (selectedProject) {
        fetchProjectDetailedActions(selectedProject);
      }
    } catch (error) {
      console.error("Failed to update action:", error);
      Alert.alert('Error', 'Failed to update action. Please try again.');
    }
  }, [selectedProject, fetchProjectDetailedActions]);

  const handleNewActionInputChange = useCallback((field, value) => {
    setNewAction(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleDateChange = useCallback((event, selectedDate) => {
    setShowDatePicker(false); // Hide picker on both platforms
    
    if (event.type === 'dismissed') {
      // User cancelled the picker, don't update the date
      return;
    }
    
    if (selectedDate) {
      setSelectedDate(selectedDate);
      setNewAction(prev => ({ ...prev, estCompletion: format(selectedDate, 'yyyy-MM-dd') }));
    }
  }, []);

  const showDatePickerModal = useCallback(() => {
    setShowDatePicker(true);
  }, []);

  const cancelDatePicker = useCallback(() => {
    setShowDatePicker(false);
  }, []);

  // Simple optimistic move function
  const moveActionOptimistically = useCallback((action, fromCategory, toCategory) => {
    // Immediately update the UI
    if (fromCategory === 'pending' && toCategory === 'active') {
      setPendingActions(prev => prev.filter(a => a.id !== action.id));
      setActiveActions(prev => [...prev, { ...action, fields: { ...action.fields, pending_action: false } }]);
    } else if (fromCategory === 'active' && toCategory === 'pending') {
      setActiveActions(prev => prev.filter(a => a.id !== action.id));
      setPendingActions(prev => [...prev, { ...action, fields: { ...action.fields, pending_action: true } }]);
    } else if (fromCategory === 'pending' && toCategory === 'completed') {
      setPendingActions(prev => prev.filter(a => a.id !== action.id));
      setCompletedActions(prev => [...prev, { ...action, fields: { ...action.fields, completed: true } }]);
    } else if (fromCategory === 'active' && toCategory === 'completed') {
      setActiveActions(prev => prev.filter(a => a.id !== action.id));
      setCompletedActions(prev => [...prev, { ...action, fields: { ...action.fields, completed: true } }]);
    } else if (fromCategory === 'completed' && toCategory === 'active') {
      setCompletedActions(prev => prev.filter(a => a.id !== action.id));
      setActiveActions(prev => [...prev, { ...action, fields: { ...action.fields, completed: false } }]);
    } else if (fromCategory === 'completed' && toCategory === 'pending') {
      setCompletedActions(prev => prev.filter(a => a.id !== action.id));
      setPendingActions(prev => [...prev, { ...action, fields: { ...action.fields, completed: false, pending_action: true } }]);
    }
    
    // Update backend in background
    updateActionInBackend(action, fromCategory, toCategory);
  }, []);

  const updateActionInBackend = useCallback(async (action, fromCategory, toCategory) => {
    try {
      const isMovingToPending = toCategory === 'pending';
      const isMovingToCompleted = toCategory === 'completed';
      
      const updateFields = {};
      if (isMovingToPending) {
        updateFields.pending_action = true;
        updateFields.completed = false;
      } else if (isMovingToCompleted) {
        updateFields.completed = true;
        updateFields.pending_action = false;
      } else {
        updateFields.pending_action = false;
        updateFields.completed = false;
      }

      await ApiCaller('/records', {
        method: 'PATCH',
        body: JSON.stringify({
          recordsToUpdate: [{ 
            id: action.id, 
            fields: updateFields
          }],
          tableName: 'actions'
        })
      });
    } catch (error) {
      console.error("Failed to update action in backend:", error);
      // Revert the optimistic update on error
      moveActionOptimistically(action, toCategory, fromCategory);
      Alert.alert('Error', 'Failed to update action. Please try again.');
    }
  }, [moveActionOptimistically]);


  const moveActionBetweenCategories = useCallback(async (action, fromCategory, toCategory) => {
    const isMovingToPending = toCategory === 'pending';
    
    try {
      await ApiCaller('/records', {
        method: 'PATCH',
        body: JSON.stringify({
          recordsToUpdate: [{ 
            id: action.id, 
            fields: { pending_action: isMovingToPending } 
          }],
          tableName: 'actions'
        })
      });
      
      // Update local state
      if (fromCategory === 'pending' && toCategory === 'active') {
        setPendingActions(prev => prev.filter(a => a.id !== action.id));
        setActiveActions(prev => [...prev, { ...action, fields: { ...action.fields, pending_action: false } }]);
      } else if (fromCategory === 'active' && toCategory === 'pending') {
        setActiveActions(prev => prev.filter(a => a.id !== action.id));
        setPendingActions(prev => [...prev, { ...action, fields: { ...action.fields, pending_action: true } }]);
      }
    } catch (error) {
      console.error("Failed to move action between categories:", error);
      Alert.alert('Error', 'Failed to move action. Please try again.');
    }
  }, []);

  const handleSaveNewAction = useCallback(async () => {
    if (!newAction.description || !newAction.estCompletion) {
      Alert.alert('Error', 'Please fill out all fields for the new action.');
      return;
    }

    if (!selectedProject) {
      Alert.alert('Error', 'No project selected.');
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    const recordToCreate = {
      fields: {
        'Project ID': [selectedProject.id],
        'action_description': newAction.description,
        'estimated_completion_date': newAction.estCompletion,
        'set_date': today,
        'completed': false,
      }
    };

    try {
      await ApiCaller('/records', {
        method: 'POST',
        body: JSON.stringify({ recordsToCreate: [recordToCreate], tableName: 'actions' })
      });
      // Refetch actions to include the new one
      fetchProjectDetailedActions(selectedProject);
      setNewAction({ description: '', estCompletion: '' });
      setIsAddingAction(false);
      setShowDatePicker(false);
    } catch (error) {
      console.error("Failed to create new action:", error);
      Alert.alert('Error', 'There was an error saving the new action.');
    }
  }, [newAction, selectedProject, fetchProjectDetailedActions]);

  const handleDeleteAction = useCallback(async (actionId) => {
    Alert.alert(
      'Delete Action',
      'Are you sure you want to delete this action? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await ApiCaller('/records/actions', {
                method: 'DELETE',
                body: JSON.stringify({ recordIds: [actionId] })
              });
              // Re-fetch to update the UI
              if (selectedProject) {
                fetchProjectDetailedActions(selectedProject);
              }
            } catch (error) {
              console.error("Failed to delete action:", error);
              Alert.alert('Error', 'There was an error deleting the action.');
            }
          }
        }
      ]
    );
  }, [selectedProject, fetchProjectDetailedActions]);

  // Project operation change handler
  const handleProjectOperationChange = async (projectId, newOperation) => {
    const project = projects.find(p => p.id === projectId);
    const projectName = project?.fields?.['Project Name'] || 'Unknown Project';
    const action = newOperation === 'Deactivated' ? 'deactivate' : 'reactivate';
    
    Alert.alert(
      `${action.charAt(0).toUpperCase() + action.slice(1)} Project`,
      `Are you sure you want to ${action} the project "${projectName}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: action.charAt(0).toUpperCase() + action.slice(1), 
          style: newOperation === 'Deactivated' ? 'destructive' : 'default',
          onPress: async () => {
            try {
              await ApiCaller('/records', {
                method: 'PATCH',
                body: JSON.stringify({ 
                  recordsToUpdate: [{ 
                    id: projectId, 
                    fields: { 'Operation': newOperation } 
                  }],
                  tableName: 'projects'
                })
              });
              
              // Update the project's operation status in the data array
              setProjects(currentProjects =>
                currentProjects.map(project =>
                  project.id === projectId 
                    ? { ...project, fields: { ...project.fields, 'Operation': newOperation } }
                    : project
                )
              );
              
              // If reactivating a project, switch to the active tab
              if (newOperation === 'Active') {
                setActiveProjectTab('active');
              }
              
              // Close the project details if it's currently open
              setSelectedProject(null);
              
              Alert.alert('Success', `Project "${projectName}" has been successfully ${action}d.`);
              
            } catch (error) {
              console.error(`Failed to ${action} project:`, error);
              Alert.alert('Error', `There was an error ${action}ing the project. Please try again.`);
            }
          }
        }
      ]
    );
  };

  // Simple Action Item Component
  const ActionItem = useCallback(({ action, onToggle, onDelete, onMoveToCategory, category }) => {
    return (
      <View style={styles.actionItem}>
        <View style={styles.actionContent}>
          <TouchableOpacity
            style={styles.actionCheckbox}
            onPress={() => {
              if (userRole !== 'client') {
                if (category === 'completed') {
                  // Move from completed to active
                  onMoveToCategory(action, 'completed', 'active');
                } else {
                  // Move to completed
                  onMoveToCategory(action, category, 'completed');
                }
              }
            }}
            disabled={userRole === 'client'}
          >
            <Ionicons 
              name={action.fields.completed ? "checkmark-circle" : "ellipse-outline"} 
              size={20} 
              color={action.fields.completed ? "#10B981" : "#6B7280"} 
            />
          </TouchableOpacity>
          <View style={styles.actionDetails}>
            <Text style={[styles.actionDescription, action.fields.completed && styles.completedActionText]}>
              {String(action.fields.action_description || 'Untitled Action')}
            </Text>
            <View style={styles.actionMeta}>
              <Text style={styles.actionMetaText}>
                Created: {String(action.fields.set_date || 'Unknown')}
              </Text>
              <Text style={styles.actionMetaText}>
                Est. Completion: {String(action.fields.estimated_completion_date || 'Not set')}
              </Text>
            </View>
          </View>
          <View style={styles.actionButtons}>
            {/* Simple Move Buttons - Only for consultants */}
            {userRole !== 'client' && (
              <>
                {category === 'pending' && (
                  <>
                    <TouchableOpacity
                      style={styles.moveButton}
                      onPress={() => onMoveToCategory(action, 'pending', 'active')}
                    >
                      <Ionicons name="arrow-down" size={16} color="#3B82F6" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.moveButton}
                      onPress={() => onMoveToCategory(action, 'pending', 'completed')}
                    >
                      <Ionicons name="checkmark" size={16} color="#10B981" />
                    </TouchableOpacity>
                  </>
                )}
                {category === 'active' && (
                  <>
                    <TouchableOpacity
                      style={styles.moveButton}
                      onPress={() => onMoveToCategory(action, 'active', 'pending')}
                    >
                      <Ionicons name="arrow-up" size={16} color="#F59E0B" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.moveButton}
                      onPress={() => onMoveToCategory(action, 'active', 'completed')}
                    >
                      <Ionicons name="arrow-down" size={16} color="#10B981" />
                    </TouchableOpacity>
                  </>
                )}
                {category === 'completed' && (
                  <TouchableOpacity
                    style={styles.moveButton}
                    onPress={() => onMoveToCategory(action, 'completed', 'active')}
                  >
                    <Ionicons name="arrow-up" size={16} color="#6B7280" />
                  </TouchableOpacity>
                )}
              </>
            )}
            
            {userRole !== 'client' && (
              <TouchableOpacity
                style={styles.deleteActionButton}
                onPress={() => onDelete(action.id)}
              >
                <Ionicons name="trash-outline" size={16} color="#EF4444" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  }, [userRole]);

  // Simple Category Component
  const ActionCategory = useCallback(({ title, color, count, children }) => {
    return (
      <View style={styles.actionCategory}>
        <View style={styles.actionCategoryHeader}>
          <Text style={[styles.actionCategoryTitle, { color }]}>{title}</Text>
          <View style={styles.actionCategoryCount}>
            <Text style={styles.actionCategoryCountText}>{String(count)}</Text>
          </View>
        </View>
        {children}
      </View>
    );
  }, []);

  // Reset navigation state when user logs out
  useEffect(() => {
    if (!isAuthenticated) {
      // Clear all navigation state
      setCurrentScreen('Home');
      setNavigationStack(['Home']);
      setSelectedProject(null);
      setSelectedTask(null);
      setTaskData({ groups: [], ungroupedTasks: [] });
      setCollapsedGroups(new Set());
      // Clear actions state
      setPendingActions([]);
      setActiveActions([]);
      setCompletedActions([]);
      setIsAddingAction(false);
      setNewAction({ description: '', estCompletion: '' });
      setShowDatePicker(false);
      // Clear chat state
      setProjectMessages([]);
      setNewProjectMessage('');
      setProjectChatAttachment(null);
      setIsAIMode(false);
      setIsAITyping(false);
      setAiRequestInProgress(false);
    }
  }, [isAuthenticated]);

  // Chat utility functions
  const isAIMessage = (message) => {
    return message.fields?.is_ai === true || message.fields?.sender === 'Waiverlyn';
  };

  const isConsultantMessage = (message) => {
    return message.fields?.sender === 'Consultant';
  };

  const isClientMessage = (message, projectName) => {
    return message.fields?.sender === projectName;
  };

  const getMessageStyling = (message, userRole, projectName) => {
    const isAI = isAIMessage(message);
    const isConsultant = isConsultantMessage(message);
    const isClient = isClientMessage(message, projectName);
    
    if (isAI) {
      return {
        alignment: 'justify-start',
        bgColor: '#F3E8FF',
        borderColor: '#C084FC',
        label: 'Waiverlyn'
      };
    }
    
    if (userRole === 'client') {
      if (isClient) {
        return {
          alignment: 'justify-end',
          bgColor: '#3B82F6',
          borderColor: '#2563EB',
          label: 'You'
        };
      } else {
        return {
          alignment: 'justify-start',
          bgColor: '#F1F5F9',
          borderColor: '#CBD5E1',
          label: 'Consultant'
        };
      }
    } else {
      if (isConsultant) {
        return {
          alignment: 'justify-end',
          bgColor: '#3B82F6',
          borderColor: '#2563EB',
          label: 'You'
        };
      } else {
        return {
          alignment: 'justify-start',
          bgColor: '#F1F5F9',
          borderColor: '#CBD5E1',
          label: 'Client'
        };
      }
    }
  };

  const shouldTriggerAI = (message, aiModeEnabled) => {
    if (!aiModeEnabled) return false;
    if (!message || message.trim().length === 0) return false;
    return true;
  };

  const debounce = (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  };

  // Fetch project messages
  const fetchProjectMessages = useCallback(async () => {
    if (!selectedProject?.fields?.['Project ID']) return;
    try {
      const { records } = await ApiCaller(`/messages/${selectedProject.fields['Project ID']}/project_messages`);
      const sortedMessages = records.sort((a, b) => new Date(a.createdTime) - new Date(b.createdTime));
      setProjectMessages(sortedMessages);
    } catch (err) {
      console.error('Failed to load project chat history:', err);
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
            sender: selectedProject?.fields?.['Project Name'] || 'Client',
            message_text: 'Hi! I have a question about the project timeline.',
            is_read: true
          }
        }
      ];
      setProjectMessages(sampleMessages);
    }
  }, [selectedProject?.fields?.['Project ID'], selectedProject?.fields?.['Project Name']]);

  // Socket.IO connection for project chat
  useEffect(() => {
    if (!selectedProject?.id) return;
    
    projectSocketRef.current = io("https://ats-backend-805977745256.us-central1.run.app");

    projectSocketRef.current.on('connect', () => {
      console.log('Connected to project socket server');
      projectSocketRef.current.emit('joinProjectRoom', selectedProject.id);
    });

    projectSocketRef.current.on('receiveProjectMessage', (message) => {
      setProjectMessages(prevMessages => {
        const newMessages = [...prevMessages, message];
        // When a new message is received, check if it should be marked as read immediately
        if (message.fields.sender === 'Consultant') {
          setTimeout(() => {
            projectSocketRef.current.emit('markMessagesAsRead', {
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

    projectSocketRef.current.on('sendProjectMessageError', (error) => {
      console.error("Error sending project message:", error);
    });

    // AI-related socket events
    projectSocketRef.current.on('waiverlyn:typing', (data) => {
      setIsAITyping(data.isTyping);
    });

    projectSocketRef.current.on('waiverlyn:response', (data) => {
      console.log('Received Waiverlyn response:', data);
      setAiRequestInProgress(false);
      setIsAITyping(false);
      
      // Add the AI response to the messages
      if (data.message) {
        setProjectMessages(prevMessages => [...prevMessages, data.message]);
      }
    });

    projectSocketRef.current.on('waiverlyn:error', (data) => {
      console.error('Waiverlyn error:', data);
      setAiRequestInProgress(false);
      setIsAITyping(false);
      Alert.alert('AI Error', data.error);
    });

    // Project update listeners for real-time data refresh
    projectSocketRef.current.on('projectUpdated', (payload) => {
      console.log('[socket] projectUpdated', payload);
      if (selectedProject?.id) {
        refreshSelectedProject(selectedProject.id);
      }
    });

    projectSocketRef.current.on('tasksUpdated', (payload) => {
      console.log('[socket] tasksUpdated', payload);
      if (selectedProject) {
        fetchProjectTasks(selectedProject);
      }
    });

    projectSocketRef.current.on('taskUpdated', (payload) => {
      console.log('[socket] taskUpdated', payload);
      if (selectedProject) {
        fetchProjectTasks(selectedProject);
      }
    });

    projectSocketRef.current.on('taskCreated', (payload) => {
      console.log('[socket] taskCreated', payload);
      if (selectedProject) {
        fetchProjectTasks(selectedProject);
      }
    });

    projectSocketRef.current.on('taskDeleted', (payload) => {
      console.log('[socket] taskDeleted', payload);
      if (selectedProject) {
        fetchProjectTasks(selectedProject);
      }
    });

    projectSocketRef.current.on('taskGroupsUpdated', (payload) => {
      console.log('[socket] taskGroupsUpdated', payload);
      if (selectedProject) {
        fetchProjectTasks(selectedProject);
      }
    });

    projectSocketRef.current.on('actionsUpdated', (payload) => {
      console.log('[socket] actionsUpdated', payload);
      if (selectedProject) {
        fetchProjectDetailedActions(selectedProject);
      }
    });

    projectSocketRef.current.on('collaboratorsUpdated', (payload) => {
      console.log('[socket] collaboratorsUpdated', payload);
      if (selectedProject?.id) {
        refreshSelectedProject(selectedProject.id);
      }
    });

    projectSocketRef.current.on('activitiesUpdated', (payload) => {
      console.log('[socket] activitiesUpdated', payload);
      if (selectedProject) {
        fetchProjectTasks(selectedProject);
        fetchProjectDetailedActions(selectedProject);
        refreshSelectedProject(selectedProject.id);
      }
    });

    projectSocketRef.current.on('internalNotesUpdated', (payload) => {
      console.log('[socket] internalNotesUpdated', payload);
      if (selectedProject?.id) {
        refreshSelectedProject(selectedProject.id);
      }
    });

    return () => {
      if (selectedProject?.id) {
        projectSocketRef.current.emit('leaveProjectRoom', selectedProject.id);
      }
      projectSocketRef.current.disconnect();
    };
  }, [selectedProject?.id]);

  // Fetch messages when project changes
  useEffect(() => {
    if (selectedProject && currentScreen === 'ProjectDetails') {
      fetchProjectMessages();
    }
  }, [selectedProject, currentScreen, fetchProjectMessages]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (projectChatContainerRef.current && projectMessages.length > 0) {
      setTimeout(() => {
        projectChatContainerRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [projectMessages]);

  // Auto-scroll to bottom when project changes (to show latest messages)
  useEffect(() => {
    if (selectedProject && currentScreen === 'ProjectDetails' && projectMessages.length > 0) {
      setTimeout(() => {
        projectChatContainerRef.current?.scrollToEnd({ animated: false });
      }, 200);
    }
  }, [selectedProject, currentScreen, projectMessages.length]);

  // Debounced AI request handler
  const debouncedAIRequest = useCallback(
    debounce(async (projectId, message, sender) => {
      if (!projectSocketRef.current) return;
      
      setAiRequestInProgress(true);
      const payload = {
        projectId: projectId,
        message: message,
        sender: sender
      };
      
      console.log('Sending AI request:', payload);
      projectSocketRef.current.emit('waiverlyn:request', payload);
    }, 2000),
    []
  );

  // Send project message
  const handleSendProjectMessage = async () => {
    const messageContent = newProjectMessage.trim();
    
    if (!messageContent && !projectChatAttachment) return;
    
    const senderName = userRole === 'client' 
      ? (selectedProject?.fields?.['Project Name'] || 'Client')
      : 'Consultant';
    
    try {
      setIsUploadingProjectChatFile(true);
      
      let attachmentUrl = null;
      
      // If there's a file attachment, upload it first
      if (projectChatAttachment) {
        const formData = new FormData();
        formData.append('file', projectChatAttachment);
        formData.append('sourceTable', 'project_messages');
        formData.append('sourceRecordId', selectedProject.id);
        
        const response = await ApiCaller('/upload-image', {
          method: 'POST',
          body: formData,
        });
        
        // Try different ways to access the URL
        if (response && typeof response === 'object') {
          if (response.url) {
            attachmentUrl = response.url;
          } else if (response.data && response.data.url) {
            attachmentUrl = response.data.url;
          } else if (typeof response === 'string' && response.includes('http')) {
            attachmentUrl = response;
          }
        }
      }
      
      // Send the message with optional attachment
      const messageData = {
        projectId: selectedProject.id,
        message: messageContent || (projectChatAttachment ? projectChatAttachment.name : ''),
        sender: senderName,
        attachmentUrl: attachmentUrl || null,
        attachmentName: projectChatAttachment ? projectChatAttachment.name : null,
        attachmentType: projectChatAttachment ? projectChatAttachment.type : null,
        attachment_url: attachmentUrl || null,
        attachment_name: projectChatAttachment ? projectChatAttachment.name : null,
        attachment_type: projectChatAttachment ? projectChatAttachment.type : null,
      };
      
      console.log('Sending project message with data:', messageData);
      
      // For demo purposes, if no socket connection, just add message locally
      if (!projectSocketRef.current) {
        const newMsg = {
          id: `demo_${Date.now()}`,
          createdTime: new Date().toISOString(),
          fields: {
            sender: senderName,
            message_text: messageContent,
            is_read: true
          }
        };
        setProjectMessages(prev => [...prev, newMsg]);
      } else {
        projectSocketRef.current.emit('sendProjectMessage', messageData);
      }
      
      // Trigger AI response if in AI mode and conditions are met
      if (isAIMode && shouldTriggerAI(messageContent, true) && !aiRequestInProgress) {
        debouncedAIRequest(selectedProject.id, messageContent, senderName);
      }
      
      // Clear the input
      setNewProjectMessage('');
      setProjectChatAttachment(null);
    } catch (error) {
      console.error('Failed to send message with attachment:', error);
      Alert.alert('Error', 'Failed to upload attachment. Please try again.');
    } finally {
      setIsUploadingProjectChatFile(false);
    }
  };

  // For clients, navigate directly to their project on first load
  // IMPORTANT: This must be BEFORE any conditional returns to follow Rules of Hooks
  useEffect(() => {
    if (userRole === 'client' && currentUser && currentUser.projectId && isAuthenticated) {
      // Check if we already have the project in state
      if (!selectedProject || selectedProject.id !== currentUser.projectId) {
        // Reconstruct project data from currentUser
        const projectData = {
          id: currentUser.projectId,
          fields: currentUser.projectFields || {}
        };
        navigateToProjectDetails(projectData);
      }
    }
  }, [userRole, currentUser, navigateToProjectDetails, selectedProject, isAuthenticated]);

  // Show loading screen while auth is initializing
  if (authLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F3F4F6' }}>
        <ActivityIndicator size={50} color="#D4AF37" />
        <Text style={{ marginTop: 16, fontSize: 16, color: '#6B7280' }}>Loading...</Text>
      </View>
    );
  }

  // Helper function to determine collaborator role
  const getCollaboratorRole = (collaboratorName, projectFields) => {
    if (!collaboratorName || !projectFields) return 'Client';
    
    const name = String(collaboratorName).trim();
    const assignedConsultant = String(projectFields['Assigned Consultant'] || '').trim();
    const supervisingConsultant = String(projectFields['Supervising Consultant'] || '').trim();
    const projectName = String(projectFields['Project Name'] || '').trim();
    
    // Check if matches Assigned Consultant or Supervising Consultant
    if (name === assignedConsultant || name === supervisingConsultant) {
      return 'Consultant';
    }
    
    // Check if matches Project Name
    if (name === projectName) {
      return 'Client';
    }
    
    // Default to Client
    return 'Client';
  };

  // Show login screens if not authenticated (MOVED AFTER ALL HOOKS)
  if (!isAuthenticated) {
    return (
      <View style={{ flex: 1 }}>
        {authScreen === 'ConsultantLogin' ? (
          <LoginScreen navigation={{ navigate: (screen) => setAuthScreen(screen) }} />
        ) : (
          <ClientLoginScreen 
            navigation={{ navigate: (screen) => setAuthScreen(screen), goBack: () => setAuthScreen('ConsultantLogin') }}
            onClientLogin={handleClientLogin}
          />
        )}
      </View>
    );
  }

  const renderScreen = () => {
    switch (currentScreen) {
      case 'Home':
        return (
          <ScrollView 
            style={styles.screenContainer} 
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#D4AF37']} />
            }
          >
            {/* Company Logo */}
            <View style={styles.contentLogoContainer}>
              <Image 
                source={require('./assets/company_logo.avif')} 
                style={styles.contentLogo}
                resizeMode="contain"
              />
            </View>
            
            <View style={styles.dashboardHeader}>
              <Text style={styles.title}>Dashboard</Text>
              <Text style={styles.subtitle}>Welcome back!</Text>
            </View>
            
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size={50} color="#D4AF37" />
                <Text style={styles.loadingText}>Loading your data...</Text>
              </View>
            ) : (
              <>
                {/* Incomplete Actions Section */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Incomplete Actions</Text>
                  {incompleteActions.length > 0 ? (
                    incompleteActions.slice(0, 5).map((action) => (
                      <View key={action.id} style={styles.actionCard}>
                        <View style={styles.actionHeader}>
                          <Text style={styles.actionTitle}>{String(action.fields.action_description || 'No description')}</Text>
                        </View>
                        <Text style={styles.actionDescription}>
                          Project: {String(action.fields.ProjectName)} ({String(action.fields.ProjectCustomID)})
                        </Text>
                        <Text style={styles.actionDate}>
                          Est. Completion: {String(action.fields.estimated_completion_date || 'Not set')}
                        </Text>
                      </View>
                    ))
                  ) : (
                    <View style={styles.emptyState}>
                      <Text style={styles.emptyText}>No incomplete actions. Great job!</Text>
                    </View>
                  )}
                </View>

                {/* Recent Projects Section */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Recent Projects</Text>
                  {projects.length > 0 ? (
                    projects.slice(0, 3).map((project) => (
                      <TouchableOpacity 
                        key={project.id} 
                        style={styles.projectCard}
                        onPress={() => navigateToProjectDetails(project)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.projectName}>
                          {String(project.fields['Project Name'] || 'Unnamed Project')}
                        </Text>
                        <Text style={styles.projectStatus}>
                          {String(project.fields.Status || 'No status')}
                        </Text>
                        <Ionicons name="chevron-forward" size={20} color="#D4AF37" style={styles.chevronIcon} />
                      </TouchableOpacity>
                    ))
                  ) : (
                    <View style={styles.emptyState}>
                      <Text style={styles.emptyText}>No projects found</Text>
                    </View>
                  )}
                </View>
              </>
            )}
          </ScrollView>
        );
      case 'Projects':
        return (
          <ScrollView 
            style={styles.screenContainer} 
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#D4AF37']} />
            }
          >
            {/* Company Logo */}
            <View style={styles.contentLogoContainer}>
              <Image 
                source={require('./assets/company_logo.avif')} 
                style={styles.contentLogo}
                resizeMode="contain"
              />
            </View>
            
            {/* Tab Navigation */}
            <View style={styles.tabContainer}>
              <TouchableOpacity 
                style={[styles.tabButton, activeProjectTab === 'active' && styles.activeTabButton]}
                onPress={() => setActiveProjectTab('active')}
              >
                <Text style={[styles.tabButtonText, activeProjectTab === 'active' && styles.activeTabButtonText]}>
                  Active Projects
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.tabButton, activeProjectTab === 'deactivated' && styles.activeTabButton]}
                onPress={() => setActiveProjectTab('deactivated')}
              >
                <Text style={[styles.tabButtonText, activeProjectTab === 'deactivated' && styles.activeTabButtonText]}>
                  Deactivated Projects
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.dashboardHeader}>
              <Text style={styles.title}>
                {activeProjectTab === 'active' ? 'Active Projects' : 'Deactivated Projects'}
              </Text>
              <Text style={styles.subtitle}>
                {searchQuery ? `${filteredProjects.length} of ${activeProjectTab === 'active' ? projects.filter(p => p.fields['Operation'] === 'Active' || !p.fields['Operation']).length : projects.filter(p => p.fields['Operation'] === 'Deactivated').length} projects` : `${activeProjectTab === 'active' ? projects.filter(p => p.fields['Operation'] === 'Active' || !p.fields['Operation']).length : projects.filter(p => p.fields['Operation'] === 'Deactivated').length} total projects`}
              </Text>
            </View>

            {/* Search Bar */}
            <View style={styles.searchContainer}>
              <View style={styles.searchInputWrapper}>
                <Ionicons name="search" size={20} color="#6B7280" style={styles.searchIcon} />
                <TextInput
                  style={styles.searchInput}
                  placeholder={`Search by ${filterField}...`}
                  placeholderTextColor="#9CA3AF"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
                    <Ionicons name="close-circle" size={20} color="#6B7280" />
                  </TouchableOpacity>
                )}
              </View>
          <TouchableOpacity 
            style={styles.filterButton}
            onPress={() => setShowFilterModal(true)}
          >
            <Ionicons name="filter" size={20} color="#D4AF37" />
            <Text style={styles.filterButtonText} numberOfLines={1}>
              {filterField}
            </Text>
          </TouchableOpacity>
            </View>
            
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size={50} color="#D4AF37" />
                <Text style={styles.loadingText}>Loading projects...</Text>
              </View>
            ) : (
              <View style={styles.section}>
                {filteredProjects.length > 0 ? (
                  filteredProjects.map((project) => {
                    const fields = project.fields;
                    const isDeactivated = fields['Operation'] === 'Deactivated';
                    const statusColor = fields.Status === 'Completed' ? '#4CAF50' : 
                                       fields.Status === 'In Progress' ? '#D4AF37' : '#FFC107';
                    
                    return (
                      <TouchableOpacity 
                        key={project.id} 
                        style={[
                          styles.projectCard,
                          isDeactivated && styles.deactivatedProjectCard
                        ]}
                        onPress={() => navigateToProjectDetails(project)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.projectHeader}>
                          <View style={styles.projectTitleRow}>
                            <Text style={[styles.projectName, isDeactivated && styles.deactivatedText]}>
                              {String(fields['Project Name'] || 'Unnamed Project')}
                            </Text>
                            {isDeactivated && (
                              <View style={styles.deactivatedBadge}>
                                <Text style={styles.deactivatedBadgeText}>DEACTIVATED</Text>
                              </View>
                            )}
                          </View>
                          <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
                            <Text style={styles.statusText}>{String(fields.Status || 'Unknown')}</Text>
                          </View>
                        </View>
                        <Text style={styles.projectDescription}>
                          {String(fields['Project ID'] || 'No ID')} • {String(fields['Project Type'] || 'No type')}
                        </Text>
                        <View style={styles.projectDetails}>
                          <View style={styles.detailItem}>
                            <Text style={styles.detailLabel}>Client:</Text>
                            <Text style={styles.detailValue}>
                              {String(fields['Client Email'] ? fields['Client Email'].split('@')[0] : 'No client')}
                            </Text>
                          </View>
                          <View style={styles.detailItem}>
                            <Text style={styles.detailLabel}>Start Date:</Text>
                            <Text style={styles.detailValue}>
                              {String(fields['Start Date'] ? new Date(fields['Start Date']).toLocaleDateString() : 'Not set')}
                            </Text>
                          </View>
                        </View>
                        {!!fields['Assigned Consultant'] && (
                          <Text style={styles.consultantText}>
                            👤 {String(fields['Assigned Consultant'])}
                          </Text>
                        )}
                        <Ionicons name="chevron-forward" size={20} color="#D4AF37" style={styles.chevronIcon} />
                      </TouchableOpacity>
                    );
                  })
                ) : (
                  <View style={styles.emptyState}>
                    <Ionicons name="search-outline" size={64} color="#9CA3AF" />
                    <Text style={styles.emptyText}>
                      {searchQuery ? 'No projects match your search' : 'No projects found'}
                    </Text>
                    {searchQuery && (
                      <TouchableOpacity 
                        style={styles.clearSearchButton}
                        onPress={() => setSearchQuery('')}
                      >
                        <Text style={styles.clearSearchText}>Clear Search</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            )}

            {/* Filter Field Selection Modal */}
            <Modal
              visible={showFilterModal}
              transparent={true}
              animationType="fade"
              onRequestClose={() => setShowFilterModal(false)}
            >
              <TouchableOpacity 
                style={styles.modalOverlay}
                activeOpacity={1}
                onPress={() => setShowFilterModal(false)}
              >
                <View style={styles.filterModalContainer}>
                  <View style={styles.filterModalHeader}>
                    <Text style={styles.filterModalTitle}>Select Filter Field</Text>
                    <TouchableOpacity onPress={() => setShowFilterModal(false)}>
                      <Ionicons name="close" size={24} color="#1F2937" />
                    </TouchableOpacity>
                  </View>
                  <ScrollView style={styles.filterModalScroll}>
                    {searchableFields.map((field) => (
                      <TouchableOpacity
                        key={field}
                        style={[
                          styles.filterModalItem,
                          filterField === field && styles.filterModalItemSelected
                        ]}
                        onPress={() => {
                          setFilterField(field);
                          setShowFilterModal(false);
                        }}
                      >
                        <Text style={[
                          styles.filterModalItemText,
                          filterField === field && styles.filterModalItemTextSelected
                        ]}>
                          {field}
                        </Text>
                        {filterField === field && (
                          <Ionicons name="checkmark-circle" size={20} color="#D4AF37" />
                        )}
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </TouchableOpacity>
            </Modal>
          </ScrollView>
        );
      case 'ProjectDetails':
        if (!selectedProject) return null;
        const fields = selectedProject.fields;
        
        // Check if client is trying to access a deactivated project
        if (userRole === 'client' && fields['Operation'] === 'Deactivated') {
          return (
            <ProjectDeactivatedScreen 
              onBackToLogin={logout}
            />
          );
        }
        
        return (
          <ScrollView 
            style={styles.screenContainer} 
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#D4AF37']} />
            }
          >
            {/* Header with Back/Logout Button and Edit */}
            <View style={styles.detailsHeader}>
              {userRole === 'client' ? (
                // Client: Logout button styled like back button
                <View style={{ alignItems: 'flex-start' }}>
                  <TouchableOpacity 
                    onPress={logout} 
                    style={[styles.backButton, { backgroundColor: '#EF4444', borderRadius: 8, padding: 8 }]}
                  >
                    <Ionicons name="log-out-outline" size={24} color="white" />
                  </TouchableOpacity>
                  <Text style={{ fontSize: 11, color: '#EF4444', marginTop: 4, fontWeight: '600' }}>Logout</Text>
                </View>
              ) : (
                // Consultant: Normal back button
                <TouchableOpacity onPress={navigateBack} style={styles.backButton}>
                  <Ionicons name="arrow-back" size={24} color="#2C2C2C" />
                </TouchableOpacity>
              )}
              <Text style={styles.detailsTitle} numberOfLines={1}>
                {String(fields['Project Name'] || 'Project Details')}
              </Text>
              {userRole !== 'client' && (
                <TouchableOpacity
                  onPress={() => {
                    const isDeactivated = fields['Operation'] === 'Deactivated';
                    handleProjectOperationChange(selectedProject.id, isDeactivated ? 'Active' : 'Deactivated');
                  }}
                  style={[
                    styles.operationButton,
                    fields['Operation'] === 'Deactivated' ? styles.reactivateButton : styles.deactivateButton
                  ]}
                >
                  <Ionicons 
                    name={fields['Operation'] === 'Deactivated' ? 'refresh' : 'pause-circle'} 
                    size={16} 
                    color="white" 
                  />
                  <Text style={styles.operationButtonText}>
                    {fields['Operation'] === 'Deactivated' ? 'Reactivate' : 'Deactivate'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Project Info Card */}
            <View style={styles.detailsCard}>
              {/* Card Header with Edit Button */}
              <TouchableOpacity 
                style={styles.cardHeader}
                onPress={() => {
                  // Only make collapsible for clients
                  if (userRole === 'client') {
                    setIsProjectInfoCollapsed(!isProjectInfoCollapsed);
                  }
                }}
                activeOpacity={userRole === 'client' ? 0.7 : 1}
                disabled={userRole !== 'client'}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                  <Text style={styles.cardTitle}>Project Information</Text>
                  {userRole === 'client' && (
                    <Ionicons 
                      name={isProjectInfoCollapsed ? "chevron-down" : "chevron-up"} 
                      size={20} 
                      color="#2C2C2C" 
                      style={{ marginLeft: 8 }}
                    />
                  )}
                </View>
                {userRole !== 'client' && !isProjectEditing && (
                  <TouchableOpacity
                    accessibilityLabel="Edit section"
                    onPress={() => setIsProjectEditing(true)}
                    style={styles.headerEditButton}
                  >
                    <Ionicons name="create" size={18} color="#2C2C2C" />
                  </TouchableOpacity>
                )}
                {userRole !== 'client' && isProjectEditing && (
                  <View style={styles.headerActionButtons}>
                    <TouchableOpacity 
                      onPress={saveEditedProject} 
                      style={styles.saveButton}
                    >
                      <Text style={styles.saveButtonText}>Save</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      onPress={() => { setIsProjectEditing(false); setEditedProjectFields({}); }} 
                      style={styles.cancelButton}
                    >
                      <Text style={styles.cancelButtonText}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </TouchableOpacity>
              
              {/* Card Content - Only show if not collapsed (or if not a client) */}
              {(!isProjectInfoCollapsed || userRole !== 'client') && (
              <View style={styles.cardContent}>
                <View style={styles.detailsRow}>
                <Text style={styles.detailsLabel}>Project ID</Text>
                <Text style={styles.detailsValue}>{String(fields['Project ID'] || 'N/A')}</Text>
              </View>
              <View style={styles.detailsRow}>
                <Text style={styles.detailsLabel}>Status</Text>
                {isProjectEditing ? (
                  <TouchableOpacity style={styles.selectInput} onPress={() => setPickerState({ open: true, field: 'Status', options: STATUS_OPTIONS })}>
                    <Text style={styles.selectText}>{String(editedProjectFields['Status'] ?? fields['Status'] ?? 'Select')}</Text>
                    <Ionicons name="chevron-down" size={18} color="#6B7280" />
                  </TouchableOpacity>
                ) : (
                  <View style={[styles.statusBadge, { 
                    backgroundColor: fields.Status === 'Completed' ? '#4CAF50' : 
                                   fields.Status === 'In Progress' ? '#D4AF37' : '#FFC107'
                  }]}>
                    <Text style={styles.statusText}>{String(fields.Status || 'Unknown')}</Text>
                  </View>
                )}
              </View>
              <View style={styles.detailsRow}>
                <Text style={styles.detailsLabel}>Type</Text>
                {isProjectEditing ? (
                  <TouchableOpacity style={styles.selectInput} onPress={() => setPickerState({ open: true, field: 'Project Type', options: PROJECT_TYPES })}>
                    <Text style={styles.selectText}>{String(editedProjectFields['Project Type'] ?? fields['Project Type'] ?? 'Select')}</Text>
                    <Ionicons name="chevron-down" size={18} color="#6B7280" />
                  </TouchableOpacity>
                ) : (
                  <Text style={styles.detailsValue}>{String(fields['Project Type'] || 'N/A')}</Text>
                )}
              </View>
              <View style={styles.detailsRow}>
                <Text style={styles.detailsLabel}>Client</Text>
                {isProjectEditing ? (
                  <TextInput
                    style={styles.detailsInput}
                    value={String(editedProjectFields['Client Email'] ?? fields['Client Email'] ?? '')}
                    onChangeText={(t) => handleProjectFieldChange('Client Email', t)}
                    placeholder="client@example.com"
                    placeholderTextColor="#9CA3AF"
                    autoCapitalize="none"
                    keyboardType="email-address"
                  />
                ) : (
                  <Text style={styles.detailsValue}>{String(fields['Client Email'] || 'N/A')}</Text>
                )}
              </View>
              <View style={styles.detailsRow}>
                <Text style={styles.detailsLabel}>Start Date</Text>
                {isProjectEditing ? (
                  <TouchableOpacity style={styles.selectInput} onPress={() => setShowDatePicker(true)}>
                    <Text style={styles.selectText}>{String(editedProjectFields['Start Date'] ?? fields['Start Date'] ?? 'YYYY-MM-DD')}</Text>
                    <Ionicons name="calendar" size={18} color="#6B7280" />
                  </TouchableOpacity>
                ) : (
                  <Text style={styles.detailsValue}>
                    {String(fields['Start Date'] ? new Date(fields['Start Date']).toLocaleDateString() : 'Not set')}
                  </Text>
                )}
              </View>
              <View style={styles.detailsRow}>
                <Text style={styles.detailsLabel}>Assigned Consultant</Text>
                {isProjectEditing ? (
                  <TouchableOpacity style={styles.selectInput} onPress={() => setPickerState({ open: true, field: 'Assigned Consultant', options: ASSIGNED_CONSULTANTS })}>
                    <Text style={styles.selectText}>{String(editedProjectFields['Assigned Consultant'] ?? fields['Assigned Consultant'] ?? 'Select')}</Text>
                    <Ionicons name="chevron-down" size={18} color="#6B7280" />
                  </TouchableOpacity>
                ) : (
                  <Text style={styles.detailsValue}>{String(fields['Assigned Consultant'] || 'Unassigned')}</Text>
                )}
              </View>
              <View style={styles.detailsRow}>
                <Text style={styles.detailsLabel}>Supervising Consultant</Text>
                {isProjectEditing ? (
                  <TouchableOpacity style={styles.selectInput} onPress={() => setPickerState({ open: true, field: 'Supervising Consultant', options: SUPERVISING_CONSULTANTS })}>
                    <Text style={styles.selectText}>{String(editedProjectFields['Supervising Consultant'] ?? fields['Supervising Consultant'] ?? 'Select')}</Text>
                    <Ionicons name="chevron-down" size={18} color="#6B7280" />
                  </TouchableOpacity>
                ) : (
                  <Text style={styles.detailsValue}>{String(fields['Supervising Consultant'] || 'N/A')}</Text>
                )}
              </View>
              </View>
              )}
            </View>

            {/* Quick Help Section - Only for Clients */}
            {userRole === 'client' && (
              <QuickPromptsSection type="project" project={selectedProject} />
            )}

            {/* Dropdown Modal */}
            <Modal visible={pickerState.open} transparent animationType="fade" onRequestClose={() => setPickerState({ open: false, field: null, options: [] })}>
              <TouchableOpacity activeOpacity={1} onPress={() => setPickerState({ open: false, field: null, options: [] })} style={{ flex:1, backgroundColor: 'rgba(0,0,0,0.25)', justifyContent:'center', alignItems:'center' }}>
                <View style={{ width:'85%', backgroundColor:'white', borderRadius:12, padding:16 }}>
                  <Text style={{ fontSize:16, fontWeight:'600', color:'#111827', marginBottom:12 }}>{String(pickerState.field)}</Text>
                  <ScrollView style={{ maxHeight: 320 }}>
                    {pickerState.options.map(opt => (
                      <TouchableOpacity key={opt} onPress={() => { 
                        // Handle both project fields and additional info fields
                        if (pickerState.field === 'Submitted (Y/N)') {
                          handleAdditionalInfoFieldChange(pickerState.field, opt);
                        } else {
                          handleProjectFieldChange(pickerState.field, opt);
                        }
                        setPickerState({ open:false, field:null, options:[] }); 
                      }} style={{ paddingVertical:12, borderBottomWidth:1, borderBottomColor:'#E5E7EB', flexDirection:'row', justifyContent:'space-between', alignItems:'center' }}>
                        <Text style={{ color:'#111827' }}>{opt}</Text>
                        {(() => {
                          // Check the correct field based on the picker state
                          if (pickerState.field === 'Submitted (Y/N)') {
                            return String(editedAdditionalInfoFields[pickerState.field] ?? fields[pickerState.field] ?? '') === opt;
                          } else {
                            return String(editedProjectFields[pickerState.field] ?? fields[pickerState.field] ?? '') === opt;
                          }
                        })() && (
                          <Ionicons name="checkmark" size={18} color="#D4AF37" />
                        )}
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </TouchableOpacity>
            </Modal>

            {/* Date Picker Modal */}
            {isProjectEditing && showDatePicker && (
              <Modal visible transparent animationType="fade" onRequestClose={() => setShowDatePicker(false)}>
                <View style={{ flex:1, backgroundColor:'rgba(0,0,0,0.25)', justifyContent:'center', alignItems:'center' }}>
                  <View style={{ backgroundColor:'white', borderRadius:12, padding:16, width:'85%' }}>
                    <Text style={{ fontSize:16, fontWeight:'600', color:'#111827', marginBottom:12 }}>Select Start Date</Text>
                    <DateTimePicker
                      value={new Date()}
                      mode="date"
                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                      onChange={(e, date) => {
                        if (date) {
                          const yyyy = date.getFullYear();
                          const mm = String(date.getMonth()+1).padStart(2,'0');
                          const dd = String(date.getDate()).padStart(2,'0');
                          handleProjectFieldChange('Start Date', `${yyyy}-${mm}-${dd}`);
                        }
                        setShowDatePicker(false);
                      }}
                    />
                  </View>
                </View>
              </Modal>
            )}

            {/* Financial Info */}
            {((fields['Full Cost'] !== undefined && fields['Full Cost'] !== null && fields['Full Cost'] !== '') || 
              (fields['Paid'] !== undefined && fields['Paid'] !== null && fields['Paid'] !== '') || 
              (fields['Balance'] !== undefined && fields['Balance'] !== null && fields['Balance'] !== '')) && (
              <View style={styles.detailsCard}>
                <TouchableOpacity 
                  style={styles.cardHeader}
                  onPress={() => {
                    // Only make collapsible for clients
                    if (userRole === 'client') {
                      setIsFinancialInfoCollapsed(!isFinancialInfoCollapsed);
                    }
                  }}
                  activeOpacity={userRole === 'client' ? 0.7 : 1}
                  disabled={userRole !== 'client'}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    <Text style={styles.cardTitle}>Financial Information</Text>
                    {userRole === 'client' && (
                      <Ionicons 
                        name={isFinancialInfoCollapsed ? "chevron-down" : "chevron-up"} 
                        size={20} 
                        color="#2C2C2C" 
                        style={{ marginLeft: 8 }}
                      />
                    )}
                  </View>
                </TouchableOpacity>
                {/* Card Content - Only show if not collapsed (or if not a client) */}
                {(!isFinancialInfoCollapsed || userRole !== 'client') && (
                <View style={styles.cardContent}>
                  {(fields['Full Cost'] !== undefined && fields['Full Cost'] !== null && fields['Full Cost'] !== '') ? (
                    <View style={styles.detailsRow}>
                      <Text style={styles.detailsLabel}>Full Cost</Text>
                      <Text style={styles.detailsValue}>${String(fields['Full Cost'])}</Text>
                    </View>
                  ) : null}
                  {(fields['Paid'] !== undefined && fields['Paid'] !== null && fields['Paid'] !== '') ? (
                    <View style={styles.detailsRow}>
                      <Text style={styles.detailsLabel}>Paid</Text>
                      <Text style={styles.detailsValue}>${String(fields['Paid'])}</Text>
                    </View>
                  ) : null}
                  {(fields['Balance'] !== undefined && fields['Balance'] !== null && fields['Balance'] !== '') ? (
                    <View style={styles.detailsRow}>
                      <Text style={styles.detailsLabel}>Balance</Text>
                      <Text style={styles.detailsValue}>${String(fields['Balance'])}</Text>
                    </View>
                  ) : null}
                </View>
                )}
              </View>
            )}

            {/* States */}
            {!!fields['States'] && (
              <View style={styles.detailsCard}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>States</Text>
                </View>
                <View style={styles.cardContent}>
                  <View style={styles.detailsRow}>
                    <Text style={styles.detailsLabel}>ID</Text>
                    <Text style={styles.detailsValue}>{String(fields['States'])}</Text>
                  </View>
                </View>
              </View>
            )}

            {/* Additional Info */}
            <View style={styles.detailsCard}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Additional Information</Text>
                {userRole !== 'client' && !isAdditionalInfoEditing && (
                  <TouchableOpacity
                    accessibilityLabel="Edit additional information"
                    onPress={() => setIsAdditionalInfoEditing(true)}
                    style={styles.headerEditButton}
                  >
                    <Ionicons name="create" size={18} color="#2C2C2C" />
                  </TouchableOpacity>
                )}
                {userRole !== 'client' && isAdditionalInfoEditing && (
                  <View style={styles.headerActionButtons}>
                    <TouchableOpacity 
                      onPress={saveEditedAdditionalInfo} 
                      style={styles.saveButton}
                    >
                      <Text style={styles.saveButtonText}>Save</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      onPress={() => { setIsAdditionalInfoEditing(false); setEditedAdditionalInfoFields({}); }} 
                      style={styles.cancelButton}
                    >
                      <Text style={styles.cancelButtonText}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
              <View style={styles.cardContent}>
                {!!fields['IRS Identifier (ID/EIN)'] && (
                  <View style={styles.detailsRow}>
                    <Text style={styles.detailsLabel}>IRS Identifier</Text>
                    <Text style={styles.detailsValue}>{String(fields['IRS Identifier (ID/EIN)'])}</Text>
                  </View>
                )}
                {!!fields['Last Updated'] && (
                  <View style={styles.detailsRow}>
                    <Text style={styles.detailsLabel}>Last Updated</Text>
                    <Text style={styles.detailsValue}>
                      {new Date(fields['Last Updated']).toLocaleString()}
                    </Text>
                  </View>
                )}
                {!!fields['Submitted (Y/N)'] && (
                  <View style={styles.detailsRow}>
                    <Text style={styles.detailsLabel}>Submitted</Text>
                    {isAdditionalInfoEditing ? (
                      <TouchableOpacity 
                        style={styles.selectInput} 
                        onPress={() => setPickerState({ open: true, field: 'Submitted (Y/N)', options: ['Yes', 'No'] })}
                      >
                        <Text style={styles.selectText}>
                          {String(editedAdditionalInfoFields['Submitted (Y/N)'] ?? fields['Submitted (Y/N)'] ?? 'Select')}
                        </Text>
                        <Ionicons name="chevron-down" size={18} color="#6B7280" />
                      </TouchableOpacity>
                    ) : (
                      <Text style={styles.detailsValue}>{String(fields['Submitted (Y/N)'])}</Text>
                    )}
                  </View>
                )}
              </View>
            </View>

            {/* Collaborators Section */}
            <TouchableOpacity 
              style={styles.detailsCard}
              onPress={() => setShowCollaboratorsModal(true)}
              activeOpacity={0.7}
            >
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderLeft}>
                  <Ionicons name="people" size={20} color="#6B7280" />
                  <Text style={styles.cardTitle}>Collaborators</Text>
                </View>
                <View style={styles.cardHeaderRight}>
                  <Text style={styles.collaboratorsCount}>
                    {String(Array.isArray(selectedProject?.fields?.['collaborator_name']) ? selectedProject.fields['collaborator_name'].length : 0)}
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
                </View>
              </View>
              <View style={styles.cardContent}>
                {Array.isArray(selectedProject?.fields?.['collaborator_name']) && selectedProject.fields['collaborator_name'].length > 0 ? (
                  <View style={styles.collaboratorsPreview}>
                    {selectedProject.fields['collaborator_name'].slice(0, 3).map((name, index) => {
                      const role = getCollaboratorRole(name, selectedProject?.fields);
                      return (
                        <View key={index} style={styles.collaboratorPreviewItem}>
                          <Ionicons name="person" size={16} color="#6B7280" />
                          <Text style={styles.collaboratorPreviewName} numberOfLines={1}>
                            {String(name || 'Unknown')} ({role})
                          </Text>
                        </View>
                      );
                    })}
                    {selectedProject.fields['collaborator_name'].length > 3 ? (
                      <Text style={styles.moreCollaboratorsText}>
                        +{selectedProject.fields['collaborator_name'].length - 3} more
                      </Text>
                    ) : null}
                  </View>
                ) : (
                  <Text style={styles.emptyCollaboratorsText}>No collaborators assigned</Text>
                )}
              </View>
            </TouchableOpacity>

            {/* Internal Notes Section (Consultants Only) */}
            {userRole === 'consultant' && (
              <TouchableOpacity 
                style={styles.detailsCard}
                onPress={() => setShowInternalNotesModal(true)}
                activeOpacity={0.7}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.cardHeaderLeft}>
                    <Ionicons name="document-text" size={20} color="#6B7280" />
                    <Text style={styles.cardTitle}>Internal Notes</Text>
                  </View>
                  <View style={styles.cardHeaderRight}>
                    <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
                  </View>
                </View>
                <View style={styles.cardContent}>
                  <Text style={styles.internalNotesPreview}>
                    Private notes visible only to consultants
                  </Text>
                </View>
              </TouchableOpacity>
            )}

            {/* About Section */}
            <AboutUsSection />

            {/* Tasks Section */}
            <View style={styles.detailsCard}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1, marginRight: 12 }}>
                  <Text style={[styles.cardTitle, userRole === 'client' && styles.cardTitleLong]}>
                    {userRole === 'client' ? '📋 TASKS YOU MUST COMPLETE TO START PROJECT.' : '📋 Tasks'}
                  </Text>
                </View>
                <View style={styles.tasksCount}>
                  <Text style={styles.tasksCountText}>
                    {String((() => {
                      // Calculate task count, excluding "GETTING STARTED" group for clients
                      const visibleGroups = userRole === 'client' 
                        ? (taskData.groups || []).filter((g) => {
                            const groupName = String(g.name || '').toUpperCase().trim();
                            return groupName !== 'GETTING STARTED';
                          })
                        : (taskData.groups || []);
                      
                      const groupTasksCount = visibleGroups.reduce((sum, g) => sum + (g.tasks?.length || 0), 0);
                      const ungroupedTasksCount = (taskData.ungroupedTasks || []).length;
                      return groupTasksCount + ungroupedTasksCount;
                    })())}
                  </Text>
                </View>
                {userRole === 'consultant' && (
                  <TouchableOpacity
                    style={[styles.editButton, { backgroundColor: isTaskEditMode ? '#EF4444' : '#3B82F6' }]}
                    onPress={() => setIsTaskEditMode(!isTaskEditMode)}
                  >
                    <Ionicons name="create" size={16} color="#FFFFFF" />
                    <Text style={styles.editButtonText}>
                      {isTaskEditMode ? 'DONE' : 'EDIT'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
              <View style={styles.cardContent}>
              
              {/* Task Management Actions - Moved to top */}
              {isTaskEditMode && userRole === 'consultant' && (
                <View style={styles.taskManagementActionsTop}>
                  <TouchableOpacity
                    style={styles.createGroupButton}
                    onPress={() => setShowCreateGroupModal(true)}
                  >
                    <Ionicons name="add" size={20} color="#FFFFFF" />
                    <Text style={styles.createGroupButtonText}>Create Group</Text>
                  </TouchableOpacity>
                  
                  {selectedTasks.size > 0 ? (
                    <TouchableOpacity
                      style={styles.moveTasksButton}
                      onPress={handleMoveTasks}
                    >
                      <Ionicons name="swap-horizontal" size={20} color="#FFFFFF" />
                      <Text style={styles.moveTasksButtonText}>Move Tasks ({selectedTasks.size})</Text>
                    </TouchableOpacity>
                  ) : null}
                  
                  <TouchableOpacity
                    style={styles.doneButton}
                    onPress={exitTaskEditMode}
                  >
                    <Ionicons name="checkmark" size={20} color="#FFFFFF" />
                    <Text style={styles.doneButtonText}>Done</Text>
                  </TouchableOpacity>
                </View>
              )}
              
              {tasksLoading ? (
                <View style={styles.tasksLoading}>
                  <ActivityIndicator size={50} color="#D4AF37" />
                  <Text style={styles.loadingText}>Loading tasks...</Text>
                </View>
              ) : (() => {
                // Check if there are visible groups/tasks (excluding "GETTING STARTED" for clients)
                const visibleGroups = userRole === 'client' 
                  ? (taskData.groups || []).filter((g) => {
                      const groupName = String(g.name || '').toUpperCase().trim();
                      return groupName !== 'GETTING STARTED';
                    })
                  : (taskData.groups || []);
                return visibleGroups.length > 0 || (taskData.ungroupedTasks || []).length > 0;
              })() ? (
                <View style={styles.tasksList}>
                  {/* Render task groups */}
                  {taskData.groups
                    .filter((group) => {
                      // Hide "GETTING STARTED" group from clients
                      if (userRole === 'client') {
                        const groupName = String(group.name || '').toUpperCase().trim();
                        return groupName !== 'GETTING STARTED';
                      }
                      return true;
                    })
                    .map((group) => {
                    const isCollapsed = collapsedGroups.has(group.id);
                    return (
                      <View key={group.id} style={styles.taskGroup}>
                        <TouchableOpacity 
                          style={[styles.taskGroupHeader, isCollapsed && styles.taskGroupHeaderCollapsed]}
                          onPress={() => toggleGroupCollapse(group.id)}
                          activeOpacity={0.7}
                        >
                          <View style={styles.taskGroupHeaderLeft}>
                            <View style={styles.taskGroupTitleRow}>
                              <Text style={styles.taskGroupName}>{String(group.name)}</Text>
                              <View style={styles.taskGroupCount}>
                                <Text style={styles.taskGroupCountText}>{String(group.tasks.length)}</Text>
                              </View>
                            </View>
                            <View style={styles.taskGroupChevronRow}>
                              <Ionicons 
                                name={isCollapsed ? "chevron-down" : "chevron-up"} 
                                size={20} 
                                color="#6B7280" 
                                style={styles.collapseIcon}
                              />
                              {isCollapsed && (
                                <Text style={styles.collapsedHint}>Tap to expand</Text>
                              )}
                            </View>
                          </View>
                          {isTaskEditMode && userRole === 'consultant' && (
                            <TouchableOpacity
                              style={styles.deleteGroupButton}
                              onPress={() => handleDeleteGroup(group.id, group.tasks.length)}
                            >
                              <Ionicons name="trash-outline" size={16} color="#EF4444" />
                            </TouchableOpacity>
                          )}
                        </TouchableOpacity>
                      {!isCollapsed && group.tasks.map((task, taskIndex) => (
                        <View key={task.id} style={styles.taskItem}>
                          {isTaskEditMode && userRole === 'consultant' && (
                            <View style={styles.taskEditControls}>
                              <TouchableOpacity
                                style={styles.taskCheckbox}
                                onPress={() => handleTaskSelect(task.id)}
                              >
                                <Ionicons 
                                  name={selectedTasks.has(task.id) ? "checkbox" : "square-outline"} 
                                  size={20} 
                                  color={selectedTasks.has(task.id) ? "#3B82F6" : "#6B7280"} 
                                />
                              </TouchableOpacity>
                              <View style={styles.reorderButtons}>
                                <TouchableOpacity
                                  style={[styles.reorderButton, taskIndex === 0 && styles.reorderButtonDisabled]}
                                  onPress={() => handleReorderTask(task.id, 'up')}
                                  disabled={taskIndex === 0}
                                >
                                  <Ionicons name="chevron-up" size={16} color={taskIndex === 0 ? "#9CA3AF" : "#6B7280"} />
                                </TouchableOpacity>
                                <TouchableOpacity
                                  style={[styles.reorderButton, taskIndex === group.tasks.length - 1 && styles.reorderButtonDisabled]}
                                  onPress={() => handleReorderTask(task.id, 'down')}
                                  disabled={taskIndex === group.tasks.length - 1}
                                >
                                  <Ionicons name="chevron-down" size={16} color={taskIndex === group.tasks.length - 1 ? "#9CA3AF" : "#6B7280"} />
                                </TouchableOpacity>
                              </View>
                            </View>
                          )}
                          <TouchableOpacity
                            style={[styles.taskContent, isTaskEditMode && styles.taskContentEditMode]}
                            onPress={() => !isTaskEditMode && navigateToTaskDetails(task)}
                          >
                            <View style={styles.taskHeader}>
                              <Text style={styles.taskTitle} numberOfLines={1}>
                                {String(task.fields.task_title || 'Untitled Task')}
                              </Text>
                              {task.fields.task_status === 'Completed' ? (
                                <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                              ) : (
                                <Ionicons name="ellipse-outline" size={20} color="#EF4444" />
                              )}
                            </View>
                            <View style={styles.taskFooter}>
                              {!!task.fields.due_date && (
                                <Text style={styles.taskDate}>
                                  Due: {new Date(task.fields.due_date).toLocaleDateString()}
                                </Text>
                              )}
                              {!!task.fields.task_status && (
                                <View style={[styles.taskStatusBadge, { 
                                  backgroundColor: task.fields.task_status === 'Completed' ? '#10B98120' : 
                                                 task.fields.task_status === 'In Progress' ? '#F59E0B20' : '#6B728020'
                                }]}>
                                  <Text style={[styles.taskStatusText, {
                                    color: task.fields.task_status === 'Completed' ? '#10B981' : 
                                          task.fields.task_status === 'In Progress' ? '#F59E0B' : '#6B7280'
                                  }]}>
                                    {String(task.fields.task_status)}
                                  </Text>
                                </View>
                              )}
                            </View>
                          </TouchableOpacity>
                        </View>
                      ))}
                      </View>
                    );
                  })}

                  {/* Render ungrouped tasks */}
                  {taskData.ungroupedTasks.length > 0 && (
                    <View style={styles.taskGroup}>
                      <View style={styles.taskGroupHeader}>
                        <View style={styles.taskGroupHeaderLeft}>
                          <View style={styles.taskGroupTitleRow}>
                            <Text style={styles.taskGroupName}>Ungrouped Tasks</Text>
                            <View style={styles.taskGroupCount}>
                              <Text style={styles.taskGroupCountText}>{String(taskData.ungroupedTasks.length)}</Text>
                            </View>
                          </View>
                        </View>
                      </View>
                      {taskData.ungroupedTasks.map((task, taskIndex) => (
                        <View key={task.id} style={styles.taskItem}>
                          {isTaskEditMode && userRole === 'consultant' && (
                            <View style={styles.taskEditControls}>
                              <TouchableOpacity
                                style={styles.taskCheckbox}
                                onPress={() => handleTaskSelect(task.id)}
                              >
                                <Ionicons 
                                  name={selectedTasks.has(task.id) ? "checkbox" : "square-outline"} 
                                  size={20} 
                                  color={selectedTasks.has(task.id) ? "#3B82F6" : "#6B7280"} 
                                />
                              </TouchableOpacity>
                              <View style={styles.reorderButtons}>
                                <TouchableOpacity
                                  style={[styles.reorderButton, taskIndex === 0 && styles.reorderButtonDisabled]}
                                  onPress={() => handleReorderTask(task.id, 'up')}
                                  disabled={taskIndex === 0}
                                >
                                  <Ionicons name="chevron-up" size={16} color={taskIndex === 0 ? "#9CA3AF" : "#6B7280"} />
                                </TouchableOpacity>
                                <TouchableOpacity
                                  style={[styles.reorderButton, taskIndex === taskData.ungroupedTasks.length - 1 && styles.reorderButtonDisabled]}
                                  onPress={() => handleReorderTask(task.id, 'down')}
                                  disabled={taskIndex === taskData.ungroupedTasks.length - 1}
                                >
                                  <Ionicons name="chevron-down" size={16} color={taskIndex === taskData.ungroupedTasks.length - 1 ? "#9CA3AF" : "#6B7280"} />
                                </TouchableOpacity>
                              </View>
                            </View>
                          )}
                          <TouchableOpacity
                            style={[styles.taskContent, isTaskEditMode && styles.taskContentEditMode]}
                            onPress={() => !isTaskEditMode && navigateToTaskDetails(task)}
                          >
                            <View style={styles.taskHeader}>
                              <Text style={styles.taskTitle} numberOfLines={1}>
                                {String(task.fields.task_title || 'Untitled Task')}
                              </Text>
                              {task.fields.task_status === 'Completed' ? (
                                <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                              ) : (
                                <Ionicons name="ellipse-outline" size={20} color="#EF4444" />
                              )}
                            </View>
                            <View style={styles.taskFooter}>
                              {!!task.fields.due_date && (
                                <Text style={styles.taskDate}>
                                  Due: {new Date(task.fields.due_date).toLocaleDateString()}
                                </Text>
                              )}
                              {!!task.fields.task_status && (
                                <View style={[styles.taskStatusBadge, { 
                                  backgroundColor: task.fields.task_status === 'Completed' ? '#10B98120' : 
                                                 task.fields.task_status === 'In Progress' ? '#F59E0B20' : '#6B728020'
                                }]}>
                                  <Text style={[styles.taskStatusText, {
                                    color: task.fields.task_status === 'Completed' ? '#10B981' : 
                                          task.fields.task_status === 'In Progress' ? '#F59E0B' : '#6B7280'
                                  }]}>
                                    {String(task.fields.task_status)}
                                  </Text>
                                </View>
                              )}
                            </View>
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              ) : (
                <View style={styles.emptyTasks}>
                  <Ionicons name="document-text-outline" size={48} color="#6B7280" />
                  <Text style={styles.emptyTasksText}>No tasks yet</Text>
                  <Text style={styles.emptyTasksSubtext}>Tasks will appear here when added</Text>
                </View>
              )}
              </View>
            </View>

            {/* Activities Section */}
            <TouchableOpacity 
              style={styles.detailsCard}
              onPress={() => setShowActivitiesModal(true)}
              activeOpacity={0.7}
            >
              <View style={styles.cardHeader}>
                <View style={[styles.cardTitleContainer, { flex: 1, marginRight: 12 }]}>
                  <Ionicons name="calendar" size={20} color="#6B7280" style={styles.cardIcon} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cardTitle, userRole === 'client' && styles.cardTitleLong]}>
                      {userRole === 'client' ? 'ACTIVITIES THAT YOUR CONSULTANT WILL COMPLETE FOR THIS PROJECT.' : '📅 Activities'}
                    </Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#9CA3AF" style={{ alignSelf: 'flex-start', marginTop: 2 }} />
              </View>
              <View style={styles.cardContent}>
                <Text style={styles.activitiesPreviewText}>
                  View and manage project activities
                </Text>
                <View style={styles.activitiesPreviewStats}>
                  <Text style={styles.activitiesStatsText}>
                    18 activities available
                  </Text>
                </View>
              </View>
            </TouchableOpacity>

            {/* Actions Section */}
            <View style={styles.detailsCard}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{userRole === 'client' ? '⚡️ACTIONS & STATUS OF PROJECT.' : '⚡️ACTIONS' }</Text>
                {!isAddingAction && userRole !== 'client' && (
                  <TouchableOpacity 
                    style={styles.addButton}
                    onPress={() => setIsAddingAction(true)}
                  >
                    <Ionicons name="add" size={20} color="#D4AF37" />
                    <Text style={styles.addButtonText}>Add</Text>
                  </TouchableOpacity>
                )}
              </View>
              <View style={styles.cardContent}>

              {/* Add Action Form */}
              {isAddingAction && (
                <View style={styles.addActionForm}>
                  <TextInput
                    style={styles.actionInput}
                    placeholder="Action description..."
                    value={newAction.description}
                    onChangeText={(text) => handleNewActionInputChange('description', text)}
                    multiline
                  />
                  <View style={styles.actionFormRow}>
                    <TouchableOpacity 
                      style={[styles.actionInput, { flex: 1, marginRight: 8, justifyContent: 'center' }]}
                      onPress={showDatePickerModal}
                    >
                      <Text style={[styles.datePickerText, !newAction.estCompletion && styles.datePickerPlaceholder]}>
                        {newAction.estCompletion ? format(new Date(newAction.estCompletion), 'MMM dd, yyyy') : 'Select completion date'}
                      </Text>
                      <Ionicons name="calendar-outline" size={16} color="#6B7280" style={{ marginLeft: 8 }} />
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={styles.cancelButton}
                      onPress={() => {
                        setIsAddingAction(false);
                        setShowDatePicker(false);
                        setNewAction({ description: '', estCompletion: '' });
                      }}
                    >
                      <Text style={styles.cancelButtonText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={styles.saveButton}
                      onPress={handleSaveNewAction}
                    >
                      <Text style={styles.saveButtonText}>Save</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {isLoadingActions ? (
                <View style={styles.tasksLoading}>
                  <ActivityIndicator size={50} color="#D4AF37" />
                  <Text style={styles.loadingText}>Loading actions...</Text>
                </View>
              ) : (
                <View style={styles.actionsList}>
                  {/* Pending Actions - Always Show */}
                  <ActionCategory
                    title="Pending Actions"
                    color="#F59E0B"
                    count={pendingActions.length}
                  >
                    {pendingActions.length > 0 ? (
                      pendingActions.map((action) => (
                        <ActionItem
                          key={action.id}
                          action={action}
                          onToggle={handleActionChange}
                          onDelete={handleDeleteAction}
                          onMoveToCategory={moveActionOptimistically}
                          category="pending"
                        />
                      ))
                    ) : (
                      <View style={styles.emptySection}>
                        <Text style={styles.emptySectionText}>No pending actions</Text>
                      </View>
                    )}
                  </ActionCategory>

                  {/* Active Actions - Always Show */}
                  <ActionCategory
                    title="Actions"
                    color="#6B7280"
                    count={activeActions.length}
                  >
                    {activeActions.length > 0 ? (
                      activeActions.map((action) => (
                        <ActionItem
                          key={action.id}
                          action={action}
                          onToggle={handleActionChange}
                          onDelete={handleDeleteAction}
                          onMoveToCategory={moveActionOptimistically}
                          category="active"
                        />
                      ))
                    ) : (
                      <View style={styles.emptySection}>
                        <Text style={styles.emptySectionText}>No active actions</Text>
                      </View>
                    )}
                  </ActionCategory>

                  {/* Completed Actions - Always Show */}
                  <ActionCategory
                    title="Completed Actions"
                    color="#10B981"
                    count={completedActions.length}
                  >
                    {completedActions.length > 0 ? (
                      completedActions.map((action) => (
                        <ActionItem
                          key={action.id}
                          action={action}
                          onToggle={handleActionChange}
                          onDelete={handleDeleteAction}
                          onMoveToCategory={moveActionOptimistically}
                          category="completed"
                        />
                      ))
                    ) : (
                      <View style={styles.emptySection}>
                        <Text style={styles.emptySectionText}>No completed actions</Text>
                      </View>
                    )}
                  </ActionCategory>
                </View>
              )}
            </View>

            {/* Date Picker Modal */}
            {showDatePicker && (
              <Modal
                visible={showDatePicker}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowDatePicker(false)}
              >
                <View style={styles.datePickerModalOverlay}>
                  <View style={styles.datePickerModalContainer}>
                    <View style={styles.datePickerModalHeader}>
                      <Text style={styles.datePickerModalTitle}>Select Completion Date</Text>
                      <TouchableOpacity
                        onPress={() => setShowDatePicker(false)}
                        style={styles.datePickerModalCloseButton}
                      >
                        <Ionicons name="close" size={24} color="#6B7280" />
                      </TouchableOpacity>
                    </View>
                    
                    <View style={styles.datePickerModalContent}>
                      <DateTimePicker
                        value={selectedDate}
                        mode="date"
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        onChange={handleDateChange}
                        minimumDate={new Date()}
                        style={styles.datePickerComponent}
                      />
                    </View>
                    
                    <View style={styles.datePickerModalActions}>
                      <TouchableOpacity
                        style={styles.datePickerModalCancelButton}
                        onPress={() => setShowDatePicker(false)}
                      >
                        <Text style={styles.datePickerModalCancelText}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.datePickerModalConfirmButton}
                        onPress={() => {
                          setNewAction(prev => ({ ...prev, estCompletion: format(selectedDate, 'yyyy-MM-dd') }));
                          setShowDatePicker(false);
                        }}
                      >
                        <Text style={styles.datePickerModalConfirmText}>Confirm</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </Modal>
            )}
            </View>

            {/* Chat Section */}
            <View style={styles.detailsCard}>
              <View style={styles.tasksSectionHeader}>
                <Text style={styles.cardTitle}>💬 General Discussion</Text>
                <TouchableOpacity 
                  style={[styles.aiToggleButton, isAIMode && styles.aiToggleButtonActive]}
                  onPress={() => setIsAIMode(!isAIMode)}
                  disabled={isUploadingProjectChatFile || aiRequestInProgress}
                >
                  <View style={[styles.aiToggleDot, isAIMode ? styles.aiToggleDotActive : styles.aiToggleDotInactive]} />
                  <Text style={[styles.aiToggleText, isAIMode && styles.aiToggleTextActive]}>
                    {isAIMode ? 'Waiverlyn' : 'Consultant'}
                  </Text>
                </TouchableOpacity>
              </View>
              
              <View style={styles.chatContainer}>
                {/* AI Mode Indicator */}
                {isAIMode && (
                  <View style={styles.aiIndicator}>
                    <Ionicons name="information-circle" size={16} color="#7C3AED" />
                    <Text style={styles.aiIndicatorText}>AI responses use redacted project context</Text>
                  </View>
                )}
                
                {/* Messages */}
                <ScrollView 
                  ref={projectChatContainerRef}
                  style={styles.chatMessages}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ flexGrow: 1 }}
                >
                  {projectMessages.map((msg) => {
                    const isAI = isAIMessage(msg);
                    const styling = getMessageStyling(msg, userRole, selectedProject?.fields?.['Project Name']);
                    
                    // Convert justify-end to flex-end for React Native compatibility
                    const fixedAlignment = styling.alignment === 'justify-end' ? 'flex-end' : styling.alignment;
                    
                    
                    if (isAI) {
                      return (
                        <View key={msg.id} style={[styles.messageContainer, { justifyContent: 'flex-start' }]}>
                          <View style={[
                            styles.messageBubble, 
                          { 
                            backgroundColor: styling.backgroundColor, 
                            borderColor: styling.borderColor
                          }
                          ]}>
                            <View style={styles.messageHeader}>
                              <View style={[styles.messageAvatar, { backgroundColor: '#7C3AED' }]}>
                                <Ionicons name="sparkles" size={12} color="white" />
                              </View>
                              <Text style={[styles.messageSender, { color: '#7C3AED' }]}>{styling.label}</Text>
                            </View>
                          {!!msg.fields?.message_text && (
                            <Text style={[styles.messageText, { color: '#1F2937' }]}>{msg.fields.message_text}</Text>
                          )}
                            <View style={[styles.messageTimeContainer, { justifyContent: 'flex-start' }]}>
                              <Text style={[styles.messageTime, { color: '#6B7280' }]}>
                                {new Date(msg.createdTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </Text>
                            </View>
                          </View>
                        </View>
                      );
                    }
                    
                    return (
                      <View key={msg.id} style={[styles.messageContainer, { justifyContent: fixedAlignment }]}>
                        <View style={[
                          styles.messageBubble, 
                          { 
                            backgroundColor: styling.backgroundColor, 
                            borderColor: styling.borderColor
                          }
                        ]}>
                          <View style={styles.messageHeader}>
                            <View style={[styles.messageAvatar, { backgroundColor: styling.label === 'You' ? '#3B82F6' : '#6B7280' }]}>
                              <Text style={styles.messageAvatarText}>
                                {styling.label === 'You' ? (userRole === 'client' ? 'U' : 'C') : (styling.label === 'Client' ? 'U' : 'C')}
                              </Text>
                            </View>
                            <Text style={[styles.messageSender, { color: styling.textColor }]}>{styling.label}</Text>
                          </View>
                          {msg.fields?.message_text && (
                            <Text style={[styles.messageText, { color: styling.textColor }]}>
                              {msg.fields.message_text}
                            </Text>
                          )}
                          {(msg.fields?.attachmentUrl || msg.fields?.attachment_url) && (
                            <View style={styles.attachmentContainer}>
                              {(msg.fields.attachmentType?.startsWith('image/') || msg.fields.attachment_type?.startsWith('image/')) ? (
                                <TouchableOpacity onPress={() => setPreviewImage(msg.fields.attachmentUrl || msg.fields.attachment_url)}>
                                  <Image 
                                    source={{ uri: msg.fields.attachmentUrl || msg.fields.attachment_url }} 
                                    style={styles.attachmentImage}
                                    resizeMode="contain"
                                  />
                                </TouchableOpacity>
                              ) : (
                                <TouchableOpacity 
                                  onPress={() => Linking.openURL(msg.fields.attachmentUrl || msg.fields.attachment_url)}
                                  style={[styles.attachmentButton, { backgroundColor: styling.label === 'You' ? '#60A5FA' : '#E5E7EB' }]}
                                >
                                  <Ionicons name="document-attach" size={16} color={styling.label === 'You' ? 'white' : '#374151'} />
                                  <Text style={[styles.attachmentButtonText, { color: styling.label === 'You' ? 'white' : '#374151' }]} numberOfLines={1}>
                                    {msg.fields.attachmentName || msg.fields.attachment_name || "Download File"}
                                  </Text>
                                </TouchableOpacity>
                              )}
                            </View>
                          )}
                          <View style={[styles.messageTimeContainer, { justifyContent: styling.label === 'You' ? 'flex-end' : 'flex-start' }]}>
                            <Text style={[styles.messageTime, { color: styling.label === 'You' ? 'rgba(255,255,255,0.7)' : '#6B7280' }]}>
                              {new Date(msg.createdTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </Text>
                            {styling.label === 'You' && (
                              <Ionicons name="checkmark-done" size={12} color={msg.fields.is_read ? '#3B82F6' : '#6B7280'} />
                            )}
                          </View>
                        </View>
                      </View>
                    );
                  })}
                  
                  {/* AI Typing Indicator */}
                  {isAITyping && (
                    <View style={[styles.messageContainer, { justifyContent: 'flex-start' }]}>
                      <View style={[
                        styles.messageBubble, 
                        { 
                          backgroundColor: '#F3E8FF', 
                          borderColor: '#C084FC'
                        }
                      ]}>
                        <View style={styles.messageHeader}>
                          <View style={[styles.messageAvatar, { backgroundColor: '#7C3AED' }]}>
                            <Ionicons name="sparkles" size={12} color="white" />
                          </View>
                          <Text style={[styles.messageSender, { color: '#7C3AED' }]}>Waiverlyn</Text>
                        </View>
                        <View style={styles.typingIndicator}>
                          <View style={styles.typingDots}>
                            <View style={[styles.typingDot, { animationDelay: '0ms' }]} />
                            <View style={[styles.typingDot, { animationDelay: '150ms' }]} />
                            <View style={[styles.typingDot, { animationDelay: '300ms' }]} />
                          </View>
                          <Text style={styles.typingText}>analyzing...</Text>
                        </View>
                      </View>
                    </View>
                  )}
                </ScrollView>
                
                {/* Attachment Preview */}
                {projectChatAttachment && (
                  <View style={styles.attachmentPreview}>
                    <View style={styles.attachmentPreviewContent}>
                      <Ionicons name="document-attach" size={16} color="#3B82F6" />
                      <Text style={styles.attachmentPreviewText} numberOfLines={1}>
                        {projectChatAttachment.name}
                      </Text>
                    </View>
                    <TouchableOpacity 
                      onPress={() => setProjectChatAttachment(null)}
                      style={styles.attachmentRemoveButton}
                    >
                      <Ionicons name="close" size={16} color="#6B7280" />
                    </TouchableOpacity>
                  </View>
                )}
                
                {/* Input */}
                <View style={styles.chatInput}>
                  <TextInput
                    style={[styles.chatTextInput, isAIMode && styles.chatTextInputAI]}
                    placeholder={isAIMode ? "Ask Waiverlyn about your project..." : "Type a message..."}
                    placeholderTextColor="#9CA3AF"
                    value={newProjectMessage}
                    onChangeText={setNewProjectMessage}
                    multiline
                    maxLength={1000}
                  />
                  <TouchableOpacity 
                    style={styles.attachmentButton}
                    onPress={() => {
                      // TODO: Implement file picker
                      Alert.alert('File Upload', 'File upload will be implemented');
                    }}
                    disabled={isUploadingProjectChatFile || !!projectChatAttachment}
                  >
                    <Ionicons name="attach" size={20} color={isUploadingProjectChatFile || projectChatAttachment ? "#9CA3AF" : "#6B7280"} />
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.chatSendButton, (isUploadingProjectChatFile || aiRequestInProgress) && styles.chatSendButtonDisabled]}
                    onPress={handleSendProjectMessage}
                    disabled={isUploadingProjectChatFile || aiRequestInProgress}
                  >
                    {isUploadingProjectChatFile ? (
                      <ActivityIndicator size="small" color="white" />
                    ) : aiRequestInProgress ? (
                      <ActivityIndicator size="small" color="white" />
                    ) : (
                      <Ionicons name="send" size={20} color="white" />
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Activities Modal */}
            <ActivitiesModal
              isVisible={showActivitiesModal}
              onClose={() => setShowActivitiesModal(false)}
              projectData={selectedProject}
              userRole={userRole}
            />

            {/* Collaborators Modal */}
            <CollaboratorsModal
              isVisible={showCollaboratorsModal}
              onClose={() => setShowCollaboratorsModal(false)}
              projectId={selectedProject?.id}
              collaborators={selectedProject?.fields?.['collaborator_name'] || []}
              projectFields={selectedProject?.fields || {}}
              onCollaboratorsUpdate={async () => {
                // Refresh the project data to get the updated computed collaborator_name field
                try {
                  const updatedProject = await ApiCaller(`/records/projects/${selectedProject.id}`);
                  setSelectedProject(updatedProject);
                } catch (error) {
                  console.error('Failed to refresh project data:', error);
                }
              }}
              isConsultant={userRole === 'consultant'}
            />

            {/* Internal Notes Modal */}
            <InternalNotesModal
              isVisible={showInternalNotesModal}
              onClose={() => setShowInternalNotesModal(false)}
              projectId={selectedProject?.fields?.['Project ID']}
              projectRecordId={selectedProject?.id}
              userRole={userRole}
            />

          </ScrollView>
        );
      case 'TaskDetails':
        if (!selectedTask) return null;
        // Determine if user is a client and if task is assigned to them
        const isClient = userRole === 'client';
        const taskAssignee = selectedTask?.fields?.assigned_to;
        const projectName = selectedTask?.fields?.['Project Name (from project_id)']?.[0];
        
        // Client can edit if:
        // 1. User is a client (isClient === true)
        // 2. Task's assigned_to field matches the Project Name
        // This means the task is assigned to the client, not a consultant
        const isTaskEditable = isClient && taskAssignee === projectName;
        
        return (
          <TaskDetailsScreen 
            task={selectedTask}
            onClose={navigateBack}
            onTaskUpdate={() => {
              // Refresh tasks when task is updated
              if (selectedProject) {
                fetchProjectTasks(selectedProject);
              }
              navigateBack();
            }}
            isClientView={isClient}
            isEditable={isTaskEditable}
          />
        );
      case 'Templates':
        return (
          <ScrollView 
            style={styles.screenContainer} 
            showsVerticalScrollIndicator={false}
          >
            {/* Company Logo */}
            <View style={styles.contentLogoContainer}>
              <Image 
                source={require('./assets/company_logo.avif')} 
                style={styles.contentLogo}
                resizeMode="contain"
              />
            </View>
            
            <View style={styles.dashboardHeader}>
              <Text style={styles.title}>Project Templates</Text>
              <Text style={styles.subtitle}>
                Create new projects from pre-defined templates
              </Text>
            </View>

            <View style={styles.templatesList}>
              {projectTemplates.map((template) => (
                <TouchableOpacity
                  key={template.id}
                  style={styles.templateCard}
                  onPress={() => {
                    setSelectedTemplate(template);
                    setCurrentScreen('TemplateDetails');
                    setNavigationStack(prev => [...prev, 'TemplateDetails']);
                  }}
                >
                  <View style={styles.templateCardHeader}>
                    <View style={styles.templateIconContainer}>
                      <Ionicons name="document-text" size={24} color="#D4AF37" />
                    </View>
                    <View style={styles.templateTitleContainer}>
                      <Text style={styles.templateTitle} numberOfLines={2}>
                        {template.name}
                      </Text>
                      <Text style={styles.templateDescription} numberOfLines={3}>
                        {template.description}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.templateCardFooter}>
                    <View style={styles.templateStats}>
                      <View style={styles.templateStatItem}>
                        <Text style={styles.templateStatNumber}>
                          {template.taskGroups ? template.taskGroups.length : 0}
                        </Text>
                        <Text style={styles.templateStatLabel}>Groups</Text>
                      </View>
                      <View style={styles.templateStatItem}>
                        <Text style={styles.templateStatNumber}>
                          {template.tasks ? template.tasks.length : 0}
                        </Text>
                        <Text style={styles.templateStatLabel}>Tasks</Text>
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        );
      case 'TemplateDetails':
        return (
          <TemplateDetailsScreen
            template={selectedTemplate}
            onClose={() => {
              setCurrentScreen('Templates');
              setNavigationStack(prev => prev.slice(0, -1));
            }}
            onProjectCreated={() => {
              // Handle project creation success
              setCurrentScreen('Projects');
              setNavigationStack(['Projects']);
            }}
          />
        );
      case 'Profile':
        const handleLogout = async () => {
          try {
            await logout();
          } catch (error) {
            console.error('Logout error:', error);
          }
        };
        
        return (
          <ScrollView style={styles.screenContainer} showsVerticalScrollIndicator={false}>
            {/* Company Logo */}
            <View style={styles.contentLogoContainer}>
              <Image 
                source={require('./assets/company_logo.avif')} 
                style={styles.contentLogo}
                resizeMode="contain"
              />
            </View>
            
            <View style={styles.dashboardHeader}>
              <Text style={styles.title}>Profile</Text>
              <Text style={styles.subtitle}>Manage your account</Text>
            </View>
            
            {/* User Info Section */}
            <View style={styles.section}>
              <View style={styles.profileCard}>
                <View style={styles.profileHeader}>
                  <View style={styles.avatarContainer}>
                    <Text style={styles.avatarText}>
                      {currentUser?.email ? currentUser.email.substring(0, 2).toUpperCase() : 'U'}
                    </Text>
                  </View>
                  <View style={styles.userInfo}>
                    <Text style={styles.userName}>{currentUser?.displayName || 'User'}</Text>
                    <Text style={styles.userRole}>{userRole === 'client' ? 'Client' : 'Consultant'}</Text>
                    <Text style={styles.userEmail}>{currentUser?.email || 'No email'}</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Project Stats Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Project Statistics</Text>
              <View style={styles.statsContainer}>
                <View style={styles.statCard}>
                  <Text style={styles.statNumber}>
                    {projects.filter(project => 
                      project.fields?.['Assigned Consultant'] === currentUser?.displayName && 
                      project.fields?.['Status'] !== 'Completed'
                    ).length}
                  </Text>
                  <Text style={styles.statLabel}>My Active Projects</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statNumber}>
                    {projects.filter(project => 
                      project.fields?.['Status'] !== 'Completed'
                    ).length}
                  </Text>
                  <Text style={styles.statLabel}>Total Incomplete</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statNumber}>
                    {projects.filter(project => 
                      project.fields?.['Assigned Consultant'] === currentUser?.displayName && 
                      project.fields?.['Status'] === 'Completed'
                    ).length}
                  </Text>
                  <Text style={styles.statLabel}>My Completed</Text>
                </View>
              </View>
            </View>


            {/* Logout Button */}
            <View style={styles.section}>
              <TouchableOpacity 
                style={styles.logoutButton}
                onPress={handleLogout}
              >
                <Ionicons name="log-out-outline" size={20} color="white" />
                <Text style={styles.logoutButtonText}>Logout</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        );
      default:
        return null;
    }
  };

  // Debug logging removed - client logout button is now working

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#2C2C2C" />
      
      {/* Header */}
      <View style={styles.header}>
        {userRole === 'client' ? (
          // Client header - simple centered title, logout button is in content area
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={[styles.headerTitle, { textAlign: 'center' }]} numberOfLines={1}>
              {currentScreen === 'TaskDetails' 
                ? 'Task Details'
                : selectedProject?.fields?.['Project Name'] || 'Client Portal'}
            </Text>
          </View>
        ) : currentScreen === 'ProjectDetails' || currentScreen === 'TaskDetails' ? (
          // Consultant header with back button
          <View style={styles.headerWithBack}>
            <TouchableOpacity onPress={navigateBack} style={styles.headerBackButton}>
              <Ionicons name="arrow-back" size={24} color="white" />
            </TouchableOpacity>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {currentScreen === 'ProjectDetails' ? 'Project Details' : 'Task Details'}
            </Text>
            <View style={styles.headerBackButton} />
          </View>
        ) : (
          <Text style={styles.headerTitle}>{currentScreen}</Text>
        )}
      </View>

      {/* Content */}
      <View style={styles.content}>
        {renderScreen()}
      </View>

      {/* Bottom Navigation - Hidden for clients */}
      {userRole !== 'client' && (
        <View style={styles.bottomNav}>
        <TouchableOpacity 
          style={[styles.navItem, currentScreen === 'Home' && styles.navItemActive]}
          onPress={() => {
            setCurrentScreen('Home');
            setNavigationStack(['Home']);
          }}
        >
          <Ionicons 
            name={currentScreen === 'Home' ? 'home' : 'home-outline'} 
            size={24} 
            color={currentScreen === 'Home' ? '#D4AF37' : 'gray'} 
          />
          <Text style={[styles.navLabel, currentScreen === 'Home' && styles.navLabelActive]}>
            Home
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.navItem, currentScreen === 'Projects' && styles.navItemActive]}
          onPress={() => {
            setCurrentScreen('Projects');
            setNavigationStack(['Projects']);
          }}
        >
          <Ionicons 
            name={currentScreen === 'Projects' ? 'folder' : 'folder-outline'} 
            size={24} 
            color={currentScreen === 'Projects' ? '#D4AF37' : 'gray'} 
          />
          <Text style={[styles.navLabel, currentScreen === 'Projects' && styles.navLabelActive]}>
            Projects
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.navItem, currentScreen === 'Templates' && styles.navItemActive]}
          onPress={() => {
            setCurrentScreen('Templates');
            setNavigationStack(['Templates']);
          }}
        >
          <Ionicons 
            name={currentScreen === 'Templates' ? 'document-text' : 'document-text-outline'} 
            size={24} 
            color={currentScreen === 'Templates' ? '#D4AF37' : 'gray'} 
          />
          <Text style={[styles.navLabel, currentScreen === 'Templates' && styles.navLabelActive]}>
            Templates
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.navItem, currentScreen === 'Profile' && styles.navItemActive]}
          onPress={() => {
            setCurrentScreen('Profile');
            setNavigationStack(['Profile']);
          }}
        >
          <Ionicons 
            name={currentScreen === 'Profile' ? 'person' : 'person-outline'} 
            size={24} 
            color={currentScreen === 'Profile' ? '#D4AF37' : 'gray'} 
          />
          <Text style={[styles.navLabel, currentScreen === 'Profile' && styles.navLabelActive]}>
            Profile
          </Text>
        </TouchableOpacity>
      </View>
      )}

      {/* Image Preview Modal */}
      {previewImage && (
        <Modal
          visible={!!previewImage}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setPreviewImage(null)}
        >
          <View style={styles.imagePreviewOverlay}>
            <TouchableOpacity 
              style={styles.imagePreviewCloseButton}
              onPress={() => setPreviewImage(null)}
            >
              <Ionicons name="close" size={24} color="white" />
            </TouchableOpacity>
            <Image 
              source={{ uri: previewImage }} 
              style={styles.imagePreview}
              resizeMode="contain"
            />
          </View>
        </Modal>
      )}

      {/* Create Group Modal */}
      {showCreateGroupModal && (
        <Modal
          visible={showCreateGroupModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowCreateGroupModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modal}>
              <Text style={styles.modalTitle}>Create New Group</Text>
              <TextInput
                style={styles.modalInput}
                value={newGroupName}
                onChangeText={setNewGroupName}
                placeholder="Enter group name"
                placeholderTextColor="#9CA3AF"
                autoFocus
              />
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonCancel]}
                  onPress={() => {
                    setShowCreateGroupModal(false);
                    setNewGroupName('');
                  }}
                >
                  <Text style={styles.modalButtonCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonConfirm]}
                  onPress={handleCreateGroup}
                >
                  <Text style={styles.modalButtonConfirmText}>Create</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Move Tasks Modal */}
      {showMoveModal && (
        <Modal
          visible={showMoveModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowMoveModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modal}>
              <Text style={styles.modalTitle}>Move Tasks</Text>
              <Text style={styles.modalSubtitle}>
                Move {selectedTasks.size} selected task(s) to:
              </Text>
              
              <TouchableOpacity
                style={styles.moveOption}
                onPress={() => moveTasksToGroup(null)}
              >
                <Ionicons name="folder-outline" size={20} color="#6B7280" />
                <Text style={styles.moveOptionText}>Ungrouped Tasks</Text>
              </TouchableOpacity>
              
              {taskData.groups.map((group) => (
                <TouchableOpacity
                  key={group.id}
                  style={styles.moveOption}
                  onPress={() => moveTasksToGroup(group.id)}
                >
                  <Ionicons name="folder" size={20} color="#3B82F6" />
                  <Text style={styles.moveOptionText}>{group.name}</Text>
                </TouchableOpacity>
              ))}
              
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => setShowMoveModal(false)}
              >
                <Text style={styles.modalButtonCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {/* AI Assistant Modal */}
      <AIAssistantModal />

      {/* AI Assistant Floating Button - Only show when authenticated and not on login screens */}
      {isAuthenticated && <AIAssistantButton />}
    </View>
  );
}

// Main App component with AuthProvider and AIAssistantProvider
export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <AIAssistantProvider>
          <AppContent />
        </AIAssistantProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    backgroundColor: '#2C2C2C',
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
    flex: 1,
    textAlign: 'center',
  },
  exitPortalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D32F2F',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  exitPortalText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  logoutIconButton: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 40,
  },
  content: {
    flex: 1,
  },
  screenContainer: {
    backgroundColor: '#F8F8F8',
    padding: 16,
    paddingBottom: 20,
  },
  contentLogoContainer: {
    backgroundColor: '#F8F8F8',
    paddingVertical: 20,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  contentLogo: {
    width: 300,
    height: 70,
  },
  dashboardHeader: {
    marginBottom: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2C2C2C',
    marginBottom: 5,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2C2C2C',
    marginBottom: 12,
  },
  actionCard: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  actionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2C2C2C',
    flex: 1,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  priorityText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'white',
  },
  actionDescription: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 8,
  },
  actionDate: {
    fontSize: 12,
    color: '#D32F2F',
    fontWeight: '500',
  },
  projectCard: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  templatesList: {
    paddingHorizontal: 16,
  },
  templateCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  templateCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  templateIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  templateTitleContainer: {
    flex: 1,
  },
  templateTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
    lineHeight: 22,
  },
  templateDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  templateCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  templateStats: {
    flexDirection: 'row',
    gap: 16,
  },
  templateStatItem: {
    alignItems: 'center',
  },
  templateStatNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: '#D4AF37',
  },
  templateStatLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  projectHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  projectName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2C2C2C',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'white',
  },
  projectDescription: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 12,
  },
  projectDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  detailItem: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 12,
    color: '#666666',
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 14,
    color: '#2C2C2C',
    fontWeight: '600',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressBar: {
    flex: 1,
    height: 6,
    backgroundColor: '#E0E0E0',
    borderRadius: 3,
    marginRight: 12,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#D4AF37',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#D4AF37',
  },
  projectStatus: {
    fontSize: 14,
    color: '#666666',
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    paddingVertical: 10,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 5,
  },
  navItemActive: {
    // Active state styling
  },
  navLabel: {
    fontSize: 12,
    color: 'gray',
    marginTop: 2,
  },
  navLabelActive: {
    color: '#D4AF37',
    fontWeight: 'bold',
  },
  // Profile Screen Styles
  profileCard: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#D4AF37',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2C2C2C',
    marginBottom: 4,
  },
  userRole: {
    fontSize: 14,
    color: '#D4AF37',
    fontWeight: '600',
    marginBottom: 2,
  },
  userEmail: {
    fontSize: 14,
    color: '#666666',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statCard: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#D4AF37',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666666',
    textAlign: 'center',
  },
  settingsCard: {
    backgroundColor: 'white',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  settingInfo: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2C2C2C',
    marginBottom: 2,
  },
  settingDescription: {
    fontSize: 14,
    color: '#666666',
  },
  settingToggle: {
    marginLeft: 16,
  },
  toggle: {
    width: 50,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleThumb: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'white',
    alignSelf: 'flex-end',
  },
  settingArrow: {
    marginLeft: 16,
  },
  arrowText: {
    fontSize: 20,
    color: '#666666',
  },
  // Loading and Empty States
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666666',
  },
  emptyState: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  emptyText: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
  },
  consultantText: {
    fontSize: 14,
    color: '#666666',
    marginTop: 8,
  },
  chevronIcon: {
    position: 'absolute',
    right: 16,
    top: '50%',
    marginTop: -10,
  },
  // Project Details Screen Styles
  detailsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  backButton: {
    padding: 8,
    marginRight: 12,
  },
  detailsTitle: {
    fontSize: 21,
    fontWeight: 'bold',
    color: '#2C2C2C',
    flex: 1,
    textAlign: 'center',
  },
  detailsCard: {
    backgroundColor: 'white',
    borderRadius: 8,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  cardContent: {
    padding: 16,
    paddingTop: 12,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  cardHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  collaboratorsCount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    marginRight: 8,
  },
  collaboratorsPreview: {
    gap: 8,
  },
  collaboratorPreviewItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  collaboratorPreviewName: {
    fontSize: 14,
    color: '#374151',
    marginLeft: 8,
    flex: 1,
  },
  moreCollaboratorsText: {
    fontSize: 14,
    color: '#6B7280',
    fontStyle: 'italic',
    marginTop: 4,
  },
  emptyCollaboratorsText: {
    fontSize: 14,
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
  internalNotesPreview: {
    fontSize: 14,
    color: '#6B7280',
    fontStyle: 'italic',
  },
  headerEditButton: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  headerActionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  saveButton: {
    backgroundColor: '#D4AF37',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  saveButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  cancelButton: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cancelButtonText: {
    color: '#111827',
    fontWeight: '600',
    fontSize: 14,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2C2C2C',
  },
  cardTitleLong: {
    fontSize: 16,
    lineHeight: 22,
  },
  cardTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardIcon: {
    marginRight: 8,
  },
  activitiesPreviewText: {
    fontSize: 14,
    color: '#6B7280',
    fontStyle: 'italic',
    marginBottom: 8,
  },
  activitiesPreviewStats: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignSelf: 'flex-start',
  },
  activitiesStatsText: {
    fontSize: 12,
    color: '#4B5563',
    fontWeight: '500',
  },
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  detailsLabel: {
    fontSize: 14,
    color: '#666666',
    fontWeight: '500',
  },
  detailsValue: {
    fontSize: 14,
    color: '#2C2C2C',
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  selectInput: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: 'white',
  },
  selectText: {
    color: '#111827',
    fontSize: 14,
  },
  headerWithBack: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flex: 1,
  },
  headerBackButton: {
    padding: 8,
    marginRight: 8,
  },
  // Logout Button
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D32F2F',
    padding: 16,
    borderRadius: 8,
    gap: 8,
  },
  logoutButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  // Tasks Section Styles
  tasksSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  tasksCount: {
    backgroundColor: '#D4AF37',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  tasksCountText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  tasksLoading: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
  },
  loadingText: {
    color: '#6B7280',
    fontSize: 14,
    marginTop: 12,
  },
  tasksList: {
    gap: 8,
  },
  emptyTasks: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
  },
  emptyTasksText: {
    color: '#6B7280',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
  },
  emptyTasksSubtext: {
    color: '#9CA3AF',
    fontSize: 14,
    marginTop: 4,
  },
  // Task Group Styles
  taskGroup: {
    marginBottom: 16,
  },
  taskGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: '#F3F4F6',
    borderRadius: 6,
    marginBottom: 8,
  },
  taskGroupHeaderLeft: {
    flexDirection: 'column',
    flex: 1,
  },
  taskGroupTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  taskGroupChevronRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  taskGroupName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    flex: 1,
    marginRight: 8,
  },
  taskGroupCount: {
    backgroundColor: '#D4AF37',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: 'center',
  },
  taskGroupCountText: {
    color: '#1F2937',
    fontSize: 12,
    fontWeight: '700',
  },
  collapseIcon: {
    // No margin needed since it's in its own row
  },
  taskGroupHeaderCollapsed: {
    opacity: 0.8,
    backgroundColor: '#F9FAFB',
  },
  collapsedHint: {
    fontSize: 12,
    color: '#9CA3AF',
    fontStyle: 'italic',
    marginLeft: 8,
  },
  // Task Item Styles
  taskItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    marginBottom: 8,
    marginLeft: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  taskHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  taskTitle: {
    color: '#1F2937',
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  taskFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  taskDate: {
    color: '#6B7280',
    fontSize: 12,
  },
  taskStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  taskStatusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  // Action Item Styles
  actionItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  actionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  actionCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#D4AF37',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  actionContent: {
    flex: 1,
  },
  actionText: {
    color: '#1F2937',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 6,
  },
  actionTextCompleted: {
    textDecorationLine: 'line-through',
    color: '#9CA3AF',
  },
  actionMeta: {
    gap: 4,
  },
  actionMetaText: {
    color: '#6B7280',
    fontSize: 11,
  },
  pendingBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  pendingBadgeText: {
    color: '#D97706',
    fontSize: 10,
    fontWeight: '700',
  },
  // Search Bar Styles
  searchContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 8,
  },
  searchInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 12,
    height: 48,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#1F2937',
    height: '100%',
  },
  clearButton: {
    padding: 4,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F2937',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
    minWidth: 100,
    maxWidth: 140,
  },
  filterButtonText: {
    color: '#D4AF37',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  clearSearchButton: {
    marginTop: 16,
    backgroundColor: '#D4AF37',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  clearSearchText: {
    color: '#1F2937',
    fontSize: 14,
    fontWeight: '600',
  },
  // Filter Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  filterModalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    maxHeight: '70%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  filterModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  filterModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  filterModalScroll: {
    maxHeight: 400,
  },
  filterModalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  filterModalItemSelected: {
    backgroundColor: '#FEF3C7',
  },
  filterModalItemText: {
    fontSize: 15,
    color: '#1F2937',
    fontWeight: '500',
  },
  filterModalItemTextSelected: {
    color: '#D4AF37',
    fontWeight: '700',
  },
  // Chat Styles
  chatContainer: {
    marginTop: 12,
  },
  chatMessages: {
    height: 300,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  chatPlaceholder: {
    color: '#6B7280',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 60,
  },
  chatDebug: {
    color: '#EF4444',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
    fontWeight: '600',
  },
  chatInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chatTextInput: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    fontSize: 15,
    color: '#1F2937',
  },
  chatSendButton: {
    backgroundColor: '#D4AF37',
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatSendButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  chatTextInputAI: {
    borderColor: '#C084FC',
  },
  // AI Toggle Styles
  aiToggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    gap: 6,
  },
  aiToggleButtonActive: {
    backgroundColor: '#F3E8FF',
    borderColor: '#C084FC',
  },
  aiToggleDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  aiToggleDotActive: {
    backgroundColor: '#7C3AED',
  },
  aiToggleDotInactive: {
    backgroundColor: '#3B82F6',
  },
  aiToggleText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  aiToggleTextActive: {
    color: '#7C3AED',
  },
  // AI Indicator
  aiIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3E8FF',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 8,
    gap: 4,
  },
  aiIndicatorText: {
    fontSize: 11,
    color: '#7C3AED',
    fontWeight: '500',
  },
  // Message Styles
  messageContainer: {
    flexDirection: 'row',
    marginVertical: 4,
    width: '100%',
  },
  messageBubble: {
    maxWidth: '75%',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
  },
  messageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  messageAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  messageAvatarText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  messageSender: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
    color: '#1F2937',
  },
  messageTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 4,
  },
  messageTime: {
    fontSize: 10,
  },
  // Attachment Styles
  attachmentContainer: {
    marginTop: 8,
  },
  attachmentImage: {
    width: 200,
    height: 150,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  attachmentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 8,
  },
  attachmentButtonText: {
    fontSize: 13,
    fontWeight: '500',
    flexShrink: 1,
  },
  attachmentPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    padding: 8,
    marginBottom: 8,
    gap: 8,
  },
  attachmentPreviewContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  attachmentPreviewText: {
    fontSize: 13,
    color: '#3B82F6',
    fontWeight: '500',
    flex: 1,
  },
  attachmentRemoveButton: {
    padding: 4,
  },
  // Typing Indicator
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  typingDots: {
    flexDirection: 'row',
    gap: 4,
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#7C3AED',
  },
  typingText: {
    fontSize: 12,
    color: '#7C3AED',
    fontWeight: '500',
  },
  // Image Preview Modal
  imagePreviewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePreviewCloseButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
    padding: 8,
    zIndex: 1,
  },
  imagePreview: {
    width: '90%',
    height: '80%',
  },
  // Actions Section Styles
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#D4AF37',
    gap: 4,
  },
  addButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#D4AF37',
  },
  addActionForm: {
    backgroundColor: '#F0F9FF',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#0EA5E9',
  },
  actionInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    fontSize: 14,
    color: '#1F2937',
    marginBottom: 8,
  },
  actionFormRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cancelButton: {
    backgroundColor: '#F3F4F6',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  cancelButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  saveButton: {
    backgroundColor: '#10B981',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  saveButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  actionsList: {
    gap: 16,
  },
  actionCategory: {
    gap: 8,
  },
  actionCategoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 8,
    borderBottomWidth: 2,
    borderBottomColor: '#E5E7EB',
  },
  actionCategoryTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  actionCategoryCount: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  actionCategoryCountText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  actionItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  completedActionItem: {
    opacity: 0.7,
  },
  actionContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  actionCheckbox: {
    marginTop: 2,
  },
  actionDetails: {
    flex: 1,
    gap: 6,
  },
  actionDescription: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1F2937',
    lineHeight: 20,
  },
  completedActionText: {
    textDecorationLine: 'line-through',
    color: '#6B7280',
  },
  actionMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionMetaText: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '500',
  },
  deleteActionButton: {
    padding: 4,
    marginTop: 2,
  },
  // Date Picker Styles
  datePickerText: {
    fontSize: 14,
    color: '#1F2937',
    fontWeight: '500',
  },
  datePickerPlaceholder: {
    color: '#9CA3AF',
    fontWeight: '400',
  },
  // Date Picker Modal Styles
  datePickerModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  datePickerModalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  datePickerModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  datePickerModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  datePickerModalCloseButton: {
    padding: 4,
  },
  datePickerModalContent: {
    padding: 20,
    alignItems: 'center',
  },
  datePickerComponent: {
    width: '100%',
  },
  datePickerModalActions: {
    flexDirection: 'row',
    padding: 20,
    paddingTop: 16,
    gap: 12,
  },
  datePickerModalCancelButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  datePickerModalCancelText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#6B7280',
  },
  datePickerModalConfirmButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
  },
  datePickerModalConfirmText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  moveButton: {
    padding: 8,
    marginHorizontal: 2,
    backgroundColor: '#F3F4F6',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Empty Section Styles
  emptySection: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
  },
  emptySectionText: {
    fontSize: 14,
    color: '#6B7280',
    fontStyle: 'italic',
  },
  
  // Task Management Styles
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  editButtonText: {
    marginLeft: 4,
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  deleteGroupButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#FEF2F2',
  },
  taskEditControls: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  taskCheckbox: {
    padding: 4,
  },
  reorderButtons: {
    flexDirection: 'row',
    gap: 4,
  },
  reorderButton: {
    padding: 4,
    borderRadius: 4,
    backgroundColor: '#F3F4F6',
  },
  reorderButtonDisabled: {
    backgroundColor: '#F9FAFB',
  },
  taskContent: {
    flex: 1,
  },
  taskContentEditMode: {
    opacity: 0.7,
  },
  taskManagementActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 8,
  },
  createGroupButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10B981',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    flex: 1,
    justifyContent: 'center',
  },
  createGroupButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  moveTasksButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3B82F6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    flex: 1,
    justifyContent: 'center',
  },
  moveTasksButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  doneButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6B7280',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    flex: 1,
    justifyContent: 'center',
  },
  doneButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modal: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonCancel: {
    backgroundColor: '#F3F4F6',
  },
  modalButtonConfirm: {
    backgroundColor: '#3B82F6',
  },
  modalButtonCancelText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '600',
  },
  modalButtonConfirmText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  moveOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#F9FAFB',
    marginBottom: 8,
    gap: 12,
  },
  moveOptionText: {
    fontSize: 16,
    color: '#374151',
    fontWeight: '500',
  },
  
  // Tab Navigation Styles
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 4,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
  },
  activeTabButton: {
    backgroundColor: '#D4AF37',
  },
  tabButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  activeTabButtonText: {
    color: '#FFFFFF',
  },
  
  // Deactivated Project Styles
  deactivatedProjectCard: {
    backgroundColor: '#F9FAFB',
    opacity: 0.75,
    borderColor: '#D1D5DB',
  },
  projectTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flex: 1,
  },
  deactivatedText: {
    color: '#6B7280',
  },
  deactivatedBadge: {
    backgroundColor: '#6B7280',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginLeft: 8,
  },
  deactivatedBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  
  // Operation Button Styles
  operationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    marginLeft: 12,
  },
  deactivateButton: {
    backgroundColor: '#EF4444',
  },
  reactivateButton: {
    backgroundColor: '#10B981',
  },
  operationButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
});