import React, { useState, useEffect, useMemo } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  ActivityIndicator, 
  Alert,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  TextInput
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ApiCaller from '../../api/apiCaller';
import { useAuth } from '../../utils/AuthContext';
import ProjectChat from '../../components/chat/ProjectChat';
import { TaskGroupManagement } from '../../components/modals';
import { AboutUsSection } from '../../components/AboutUs';

const ProjectDetailsScreen = ({ route, navigation }) => {
  const { projectId, projectName, startInEdit } = route.params || {};
  const { userRole } = useAuth();
  const [projectData, setProjectData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('chat'); // 'chat', 'details', or 'tasks'
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedFields, setEditedFields] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [showTaskManagement, setShowTaskManagement] = useState(false);
  
  // Task management state for inline editing
  const [taskGroups, setTaskGroups] = useState([]);
  const [ungroupedTasks, setUngroupedTasks] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [isTaskEditMode, setIsTaskEditMode] = useState(false);
  const [selectedTasks, setSelectedTasks] = useState(new Set());
  const [isMoveMode, setIsMoveMode] = useState(false);
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [showMoveModal, setShowMoveModal] = useState(false);
  
  // Debug logging
  useEffect(() => {
    console.log('ProjectDetailsScreen - projectId:', projectId);
    console.log('ProjectDetailsScreen - projectName:', projectName);
    console.log('ProjectDetailsScreen - projectData:', projectData);
    console.log('ProjectDetailsScreen - activeTab:', activeTab);
    console.log('ProjectDetailsScreen - userRole:', userRole);
    console.log('ProjectDetailsScreen - route.params:', route.params);
  }, [projectId, projectName, projectData, activeTab, userRole, route.params]);

  useEffect(() => {
    const fetchProjectData = async () => {
      if (!projectId) {
        setError('No project ID provided');
        setLoading(false);
        return;
      }

      try {
        const data = await ApiCaller(`/records/projects/${projectId}`);
        setProjectData(data);
      } catch (err) {
        console.error('Failed to load project data:', err);
        setError('Failed to load project data');
        Alert.alert('Error', 'Failed to load project data');
      } finally {
        setLoading(false);
      }
    };

    fetchProjectData();
  }, [projectId]);

  // When arriving with an intent to edit, switch to details tab and edit mode
  useEffect(() => {
    if (startInEdit) {
      setActiveTab('details');
      setIsEditMode(true);
    }
  }, [startInEdit]);

  // Fetch tasks when project data is loaded
  useEffect(() => {
    if (projectData?.fields?.['Project ID']) {
      fetchTasks();
    }
  }, [projectData]);

  const fetchTasks = async () => {
    if (!projectData?.fields?.['Project ID']) return;
    
    setLoadingTasks(true);
    try {
      const [groupsResponse, tasksResponse] = await Promise.all([
        ApiCaller(`/records/filter/${projectData.fields['Project ID']}/task_groups`),
        ApiCaller(`/records/filter/${projectData.fields['Project ID']}/tasks`)
      ]);

      const allGroups = Array.isArray(groupsResponse?.records) ? groupsResponse.records : [];
      const allTasks = Array.isArray(tasksResponse?.records) ? tasksResponse.records : [];

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
      allTasks.forEach(task => {
        const groupId = task.fields.task_groups?.[0];
        if (groupId && groupsMap.has(groupId)) {
          groupsMap.get(groupId).tasks.push(task);
        } else {
          ungrouped.push(task);
        }
      });

      const sortedGroups = Array.from(groupsMap.values()).sort((a, b) => a.order - b.order);
      sortedGroups.forEach(group => {
        group.tasks.sort((a, b) => (a.fields.order || 0) - (b.fields.order || 0));
      });
      const sortedUngrouped = ungrouped.sort((a, b) => (a.fields.order || 0) - (b.fields.order || 0));

      setTaskGroups(sortedGroups);
      setUngroupedTasks(sortedUngrouped);

    } catch (error) {
      console.error("Failed to fetch and process tasks:", error);
      setTaskGroups([]);
      setUngroupedTasks([]);
    } finally {
      setLoadingTasks(false);
    }
  };

  // derive safe fields
  const fields = projectData?.fields || {};

  const handleFieldChange = (field, value) => {
    setEditedFields(prev => ({ ...prev, [field]: value }));
  };

  const validateEmail = (email) => {
    if (!email) return true;
    const re = /[^\s@]+@[^\s@]+\.[^\s@]+/;
    return re.test(String(email).toLowerCase());
  };

  const isDateLike = (val) => {
    if (!val) return true;
    // accept yyyy-mm-dd
    return /^\d{4}-\d{2}-\d{2}$/.test(val);
  };

  const updatableFields = useMemo(() => {
    if (!projectData) return {};
    const next = {};
    const cand = editedFields;
    const original = fields;
    const consider = [
      'Project Name',
      'Status',
      'Project Type',
      'Assigned Consultant',
      'Project Manager',
      'Client Email',
      'States',
      'IRS Identifier (ID/EIN)',
      'Date of Submission',
      'Estimated Completion',
    ];
    consider.forEach(k => {
      if (cand[k] !== undefined && cand[k] !== original[k]) {
        next[k] = cand[k] === '' ? null : cand[k];
      }
    });
    return next;
  }, [editedFields, fields, projectData]);

  const handleSave = async () => {
    // basic validations
    if (editedFields['Client Email'] !== undefined && !validateEmail(editedFields['Client Email'])) {
      Alert.alert('Validation', 'Please enter a valid client email.');
      return;
    }
    if (editedFields['Date of Submission'] !== undefined && !isDateLike(editedFields['Date of Submission'])) {
      Alert.alert('Validation', 'Date of Submission must be in yyyy-mm-dd format.');
      return;
    }
    if (editedFields['Estimated Completion'] !== undefined && !isDateLike(editedFields['Estimated Completion'])) {
      Alert.alert('Validation', 'Estimated Completion must be in yyyy-mm-dd format.');
      return;
    }

    if (Object.keys(updatableFields).length === 0) {
      setIsEditMode(false);
      return;
    }
    setIsSaving(true);
    try {
      await ApiCaller(`/records/projects/${projectId}`, {
        method: 'PATCH',
        body: JSON.stringify({ fields: updatableFields }),
      });
      // refresh local state
      setProjectData(prev => prev ? { ...prev, fields: { ...prev.fields, ...updatableFields } } : prev);
      setIsEditMode(false);
      setEditedFields({});
      Alert.alert('Success', 'Project updated successfully');
    } catch (err) {
      console.error('Failed to update project:', err);
      Alert.alert('Error', err?.message || 'Failed to update project');
    } finally {
      setIsSaving(false);
    }
  };

  const handleBack = () => {
    navigation.goBack();
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
              project_id: [projectData.id],
              group_order: taskGroups.length
            }
          }],
          tableName: 'task_groups'
        })
      });

      if (response.records && response.records.length > 0) {
        const newGroup = {
          id: response.records[0].id,
          name: newGroupName.trim(),
          order: taskGroups.length,
          tasks: []
        };
        setTaskGroups(prev => [...prev, newGroup]);
        setNewGroupName('');
        setShowCreateGroupModal(false);
        Alert.alert('Success', 'Group created successfully');
      }
    } catch (error) {
      console.error('Error creating group:', error);
      Alert.alert('Error', 'Failed to create group');
    }
  };

  const handleDeleteGroup = async (groupId) => {
    const group = taskGroups.find(g => g.id === groupId);
    if (!group) return;

    Alert.alert(
      'Delete Group',
      `Delete "${group.name}"? This will affect ${group.tasks.length} tasks.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Tasks',
          style: 'destructive',
          onPress: () => deleteGroup(groupId, true)
        },
        {
          text: 'Move to Ungrouped',
          onPress: () => deleteGroup(groupId, false)
        }
      ]
    );
  };

  const deleteGroup = async (groupId, deleteTasks) => {
    try {
      if (deleteTasks) {
        // Delete all tasks in the group
        const group = taskGroups.find(g => g.id === groupId);
        if (group && group.tasks.length > 0) {
          const taskIds = group.tasks.map(task => task.id);
          await ApiCaller('/records/tasks', {
            method: 'DELETE',
            body: JSON.stringify({ recordIds: taskIds })
          });
        }
      } else {
        // Move tasks to ungrouped
        const group = taskGroups.find(g => g.id === groupId);
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
          setUngroupedTasks(prev => [...prev, ...group.tasks]);
        }
      }

      // Delete the group
      await ApiCaller('/records/task_groups', {
        method: 'DELETE',
        body: JSON.stringify({ recordIds: [groupId] })
      });

      setTaskGroups(prev => prev.filter(g => g.id !== groupId));
      Alert.alert('Success', 'Group deleted successfully');
    } catch (error) {
      console.error('Error deleting group:', error);
      Alert.alert('Error', 'Failed to delete group');
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
      Alert.alert('Error', 'Please select tasks to move');
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

      // Refresh tasks
      await fetchTasks();
      setSelectedTasks(new Set());
      setIsMoveMode(false);
      setShowMoveModal(false);
      Alert.alert('Success', 'Tasks moved successfully');
    } catch (error) {
      console.error('Error moving tasks:', error);
      Alert.alert('Error', 'Failed to move tasks');
    }
  };

  const handleReorderTask = async (taskId, direction) => {
    // Find the task and its current group
    let currentGroup = null;
    let taskIndex = -1;
    
    for (const group of taskGroups) {
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

    // Swap tasks
    const tasks = [...currentGroup.tasks];
    [tasks[taskIndex], tasks[newIndex]] = [tasks[newIndex], tasks[taskIndex]];

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

      // Update local state
      setTaskGroups(prev => prev.map(group => 
        group.id === currentGroup.id 
          ? { ...group, tasks }
          : group
      ));
    } catch (error) {
      console.error('Error reordering task:', error);
      Alert.alert('Error', 'Failed to reorder task');
    }
  };

  const exitTaskEditMode = () => {
    setIsTaskEditMode(false);
    setSelectedTasks(new Set());
    setIsMoveMode(false);
  };

  const renderProjectDetails = () => {
    if (!projectData) return null;

    return (
      <ScrollView style={styles.detailsContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Project Information</Text>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Project Name:</Text>
            {isEditMode ? (
              <TextInput
                style={styles.input}
                value={String(editedFields['Project Name'] ?? fields['Project Name'] ?? '')}
                onChangeText={(t) => handleFieldChange('Project Name', t)}
                placeholder="Enter project name"
                placeholderTextColor="#9CA3AF"
              />
            ) : (
              <Text style={styles.detailValue}>{fields?.['Project Name'] || 'N/A'}</Text>
            )}
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Project ID:</Text>
            <Text style={styles.detailValue}>{projectData.fields?.['Project ID'] || 'N/A'}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Status:</Text>
            {isEditMode ? (
              <TextInput
                style={styles.input}
                value={String(editedFields['Status'] ?? fields['Status'] ?? '')}
                onChangeText={(t) => handleFieldChange('Status', t)}
                placeholder="Enter status"
                placeholderTextColor="#9CA3AF"
              />
            ) : (
              <Text style={styles.detailValue}>{fields?.['Status'] || 'N/A'}</Text>
            )}
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Project Type:</Text>
            {isEditMode ? (
              <TextInput
                style={styles.input}
                value={String(editedFields['Project Type'] ?? fields['Project Type'] ?? '')}
                onChangeText={(t) => handleFieldChange('Project Type', t)}
                placeholder="Enter project type"
                placeholderTextColor="#9CA3AF"
              />
            ) : (
              <Text style={styles.detailValue}>{fields?.['Project Type'] || 'N/A'}</Text>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Team Information</Text>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Assigned Consultant:</Text>
            {isEditMode ? (
              <TextInput
                style={styles.input}
                value={String(editedFields['Assigned Consultant'] ?? fields['Assigned Consultant'] ?? '')}
                onChangeText={(t) => handleFieldChange('Assigned Consultant', t)}
                placeholder="Enter assigned consultant"
                placeholderTextColor="#9CA3AF"
              />
            ) : (
              <Text style={styles.detailValue}>{fields?.['Assigned Consultant'] || 'N/A'}</Text>
            )}
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Project Manager:</Text>
            {isEditMode ? (
              <TextInput
                style={styles.input}
                value={String(editedFields['Project Manager'] ?? fields['Project Manager'] ?? '')}
                onChangeText={(t) => handleFieldChange('Project Manager', t)}
                placeholder="Enter project manager"
                placeholderTextColor="#9CA3AF"
              />
            ) : (
              <Text style={styles.detailValue}>{fields?.['Project Manager'] || 'N/A'}</Text>
            )}
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Client Email:</Text>
            {isEditMode ? (
              <TextInput
                style={styles.input}
                autoCapitalize="none"
                keyboardType="email-address"
                value={String(editedFields['Client Email'] ?? fields['Client Email'] ?? '')}
                onChangeText={(t) => handleFieldChange('Client Email', t)}
                placeholder="client@example.com"
                placeholderTextColor="#9CA3AF"
              />
            ) : (
              <Text style={styles.detailValue}>{fields?.['Client Email'] || 'N/A'}</Text>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Project Details</Text>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>State:</Text>
            {isEditMode ? (
              <TextInput
                style={styles.input}
                value={String(editedFields['States'] ?? fields['States'] ?? '')}
                onChangeText={(t) => handleFieldChange('States', t)}
                placeholder="Enter state"
                placeholderTextColor="#9CA3AF"
              />
            ) : (
              <Text style={styles.detailValue}>{fields?.['States'] || 'N/A'}</Text>
            )}
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>IRS Identifier:</Text>
            {isEditMode ? (
              <TextInput
                style={styles.input}
                value={String(editedFields['IRS Identifier (ID/EIN)'] ?? fields['IRS Identifier (ID/EIN)'] ?? '')}
                onChangeText={(t) => handleFieldChange('IRS Identifier (ID/EIN)', t)}
                placeholder="Enter IRS ID/EIN"
                placeholderTextColor="#9CA3AF"
              />
            ) : (
              <Text style={styles.detailValue}>{fields?.['IRS Identifier (ID/EIN)'] || 'N/A'}</Text>
            )}
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Date of Submission:</Text>
            {isEditMode ? (
              <TextInput
                style={styles.input}
                value={String(editedFields['Date of Submission'] ?? fields['Date of Submission'] ?? '')}
                onChangeText={(t) => handleFieldChange('Date of Submission', t)}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#9CA3AF"
              />
            ) : (
              <Text style={styles.detailValue}>{fields?.['Date of Submission'] || 'N/A'}</Text>
            )}
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Estimated Completion:</Text>
            {isEditMode ? (
              <TextInput
                style={styles.input}
                value={String(editedFields['Estimated Completion'] ?? fields['Estimated Completion'] ?? '')}
                onChangeText={(t) => handleFieldChange('Estimated Completion', t)}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#9CA3AF"
              />
            ) : (
              <Text style={styles.detailValue}>{fields?.['Estimated Completion'] || 'N/A'}</Text>
            )}
          </View>
        </View>

        {/* Tasks Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Tasks</Text>
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

          {loadingTasks ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#3B82F6" />
              <Text style={styles.loadingText}>Loading tasks...</Text>
            </View>
          ) : (
            <View>
              {/* Task Groups */}
              {taskGroups.map((group) => (
                <View key={group.id} style={styles.taskGroup}>
                  <View style={styles.taskGroupHeader}>
                    <Text style={styles.taskGroupTitle}>{group.name}</Text>
                    {isTaskEditMode && (
                      <TouchableOpacity
                        style={styles.deleteGroupButton}
                        onPress={() => handleDeleteGroup(group.id)}
                      >
                        <Ionicons name="trash" size={16} color="#EF4444" />
                      </TouchableOpacity>
                    )}
                  </View>
                  <View style={styles.taskList}>
                    {group.tasks.map((task, index) => (
                      <View key={task.id} style={styles.taskItem}>
                        {isTaskEditMode && (
                          <TouchableOpacity
                            style={styles.taskCheckbox}
                            onPress={() => handleTaskSelect(task.id)}
                          >
                            <Ionicons 
                              name={selectedTasks.has(task.id) ? "checkbox" : "square-outline"} 
                              size={20} 
                              color={selectedTasks.has(task.id) ? "#3B82F6" : "#9CA3AF"} 
                            />
                          </TouchableOpacity>
                        )}
                        <View style={styles.taskContent}>
                          <Text style={styles.taskTitle}>{task.fields.task_title}</Text>
                          <Text style={styles.taskStatus}>{task.fields.task_status}</Text>
                        </View>
                        {isTaskEditMode && (
                          <View style={styles.taskActions}>
                            <TouchableOpacity
                              style={[styles.reorderButton, index === 0 && styles.disabledButton]}
                              onPress={() => handleReorderTask(task.id, 'up')}
                              disabled={index === 0}
                            >
                              <Ionicons name="chevron-up" size={16} color={index === 0 ? "#9CA3AF" : "#6B7280"} />
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.reorderButton, index === group.tasks.length - 1 && styles.disabledButton]}
                              onPress={() => handleReorderTask(task.id, 'down')}
                              disabled={index === group.tasks.length - 1}
                            >
                              <Ionicons name="chevron-down" size={16} color={index === group.tasks.length - 1 ? "#9CA3AF" : "#6B7280"} />
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    ))}
                  </View>
                </View>
              ))}

              {/* Ungrouped Tasks */}
              {ungroupedTasks.length > 0 && (
                <View style={styles.taskGroup}>
                  <Text style={styles.taskGroupTitle}>Ungrouped Tasks</Text>
                  <View style={styles.taskList}>
                    {ungroupedTasks.map((task, index) => (
                      <View key={task.id} style={styles.taskItem}>
                        {isTaskEditMode && (
                          <TouchableOpacity
                            style={styles.taskCheckbox}
                            onPress={() => handleTaskSelect(task.id)}
                          >
                            <Ionicons 
                              name={selectedTasks.has(task.id) ? "checkbox" : "square-outline"} 
                              size={20} 
                              color={selectedTasks.has(task.id) ? "#3B82F6" : "#9CA3AF"} 
                            />
                          </TouchableOpacity>
                        )}
                        <View style={styles.taskContent}>
                          <Text style={styles.taskTitle}>{task.fields.task_title}</Text>
                          <Text style={styles.taskStatus}>{task.fields.task_status}</Text>
                        </View>
                        {isTaskEditMode && (
                          <View style={styles.taskActions}>
                            <TouchableOpacity
                              style={[styles.reorderButton, index === 0 && styles.disabledButton]}
                              onPress={() => handleReorderTask(task.id, 'up')}
                              disabled={index === 0}
                            >
                              <Ionicons name="chevron-up" size={16} color={index === 0 ? "#9CA3AF" : "#6B7280"} />
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.reorderButton, index === ungroupedTasks.length - 1 && styles.disabledButton]}
                              onPress={() => handleReorderTask(task.id, 'down')}
                              disabled={index === ungroupedTasks.length - 1}
                            >
                              <Ionicons name="chevron-down" size={16} color={index === ungroupedTasks.length - 1 ? "#9CA3AF" : "#6B7280"} />
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Task Management Actions */}
              {isTaskEditMode && (
                <View style={styles.taskManagementActions}>
                  <TouchableOpacity
                    style={styles.createGroupButton}
                    onPress={() => setShowCreateGroupModal(true)}
                  >
                    <Ionicons name="add" size={16} color="#FFFFFF" />
                    <Text style={styles.createGroupButtonText}>Create Group</Text>
                  </TouchableOpacity>
                  
                  {selectedTasks.size > 0 && (
                    <TouchableOpacity
                      style={styles.moveTasksButton}
                      onPress={handleMoveTasks}
                    >
                      <Ionicons name="swap-horizontal" size={16} color="#FFFFFF" />
                      <Text style={styles.moveTasksButtonText}>Move Tasks ({selectedTasks.size})</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          )}
        </View>
      </ScrollView>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#F9FAFB" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.loadingText}>Loading project...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#F9FAFB" />
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color="#EF4444" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => navigation.goBack()}>
            <Text style={styles.retryButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F9FAFB" />
      
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#374151" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {projectData?.fields?.['Project Name'] || projectName || 'Project Details'}
          </Text>
          <Text style={styles.headerSubtitle}>
            {projectData?.fields?.['Project ID'] || projectId || 'N/A'}
          </Text>
        </View>
        <View style={styles.headerActions}>
          {isEditMode ? (
            <View style={styles.actionRow}>
              <TouchableOpacity disabled={isSaving} onPress={handleSave} style={styles.primaryBtn}>
                <Text style={styles.primaryBtnText}>{isSaving ? 'Saving...' : 'Save'}</Text>
              </TouchableOpacity>
              <View style={{ width: 8 }} />
              <TouchableOpacity disabled={isSaving} onPress={() => { setIsEditMode(false); setEditedFields({}); }} style={styles.secondaryBtn}>
                <Text style={styles.secondaryBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              accessibilityLabel="Edit project"
              onPress={() => {
                if (activeTab !== 'details') {
                  setActiveTab('details');
                }
                setIsEditMode(true);
              }}
              style={styles.iconBtn}
            >
              <Ionicons name="create" size={20} color="#374151" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Tab Navigation */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.tabContainer}
        contentContainerStyle={styles.tabContentContainer}
      >
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'chat' && styles.activeTab]}
          onPress={() => setActiveTab('chat')}
        >
          <Ionicons 
            name="chatbubbles" 
            size={20} 
            color={activeTab === 'chat' ? '#3B82F6' : '#6B7280'} 
          />
          <Text style={[styles.tabText, activeTab === 'chat' && styles.activeTabText]}>
            Chat
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'details' && styles.activeTab]}
          onPress={() => setActiveTab('details')}
        >
          <Ionicons 
            name="information-circle" 
            size={20} 
            color={activeTab === 'details' ? '#3B82F6' : '#6B7280'} 
          />
          <Text style={[styles.tabText, activeTab === 'details' && styles.activeTabText]}>
            Details
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'tasks' && styles.activeTab]}
          onPress={() => setActiveTab('tasks')}
        >
          <Ionicons 
            name="list" 
            size={20} 
            color={activeTab === 'tasks' ? '#3B82F6' : '#6B7280'} 
          />
          <Text style={[styles.tabText, activeTab === 'tasks' && styles.activeTabText]}>
            Tasks
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'about' && styles.activeTab]}
          onPress={() => setActiveTab('about')}
        >
          <Ionicons 
            name="information-circle-outline" 
            size={20} 
            color={activeTab === 'about' ? '#3B82F6' : '#6B7280'} 
          />
          <Text style={[styles.tabText, activeTab === 'about' && styles.activeTabText]}>
            About
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Content */}
      {activeTab === 'chat' ? (
        <View style={styles.chatContainer}>
          <Text style={{ padding: 20, backgroundColor: 'yellow', color: 'black' }}>
            DEBUG: Chat tab selected, projectData: {projectData ? 'LOADED' : 'NULL'}, userRole: {userRole}
          </Text>
          {projectData ? (
            <ProjectChat 
              projectData={projectData} 
              userRole={userRole}
              style={styles.chatContainer}
            />
          ) : (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#3B82F6" />
              <Text style={styles.loadingText}>Loading chat...</Text>
            </View>
          )}
        </View>
      ) : activeTab === 'tasks' ? (
        <View style={{ flex: 1 }}>
          <View style={styles.tasksTabContent}>
            <Text style={styles.tasksTabTitle}>Task Management</Text>
            <Text style={styles.tasksTabSubtitle}>
              Manage task groups, move tasks between groups, and reorder tasks
            </Text>
            <TouchableOpacity
              style={styles.openTaskManagementButton}
              onPress={() => setShowTaskManagement(true)}
            >
              <Ionicons name="settings" size={20} color="#FFFFFF" />
              <Text style={styles.openTaskManagementButtonText}>Open Task Management</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : activeTab === 'about' ? (
        <View style={{ flex: 1 }}>
          <ScrollView style={styles.detailsContainer} showsVerticalScrollIndicator={false}>
            <AboutUsSection />
          </ScrollView>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <Text style={{ padding: 20, backgroundColor: 'lightblue', color: 'black' }}>
            DEBUG: Details tab selected
          </Text>
          {renderProjectDetails()}

          {/* Floating Edit Button (visible when not editing) */}
          {!isEditMode && (
            <TouchableOpacity
              accessibilityLabel="Edit project"
              onPress={() => setIsEditMode(true)}
              style={styles.fab}
            >
              <Ionicons name="create" size={22} color="#111827" />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Task Management Modal */}
      <TaskGroupManagement
        visible={showTaskManagement}
        projectData={projectData}
        onClose={() => setShowTaskManagement(false)}
        onTasksUpdated={() => {
          // Optionally refresh any data that depends on tasks
          console.log('Tasks updated');
        }}
      />

      {/* Create Group Modal */}
      {showCreateGroupModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
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
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setShowCreateGroupModal(false);
                  setNewGroupName('');
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                onPress={handleCreateGroup}
              >
                <Text style={styles.confirmButtonText}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Move Tasks Modal */}
      {showMoveModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Move Tasks</Text>
            <Text style={styles.modalSubtitle}>
              Select destination for {selectedTasks.size} selected task(s):
            </Text>
            
            <TouchableOpacity
              style={styles.moveOption}
              onPress={() => moveTasksToGroup(null)}
            >
              <Text style={styles.moveOptionText}>Ungrouped Tasks</Text>
            </TouchableOpacity>
            
            {taskGroups.map((group) => (
              <TouchableOpacity
                key={group.id}
                style={styles.moveOption}
                onPress={() => moveTasksToGroup(group.id)}
              >
                <Text style={styles.moveOptionText}>{group.name}</Text>
              </TouchableOpacity>
            ))}
            
            <TouchableOpacity
              style={[styles.modalButton, styles.cancelButton]}
              onPress={() => setShowMoveModal(false)}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#EF4444',
    textAlign: 'center',
    marginVertical: 16,
  },
  retryButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 4,
  },
  headerContent: {
    flex: 1,
    marginHorizontal: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  headerSpacer: {
    width: 32,
  },
  tabContainer: {
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tabContentContainer: {
    flexDirection: 'row',
  },
  tab: {
    minWidth: 100,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    gap: 8,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#3B82F6',
  },
  tabText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#6B7280',
  },
  activeTabText: {
    color: '#3B82F6',
  },
  chatContainer: {
    flex: 1,
  },
  detailsContainer: {
    flex: 1,
    padding: 16,
  },
  section: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
    width: 140,
  },
  detailValue: {
    fontSize: 14,
    color: '#374151',
    flex: 1,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: 'white',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 40,
    justifyContent: 'flex-end',
    width: 56,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  primaryBtn: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  primaryBtnText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  secondaryBtn: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  secondaryBtnText: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '600',
  },
  iconBtn: {
    backgroundColor: 'white',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 24,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 22,
    elevation: 4,
    zIndex: 100,
  },
  tasksTabContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  tasksTabTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 12,
    textAlign: 'center',
  },
  tasksTabSubtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  openTaskManagementButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3B82F6',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  openTaskManagementButtonText: {
    marginLeft: 8,
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  
  // Task management styles
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
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
  taskGroup: {
    marginBottom: 20,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  taskGroupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  taskGroupTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  deleteGroupButton: {
    padding: 4,
  },
  taskList: {
    gap: 8,
  },
  taskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  taskCheckbox: {
    marginRight: 12,
  },
  taskContent: {
    flex: 1,
  },
  taskTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 2,
  },
  taskStatus: {
    fontSize: 12,
    color: '#6B7280',
  },
  taskActions: {
    flexDirection: 'row',
    gap: 4,
  },
  reorderButton: {
    padding: 4,
    borderRadius: 4,
    backgroundColor: '#F3F4F6',
  },
  disabledButton: {
    opacity: 0.5,
  },
  taskManagementActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  createGroupButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10B981',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    flex: 1,
    justifyContent: 'center',
  },
  createGroupButtonText: {
    marginLeft: 8,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  moveTasksButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3B82F6',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    flex: 1,
    justifyContent: 'center',
  },
  moveTasksButtonText: {
    marginLeft: 8,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  
  // Modal styles
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
    margin: 20,
    minWidth: 300,
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
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
    color: '#111827',
    marginBottom: 20,
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
  cancelButton: {
    backgroundColor: '#F3F4F6',
  },
  confirmButton: {
    backgroundColor: '#3B82F6',
  },
  cancelButtonText: {
    color: '#6B7280',
    fontSize: 16,
    fontWeight: '500',
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
  moveOption: {
    padding: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  moveOptionText: {
    fontSize: 16,
    color: '#111827',
    textAlign: 'center',
  },
});

export default ProjectDetailsScreen;