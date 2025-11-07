import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import ApiCaller from '../../api/apiCaller';
import { useAuth } from '../../utils/AuthContext';
import { dropdownFields } from '../../utils/validations';

export default function TemplateDetailsScreen({ 
  template, 
  onClose, 
  onProjectCreated 
}) {
  const { userRole } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [projectData, setProjectData] = useState(template.projectData);
  const [taskData, setTaskData] = useState(() => {
    // Initialize task data from template
    const groupsMap = new Map();
    template.taskGroups.forEach(group => {
      groupsMap.set(group.id, { ...group, tasks: [] });
    });

    const ungroupedTasks = [];
    template.tasks.forEach(task => {
      if (task.groupId && groupsMap.has(task.groupId)) {
        groupsMap.get(task.groupId).tasks.push(task);
      } else {
        ungroupedTasks.push(task);
      }
    });

    const sortedGroups = Array.from(groupsMap.values()).sort((a, b) => a.order - b.order);
    sortedGroups.forEach(group => group.tasks.sort((a, b) => a.fields.order - b.fields.order));
    ungroupedTasks.sort((a, b) => a.fields.order - b.fields.order);

    return { groups: sortedGroups, ungroupedTasks };
  });

  const [selectedTask, setSelectedTask] = useState(null);
  const [isTaskModalVisible, setIsTaskModalVisible] = useState(false);
  const [datePickerState, setDatePickerState] = useState({ visible: false, field: null });
  const [dropdownState, setDropdownState] = useState({ visible: false, field: null, options: [] });

  const handleFieldChange = (field, value) => {
    setProjectData(prev => ({ ...prev, [field]: value }));
  };

  const handleTaskFieldChange = (taskId, field, value) => {
    setTaskData(prev => {
      const newTaskData = { ...prev };
      
      // Update task in groups
      newTaskData.groups = newTaskData.groups.map(group => ({
        ...group,
        tasks: group.tasks.map(task => 
          task.id === taskId 
            ? { ...task, fields: { ...task.fields, [field]: value } }
            : task
        )
      }));
      
      // Update task in ungrouped tasks
      newTaskData.ungroupedTasks = newTaskData.ungroupedTasks.map(task =>
        task.id === taskId 
          ? { ...task, fields: { ...task.fields, [field]: value } }
          : task
      );
      
      return newTaskData;
    });
  };

  const handleDateChange = (event, selectedDate, field) => {
    setDatePickerState({ visible: false, field: null });
    if (selectedDate) {
      handleFieldChange(field, format(selectedDate, 'yyyy-MM-dd'));
    }
  };

  const openDropdown = (field) => {
    const options = dropdownFields[field] || [];
    setDropdownState({ visible: true, field, options });
  };

  const selectDropdownOption = (value) => {
    if (dropdownState.field) {
      if (dropdownState.taskId) {
        // Handle task field dropdown
        handleTaskFieldChange(dropdownState.taskId, dropdownState.field, value);
      } else {
        // Handle project field dropdown
        handleFieldChange(dropdownState.field, value);
      }
    }
    setDropdownState({ visible: false, field: null, options: [] });
  };

  const handleTaskDateChange = (event, selectedDate, taskId, field) => {
    setDatePickerState({ visible: false, field: null });
    if (selectedDate) {
      handleTaskFieldChange(taskId, field, format(selectedDate, 'yyyy-MM-dd'));
    }
  };

  const validateProjectData = () => {
    const requiredFields = ['Project Name', 'Client Email', 'States', 'Assigned Consultant'];
    const errors = [];
    
    requiredFields.forEach(field => {
      if (!projectData[field] || projectData[field].trim() === '') {
        errors.push(`${field} is required`);
      }
    });
    
    if (errors.length > 0) {
      Alert.alert('Validation Error', errors.join('\n'));
      return false;
    }
    
    return true;
  };

    const updateTaskIds = async (createdTasks, projectId) => {
      try {
        console.log('Updating task IDs with human-readable format for', createdTasks.length, 'tasks');
        
        // Get all tasks from template (both grouped and ungrouped) in the same order as created
        const allTasksFromTemplate = [
          ...taskData.groups.flatMap(group => group.tasks),
          ...taskData.ungroupedTasks
        ];

        const idUpdatePromises = allTasksFromTemplate.map(async (templateTask, index) => {
          const newTaskId = createdTasks[index].id;
          
          // Create human-readable task ID following web app convention: ${projectId}-T${index + 1}
          const humanReadableId = `${projectId}-T${index + 1}`;
          
          try {
            console.log(`Updating task ID for "${templateTask.fields.task_title}": ${newTaskId} -> ${humanReadableId}`);
            
            await ApiCaller(`/records/tasks/${newTaskId}`, {
              method: 'PATCH',
              body: JSON.stringify({
                fields: { id: humanReadableId }
              })
            });
            
            console.log(`Successfully updated task ID to: ${humanReadableId}`);
          } catch (idError) {
            console.error(`Failed to update ID for task ${newTaskId} (${templateTask.fields.task_title}):`, idError);
          }
        });
        
        await Promise.all(idUpdatePromises);
        console.log('Finished updating all task IDs');
      } catch (error) {
        console.error('Error updating task IDs:', error);
        // Don't throw the error - ID updates are not critical for project creation
      }
    };

    const saveTaskDescriptions = async (createdTasks) => {
      try {
        console.log('Saving task descriptions for', createdTasks.length, 'tasks');
        
        // Get all tasks from template (both grouped and ungrouped)
        const allTasksFromTemplate = [
          ...taskData.groups.flatMap(group => group.tasks),
          ...taskData.ungroupedTasks
        ];

        const descriptionPromises = allTasksFromTemplate.map(async (templateTask, index) => {
          const newTaskId = createdTasks[index].id;
          if (templateTask.fields.description) {
            try {
              console.log(`Saving description for task: ${templateTask.fields.task_title}`);
              console.log('Description content type:', typeof templateTask.fields.description);
              console.log('Description content preview:', templateTask.fields.description?.substring(0, 200) + '...');
              
              // Save description as attachment using the same endpoint as the web app
              await ApiCaller('/save-content-attachment', {
                method: 'POST',
                body: JSON.stringify({
                  recordId: newTaskId,
                  tableName: 'tasks',
                  fieldName: 'description',
                  content: templateTask.fields.description
                })
              });
              
              console.log(`Successfully saved description for task: ${templateTask.fields.task_title}`);
            } catch (descError) {
              console.error(`Failed to save description for task ${newTaskId}:`, descError);
              console.error('Description content that failed:', templateTask.fields.description);
            }
          }
        });
        
        await Promise.all(descriptionPromises);
        console.log('Finished saving task descriptions');
      } catch (error) {
        console.error('Error saving task descriptions:', error);
        // Don't throw the error - descriptions are not critical for project creation
      }
    };

    const createTaskSubItems = async (createdTasks) => {
      try {
        console.log('Creating task sub-items for', createdTasks.length, 'tasks');
        
        // Get all tasks from template (both grouped and ungrouped)
        const allTasksFromTemplate = [
          ...taskData.groups.flatMap(group => group.tasks),
          ...taskData.ungroupedTasks
        ];

        const checklistsToCreate = [];
        const attachmentsToCreate = [];
        const approvalsToCreate = [];

        allTasksFromTemplate.forEach((templateTask, index) => {
          const newTaskId = createdTasks[index].id;
          console.log(`Processing sub-items for task: ${templateTask.fields.task_title} (ID: ${newTaskId})`);

          // Create checklist items
          if (templateTask.fields.checklistItems?.length > 0) {
            console.log(`Creating ${templateTask.fields.checklistItems.length} checklist items`);
            templateTask.fields.checklistItems.forEach(item => {
              checklistsToCreate.push({
                fields: {
                  task_id: [newTaskId],
                  checklist_description: item.checklist_description || item.description || 'Checklist item',
                  completed: false,
                  order_number: checklistsToCreate.length + 1
                }
              });
            });
          }

          // Create attachment placeholders
          if (templateTask.fields.attachments?.length > 0) {
            console.log(`Creating ${templateTask.fields.attachments.length} attachment placeholders`);
            templateTask.fields.attachments.forEach(att => {
              attachmentsToCreate.push({
                fields: {
                  task_id: [newTaskId],
                  attachment_description: att.attachment_description || att.description || 'Attachment',
                }
              });
            });
          }

          // Create approval records
          if (templateTask.fields.approvals?.length > 0) {
            console.log(`Creating ${templateTask.fields.approvals.length} approval records`);
            templateTask.fields.approvals.forEach(approval => {
              approvalsToCreate.push({
                fields: {
                  task_id: [newTaskId],
                  approval_description: approval.fields?.approval_description || approval.approval_description || 'Approval required',
                }
              });
            });
          }

          // Note: Form submissions are handled separately in handlePreAttachedForms
          // This is to match the web app's approach where forms are processed after all other sub-items
        });

        // Batch create all sub-items in parallel
        const subItemPromises = [];
        
        if (checklistsToCreate.length > 0) {
          console.log(`Creating ${checklistsToCreate.length} checklist items`);
          subItemPromises.push(ApiCaller('/records', {
            method: 'POST', 
            body: JSON.stringify({ recordsToCreate: checklistsToCreate, tableName: 'task_checklists' })
          }));
        }
        
        if (attachmentsToCreate.length > 0) {
          console.log(`Creating ${attachmentsToCreate.length} attachment placeholders`);
          subItemPromises.push(ApiCaller('/records', {
            method: 'POST', 
            body: JSON.stringify({ recordsToCreate: attachmentsToCreate, tableName: 'task_attachments' })
          }));
        }
        
        // Form submissions are handled separately in handlePreAttachedForms
        
        if (approvalsToCreate.length > 0) {
          console.log(`Creating ${approvalsToCreate.length} approval records`);
          subItemPromises.push(ApiCaller('/records', {
            method: 'POST', 
            body: JSON.stringify({ recordsToCreate: approvalsToCreate, tableName: 'task_approval' })
          }));
        }

        if (subItemPromises.length > 0) {
          await Promise.all(subItemPromises);
          console.log('Successfully created all task sub-items');
        } else {
          console.log('No sub-items to create');
        }

      } catch (error) {
        console.error('Error creating task sub-items:', error);
        // Don't throw the error - sub-items are not critical for project creation
      }
    };

    const handlePreAttachedForms = async (createdTasks, projectId) => {
      try {
        // Get all tasks that have preAttachedFormName
        const tasksWithForms = createdTasks.filter(task => {
          const originalTask = [...taskData.groups.flatMap(g => g.tasks), ...taskData.ungroupedTasks]
            .find(t => t.fields.task_title === task.fields.task_title);
          return originalTask?.fields.preAttachedFormName;
        });

        if (tasksWithForms.length === 0) {
          console.log('No tasks with pre-attached forms found');
          return;
        }

        console.log(`Processing ${tasksWithForms.length} tasks with pre-attached forms`);

        // Fetch all available forms
        const formsResponse = await ApiCaller('/all/task_forms');
        const allForms = formsResponse;

        for (const task of tasksWithForms) {
          // Find the original task data to get the preAttachedFormName
          const originalTask = [...taskData.groups.flatMap(g => g.tasks), ...taskData.ungroupedTasks]
            .find(t => t.fields.task_title === task.fields.task_title);
          
          if (!originalTask?.fields.preAttachedFormName) continue;

          const formName = originalTask.fields.preAttachedFormName;
          console.log(`Looking for form: ${formName} for task: ${task.fields.task_title}`);

          // Find the form by name
          const formToAttach = allForms.find(form => 
            form.fields.form_name === formName
          );

          if (!formToAttach) {
            console.warn(`Form "${formName}" not found for task "${task.fields.task_title}"`);
            continue;
          }

          console.log(`Attaching form "${formName}" to task "${task.fields.task_title}"`);

          // Get form fields
          const fieldIds = formToAttach.fields.task_forms_fields;
          if (!Array.isArray(fieldIds) || fieldIds.length === 0) {
            console.warn(`Form "${formName}" has no fields linked to it`);
            continue;
          }

          // Fetch the full field records
          const formFieldsResponse = await ApiCaller('/records/by-ids', {
            method: 'POST',
            body: JSON.stringify({
              recordIds: fieldIds,
              tableName: 'task_forms_fields'
            }),
          });
          const formFields = formFieldsResponse.records;

          if (!formFields || formFields.length === 0) {
            console.warn(`Could not fetch fields for form "${formName}"`);
            continue;
          }

          // Create a unique submission ID
          const submissionId = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

          // Create submission records for each field
          const recordsToCreate = formFields.map(field => ({
            fields: {
              submission_id: submissionId,
              form: [formToAttach.id],
              field: [field.id],
              task_id: [task.id],
              value: '--EMPTY--',
              submission: 'Incomplete'
            }
          }));

          await ApiCaller('/records', {
            method: 'POST',
            body: JSON.stringify({
              recordsToCreate: recordsToCreate,
              tableName: 'task_forms_submissions'
            })
          });

          console.log(`Successfully attached form "${formName}" to task "${task.fields.task_title}"`);
        }

        console.log('Finished processing pre-attached forms');
      } catch (error) {
        console.error('Error handling pre-attached forms:', error);
        // Don't throw the error - forms are not critical for project creation
      }
    };

  const handleCreateProject = async () => {
    if (!validateProjectData()) return;
    
    setIsCreatingProject(true);
    
    try {
      // Step 1: Generate a unique Project ID (matching web app format)
      const state = projectData['States'] || 'CA';
      const projectType = projectData['Project Type'] || 'Market Research';
      const serviceType = projectType.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
      const today = new Date();
      const formattedDate = today.toISOString().slice(2, 10).replace(/-/g, '').slice(0, 6);
      const randomCounter = Math.floor(Math.random() * 1000);
      const projectId = `${state}${serviceType}-${formattedDate}P${randomCounter}`;
      
        // Step 2: Create the main project record
        const projectRecord = {
          fields: {
            'Project Name': projectData['Project Name'],
            'Project ID': projectId,
            'Client Email': projectData['Client Email'],
            'States': projectData['States'],
            'Project Type': projectData['Project Type'],
            'Assigned Consultant': projectData['Assigned Consultant'],
            'Supervising Consultant': projectData['Supervising Consultant'],
            'Project Manager': projectData['Project Manager'],
            'Status': 'Preparatory Stage with Consultant',
            'Date of Submission': new Date().toISOString().split('T')[0],
            'Submitted (Y/N)': 'No'
          }
        };

      // Remove any undefined, null, or empty values to keep the payload clean
      Object.keys(projectRecord.fields).forEach(key => {
        if (projectRecord.fields[key] === undefined || projectRecord.fields[key] === null || projectRecord.fields[key] === '') {
          delete projectRecord.fields[key];
        }
      });

      console.log('Creating project record:', JSON.stringify(projectRecord, null, 2));
      
      const requestBody = {
        recordsToCreate: [projectRecord],
        tableName: 'projects'
      };
      
      console.log('Full request body:', JSON.stringify(requestBody, null, 2));
      
      // Create the project
      const projectResponse = await ApiCaller('/records', {
        method: 'POST',
        body: JSON.stringify(requestBody)
      });

      const createdProject = projectResponse.records[0];
      console.log('Created project:', createdProject);

      // Step 2.5: Create a collaborator for the client
      try {
        const newClientCollaboratorName = projectData['Project Name'];
        await ApiCaller('/records', {
          method: 'POST',
          body: JSON.stringify({
            recordsToCreate: [{
              fields: {
                collaborator_name: newClientCollaboratorName,
                collaborator_email: projectData['Client Email'],
                Projects: [createdProject.id]
              }
            }],
            tableName: 'collaborators'
          })
        });
        console.log('Created client collaborator');
      } catch (collaboratorError) {
        console.error("Project created, but failed to create collaborator:", collaboratorError);
        // Don't throw error here as project is already created
      }

      // Step 2.6: Notes saving will be handled later when the endpoint is available

      // Step 3: Create task groups
      const taskGroupsToCreate = taskData.groups.map(group => {
        const groupData = {
          fields: {
            'group_name': group.name,
            'group_order': group.order,
            'projectID': [createdProject.id]
          }
        };
        
        // Remove any undefined, null, or empty values
        Object.keys(groupData.fields).forEach(key => {
          if (groupData.fields[key] === undefined || groupData.fields[key] === null || groupData.fields[key] === '') {
            delete groupData.fields[key];
          }
        });
        
        return groupData;
      });

      let createdGroups = [];
      if (taskGroupsToCreate.length > 0) {
        const groupsResponse = await ApiCaller('/records', {
          method: 'POST',
          body: JSON.stringify({
            recordsToCreate: taskGroupsToCreate,
            tableName: 'task_groups'
          })
        });
        createdGroups = groupsResponse.records;
        console.log('Created task groups:', createdGroups);
      }

      // Step 4: Create tasks
      const tasksToCreate = [];
      
      console.log('Creating tasks. Total groups:', taskData.groups.length);
      console.log('Created groups:', createdGroups.map(g => ({ id: g.id, name: g.fields.group_name })));
      console.log('Task data structure:', JSON.stringify(taskData, null, 2));
      
      // Add tasks from groups
      taskData.groups.forEach(group => {
        console.log(`Processing group: ${group.name} with ${group.tasks.length} tasks`);
        const groupRecord = createdGroups.find(g => g.fields.group_name === group.name);
        if (groupRecord) {
          console.log(`Found group record for ${group.name}:`, groupRecord.id);
          group.tasks.forEach(task => {
            // Dynamic assignee logic (matching web app)
            let finalAssignee = task.fields.assigned_to; // Default
            const assigneePlaceholder = task.fields.assigned_to;
            if (assigneePlaceholder === 'Client') {
              finalAssignee = projectData['Project Name']; // Client name
            } else if (assigneePlaceholder === 'Consultant') {
              finalAssignee = projectData['Assigned Consultant'];
            } else if (assigneePlaceholder === 'Supervising Consultant') {
              finalAssignee = projectData['Supervising Consultant'];
            }
            
            // If no assignee specified, default to the project's assigned consultant
            if (!finalAssignee) {
              finalAssignee = projectData['Assigned Consultant'];
            }

            const taskData = {
              fields: {
                'task_title': task.fields.task_title,
                'task_status': task.fields.task_status || 'Not Started',
                'order': task.fields.order || 0,
                'Action_type': task.fields.Action_type || 'Review Only',
                'project_id': [createdProject.id],
                'task_groups': [groupRecord.id],
                'assigned_to': finalAssignee,
                'due_date': task.fields.due_date || '',
                'start_date': task.fields.start_date || new Date().toISOString().split('T')[0],
                'progress_bar': task.fields.progress_bar || 0,
                'tags': task.fields.tags || ''
              }
            };
            
            // Remove any undefined, null, or empty values
            Object.keys(taskData.fields).forEach(key => {
              if (taskData.fields[key] === undefined || taskData.fields[key] === null || taskData.fields[key] === '') {
                delete taskData.fields[key];
              }
            });
            
            tasksToCreate.push(taskData);
            console.log(`Added task to create: ${task.fields.task_title}`);
          });
        } else {
          console.log(`No group record found for ${group.name}`);
        }
      });

      console.log(`Total tasks from groups: ${tasksToCreate.length}`);

      // Add ungrouped tasks
      console.log(`Processing ${taskData.ungroupedTasks.length} ungrouped tasks`);
      taskData.ungroupedTasks.forEach(task => {
        // Dynamic assignee logic (matching web app)
        let finalAssignee = task.fields.assigned_to; // Default
        const assigneePlaceholder = task.fields.assigned_to;
        if (assigneePlaceholder === 'Client') {
          finalAssignee = projectData['Project Name']; // Client name
        } else if (assigneePlaceholder === 'Consultant') {
          finalAssignee = projectData['Assigned Consultant'];
        } else if (assigneePlaceholder === 'Supervising Consultant') {
          finalAssignee = projectData['Supervising Consultant'];
        }
        
        // If no assignee specified, default to the project's assigned consultant
        if (!finalAssignee) {
          finalAssignee = projectData['Assigned Consultant'];
        }

        const taskData = {
          fields: {
            'task_title': task.fields.task_title,
            'task_status': task.fields.task_status || 'Not Started',
            'order': task.fields.order || 0,
            'Action_type': task.fields.Action_type || 'Review Only',
            'project_id': [createdProject.id],
            'assigned_to': finalAssignee,
            'due_date': task.fields.due_date || '',
            'start_date': task.fields.start_date || new Date().toISOString().split('T')[0],
            'progress_bar': task.fields.progress_bar || 0,
            'tags': task.fields.tags || ''
          }
        };
        
        // Remove any undefined, null, or empty values
        Object.keys(taskData.fields).forEach(key => {
          if (taskData.fields[key] === undefined || taskData.fields[key] === null || taskData.fields[key] === '') {
            delete taskData.fields[key];
          }
        });
        
        tasksToCreate.push(taskData);
        console.log(`Added ungrouped task to create: ${task.fields.task_title}`);
      });

      console.log(`Total tasks to create: ${tasksToCreate.length}`);

      if (tasksToCreate.length > 0) {
        const tasksResponse = await ApiCaller('/records', {
          method: 'POST',
          body: JSON.stringify({
            recordsToCreate: tasksToCreate,
            tableName: 'tasks'
          })
        });
        console.log('Created tasks:', tasksResponse.records);

        // Step 5: Update task IDs with human-readable IDs (matching web app convention)
        await updateTaskIds(tasksResponse.records, projectId);

        // Step 6: Save task descriptions as attachments (if they exist)
        await saveTaskDescriptions(tasksResponse.records);

        // Step 7: Create all task sub-items (checklists, attachments, approvals, form submissions)
        await createTaskSubItems(tasksResponse.records);

        // Step 8: Handle pre-attached forms for tasks
        await handlePreAttachedForms(tasksResponse.records, createdProject.id);
      }

      // Step 9: Show success and navigate
      Alert.alert(
        'Success!',
        `Project "${projectData['Project Name']}" has been created successfully with ${tasksToCreate.length} tasks, checklists, attachments, approvals, and forms.`,
        [
          {
            text: 'OK',
            onPress: () => {
              onProjectCreated(createdProject);
            }
          }
        ]
      );
      
    } catch (error) {
      console.error('Error creating project:', error);
      Alert.alert('Error', `Failed to create project: ${error.message}`);
    } finally {
      setIsCreatingProject(false);
    }
  };

  const openTaskModal = (task) => {
    setSelectedTask(task);
    setIsTaskModalVisible(true);
  };

  const closeTaskModal = () => {
    setSelectedTask(null);
    setIsTaskModalVisible(false);
  };

  const renderTaskModal = () => {
    if (!selectedTask) return null;

    return (
      <Modal
        visible={isTaskModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Edit Task</Text>
            <TouchableOpacity onPress={closeTaskModal} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.modalContent}>
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Task Title</Text>
              <TextInput
                style={styles.textInput}
                value={selectedTask.fields.task_title}
                onChangeText={(value) => handleTaskFieldChange(selectedTask.id, 'task_title', value)}
                placeholder="Enter task title"
              />
            </View>

            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Task Status</Text>
              <TouchableOpacity
                style={styles.pickerContainer}
                onPress={() => {
                  const options = ['Not Started', 'In Progress', 'Completed'];
                  setDropdownState({ visible: true, field: 'task_status', options, taskId: selectedTask.id });
                }}
              >
                <Text style={styles.pickerText}>
                  {selectedTask.fields.task_status || 'Not Started'}
                </Text>
                <Ionicons name="chevron-down" size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Due Date</Text>
              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => setDatePickerState({ visible: true, field: 'due_date', taskId: selectedTask.id })}
              >
                <Text style={styles.dateButtonText}>
                  {selectedTask.fields.due_date ? format(new Date(selectedTask.fields.due_date), 'MMM dd, yyyy') : 'Select date'}
                </Text>
                <Ionicons name="calendar-outline" size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Assigned To</Text>
              <TextInput
                style={styles.textInput}
                value={selectedTask.fields.assigned_to}
                onChangeText={(value) => handleTaskFieldChange(selectedTask.id, 'assigned_to', value)}
                placeholder="Enter assignee name"
              />
            </View>

            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Action Type</Text>
              <TouchableOpacity
                style={styles.pickerContainer}
                onPress={() => {
                  const options = dropdownFields['Action_type'] || [];
                  setDropdownState({ visible: true, field: 'Action_type', options, taskId: selectedTask.id });
                }}
              >
                <Text style={styles.pickerText}>
                  {selectedTask.fields.Action_type || 'Select action type'}
                </Text>
                <Ionicons name="chevron-down" size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Description</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                value={selectedTask.fields.description || ''}
                onChangeText={(value) => handleTaskFieldChange(selectedTask.id, 'description', value)}
                placeholder="Enter task description"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Tags</Text>
              <TextInput
                style={styles.textInput}
                value={selectedTask.fields.tags || ''}
                onChangeText={(value) => handleTaskFieldChange(selectedTask.id, 'tags', value)}
                placeholder="Enter tags (comma separated)"
              />
            </View>

            {/* Modal Actions */}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={closeTaskModal}
              >
                <Text style={styles.modalButtonCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm]}
                onPress={closeTaskModal}
              >
                <Text style={styles.modalButtonConfirmText}>Save</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {template.name}
          </Text>
          <Text style={styles.headerSubtitle}>Template Details</Text>
        </View>
        <TouchableOpacity
          style={[styles.editButton, isEditing && styles.editButtonActive]}
          onPress={() => setIsEditing(!isEditing)}
        >
          <Ionicons name="create" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Project Information */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Project Information</Text>
            {isEditing && (
              <TouchableOpacity
                style={styles.createProjectButton}
                onPress={handleCreateProject}
                disabled={isCreatingProject}
              >
                {isCreatingProject ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="add" size={16} color="#FFFFFF" />
                    <Text style={styles.createProjectButtonText}>Create Project</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.fieldsContainer}>
            <View style={styles.fieldRow}>
              <View style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>Project Name</Text>
                <TextInput
                  style={[styles.textInput, !isEditing && styles.textInputDisabled]}
                  value={projectData['Project Name']}
                  onChangeText={(value) => handleFieldChange('Project Name', value)}
                  placeholder="Enter project name"
                  editable={isEditing}
                />
              </View>
            </View>

            <View style={styles.fieldRow}>
              <View style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>Client Email</Text>
                <TextInput
                  style={[styles.textInput, !isEditing && styles.textInputDisabled]}
                  value={projectData['Client Email']}
                  onChangeText={(value) => handleFieldChange('Client Email', value)}
                  placeholder="Enter client email"
                  keyboardType="email-address"
                  editable={isEditing}
                />
              </View>
            </View>

            <View style={styles.fieldRow}>
              <View style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>States</Text>
                <TouchableOpacity
                  style={[styles.dropdownButton, !isEditing && styles.dropdownButtonDisabled]}
                  onPress={() => isEditing && openDropdown('States')}
                  disabled={!isEditing}
                >
                  <Text style={[styles.dropdownButtonText, !projectData['States'] && styles.placeholderText]}>
                    {projectData['States'] || 'Select state(s)'}
                  </Text>
                  <Ionicons name="chevron-down" size={20} color="#6B7280" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.fieldRow}>
              <View style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>Assigned Consultant</Text>
                <TouchableOpacity
                  style={[styles.dropdownButton, !isEditing && styles.dropdownButtonDisabled]}
                  onPress={() => isEditing && openDropdown('Assigned Consultant')}
                  disabled={!isEditing}
                >
                  <Text style={[styles.dropdownButtonText, !projectData['Assigned Consultant'] && styles.placeholderText]}>
                    {projectData['Assigned Consultant'] || 'Select consultant'}
                  </Text>
                  <Ionicons name="chevron-down" size={20} color="#6B7280" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.fieldRow}>
              <View style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>Project Type</Text>
                <TouchableOpacity
                  style={[styles.dropdownButton, !isEditing && styles.dropdownButtonDisabled]}
                  onPress={() => isEditing && openDropdown('Project Type')}
                  disabled={!isEditing}
                >
                  <Text style={[styles.dropdownButtonText, !projectData['Project Type'] && styles.placeholderText]}>
                    {projectData['Project Type'] || 'Select project type'}
                  </Text>
                  <Ionicons name="chevron-down" size={20} color="#6B7280" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.fieldRow}>
              <View style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>Supervising Consultant</Text>
                <TouchableOpacity
                  style={[styles.dropdownButton, !isEditing && styles.dropdownButtonDisabled]}
                  onPress={() => isEditing && openDropdown('Supervising Consultant')}
                  disabled={!isEditing}
                >
                  <Text style={[styles.dropdownButtonText, !projectData['Supervising Consultant'] && styles.placeholderText]}>
                    {projectData['Supervising Consultant'] || 'Select supervising consultant'}
                  </Text>
                  <Ionicons name="chevron-down" size={20} color="#6B7280" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.fieldRow}>
              <View style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>Project Manager</Text>
                <TouchableOpacity
                  style={[styles.dropdownButton, !isEditing && styles.dropdownButtonDisabled]}
                  onPress={() => isEditing && openDropdown('Project Manager')}
                  disabled={!isEditing}
                >
                  <Text style={[styles.dropdownButtonText, !projectData['Project Manager'] && styles.placeholderText]}>
                    {projectData['Project Manager'] || 'Select project manager'}
                  </Text>
                  <Ionicons name="chevron-down" size={20} color="#6B7280" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>

        {/* Tasks */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Tasks</Text>
            <Text style={styles.sectionSubtitle}>
              {taskData.groups.reduce((sum, g) => sum + g.tasks.length, 0) + taskData.ungroupedTasks.length} total tasks
            </Text>
          </View>

          {/* Task Groups */}
          {taskData.groups.map((group) => (
            <View key={group.id} style={styles.taskGroup}>
              <View style={styles.taskGroupHeader}>
                <Text style={styles.taskGroupName}>{group.name}</Text>
                <Text style={styles.taskGroupCount}>{group.tasks.length} tasks</Text>
              </View>
              
              {group.tasks.map((task) => (
                <TouchableOpacity
                  key={task.id}
                  style={styles.taskItem}
                  onPress={() => isEditing && openTaskModal(task)}
                >
                  <View style={styles.taskContent}>
                    <Text style={styles.taskTitle} numberOfLines={2}>
                      {task.fields.task_title}
                    </Text>
                    <View style={styles.taskMeta}>
                      <Text style={styles.taskStatus}>
                        {task.fields.task_status || 'Not Started'}
                      </Text>
                      {!!task.fields.due_date && (
                        <Text style={styles.taskDate}>
                          Due: {format(new Date(task.fields.due_date), 'MMM dd')}
                        </Text>
                      )}
                    </View>
                  </View>
                  {isEditing && (
                    <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          ))}

          {/* Ungrouped Tasks */}
          {taskData.ungroupedTasks.length > 0 && (
            <View style={styles.taskGroup}>
              <View style={styles.taskGroupHeader}>
                <Text style={styles.taskGroupName}>Ungrouped Tasks</Text>
                <Text style={styles.taskGroupCount}>{taskData.ungroupedTasks.length} tasks</Text>
              </View>
              
              {taskData.ungroupedTasks.map((task) => (
                <TouchableOpacity
                  key={task.id}
                  style={styles.taskItem}
                  onPress={() => isEditing && openTaskModal(task)}
                >
                  <View style={styles.taskContent}>
                    <Text style={styles.taskTitle} numberOfLines={2}>
                      {task.fields.task_title}
                    </Text>
                    <View style={styles.taskMeta}>
                      <Text style={styles.taskStatus}>
                        {task.fields.task_status || 'Not Started'}
                      </Text>
                      {!!task.fields.due_date && (
                        <Text style={styles.taskDate}>
                          Due: {format(new Date(task.fields.due_date), 'MMM dd')}
                        </Text>
                      )}
                    </View>
                  </View>
                  {isEditing && (
                    <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Date Picker */}
      {datePickerState.visible && (
        <DateTimePicker
          value={new Date()}
          mode="date"
          display="default"
          onChange={(event, date) => {
            if (datePickerState.field === 'due_date' && selectedTask) {
              handleTaskDateChange(event, date, selectedTask.id, 'due_date');
            } else {
              handleDateChange(event, date, datePickerState.field);
            }
          }}
        />
      )}

      {/* Dropdown Modal */}
      {dropdownState.visible && (
        <Modal
          visible={dropdownState.visible}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setDropdownState({ visible: false, field: null, options: [] })}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setDropdownState({ visible: false, field: null, options: [] })}
          >
            <View style={styles.dropdownModal}>
              <View style={styles.dropdownHeader}>
                <Text style={styles.dropdownTitle}>
                  Select {dropdownState.field}
                </Text>
                <TouchableOpacity
                  onPress={() => setDropdownState({ visible: false, field: null, options: [] })}
                  style={styles.dropdownCloseButton}
                >
                  <Ionicons name="close" size={24} color="#6B7280" />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.dropdownContent}>
                {dropdownState.options.map((option, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.dropdownOption}
                    onPress={() => selectDropdownOption(option)}
                  >
                    <Text style={styles.dropdownOptionText}>{option}</Text>
                    {((dropdownState.taskId && selectedTask?.fields[dropdownState.field] === option) || 
                      (!dropdownState.taskId && projectData[dropdownState.field] === option)) && (
                      <Ionicons name="checkmark" size={20} color="#10B981" />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>
      )}

      {/* Task Modal */}
      {renderTaskModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3B82F6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  editButtonActive: {
    backgroundColor: '#EF4444',
  },
  content: {
    flex: 1,
  },
  section: {
    backgroundColor: '#FFFFFF',
    marginTop: 16,
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  createProjectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10B981',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  createProjectButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  fieldsContainer: {
    gap: 16,
  },
  fieldRow: {
    flexDirection: 'row',
    gap: 12,
  },
  fieldContainer: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: '#FFFFFF',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  textInputDisabled: {
    backgroundColor: '#F9FAFB',
    color: '#6B7280',
  },
  pickerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#F9FAFB',
  },
  pickerText: {
    fontSize: 16,
    color: '#6B7280',
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
  },
  dateButtonText: {
    fontSize: 16,
    color: '#1F2937',
  },
  taskGroup: {
    marginBottom: 20,
  },
  taskGroupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  taskGroupName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#374151',
  },
  taskGroupCount: {
    fontSize: 14,
    color: '#6B7280',
  },
  taskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  taskContent: {
    flex: 1,
  },
  taskTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  taskMeta: {
    flexDirection: 'row',
    gap: 12,
  },
  taskStatus: {
    fontSize: 12,
    color: '#6B7280',
  },
  taskDate: {
    fontSize: 12,
    color: '#6B7280',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  closeButton: {
    padding: 8,
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
  },
  dropdownButtonDisabled: {
    backgroundColor: '#F9FAFB',
  },
  dropdownButtonText: {
    fontSize: 16,
    color: '#1F2937',
    flex: 1,
  },
  placeholderText: {
    color: '#9CA3AF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  dropdownModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    width: '100%',
    maxWidth: 400,
    maxHeight: '70%',
  },
  dropdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  dropdownTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  dropdownCloseButton: {
    padding: 4,
  },
  dropdownContent: {
    maxHeight: 300,
  },
  dropdownOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  dropdownOptionText: {
    fontSize: 16,
    color: '#1F2937',
    flex: 1,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
    paddingHorizontal: 16,
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
});
