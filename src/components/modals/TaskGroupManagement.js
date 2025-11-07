import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  Modal,
  TextInput
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ApiCaller from '../../api/apiCaller';

const TaskGroupManagement = ({ 
  projectData, 
  onTasksUpdated,
  visible = false,
  onClose = () => {}
}) => {
  // Task management state
  const [taskGroups, setTaskGroups] = useState([]);
  const [ungroupedTasks, setUngroupedTasks] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [isTaskEditMode, setIsTaskEditMode] = useState(false);
  const [selectedTasks, setSelectedTasks] = useState(new Set());
  const [isMoveMode, setIsMoveMode] = useState(false);
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [showMoveModal, setShowMoveModal] = useState(false);

  // Fetch tasks when project data is loaded
  useEffect(() => {
    if (projectData?.fields?.['Project ID'] && visible) {
      fetchTasks();
    }
  }, [projectData, visible]);

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

  // Task management functions
  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) {
      Alert.alert('Error', 'Please enter a group name');
      return;
    }

    try {
      const newGroup = {
        fields: {
          group_name: newGroupName.trim(),
          group_order: taskGroups.length,
          projectID: [projectData.id]
        }
      };

      const response = await ApiCaller('/records', {
        method: 'POST',
        body: JSON.stringify({
          recordsToCreate: [newGroup],
          tableName: 'task_groups'
        })
      });

      const createdGroup = response.records[0];
      setTaskGroups(prev => [...prev, {
        id: createdGroup.id,
        name: createdGroup.fields.group_name,
        order: createdGroup.fields.group_order,
        tasks: []
      }]);

      setNewGroupName('');
      setShowCreateGroupModal(false);
      Alert.alert('Success', 'Task group created successfully');
    } catch (error) {
      console.error('Error creating group:', error);
      Alert.alert('Error', 'Failed to create task group');
    }
  };

  const handleDeleteGroup = (groupId, groupName, taskCount) => {
    Alert.alert(
      'Delete Task Group',
      `Are you sure you want to delete "${groupName}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Group Only',
          style: 'destructive',
          onPress: () => deleteGroup(groupId, false)
        },
        {
          text: 'Delete Group & Tasks',
          style: 'destructive',
          onPress: () => deleteGroup(groupId, true)
        }
      ]
    );
  };

  const deleteGroup = async (groupId, deleteTasks) => {
    try {
      const group = taskGroups.find(g => g.id === groupId);
      if (!group) return;

      if (deleteTasks && group.tasks.length > 0) {
        // Delete all tasks in the group
        const taskIds = group.tasks.map(task => task.id);
        await ApiCaller('/records/tasks', {
          method: 'DELETE',
          body: JSON.stringify({ recordIds: taskIds })
        });
      } else if (!deleteTasks && group.tasks.length > 0) {
        // Move tasks to ungrouped
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

        // Update local state
        setUngroupedTasks(prev => [...prev, ...group.tasks]);
      }

      // Delete the group
      await ApiCaller('/records/task_groups', {
        method: 'DELETE',
        body: JSON.stringify({ recordIds: [groupId] })
      });

      // Update local state
      setTaskGroups(prev => prev.filter(g => g.id !== groupId));
      Alert.alert('Success', 'Task group deleted successfully');
    } catch (error) {
      console.error('Error deleting group:', error);
      Alert.alert('Error', 'Failed to delete task group');
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
      Alert.alert('No Selection', 'Please select tasks to move');
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
      const tasksToMove = [];
      const updatedGroups = taskGroups.map(group => {
        const remainingTasks = group.tasks.filter(task => !selectedTasks.has(task.id));
        const movingTasks = group.tasks.filter(task => selectedTasks.has(task.id));
        tasksToMove.push(...movingTasks);
        return { ...group, tasks: remainingTasks };
      });

      const updatedUngrouped = ungroupedTasks.filter(task => !selectedTasks.has(task.id));
      const movingFromUngrouped = ungroupedTasks.filter(task => selectedTasks.has(task.id));
      tasksToMove.push(...movingFromUngrouped);

      if (targetGroupId) {
        const targetGroup = updatedGroups.find(g => g.id === targetGroupId);
        if (targetGroup) {
          targetGroup.tasks.push(...tasksToMove);
        }
      } else {
        updatedUngrouped.push(...tasksToMove);
      }

      setTaskGroups(updatedGroups);
      setUngroupedTasks(updatedUngrouped);
      setSelectedTasks(new Set());
      setShowMoveModal(false);
      setIsMoveMode(false);
      Alert.alert('Success', 'Tasks moved successfully');
      
      // Notify parent component
      if (onTasksUpdated) {
        onTasksUpdated();
      }
    } catch (error) {
      console.error('Error moving tasks:', error);
      Alert.alert('Error', 'Failed to move tasks');
    }
  };

  const handleReorderTask = async (taskId, direction, currentGroupId) => {
    try {
      let tasks = [];
      let groupIndex = -1;

      if (currentGroupId) {
        const group = taskGroups.find(g => g.id === currentGroupId);
        if (group) {
          tasks = [...group.tasks];
          groupIndex = taskGroups.findIndex(g => g.id === currentGroupId);
        }
      } else {
        tasks = [...ungroupedTasks];
      }

      const taskIndex = tasks.findIndex(t => t.id === taskId);
      if (taskIndex === -1) return;

      const newIndex = direction === 'up' ? taskIndex - 1 : taskIndex + 1;
      if (newIndex < 0 || newIndex >= tasks.length) return;

      // Swap tasks
      [tasks[taskIndex], tasks[newIndex]] = [tasks[newIndex], tasks[taskIndex]];

      // Update order values
      const taskUpdates = tasks.map((task, index) => ({
        id: task.id,
        fields: { order: index }
      }));

      await ApiCaller('/records', {
        method: 'PATCH',
        body: JSON.stringify({
          recordsToUpdate: taskUpdates,
          tableName: 'tasks'
        })
      });

      // Update local state
      if (currentGroupId) {
        const updatedGroups = [...taskGroups];
        updatedGroups[groupIndex] = { ...updatedGroups[groupIndex], tasks };
        setTaskGroups(updatedGroups);
      } else {
        setUngroupedTasks(tasks);
      }
    } catch (error) {
      console.error('Error reordering task:', error);
      Alert.alert('Error', 'Failed to reorder task');
    }
  };

  const exitTaskEditMode = () => {
    setIsTaskEditMode(false);
    setIsMoveMode(false);
    setSelectedTasks(new Set());
  };

  const renderTasksContent = () => {
    if (loadingTasks) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.loadingText}>Loading tasks...</Text>
        </View>
      );
    }

    return (
      <ScrollView style={styles.tasksContainer}>
        {/* Tasks Header */}
        <View style={styles.tasksHeader}>
          <Text style={styles.tasksTitle}>Tasks</Text>
          {!isTaskEditMode ? (
            <TouchableOpacity
              style={[styles.editButton, { backgroundColor: '#FF6B6B' }]} // Debug: Make button more visible
              onPress={() => setIsTaskEditMode(true)}
            >
              <Ionicons name="create" size={20} color="#FFFFFF" />
              <Text style={[styles.editButtonText, { color: '#FFFFFF' }]}>EDIT</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.editModeActions}>
              {isMoveMode && selectedTasks.size > 0 && (
                <TouchableOpacity
                  style={styles.moveButton}
                  onPress={handleMoveTasks}
                >
                  <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
                  <Text style={styles.moveButtonText}>Move ({selectedTasks.size})</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={styles.doneButton}
                onPress={exitTaskEditMode}
              >
                <Text style={styles.doneButtonText}>Done</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Task Groups */}
        {taskGroups.map((group) => (
          <View key={group.id} style={styles.taskGroup}>
            <View style={styles.groupHeader}>
              <Text style={styles.groupTitle}>{group.name}</Text>
              <View style={styles.groupActions}>
                {isTaskEditMode && (
                  <>
                    <TouchableOpacity
                      style={styles.addTaskButton}
                      onPress={() => {/* TODO: Add task to group */}}
                    >
                      <Ionicons name="add" size={16} color="#3B82F6" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.deleteGroupButton}
                      onPress={() => handleDeleteGroup(group.id, group.name, group.tasks.length)}
                    >
                      <Ionicons name="trash" size={16} color="#EF4444" />
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>
            
            <View style={styles.tasksList}>
              {group.tasks.map((task, index) => (
                <View key={task.id} style={[
                  styles.taskItem,
                  selectedTasks.has(task.id) && styles.selectedTaskItem
                ]}>
                  <View style={styles.taskContent}>
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
                    <View style={styles.taskInfo}>
                      <Text style={styles.taskTitle}>{task.fields.task_title}</Text>
                      <Text style={styles.taskStatus}>{task.fields.task_status}</Text>
                    </View>
                  </View>
                  
                  {isTaskEditMode && !isMoveMode && (
                    <View style={styles.taskActions}>
                      <TouchableOpacity
                        style={[styles.reorderButton, index === 0 && styles.disabledButton]}
                        onPress={() => handleReorderTask(task.id, 'up', group.id)}
                        disabled={index === 0}
                      >
                        <Ionicons name="chevron-up" size={16} color={index === 0 ? "#9CA3AF" : "#374151"} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.reorderButton, index === group.tasks.length - 1 && styles.disabledButton]}
                        onPress={() => handleReorderTask(task.id, 'down', group.id)}
                        disabled={index === group.tasks.length - 1}
                      >
                        <Ionicons name="chevron-down" size={16} color={index === group.tasks.length - 1 ? "#9CA3AF" : "#374151"} />
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
            <View style={styles.groupHeader}>
              <Text style={styles.groupTitle}>Ungrouped Tasks</Text>
              {isTaskEditMode && (
                <TouchableOpacity
                  style={styles.addTaskButton}
                  onPress={() => {/* TODO: Add ungrouped task */}}
                >
                  <Ionicons name="add" size={16} color="#3B82F6" />
                </TouchableOpacity>
              )}
            </View>
            
            <View style={styles.tasksList}>
              {ungroupedTasks.map((task, index) => (
                <View key={task.id} style={[
                  styles.taskItem,
                  selectedTasks.has(task.id) && styles.selectedTaskItem
                ]}>
                  <View style={styles.taskContent}>
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
                    <View style={styles.taskInfo}>
                      <Text style={styles.taskTitle}>{task.fields.task_title}</Text>
                      <Text style={styles.taskStatus}>{task.fields.task_status}</Text>
                    </View>
                  </View>
                  
                  {isTaskEditMode && !isMoveMode && (
                    <View style={styles.taskActions}>
                      <TouchableOpacity
                        style={[styles.reorderButton, index === 0 && styles.disabledButton]}
                        onPress={() => handleReorderTask(task.id, 'up', null)}
                        disabled={index === 0}
                      >
                        <Ionicons name="chevron-up" size={16} color={index === 0 ? "#9CA3AF" : "#374151"} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.reorderButton, index === ungroupedTasks.length - 1 && styles.disabledButton]}
                        onPress={() => handleReorderTask(task.id, 'down', null)}
                        disabled={index === ungroupedTasks.length - 1}
                      >
                        <Ionicons name="chevron-down" size={16} color={index === ungroupedTasks.length - 1 ? "#9CA3AF" : "#374151"} />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Edit Mode Controls */}
        {isTaskEditMode && (
          <View style={styles.editModeControls}>
            <TouchableOpacity
              style={styles.createGroupButton}
              onPress={() => setShowCreateGroupModal(true)}
            >
              <Ionicons name="add-circle" size={20} color="#3B82F6" />
              <Text style={styles.createGroupButtonText}>Create Group</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.moveModeButton, isMoveMode && styles.activeMoveModeButton]}
              onPress={() => {
                setIsMoveMode(!isMoveMode);
                setSelectedTasks(new Set());
              }}
            >
              <Ionicons name="swap-horizontal" size={20} color={isMoveMode ? "#FFFFFF" : "#3B82F6"} />
              <Text style={[styles.moveModeButtonText, isMoveMode && styles.activeMoveModeButtonText]}>
                {isMoveMode ? 'Exit Move Mode' : 'Move Tasks'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Modals */}
        {renderModals()}
      </ScrollView>
    );
  };

  const renderModals = () => {
    return (
      <>
        {/* Create Group Modal */}
        <Modal
          visible={showCreateGroupModal}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowCreateGroupModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Create New Task Group</Text>
              <TextInput
                style={styles.modalInput}
                value={newGroupName}
                onChangeText={setNewGroupName}
                placeholder="Enter group name"
                placeholderTextColor="#9CA3AF"
                autoFocus={true}
              />
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalCancelButton}
                  onPress={() => {
                    setShowCreateGroupModal(false);
                    setNewGroupName('');
                  }}
                >
                  <Text style={styles.modalCancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalConfirmButton}
                  onPress={handleCreateGroup}
                >
                  <Text style={styles.modalConfirmButtonText}>Create</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Move Tasks Modal */}
        <Modal
          visible={showMoveModal}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowMoveModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Move Tasks</Text>
              <Text style={styles.modalSubtitle}>
                Move {selectedTasks.size} selected task{selectedTasks.size !== 1 ? 's' : ''} to:
              </Text>
              
              <ScrollView style={styles.moveOptionsList}>
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
              </ScrollView>
              
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setShowMoveModal(false)}
              >
                <Text style={styles.modalCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </>
    );
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#374151" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Task Management</Text>
          <View style={{ width: 24 }} />
        </View>
        {renderTasksContent()}
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  closeButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
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
  tasksContainer: {
    flex: 1,
    padding: 16,
  },
  tasksHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  tasksTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EBF8FF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  editButtonText: {
    marginLeft: 6,
    color: '#3B82F6',
    fontWeight: '600',
  },
  editModeActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  moveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3B82F6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  moveButtonText: {
    marginLeft: 6,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  doneButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  doneButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  taskGroup: {
    marginBottom: 24,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F9FAFB',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  groupTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  groupActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addTaskButton: {
    padding: 8,
    backgroundColor: '#EBF8FF',
    borderRadius: 6,
  },
  deleteGroupButton: {
    padding: 8,
    backgroundColor: '#FEF2F2',
    borderRadius: 6,
  },
  tasksList: {
    padding: 8,
  },
  taskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    marginVertical: 4,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  selectedTaskItem: {
    backgroundColor: '#EBF8FF',
    borderColor: '#3B82F6',
  },
  taskContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  taskCheckbox: {
    marginRight: 12,
  },
  taskInfo: {
    flex: 1,
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 2,
  },
  taskStatus: {
    fontSize: 14,
    color: '#6B7280',
  },
  taskActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  reorderButton: {
    padding: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 6,
  },
  disabledButton: {
    opacity: 0.5,
  },
  editModeControls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    marginTop: 20,
  },
  createGroupButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EBF8FF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  createGroupButtonText: {
    marginLeft: 8,
    color: '#3B82F6',
    fontWeight: '600',
  },
  moveModeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  activeMoveModeButton: {
    backgroundColor: '#3B82F6',
  },
  moveModeButtonText: {
    marginLeft: 8,
    color: '#3B82F6',
    fontWeight: '600',
  },
  activeMoveModeButtonText: {
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    marginBottom: 20,
    backgroundColor: '#FFFFFF',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalCancelButtonText: {
    color: '#374151',
    fontWeight: '600',
  },
  modalConfirmButton: {
    flex: 1,
    backgroundColor: '#3B82F6',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalConfirmButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  moveOptionsList: {
    maxHeight: 200,
    marginBottom: 20,
  },
  moveOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  moveOptionText: {
    fontSize: 16,
    color: '#111827',
  },
});

export default TaskGroupManagement;
