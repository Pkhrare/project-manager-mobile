import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const TaskCard = ({ task, onPress, compact = false }) => {
  const [expanded, setExpanded] = useState(false);

  // Extract task fields
  const fields = task?.fields || {};
  const taskName = fields['Task Name'] || 'Untitled Task';
  const description = fields.Description || '';
  const status = fields.Status || 'Not Started';
  const dueDate = fields['Due Date'];
  const assignee = fields.Assignee || 'Unassigned';
  const priority = fields.Priority || 'Medium';
  const completed = fields.completed || false;

  // Status colors
  const getStatusColor = () => {
    if (completed) return '#10B981'; // Green
    switch (status) {
      case 'In Progress':
        return '#F59E0B'; // Amber
      case 'Blocked':
        return '#EF4444'; // Red
      case 'Review':
        return '#3B82F6'; // Blue
      default:
        return '#6B7280'; // Gray
    }
  };

  // Priority colors
  const getPriorityColor = () => {
    switch (priority) {
      case 'High':
        return '#EF4444'; // Red
      case 'Medium':
        return '#F59E0B'; // Amber
      case 'Low':
        return '#10B981'; // Green
      default:
        return '#6B7280'; // Gray
    }
  };

  const handlePress = () => {
    if (compact) {
      setExpanded(!expanded);
    }
    if (onPress) {
      onPress(task);
    }
  };

  if (compact && !expanded) {
    // Compact view for list
    return (
      <TouchableOpacity
        style={[styles.card, styles.compactCard]}
        onPress={handlePress}
        activeOpacity={0.7}
      >
        <View style={styles.compactHeader}>
          <View style={styles.compactLeft}>
            <View style={[styles.statusDot, { backgroundColor: getStatusColor() }]} />
            <Text style={styles.compactTitle} numberOfLines={1}>
              {taskName}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#6B7280" />
        </View>
        
        <View style={styles.compactMeta}>
          {dueDate && (
            <View style={styles.metaBadge}>
              <Ionicons name="calendar-outline" size={12} color="#6B7280" />
              <Text style={styles.metaText}>{new Date(dueDate).toLocaleDateString()}</Text>
            </View>
          )}
          <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor() + '20' }]}>
            <Text style={[styles.priorityText, { color: getPriorityColor() }]}>
              {priority}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  // Expanded/Full view
  return (
    <TouchableOpacity
      style={[styles.card, expanded && styles.expandedCard]}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            style={[styles.checkbox, completed && styles.checkboxCompleted]}
            onPress={(e) => {
              e.stopPropagation();
              // TODO: Handle task completion toggle
            }}
          >
            {completed && <Ionicons name="checkmark" size={16} color="#FFF" />}
          </TouchableOpacity>
          <Text style={[styles.title, completed && styles.completedTitle]}>
            {taskName}
          </Text>
        </View>
        {compact && (
          <Ionicons
            name={expanded ? "chevron-up" : "chevron-down"}
            size={20}
            color="#6B7280"
          />
        )}
      </View>

      {/* Status and Priority */}
      <View style={styles.badges}>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor() + '20' }]}>
          <View style={[styles.statusDot, { backgroundColor: getStatusColor() }]} />
          <Text style={[styles.statusText, { color: getStatusColor() }]}>
            {completed ? 'Completed' : status}
          </Text>
        </View>
        <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor() + '20' }]}>
          <Text style={[styles.priorityText, { color: getPriorityColor() }]}>
            {priority} Priority
          </Text>
        </View>
      </View>

      {/* Description */}
      {description && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Description</Text>
          <Text style={styles.description} numberOfLines={expanded ? undefined : 2}>
            {description}
          </Text>
        </View>
      )}

      {/* Meta Information */}
      <View style={styles.metaSection}>
        {assignee && (
          <View style={styles.metaItem}>
            <Ionicons name="person-outline" size={16} color="#6B7280" />
            <Text style={styles.metaLabel}>Assignee:</Text>
            <Text style={styles.metaValue}>{assignee}</Text>
          </View>
        )}
        {dueDate && (
          <View style={styles.metaItem}>
            <Ionicons name="calendar-outline" size={16} color="#6B7280" />
            <Text style={styles.metaLabel}>Due:</Text>
            <Text style={styles.metaValue}>{new Date(dueDate).toLocaleDateString()}</Text>
          </View>
        )}
      </View>

      {/* Expand hint for compact mode */}
      {compact && !expanded && (
        <Text style={styles.expandHint}>Tap to see more details</Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  compactCard: {
    padding: 12,
  },
  expandedCard: {
    borderColor: '#D4AF37',
  },
  compactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  compactLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  compactTitle: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  compactMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#2A2A2A',
    borderRadius: 6,
  },
  metaText: {
    color: '#9CA3AF',
    fontSize: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#D4AF37',
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxCompleted: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  title: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  completedTitle: {
    textDecorationLine: 'line-through',
    color: '#9CA3AF',
  },
  badges: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
  },
  priorityBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  priorityText: {
    fontSize: 13,
    fontWeight: '600',
  },
  section: {
    marginBottom: 12,
  },
  sectionLabel: {
    color: '#D4AF37',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  description: {
    color: '#D1D5DB',
    fontSize: 14,
    lineHeight: 20,
  },
  metaSection: {
    gap: 8,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaLabel: {
    color: '#9CA3AF',
    fontSize: 13,
  },
  metaValue: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '500',
  },
  expandHint: {
    color: '#6B7280',
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 8,
    textAlign: 'center',
  },
});

export default TaskCard;

