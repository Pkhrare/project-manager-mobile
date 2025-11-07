export const toLexical = (text) => {
    // If text is falsy, return a valid empty Lexical state.
    if (!text) {
        return JSON.stringify({
            root: {
                children: [{
                    type: 'paragraph',
                    children: [],
                    direction: null,
                    format: '',
                    indent: 0,
                    version: 1
                }],
                direction: null,
                format: '',
                indent: 0,
                type: 'root',
                version: 1
            }
        });
    }

    try {
        const parsed = JSON.parse(text);
        // A more robust check to see if it's a valid Lexical state.
        if (parsed.root && parsed.root.type === 'root') {
            return text; // Assume it's valid and return as is.
        }
    } catch (e) {
        // Not a JSON string, so we'll treat it as plain text below.
    }

    // If it's not a valid Lexical JSON, create a new state from the plain text.
    return JSON.stringify({
        root: {
            children: [{
                type: 'paragraph',
                children: [{
                    detail: 0,
                    format: 0,
                    mode: 'normal',
                    style: '',
                    text: text,
                    type: 'text',
                    version: 1
                }],
                direction: null,
                format: '',
                indent: 0,
                version: 1
            }],
            direction: null,
            format: '',
            indent: 0,
            type: 'root',
            version: 1
        }
    });
};

export const fromLexical = (lexicalJSON) => {
    if (!lexicalJSON) return '';
    try {
        const parsed = JSON.parse(lexicalJSON);
        // Make sure we can safely access the nested properties.
        if (parsed && parsed.root && Array.isArray(parsed.root.children)) {
            return parsed.root.children.map(paragraph =>
                (paragraph.children || []).map(child => child.text).join('')
            ).join('\n');
        }
        // If it's JSON but not the expected structure, return an empty string.
        return '';
    } catch (e) {
        // If it's not JSON, it might be plain text from an older state.
        return lexicalJSON;
    }
};

// Convert plain text to Lexical JSON (for saving edited text)
export const plainTextToLexical = (plainText) => {
    if (!plainText || plainText.trim() === '') {
        return toLexical('');
    }

    // Split text into paragraphs (by newlines)
    const paragraphs = plainText.split('\n');
    
    const lexicalState = {
        root: {
            children: paragraphs.map(paragraphText => ({
                type: 'paragraph',
                children: paragraphText ? [{
                    detail: 0,
                    format: 0,
                    mode: 'normal',
                    style: '',
                    text: paragraphText,
                    type: 'text',
                    version: 1
                }] : [],
                direction: null,
                format: '',
                indent: 0,
                version: 1
            })),
            direction: null,
            format: '',
            indent: 0,
            type: 'root',
            version: 1
        }
    };

    return JSON.stringify(lexicalState);
};
