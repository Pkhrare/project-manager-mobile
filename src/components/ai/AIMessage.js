import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getMessageStyling, formatAIMetadata, renderMarkdownToHtml } from '../../utils/aiUtils';
import { WebView } from 'react-native-webview';

const AIMessage = ({ message, style = {} }) => {
    const styling = getMessageStyling(message, 'client', '');
    const metadata = message.metadata || {};

    const handleLinkPress = (url) => {
        Linking.openURL(url).catch(err => {
            console.error('Failed to open URL:', err);
            Alert.alert('Error', 'Could not open the link');
        });
    };

    return (
        <View style={[styles.container, style]}>
            <View style={styles.messageContainer}>
                <View style={styles.header}>
                    <View style={styles.avatarContainer}>
                        <Ionicons name="code-slash" size={20} color="white" />
                    </View>
                    <View>
                        <Text style={styles.name}>Waiverlyn</Text>
                        <Text style={styles.subtitle}>AI Assistant</Text>
                    </View>
                </View>
                
                {message.fields?.message_text && (
                    <View style={styles.contentContainer}>
                        <WebView
                            source={{ html: renderMarkdownToHtml(message.fields.message_text) }}
                            style={styles.webView}
                            scrollEnabled={false}
                            showsVerticalScrollIndicator={false}
                            showsHorizontalScrollIndicator={false}
                            onShouldStartLoadWithRequest={(request) => {
                                if (request.url.startsWith('http')) {
                                    handleLinkPress(request.url);
                                    return false;
                                }
                                return true;
                            }}
                        />
                    </View>
                )}
                
                {/* AI-specific metadata */}
                {message.fields?.is_ai && metadata.contextUsed && (
                    <View style={styles.metadataContainer}>
                        <Ionicons name="information-circle" size={16} color="#7C3AED" />
                        <Text style={styles.metadataText}>
                            {formatAIMetadata(metadata)}
                        </Text>
                    </View>
                )}
                
                {/* Attachment handling for AI messages */}
                {(message.fields?.attachmentUrl || message.fields?.attachment_url) && (
                    <View style={styles.attachmentContainer}>
                        {message.fields.attachmentType?.startsWith('image/') ? (
                            <TouchableOpacity style={styles.imageAttachment}>
                                <Text style={styles.attachmentText}>
                                    📷 Image Attachment
                                </Text>
                            </TouchableOpacity>
                        ) : (
                            <TouchableOpacity 
                                style={styles.fileAttachment}
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
                
                <Text style={styles.timestamp}>
                    {new Date(message.createdTime).toLocaleTimeString([], { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                    })}
                </Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        alignItems: 'flex-start',
        marginVertical: 4,
    },
    messageContainer: {
        backgroundColor: '#F3E8FF',
        borderColor: '#C084FC',
        borderWidth: 1,
        borderRadius: 16,
        padding: 16,
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
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        gap: 12,
    },
    avatarContainer: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#7C3AED',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 1,
        },
        shadowOpacity: 0.2,
        shadowRadius: 2,
        elevation: 2,
    },
    name: {
        fontSize: 14,
        fontWeight: '600',
        color: '#6B21A8',
    },
    subtitle: {
        fontSize: 12,
        color: '#7C3AED',
    },
    contentContainer: {
        marginBottom: 12,
    },
    webView: {
        height: 100, // Fixed height for WebView
        backgroundColor: 'transparent',
    },
    metadataContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F3E8FF',
        borderColor: '#C084FC',
        borderWidth: 1,
        borderRadius: 8,
        padding: 8,
        marginBottom: 12,
        gap: 6,
    },
    metadataText: {
        fontSize: 12,
        fontWeight: '500',
        color: '#7C3AED',
        flex: 1,
    },
    attachmentContainer: {
        marginBottom: 12,
    },
    imageAttachment: {
        backgroundColor: '#E0E7FF',
        borderColor: '#C084FC',
        borderWidth: 1,
        borderRadius: 8,
        padding: 12,
        alignItems: 'center',
    },
    fileAttachment: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#7C3AED',
        borderRadius: 8,
        padding: 12,
        gap: 8,
    },
    attachmentText: {
        fontSize: 12,
        color: 'white',
        fontWeight: '500',
        flex: 1,
    },
    timestamp: {
        fontSize: 11,
        color: '#7C3AED',
        textAlign: 'right',
    },
});

export default AIMessage;
