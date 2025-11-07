import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const AIDropdown = ({ isAIMode, onToggle, disabled = false, style = {} }) => {
    const [isOpen, setIsOpen] = useState(false);

    const handleOptionClick = (aiMode) => {
        onToggle(aiMode);
        setIsOpen(false);
    };

    return (
        <View style={[styles.container, style]}>
            <TouchableOpacity
                onPress={() => setIsOpen(!isOpen)}
                disabled={disabled}
                style={[
                    styles.button,
                    isAIMode ? styles.aiButton : styles.consultantButton,
                    disabled && styles.disabledButton
                ]}
            >
                <View style={[styles.indicator, isAIMode ? styles.aiIndicator : styles.consultantIndicator]} />
                <Text style={[styles.buttonText, isAIMode ? styles.aiText : styles.consultantText]}>
                    {isAIMode ? 'Waiverlyn' : 'Consultant'}
                </Text>
                <Ionicons 
                    name={isOpen ? 'chevron-up' : 'chevron-down'} 
                    size={16} 
                    color={isAIMode ? '#7C3AED' : '#3B82F6'} 
                />
            </TouchableOpacity>

            <Modal
                visible={isOpen}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setIsOpen(false)}
            >
                <TouchableOpacity 
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setIsOpen(false)}
                >
                    <View style={styles.dropdown}>
                        <TouchableOpacity
                            onPress={() => handleOptionClick(false)}
                            style={[
                                styles.option,
                                !isAIMode && styles.selectedOption
                            ]}
                        >
                            <View style={[styles.optionIndicator, styles.consultantIndicator]} />
                            <Text style={[
                                styles.optionText,
                                !isAIMode && styles.selectedOptionText
                            ]}>
                                Consultant
                            </Text>
                        </TouchableOpacity>
                        
                        <TouchableOpacity
                            onPress={() => handleOptionClick(true)}
                            style={[
                                styles.option,
                                isAIMode && styles.selectedOption
                            ]}
                        >
                            <View style={[styles.optionIndicator, styles.aiIndicator]} />
                            <Text style={[
                                styles.optionText,
                                isAIMode && styles.selectedOptionText
                            ]}>
                                Waiverlyn
                            </Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'relative',
    },
    button: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        borderWidth: 1,
        gap: 8,
    },
    aiButton: {
        backgroundColor: '#F3E8FF',
        borderColor: '#C084FC',
    },
    consultantButton: {
        backgroundColor: '#EFF6FF',
        borderColor: '#93C5FD',
    },
    disabledButton: {
        opacity: 0.5,
    },
    indicator: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    aiIndicator: {
        backgroundColor: '#7C3AED',
    },
    consultantIndicator: {
        backgroundColor: '#3B82F6',
    },
    buttonText: {
        fontSize: 14,
        fontWeight: '500',
    },
    aiText: {
        color: '#7C3AED',
    },
    consultantText: {
        color: '#3B82F6',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-start',
        alignItems: 'flex-start',
        paddingTop: 100,
        paddingLeft: 20,
    },
    dropdown: {
        backgroundColor: 'white',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
        minWidth: 160,
    },
    option: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 12,
        gap: 8,
    },
    selectedOption: {
        backgroundColor: '#F3F4F6',
    },
    optionIndicator: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    optionText: {
        fontSize: 14,
        color: '#374151',
    },
    selectedOptionText: {
        color: '#1F2937',
        fontWeight: '500',
    },
});

export default AIDropdown;
