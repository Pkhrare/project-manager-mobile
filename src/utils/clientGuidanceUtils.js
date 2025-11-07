import ApiCaller from '../api/apiCaller';

/**
 * Builds comprehensive context for client guidance questions
 * This includes task sequencing, project type information, and workflow understanding
 */
export const buildClientGuidanceContext = async (projectId, taskId = null) => {
  try {
    // Fetch project
    const project = await ApiCaller(`/records/projects/${projectId}`);
    
    if (!project?.fields) {
      return null;
    }

    // Fetch all tasks and groups for the project
    const projectIdentifier = project.fields['Project ID'];
    if (!projectIdentifier) {
      return null;
    }

    const [groupsResponse, tasksResponse] = await Promise.all([
      ApiCaller(`/records/filter/${projectIdentifier}/task_groups`),
      ApiCaller(`/records/filter/${projectIdentifier}/tasks`)
    ]);

    const allGroups = Array.isArray(groupsResponse?.records) ? groupsResponse.records : [];
    const allTasks = Array.isArray(tasksResponse?.records) ? tasksResponse.records : [];

    // Organize tasks by group
    const tasksByGroup = {};
    const ungroupedTasks = [];

    allTasks.forEach(task => {
      const groupId = task.fields.task_groups?.[0];
      if (groupId) {
        if (!tasksByGroup[groupId]) {
          tasksByGroup[groupId] = [];
        }
        tasksByGroup[groupId].push(task);
      } else {
        ungroupedTasks.push(task);
      }
    });

    // Sort groups by group_order
    const sortedGroups = allGroups.sort((a, b) => (a.fields.group_order || 0) - (b.fields.group_order || 0));

    // Sort tasks within each group by order
    sortedGroups.forEach(group => {
      if (tasksByGroup[group.id]) {
        tasksByGroup[group.id].sort((a, b) => (a.fields.order || 0) - (b.fields.order || 0));
      }
    });

    // Sort ungrouped tasks by order
    ungroupedTasks.sort((a, b) => (a.fields.order || 0) - (b.fields.order || 0));

    // Build task sequence (flattened ordered list)
    const taskSequence = [];
    
    sortedGroups.forEach(group => {
      if (tasksByGroup[group.id]) {
        tasksByGroup[group.id].forEach(task => {
          taskSequence.push({
            taskId: task.id,
            taskTitle: task.fields.task_title,
            groupName: group.fields.group_name,
            groupOrder: group.fields.group_order || 0,
            taskOrder: task.fields.order || 0,
            status: task.fields.task_status,
            actionType: task.fields.Action_type
          });
        });
      }
    });

    // Add ungrouped tasks at the end
    ungroupedTasks.forEach(task => {
      taskSequence.push({
        taskId: task.id,
        taskTitle: task.fields.task_title,
        groupName: null,
        groupOrder: 9999,
        taskOrder: task.fields.order || 0,
        status: task.fields.task_status,
        actionType: task.fields.Action_type
      });
    });

    // Find current task position and next/previous tasks
    let currentTaskIndex = null;
    let currentTask = null;
    let nextTasks = [];
    let previousTasks = [];

    if (taskId) {
      currentTaskIndex = taskSequence.findIndex(t => t.taskId === taskId);
      if (currentTaskIndex !== -1) {
        currentTask = taskSequence[currentTaskIndex];
        nextTasks = taskSequence.slice(currentTaskIndex + 1).filter(t => t.status !== 'Completed');
        previousTasks = taskSequence.slice(0, currentTaskIndex).filter(t => t.status === 'Completed');
      }
    }

    // Calculate completion stats
    const totalTasks = allTasks.length;
    const completedTasks = allTasks.filter(t => t.fields.task_status === 'Completed').length;
    const isAllTasksCompleted = totalTasks > 0 && completedTasks === totalTasks;

    return {
      projectType: project.fields['Project Type'],
      projectStatus: project.fields['Status'],
      projectName: project.fields['Project Name'],
      totalTasks,
      completedTasks,
      isAllTasksCompleted,
      tasksByGroup: sortedGroups.map(group => ({
        groupId: group.id,
        groupName: group.fields.group_name,
        groupOrder: group.fields.group_order || 0,
        tasks: (tasksByGroup[group.id] || []).map(t => ({
          taskId: t.id,
          taskTitle: t.fields.task_title,
          taskOrder: t.fields.order || 0,
          status: t.fields.task_status,
          actionType: t.fields.Action_type
        }))
      })),
      ungroupedTasks: ungroupedTasks.map(t => ({
        taskId: t.id,
        taskTitle: t.fields.task_title,
        taskOrder: t.fields.order || 0,
        status: t.fields.task_status,
        actionType: t.fields.Action_type
      })),
      taskSequence,
      currentTask,
      currentTaskIndex,
      nextTasks,
      previousTasks
    };
  } catch (error) {
    console.error('Error building client guidance context:', error);
    return null;
  }
};

