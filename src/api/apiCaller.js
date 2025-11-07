import Constants from 'expo-constants';

const API_URL = 'https://ats-backend-805977745256.us-central1.run.app/api';

// Get bearer token from Expo environment variables
const BEARER_TOKEN = Constants.expoConfig?.extra?.bearerToken || '';

export default async function ApiCaller(endpoint, options = {}) {
    const headers = {
        "Authorization": `Bearer ${BEARER_TOKEN}`,
        "X-Client-Type": "mobile-app", // Identify as mobile app for backend
        "X-Bundle-ID": Constants.expoConfig?.ios?.bundleIdentifier || 
                       Constants.expoConfig?.android?.package || "unknown",
        ...options.headers
    };

    // For FormData, let the browser set the Content-Type header with the correct boundary.
    // Manually setting it to 'multipart/form-data' can cause issues in some environments (like React Native).
    if (!(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
    }

    try {
        console.log(`API Request to ${endpoint}`, {
            method: options.method || 'GET',
            hasBody: !!options.body,
            isFormData: options.body instanceof FormData
        });
        
        const response = await fetch(`${API_URL}${endpoint}`, {
            ...options,
            headers
        });

        if (!response.ok) {
            const errorText = await response.text();
            let errorMessage = 'API request failed';
            
            try {
                const errorBody = JSON.parse(errorText);
                errorMessage = errorBody.error || errorMessage;
            } catch (e) {
                // If parsing fails, use the raw text
                errorMessage = errorText || `HTTP Error ${response.status}`;
            }
            
            throw new Error(errorMessage);
        }

        const data = await response.json();
        console.log(`API Response from ${endpoint}:`, data);
        return data;
    } catch (error) {
        console.error(`Error in ApiCaller for ${endpoint}:`, error);
        throw error;
    }
}
