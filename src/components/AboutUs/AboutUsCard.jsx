import React, { useRef, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';

const AboutUsCard = ({ task, onClose }) => {
    const [isContentLoading, setIsContentLoading] = useState(true);
    const [descriptionContent, setDescriptionContent] = useState(null);

    useEffect(() => {
        // Initialize the description content
        const initializeDescription = async () => {
            if (task.fields.description) {
                try {
                    // Parse the JSON string if it's a string, otherwise use as is
                    const content = typeof task.fields.description === 'string' 
                        ? JSON.parse(task.fields.description)
                        : task.fields.description;
                    
                    setDescriptionContent(content);
                } catch (error) {
                    console.error('Error parsing description:', error);
                    setDescriptionContent(null);
                }
            } else {
                setDescriptionContent(null);
            }
            
            // Wait a bit to ensure content is properly initialized
            setTimeout(() => {
                setIsContentLoading(false);
            }, 100);
        };
        
        initializeDescription();
    }, [task]);

    // Convert Lexical JSON to HTML for WebView display
    const convertLexicalToHTML = (lexicalContent) => {
        if (!lexicalContent || !lexicalContent.root) {
            return '<p>No content available</p>';
        }

        const convertNode = (node) => {
            if (!node) return '';

            switch (node.type) {
                case 'root':
                    return node.children ? node.children.map(convertNode).join('') : '';
                
                case 'paragraph':
                    return `<p>${node.children ? node.children.map(convertNode).join('') : ''}</p>`;
                
                case 'heading':
                    const tag = node.tag || 'h3';
                    return `<${tag}>${node.children ? node.children.map(convertNode).join('') : ''}</${tag}>`;
                
                case 'text':
                    let text = node.text || '';
                    if (node.format & 1) text = `<strong>${text}</strong>`; // Bold
                    if (node.format & 2) text = `<em>${text}</em>`; // Italic
                    if (node.format & 8) text = `<u>${text}</u>`; // Underline
                    return text;
                
                case 'linebreak':
                    return '<br>';
                
                case 'image':
                    return `<img src="${node.src}" alt="${node.altText || ''}" style="max-width: 100%; height: auto;" />`;
                
                case 'youtube':
                    return `<iframe width="100%" height="200" src="${node.src}" frameborder="0" allowfullscreen></iframe>`;
                
                default:
                    return node.children ? node.children.map(convertNode).join('') : '';
            }
        };

        const htmlContent = convertNode(lexicalContent.root);
        
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                        margin: 0;
                        padding: 12px;
                        line-height: 1.6;
                        color: #333;
                    }
                    h3, h4 {
                        color: #1f2937;
                        margin-top: 20px;
                        margin-bottom: 10px;
                    }
                    p {
                        margin-bottom: 12px;
                    }
                    img {
                        max-width: 100%;
                        height: auto;
                        border-radius: 8px;
                        margin: 10px 0;
                    }
                    iframe {
                        border-radius: 8px;
                        margin: 10px 0;
                    }
                    strong {
                        font-weight: 600;
                    }
                </style>
            </head>
            <body>
                ${htmlContent}
            </body>
            </html>
        `;
    };

    if (!task) return null;

    // Loading screen
    if (isContentLoading) {
        return (
            <Modal visible={true} animationType="slide" presentationStyle="pageSheet">
                <View style={styles.container}>
                    <View style={styles.header}>
                        <View style={styles.headerContent}>
                            <View style={styles.iconContainer}>
                                <Text style={styles.icon}>ℹ️</Text>
                            </View>
                            <Text style={styles.headerTitle}>Loading...</Text>
                        </View>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <Text style={styles.closeButtonText}>✕</Text>
                        </TouchableOpacity>
                    </View>
                    <View style={styles.loadingContent}>
                        <ActivityIndicator size="large" color="#3b82f6" />
                        <Text style={styles.loadingText}>Loading content...</Text>
                    </View>
                </View>
            </Modal>
        );
    }

    return (
        <Modal visible={true} animationType="slide" presentationStyle="pageSheet">
            <View style={styles.container}>
                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.headerContent}>
                        <View style={styles.iconContainer}>
                            <Text style={styles.icon}>ℹ️</Text>
                        </View>
                        <Text style={styles.headerTitle}>{task.fields.task_title}</Text>
                    </View>
                    <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                        <Text style={styles.closeButtonText}>✕</Text>
                    </TouchableOpacity>
                </View>

                {/* Content */}
                <View style={styles.content}>
                    <View style={styles.contentContainer}>
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>Content</Text>
                        </View>
                        
                        <View style={styles.webViewContainer}>
                            <WebView
                                source={{ html: convertLexicalToHTML(descriptionContent) }}
                                style={styles.webView}
                                showsVerticalScrollIndicator={true}
                                showsHorizontalScrollIndicator={false}
                                javaScriptEnabled={true}
                                domStorageEnabled={true}
                                startInLoadingState={true}
                                renderLoading={() => (
                                    <View style={styles.webViewLoading}>
                                        <ActivityIndicator size="small" color="#3b82f6" />
                                    </View>
                                )}
                            />
                        </View>
                    </View>
                </View>

                {/* Footer */}
                <View style={styles.footer}>
                    <TouchableOpacity onPress={onClose} style={styles.closeButtonFooter}>
                        <Text style={styles.closeButtonTextFooter}>Close</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#ffffff',
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
    },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    iconContainer: {
        width: 32,
        height: 32,
        backgroundColor: '#f1f5f9',
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    icon: {
        fontSize: 16,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1f2937',
        flex: 1,
    },
    closeButton: {
        width: 32,
        height: 32,
        justifyContent: 'center',
        alignItems: 'center',
    },
    closeButtonText: {
        fontSize: 18,
        color: '#6b7280',
        fontWeight: 'bold',
    },
    content: {
        flex: 1,
    },
    contentContainer: {
        flex: 1,
        padding: 12,
    },
    sectionHeader: {
        marginBottom: 12,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1f2937',
    },
    webViewContainer: {
        flex: 1,
        backgroundColor: '#ffffff',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        overflow: 'hidden',
    },
    webView: {
        flex: 1,
        backgroundColor: '#ffffff',
    },
    webViewLoading: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#ffffff',
    },
    footer: {
        padding: 12,
        backgroundColor: '#ffffff',
        borderTopWidth: 1,
        borderTopColor: '#e2e8f0',
    },
    closeButtonFooter: {
        backgroundColor: '#6b7280',
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 8,
        alignItems: 'center',
    },
    closeButtonTextFooter: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '600',
    },
    loadingContent: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
        color: '#6b7280',
    },
});

export default AboutUsCard;
