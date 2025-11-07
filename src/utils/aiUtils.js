// AI utility functions for Waiverlyn integration - Mobile App

/**
 * Debounce function to prevent multiple rapid AI requests
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
export const debounce = (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
};

/**
 * Check if a message is from Waiverlyn AI
 * @param {Object} message - Message object
 * @returns {boolean} True if message is from AI
 */
export const isAIMessage = (message) => {
    return message.fields?.sender === 'Waiverlyn' || message.fields?.is_ai === true;
};

/**
 * Check if a message is from a consultant
 * @param {Object} message - Message object
 * @returns {boolean} True if message is from consultant
 */
export const isConsultantMessage = (message) => {
    return message.fields?.sender === 'Consultant';
};

/**
 * Check if a message is from a client
 * @param {Object} message - Message object
 * @param {string} projectName - Project name to check against
 * @returns {boolean} True if message is from client
 */
export const isClientMessage = (message, projectName) => {
    return message.fields?.sender === projectName;
};

/**
 * Get message styling based on sender type
 * @param {Object} message - Message object
 * @param {string} userRole - Current user role
 * @param {string} projectName - Project name
 * @returns {Object} Styling object with classes and alignment
 */
export const getMessageStyling = (message, userRole, projectName) => {
    const isAI = isAIMessage(message);
    const isConsultant = isConsultantMessage(message);
    const isClient = isClientMessage(message, projectName);
    

    if (isAI) {
        return {
            alignment: 'flex-start',
            backgroundColor: '#F3E8FF', // Purple background
            textColor: '#6B21A8', // Purple text
            borderColor: '#C084FC', // Purple border
            avatar: '🤖',
            label: 'Waiverlyn (AI)'
        };
    } else if (isConsultant) {
        const alignment = userRole === 'consultant' ? 'flex-end' : 'flex-start';
        const result = {
            alignment: alignment,
            backgroundColor: '#F1F5F9', // Slate background
            textColor: '#334155', // Slate text
            borderColor: '#CBD5E1', // Slate border
            avatar: '👨‍💼',
            label: userRole === 'consultant' ? 'You' : 'Consultant'
        };
        return result;
    } else if (isClient) {
        return {
            alignment: userRole === 'client' ? 'flex-end' : 'flex-start',
            backgroundColor: '#3B82F6', // Blue background
            textColor: '#FFFFFF', // White text
            borderColor: '#2563EB', // Blue border
            avatar: '👤',
            label: userRole === 'client' ? 'You' : 'Client'
        };
    }

    // Default styling
    return {
        alignment: 'flex-start',
        backgroundColor: '#F3F4F6', // Gray background
        textColor: '#374151', // Gray text
        borderColor: '#D1D5DB', // Gray border
        avatar: '❓',
        label: 'Unknown'
    };
};

/**
 * Format AI response metadata for display
 * @param {Object} metadata - Response metadata
 * @returns {string} Formatted metadata string
 */
export const formatAIMetadata = (metadata) => {
    if (!metadata || !metadata.contextUsed) return '';
    
    const contextInfo = [];
    if (metadata.contextUsed.includes('tasks')) {
        contextInfo.push('tasks');
    }
    if (metadata.contextUsed.includes('activities')) {
        contextInfo.push('activities');
    }
    if (metadata.contextUsed.includes('project')) {
        contextInfo.push('project data');
    }
    if (metadata.contextUsed.includes('recentMessages')) {
        contextInfo.push('conversation history');
    }

    return contextInfo.length > 0 ? `Using: ${contextInfo.join(', ')}` : '';
};

/**
 * Check if AI is currently typing
 * @param {boolean} isTyping - Typing state
 * @returns {boolean} True if AI is typing
 */
export const isAITyping = (isTyping) => {
    return isTyping === true;
};

/**
 * Generate a unique request ID for tracking AI requests
 * @returns {string} Unique request ID
 */
export const generateRequestId = () => {
    return `ai_req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Validate AI request parameters
 * @param {string} projectId - Project ID
 * @param {string} message - User message
 * @param {string} sender - Sender name
 * @returns {Object} Validation result with isValid and error message
 */
export const validateAIRequest = (projectId, message, sender) => {
    if (!projectId) {
        return { isValid: false, error: 'Project ID is required' };
    }
    if (!message || message.trim().length === 0) {
        return { isValid: false, error: 'Message cannot be empty' };
    }
    if (message.trim().length > 1000) {
        return { isValid: false, error: 'Message is too long (max 1000 characters)' };
    }
    if (!sender) {
        return { isValid: false, error: 'Sender is required' };
    }
    return { isValid: true, error: null };
};

/**
 * Create AI request payload
 * @param {string} projectId - Project ID
 * @param {string} message - User message
 * @param {string} sender - Sender name
 * @returns {Object} AI request payload
 */
export const createAIRequestPayload = (projectId, message, sender) => {
    return {
        projectId,
        message: message.trim(),
        sender,
        requestId: generateRequestId(),
        timestamp: new Date().toISOString()
    };
};

/**
 * Check if we should trigger AI response based on message content
 * @param {string} message - User message
 * @param {boolean} aiModeEnabled - Whether AI mode is enabled
 * @returns {boolean} True if AI should respond
 */
export const shouldTriggerAI = (message, aiModeEnabled) => {
    if (!aiModeEnabled) return false;
    
    const trimmedMessage = message.trim().toLowerCase();
    
    // Don't trigger AI for very short messages or commands
    if (trimmedMessage.length < 3) return false;
    
    // Don't trigger AI for file uploads only
    if (trimmedMessage === '' || trimmedMessage === 'file uploaded') return false;
    
    return true;
};

/**
 * Sanitize AI response text to ensure it's raw Lexical JSON.
 * - If it already starts with '{', return as-is (trimmed).
 * - Otherwise, strip leading markdown code fences and any text before the first '{'.
 * - Also strip a trailing code fence if present.
 * @param {string} responseText
 * @returns {string}
 */
export const sanitizeLexicalJsonString = (responseText) => {
    if (typeof responseText !== 'string') return responseText;

    let text = responseText.trim();

    // Fast path: already JSON-looking
    if (text.startsWith('{')) return text;

    // Remove leading markdown code fence, optionally with a language tag
    if (text.startsWith('```')) {
        // Remove first line starting fence
        text = text.replace(/^```[a-zA-Z0-9_-]*\s*/, '');
    }

    // Remove trailing code fence if present
    if (text.endsWith('```')) {
        text = text.replace(/\s*```\s*$/, '');
    }

    // Slice from the first '{' to the last '}' to isolate the JSON object
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        const sliced = text.slice(firstBrace, lastBrace + 1).trim();
        return sliced || text;
    }

    // Fallback: return trimmed text
    return text;
};

/**
 * Convert a minimal subset of Markdown to safe HTML for rendering.
 * Supports: headings, bold, italic, inline code, code blocks, links, lists, line breaks.
 * Escapes HTML before applying replacements to avoid XSS.
 * @param {string} markdown
 * @returns {string} safe HTML string
 */
export const renderMarkdownToHtml = (markdown) => {
    if (typeof markdown !== 'string') return '';
    let text = markdown.replace(/\r\n/g, '\n');

    // Escape HTML
    const escapeHtml = (s) => s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    text = escapeHtml(text);

    // Fenced code blocks ```
    text = text.replace(/```([\s\S]*?)```/g, (m, p1) => {
        return `<pre class="whitespace-pre-wrap bg-slate-900 text-slate-100 p-3 rounded-md overflow-auto"><code>${p1}</code></pre>`;
    });

    // Headings ###### to # at line start
    for (let i = 6; i >= 1; i--) {
        const re = new RegExp(`^${'#'.repeat(i)}\\s+(.+)$`, 'gm');
        text = text.replace(re, `<h${i} class="font-semibold mt-3 mb-1">$1</h${i}>`);
    }

    // Bold **text**
    text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1<\/strong>');
    // Italic *text*
    text = text.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1<\/em>');
    // Inline code `code`
    text = text.replace(/`([^`]+)`/g, '<code class="bg-slate-100 px-1 rounded">$1<\/code>');

    // Links [text](url)
    text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-blue-600 underline">$1<\/a>');

    // Unordered lists - or * at line start
    text = text.replace(/^(?:- |\* )(.*(?:\n(?:- |\* ).*)*)/gm, (m) => {
        const items = m.split(/\n/).map(line => line.replace(/^(?:- |\* )/, '')).map(li => `<li>${li}<\/li>`).join('');
        return `<ul class="list-disc ml-6">${items}<\/ul>`;
    });

    // Ordered lists 1. 2.
    text = text.replace(/^(?:\d+\. )(.*(?:\n(?:\d+\. ).*)*)/gm, (m) => {
        const items = m.split(/\n/).map(line => line.replace(/^\d+\. /, '')).map(li => `<li>${li}<\/li>`).join('');
        return `<ol class="list-decimal ml-6">${items}<\/ol>`;
    });

    // Paragraphs: split by double newlines
    const blocks = text.split(/\n{2,}/).map(b => {
        // Preserve existing block tags (pre, ul, ol, h1-6)
        if (/^(<pre|<ul|<ol|<h\d)/.test(b)) return b;
        // Convert single line breaks to <br/>
        const withBreaks = b.replace(/\n/g, '<br/>');
        return `<p class="mb-2">${withBreaks}<\/p>`;
    });

    return blocks.join('');
};
