import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getMessageStyling } from '../../utils/aiUtils';

const MessageBubble = ({ message, userRole, projectName, style = {} }) => {
    const styling = getMessageStyling(message, userRole, projectName);
    const isMyMessage = styling.alignment === 'flex-end';

    const handleLinkPress = (url) => {
        Linking.openURL(url).catch(err => {
            console.error('Failed to open URL:', err);
            Alert.alert('Error', 'Could not open the link');
        });
    };

    const formatTime = (timestamp) => {
        return new Date(timestamp).toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    };

    return (
        <View style={[styles.container, { alignItems: styling.alignment }, style]}>
            <View style={[
                styles.messageContainer,
                { backgroundColor: styling.backgroundColor },
                { borderColor: styling.borderColor },
                isMyMessage && styles.myMessage
            ]}>
                <View style={styles.header}>
                    <View style={[
                        styles.avatarContainer,
                        { backgroundColor: isMyMessage ? '#3B82F6' : '#6B7280' }
                    ]}>
                        <Text style={styles.avatarText}>
                            {styling.label === 'Client' ? 'U' : 'C'}
                        </Text>
                    </View>
                    <Text style={[
                        styles.senderName,
                        { color: styling.textColor }
                    ]}>
                        {styling.label}
                    </Text>
                </View>
                
                {message.fields?.message_text && (
                    <Text style={[
                        styles.messageText,
                        { color: styling.textColor }
                    ]}>
                        {message.fields.message_text}
                    </Text>
                )}
                
                {/* Attachment handling */}
                {(message.fields?.attachmentUrl || message.fields?.attachment_url) && (
                    <View style={styles.attachmentContainer}>
                        {message.fields.attachmentType?.startsWith('image/') ? (
                            <TouchableOpacity style={styles.imageAttachment}>
                                <Text style={[
                                    styles.attachmentText,
                                    { color: styling.textColor }
                                ]}>
                                    📷 Image Attachment
                                </Text>
                            </TouchableOpacity>
                        ) : (
                            <TouchableOpacity 
                                style={[
                                    styles.fileAttachment,
                                    { backgroundColor: isMyMessage ? '#2563EB' : '#4B5563' }
                                ]}
                                onPress={() => handleLinkPress(
                                    message.fields.attachmentUrl || message.fields.attachment_url
                                )}
                            >
                                <Ionicons name="document" size={16} color="white" />
                                <Text style={styles.attachmentText}>
                                    {message.fields.attachmentName || message.fields.attachment_name || "Download"}
                                </Text>
                            </TouchableOpacity>
                        )}
                    </View>
                )}
                
                <View style={styles.footer}>
                    <Text style={[
                        styles.timestamp,
                        { color: styling.textColor, opacity: 0.7 }
                    ]}>
                        {formatTime(message.createdTime)}
                    </Text>
                    {isMyMessage && (
                        <View style={styles.readReceipt}>
                            <Ionicons 
                                name={message.fields?.is_read ? "checkmark-done" : "checkmark"} 
                                size={12} 
                                color={message.fields?.is_read ? "#3B82F6" : "#9CA3AF"} 
                            />
                        </View>
                    )}
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginVertical: 4,
        paddingHorizontal: 16,
    },
    messageContainer: {
        borderWidth: 1,
        borderRadius: 16,
        padding: 12,
        maxWidth: '85%',
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 1,
        },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    myMessage: {
        borderBottomRightRadius: 4,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
        gap: 8,
    },
    avatarContainer: {
        width: 24,
        height: 24,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarText: {
        fontSize: 12,
        fontWeight: 'bold',
        color: 'white',
    },
    senderName: {
        fontSize: 14,
        fontWeight: '600',
    },
    messageText: {
        fontSize: 14,
        lineHeight: 20,
        marginBottom: 8,
    },
    attachmentContainer: {
        marginBottom: 8,
    },
    imageAttachment: {
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)',
        borderRadius: 8,
        padding: 12,
        alignItems: 'center',
    },
    fileAttachment: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 8,
        padding: 12,
        gap: 8,
    },
    attachmentText: {
        fontSize: 12,
        fontWeight: '500',
        flex: 1,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    timestamp: {
        fontSize: 11,
    },
    readReceipt: {
        marginLeft: 4,
    },
});

export default MessageBubble;
