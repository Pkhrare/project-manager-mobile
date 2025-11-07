// ===================================
// CONTENT UTILITIES FOR MOBILE APP
// ===================================

import ApiCaller from '../api/apiCaller';

/**
 * Load content from attachment or fallback to old field
 * @param {string} tableName - The Airtable table name
 * @param {string} recordId - The record ID
 * @param {string} fieldName - The field name (Notes, description, pageContent)
 * @returns {Promise<string|null>} - The content as string or null
 */
export const loadContent = async (tableName, recordId, fieldName) => {
    try {
        console.log(`[Mobile] Loading content for ${tableName}.${fieldName}, record: ${recordId}`);
        
        const response = await ApiCaller(`/get-content-hybrid/${tableName}/${recordId}/${fieldName}`);
        
        if (response.content) {
            console.log(`[Mobile] Content loaded from ${response.source} for ${tableName}.${fieldName}`);
            
            // Handle double-encoded or triple-encoded content
            let content = response.content;
            console.log('[Mobile] Raw content from API:', content.substring(0, 100) + '...');
            
            // Try to decode multiple times if needed
            let decodingAttempts = 0;
            const maxDecodingAttempts = 3; // Prevent infinite loops
            
            while (decodingAttempts < maxDecodingAttempts && 
                   typeof content === 'string' && 
                   content.startsWith('"') && 
                   content.endsWith('"') && 
                   (content.includes('\\"') || content.includes('\\\\"'))) {
                try {
                    const oldContent = content;
                    content = JSON.parse(content);
                    decodingAttempts++;
                    console.log(`[Mobile] Decoded content (attempt ${decodingAttempts}):`, content.substring(0, 100) + '...');
                    
                    // If parsing didn't change the content, break to avoid infinite loop
                    if (oldContent === content) {
                        console.warn('[Mobile] Parsing did not change content, stopping decoding attempts');
                        break;
                    }
                } catch (parseError) {
                    console.warn(`[Mobile] Failed to parse encoded content (attempt ${decodingAttempts}):`, parseError);
                    break;
                }
            }
            
            console.log(`[Mobile] Content after ${decodingAttempts} decoding attempts:`, content.substring(0, 100) + '...');
            
            return content;
        }
        
        console.log(`[Mobile] No content found for ${tableName}.${fieldName}, record: ${recordId}`);
        return null;
        
    } catch (error) {
        console.error(`[Mobile] Failed to load content for ${tableName}.${fieldName}:`, error);
        return null;
    }
};

/**
 * Detect content type (rich-text, code, or plain text)
 * @param {string} content - The content to analyze
 * @returns {string} - 'rich-text', 'code', or 'plain-text'
 */
export const detectContentType = (content) => {
    if (!content) return 'plain-text';
    
    // Make sure content is a string before calling trim()
    const contentStr = typeof content === 'string' ? content : JSON.stringify(content);
    const trimmed = contentStr.trim();
    
    // Check if it's wrapped in our code wrapper
    if (trimmed.includes('code-content')) {
        return 'code';
    }
    // Check if it starts with a JSON-like structure (Lexical)
    if (trimmed.startsWith('{') && trimmed.includes('"root"')) {
        return 'rich-text';
    }
    // Check if it starts with HTML tags
    if (trimmed.startsWith('<')) {
        return 'code';
    }
    // Default to plain text
    return 'plain-text';
};

/**
 * Convert plain text to basic Lexical format
 * @param {string} text - Plain text content
 * @returns {string} - Lexical JSON string
 */
export const convertToLexical = (text) => {
    if (!text) return null;
    
    const basicLexicalContent = {
        root: {
            children: [{
                children: [{
                    detail: 0,
                    format: 0,
                    mode: "normal",
                    style: "",
                    text: text,
                    type: "text",
                    version: 1
                }],
                direction: "ltr",
                format: "",
                indent: 0,
                type: "paragraph",
                version: 1
            }],
            direction: "ltr",
            format: "",
            indent: 0,
            type: "root",
            version: 1
        }
    };
    
    return JSON.stringify(basicLexicalContent);
};

/**
 * Extract plain text from Lexical JSON
 * @param {string} lexicalJson - Lexical JSON string
 * @returns {string} - Plain text content
 */
export const extractTextFromLexical = (lexicalJson) => {
    try {
        const parsed = JSON.parse(lexicalJson);
        const root = parsed.root || parsed;
        
        const extractText = (node) => {
            if (node.type === 'text') {
                return node.text || '';
            }
            
            if (node.children && Array.isArray(node.children)) {
                return node.children.map(extractText).join('');
            }
            
            return '';
        };
        
        return extractText(root);
    } catch (error) {
        console.warn('[Mobile] Failed to extract text from Lexical JSON:', error);
        return lexicalJson; // Return original if parsing fails
    }
};

/**
 * Save content as attachment (same as web app)
 * @param {string} tableName - The Airtable table name
 * @param {string} recordId - The record ID
 * @param {string} fieldName - The field name (Notes, description, pageContent)
 * @param {string|object} content - The content to save
 * @returns {Promise<boolean>} - Success status
 */
export const saveContent = async (tableName, recordId, fieldName, content) => {
    try {
        console.log(`[Mobile] Saving content for ${tableName}.${fieldName}, record: ${recordId}`);
        
        // Convert content to string if it's an object
        const contentString = typeof content === 'string' ? content : JSON.stringify(content);
        
        const response = await ApiCaller('/save-content-attachment', {
            method: 'POST',
            body: JSON.stringify({
                recordId,
                tableName,
                fieldName,
                content: contentString
            }),
        });
        
        if (response.url) {
            console.log(`[Mobile] Content saved successfully for ${tableName}.${fieldName}: ${response.url}`);
            return true;
        } else {
            console.error(`[Mobile] Failed to save content for ${tableName}.${fieldName}:`, response);
            return false;
        }
        
    } catch (error) {
        console.error(`[Mobile] Error saving content for ${tableName}.${fieldName}:`, error);
        return false;
    }
};

