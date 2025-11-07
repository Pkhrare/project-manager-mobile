import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Linking, 
  Alert, 
  Platform,
  Image,
  Dimensions,
  Modal
} from 'react-native';
import { WebView } from 'react-native-webview';
import { detectContentType, extractTextFromLexical } from '../utils/contentUtils';

/**
 * Rich Text Renderer for Mobile App
 * Handles Lexical JSON, HTML/Code, and plain text content
 */
export default function RichTextRenderer({ 
  content, 
  style, 
  isEditable = false, 
  onEdit = null,
  maxHeight = null 
}) {
  const [contentType, setContentType] = useState('plain-text');
  const [parsedContent, setParsedContent] = useState(null);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (content) {
      const type = detectContentType(content);
      setContentType(type);
      
      if (type === 'rich-text') {
        try {
          const parsed = JSON.parse(content);
          setParsedContent(parsed);
        } catch (error) {
          console.warn('[Mobile] Failed to parse Lexical JSON:', error);
          setContentType('plain-text');
          setParsedContent(null);
        }
      } else if (type === 'code') {
        setParsedContent(content);
      } else {
        setParsedContent(content);
      }
    } else {
      setContentType('plain-text');
      setParsedContent(null);
    }
  }, [content]);

  const handleLinkPress = (url) => {
    Linking.openURL(url).catch(err => {
      console.error('Failed to open URL:', err);
      Alert.alert('Error', 'Could not open the link');
    });
  };

  const [imageModalVisible, setImageModalVisible] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [youtubeModalVisible, setYoutubeModalVisible] = useState(false);
  const [selectedYoutubeUrl, setSelectedYoutubeUrl] = useState(null);

  // Get screen width safely
  const getScreenWidth = () => {
    try {
      return Dimensions.get('window').width;
    } catch (error) {
      return 375; // Fallback width
    }
  };
  
  const screenWidth = getScreenWidth();

  const renderLexicalNode = (node, depth = 0) => {
    if (!node) return null;

    const key = `${node.type}-${depth}-${Math.random()}`;

    switch (node.type) {
      case 'root':
        return (
          <View key={key} style={styles.lexicalRoot}>
            {node.children?.map((child, index) => renderLexicalNode(child, depth + 1))}
          </View>
        );

      case 'paragraph':
        return (
          <View key={key} style={[styles.paragraph, { marginBottom: depth > 0 ? 8 : 12 }]}>
            {node.children?.map((child, index) => renderLexicalNode(child, depth + 1))}
          </View>
        );

      case 'text':
        const textStyle = [];
        
        // Apply formatting
        if (node.format) {
          if (node.format & 1) textStyle.push(styles.bold); // Bold
          if (node.format & 2) textStyle.push(styles.italic); // Italic
          if (node.format & 8) textStyle.push(styles.underline); // Underline
        }
        
        // Apply styles
        if (node.style) {
          const fontSize = node.style.match(/font-size:\s*(\d+)px/);
          if (fontSize) {
            textStyle.push({ fontSize: parseInt(fontSize[1]) });
          }
        }

        return (
          <Text key={key} style={[styles.text, ...textStyle]} numberOfLines={0} ellipsizeMode="clip">
            {node.text || ''}
          </Text>
        );

      case 'link':
        return (
          <TouchableOpacity 
            key={key} 
            onPress={() => handleLinkPress(node.url)}
            style={styles.linkContainer}
          >
            <Text style={styles.link}>
              {node.children?.map((child, index) => renderLexicalNode(child, depth + 1))}
            </Text>
          </TouchableOpacity>
        );

      case 'list':
        const listStyle = node.listType === 'bullet' ? styles.unorderedList : styles.orderedList;
        return (
          <View key={key} style={[styles.list, listStyle]}>
            {node.children?.map((child, index) => renderLexicalNode(child, depth + 1))}
          </View>
        );

      case 'listitem':
        // Determine if this is a numbered list item
        const isNumberedList = node.parent?.listType === 'number';
        const listNumber = isNumberedList ? `${node.value || 1}. ` : '• ';
        
        return (
          <View key={key} style={styles.listItem}>
            <Text style={styles.listBullet}>{listNumber}</Text>
            <View style={styles.listItemContent}>
              {node.children?.map((child, index) => renderLexicalNode(child, depth + 1))}
            </View>
          </View>
        );

      case 'heading':
        const headingStyle = styles[`heading${node.tag?.replace('h', '') || '1'}`] || styles.heading1;
        return (
          <Text key={key} style={[headingStyle, { marginBottom: 8 }]}>
            {node.children?.map((child, index) => renderLexicalNode(child, depth + 1))}
          </Text>
        );

      case 'quote':
        return (
          <View key={key} style={styles.quote}>
            <Text style={styles.quoteText}>
              {node.children?.map((child, index) => renderLexicalNode(child, depth + 1))}
            </Text>
          </View>
        );

      // Handle custom nodes from the web app
        case 'image':
          return (
            <View key={key} style={styles.imageContainer}>
              <TouchableOpacity 
                onPress={() => {
                  setSelectedImage(node.src);
                  setImageModalVisible(true);
                }}
                style={styles.imageTouchable}
              >
                <Image 
                  source={{ uri: node.src }} 
                  style={[styles.image, { maxWidth: screenWidth - 32 }]}
                  resizeMode="contain"
                />
              </TouchableOpacity>
              {node.alt && (
                <Text style={styles.imageCaption}>{node.alt}</Text>
              )}
            </View>
          );

      case 'youtube':
        return (
          <View key={key} style={styles.youtubeContainer}>
            <TouchableOpacity 
              onPress={() => {
                setSelectedYoutubeUrl(node.src);
                setYoutubeModalVisible(true);
              }}
              style={styles.youtubeTouchable}
            >
              <View style={[styles.youtubeThumbnail, { maxWidth: screenWidth - 32 }]}>
                <View style={styles.youtubePlayButton}>
                  <Text style={styles.youtubePlayIcon}>▶</Text>
                </View>
                <Text style={styles.youtubeText}>YouTube Video</Text>
              </View>
            </TouchableOpacity>
          </View>
        );

        case 'table':
          // Calculate consistent column widths based on content
          const calculateColumnWidths = (tableNode) => {
            const columnWidths = [];
            const maxColumns = Math.max(...tableNode.children.map(row => row.children?.length || 0));
            
            for (let colIndex = 0; colIndex < maxColumns; colIndex++) {
              let maxContentLength = 0;
              
              tableNode.children.forEach(row => {
                const cell = row.children?.[colIndex];
                if (cell) {
                  // Calculate content length for this cell
                  const contentLength = calculateCellContentLength(cell);
                  maxContentLength = Math.max(maxContentLength, contentLength);
                }
              });
              
              // Convert content length to pixel width with some padding
              const baseWidth = Math.max(maxContentLength * 8, 120); // 8px per character, minimum 120px
              const maxWidth = screenWidth * 0.45; // Maximum 45% of screen width
              columnWidths[colIndex] = Math.min(baseWidth, maxWidth);
            }
            
            return columnWidths;
          };
          
          const calculateCellContentLength = (cell) => {
            let length = 0;
            if (cell.children) {
              cell.children.forEach(child => {
                if (child.type === 'text') {
                  length += (child.text || '').length;
                } else if (child.type === 'list') {
                  child.children?.forEach(listItem => {
                    listItem.children?.forEach(itemChild => {
                      if (itemChild.type === 'text') {
                        length += (itemChild.text || '').length;
                      }
                    });
                  });
                }
              });
            }
            return length;
          };
          
          const columnWidths = calculateColumnWidths(node);
          
          return (
            <ScrollView 
              key={key} 
              horizontal 
              showsHorizontalScrollIndicator={true}
              style={styles.tableContainer}
            >
              <View style={styles.table}>
                {node.children?.map((row, rowIndex) => (
                  <View key={rowIndex} style={styles.tableRow}>
                    {row.children?.map((cell, cellIndex) => {
                      const cellWidth = columnWidths[cellIndex] || 150; // Fallback width
                      
                      return (
                        <View 
                          key={cellIndex} 
                          style={[
                            styles.tableCell,
                            rowIndex === 0 && styles.tableHeader,
                            { width: cellWidth }
                          ]}
                        >
                          <View style={styles.tableCellContent}>
                            {cell.children?.map((child, childIndex) => 
                              renderLexicalNode(child, depth + 1)
                            )}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                ))}
              </View>
            </ScrollView>
          );

      case 'tableRow':
        // This is handled in the table case above
        return null;

      case 'tableCell':
        // This is handled in the table case above
        return null;

      default:
        // For unknown node types, try to render children
        if (node.children) {
          return (
            <View key={key}>
              {node.children.map((child, index) => renderLexicalNode(child, depth + 1))}
            </View>
          );
        }
        return null;
    }
  };

  const renderCodeContent = (codeContent) => {
    // Simple code rendering - could be enhanced with syntax highlighting
    return (
      <View style={styles.codeContainer}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={true}
          style={styles.codeScrollView}
        >
          <Text style={styles.codeText} selectable>
            {codeContent}
          </Text>
        </ScrollView>
      </View>
    );
  };

  const renderPlainText = (text) => {
    // Handle line breaks and basic formatting
    const lines = text.split('\n');
    return (
      <View>
        {lines.map((line, index) => (
          <Text key={index} style={[styles.text, { marginBottom: index < lines.length - 1 ? 4 : 0 }]}>
            {line}
          </Text>
        ))}
      </View>
    );
  };

  const renderContent = () => {
    if (!parsedContent) {
      return (
        <Text style={[styles.text, styles.placeholder]}>
          No content available
        </Text>
      );
    }

    switch (contentType) {
      case 'rich-text':
        return renderLexicalNode(parsedContent.root || parsedContent);
      
      case 'code':
        return renderCodeContent(parsedContent);
      
      case 'plain-text':
      default:
        return renderPlainText(parsedContent);
    }
  };

  const shouldShowExpandButton = maxHeight && contentType === 'code' && parsedContent && parsedContent.length > 500;

  return (
    <View style={[styles.container, style]}>
      {isEditable && onEdit && (
        <TouchableOpacity style={styles.editButton} onPress={onEdit}>
          <Text style={styles.editButtonText}>Edit</Text>
        </TouchableOpacity>
      )}
      
      <ScrollView 
        style={[styles.scrollView, maxHeight && !isExpanded && { maxHeight }]}
        showsVerticalScrollIndicator={true}
        nestedScrollEnabled={true}
        contentContainerStyle={styles.scrollContent}
      >
        {renderContent()}
      </ScrollView>
      
      {shouldShowExpandButton && (
        <TouchableOpacity 
          style={styles.expandButton} 
          onPress={() => setIsExpanded(!isExpanded)}
        >
          <Text style={styles.expandButtonText}>
            {isExpanded ? 'Show Less' : 'Show More'}
          </Text>
        </TouchableOpacity>
      )}

      {/* Image Modal */}
      <Modal
        visible={imageModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setImageModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity 
            style={styles.modalCloseArea}
            onPress={() => setImageModalVisible(false)}
          >
            <View style={styles.modalContent}>
              <TouchableOpacity 
                style={styles.modalCloseButton}
                onPress={() => setImageModalVisible(false)}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
              {selectedImage && (
                <Image 
                  source={{ uri: selectedImage }} 
                  style={styles.modalImage}
                  resizeMode="contain"
                />
              )}
            </View>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* YouTube Modal */}
      <Modal
        visible={youtubeModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setYoutubeModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.youtubeModalContent}>
            <TouchableOpacity 
              style={styles.modalCloseButton}
              onPress={() => setYoutubeModalVisible(false)}
            >
              <Text style={styles.modalCloseText}>✕</Text>
            </TouchableOpacity>
            {selectedYoutubeUrl && (
              <WebView
                source={{ uri: selectedYoutubeUrl }}
                style={styles.youtubeWebView}
                allowsFullscreenVideo={true}
                mediaPlaybackRequiresUserAction={false}
              />
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  editButton: {
    alignSelf: 'flex-end',
    backgroundColor: '#3B82F6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginBottom: 8,
  },
  editButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  expandButton: {
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#F3F4F6',
    borderRadius: 6,
    marginTop: 8,
  },
  expandButtonText: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '500',
  },
  
  // Lexical styles
  lexicalRoot: {
    flex: 1,
  },
  paragraph: {
    marginBottom: 8,
  },
  text: {
    fontSize: 14,
    lineHeight: 20,
    color: '#374151',
  },
  bold: {
    fontWeight: 'bold',
  },
  italic: {
    fontStyle: 'italic',
  },
  underline: {
    textDecorationLine: 'underline',
  },
  linkContainer: {
    marginVertical: 2,
  },
  link: {
    color: '#3B82F6',
    textDecorationLine: 'underline',
  },
  
  // List styles
  list: {
    marginVertical: 4,
  },
  unorderedList: {
    paddingLeft: 16,
  },
  orderedList: {
    paddingLeft: 16,
  },
  listItem: {
    flexDirection: 'row',
    marginBottom: 4,
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    width: '100%',
  },
  listBullet: {
    fontSize: 14,
    color: '#6B7280',
    marginRight: 8,
    minWidth: 20,
    lineHeight: 20,
  },
  listItemContent: {
    flex: 1,
    flexWrap: 'wrap',
    width: '100%',
  },
  
  // Heading styles
  heading1: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 12,
  },
  heading2: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 10,
  },
  heading3: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
  },
  heading4: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 6,
  },
  heading5: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  heading6: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  
  // Quote styles
  quote: {
    borderLeftWidth: 4,
    borderLeftColor: '#D1D5DB',
    paddingLeft: 16,
    marginVertical: 8,
    backgroundColor: '#F9FAFB',
    paddingVertical: 8,
    paddingRight: 12,
  },
  quoteText: {
    fontSize: 14,
    fontStyle: 'italic',
    color: '#6B7280',
  },
  
  // Code styles
  codeContainer: {
    backgroundColor: '#F3F4F6',
    borderRadius: 6,
    padding: 12,
    marginVertical: 8,
  },
  codeScrollView: {
    maxHeight: 200,
  },
  codeText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 12,
    color: '#374151',
    lineHeight: 16,
  },
  
  // Placeholder
  placeholder: {
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
  
  // Image styles
  imageContainer: {
    marginVertical: 12,
    alignItems: 'center',
    width: '100%',
  },
  imageTouchable: {
    width: '100%',
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  imageCaption: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
  
  // YouTube styles
  youtubeContainer: {
    marginVertical: 12,
    alignItems: 'center',
    width: '100%',
  },
  youtubeTouchable: {
    width: '100%',
    alignItems: 'center',
  },
  youtubeThumbnail: {
    width: '100%',
    height: 200,
    backgroundColor: '#000',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  youtubePlayButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  youtubePlayIcon: {
    fontSize: 24,
    color: '#FF0000',
    marginLeft: 4,
  },
  youtubeText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  
  // Table styles
  tableContainer: {
    marginVertical: 12,
  },
  table: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    overflow: 'hidden',
    minWidth: '100%',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#D1D5DB',
    minHeight: 60,
    alignItems: 'stretch',
  },
  tableCell: {
    padding: 12,
    borderRightWidth: 1,
    borderRightColor: '#D1D5DB',
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    minHeight: 60,
    flex: 1,
    overflow: 'hidden',
  },
  tableCellContent: {
    flex: 1,
    width: '100%',
    flexWrap: 'wrap',
    overflow: 'hidden',
  },
  tableHeader: {
    backgroundColor: '#F9FAFB',
  },
  tableCellText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
    textAlign: 'left',
    flexWrap: 'wrap',
  },
  tableHeaderText: {
    fontWeight: '600',
    color: '#1F2937',
  },
  
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    height: '80%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    position: 'relative',
  },
  modalCloseArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  modalCloseText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalImage: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  
  // YouTube Modal styles
  youtubeModalContent: {
    width: '95%',
    height: '70%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    position: 'relative',
  },
  youtubeWebView: {
    flex: 1,
    borderRadius: 8,
    marginTop: 16,
  },
});
