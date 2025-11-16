import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { about_task_group } from '../../utils/AboutContent';
import AboutUsCard from './AboutUsCard';

const AboutUsSection = () => {
    const [selectedTask, setSelectedTask] = useState(null);
    const [isCardVisible, setIsCardVisible] = useState(false);

    const handleTaskClick = (task) => {
        setSelectedTask(task);
        setIsCardVisible(true);
    };

    const handleCloseCard = () => {
        setIsCardVisible(false);
        setSelectedTask(null);
    };

    return (
        <View style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>ℹ️ About Waiver Consulting Group</Text>
            </View>
            <View style={styles.sectionContent}>
                {about_task_group?.tasks?.map((task, index) => (
                    <TouchableOpacity
                        key={task.id || index}
                        onPress={() => handleTaskClick(task)}
                        style={styles.taskItem}
                        activeOpacity={0.7}
                    >
                        <View style={styles.taskContent}>
                            <View style={styles.taskIconContainer}>
                                <Text style={styles.taskIcon}>ℹ️</Text>
                            </View>
                            <Text style={styles.taskTitle}>
                                {task.fields?.task_title || 'No title'}
                            </Text>
                        </View>
                        <Text style={styles.arrow}>›</Text>
                    </TouchableOpacity>
                ))}
            </View>

            {isCardVisible && selectedTask && (
                <AboutUsCard
                    task={selectedTask}
                    onClose={handleCloseCard}
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    sectionContainer: {
        backgroundColor: '#ffffff',
        marginBottom: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 1,
        },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    sectionHeader: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
        backgroundColor: '#e0f2fe', // Light blue background for the heading
        borderTopLeftRadius: 12,
        borderTopRightRadius: 12,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#1f2937',
    },
    sectionContent: {
        paddingVertical: 8,
    },
    taskItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f8fafc',
    },
    taskContent: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    taskIconContainer: {
        width: 32,
        height: 32,
        backgroundColor: '#e2e8f0',
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    taskIcon: {
        fontSize: 16,
    },
    taskTitle: {
        fontSize: 16,
        fontWeight: '500',
        color: '#374151',
        flex: 1,
    },
    arrow: {
        fontSize: 20,
        color: '#9ca3af',
        fontWeight: 'bold',
    },
});

export default AboutUsSection;
