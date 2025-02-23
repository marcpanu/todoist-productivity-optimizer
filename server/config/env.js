const requiredEnvVars = {
    // Session
    SESSION_SECRET: 'string',
    
    // OAuth - Todoist
    TODOIST_CLIENT_ID: 'string',
    TODOIST_CLIENT_SECRET: 'string',
    TODOIST_REDIRECT_URI: 'url',
    
    // OAuth - Google
    GOOGLE_CLIENT_ID: 'string',
    GOOGLE_CLIENT_SECRET: 'string',
    GOOGLE_REDIRECT_URI: 'url',
    
    // App Config
    NODE_ENV: ['development', 'production'],
    BASE_URL: 'url',
    COOKIE_DOMAIN: 'string',
    
    // Rate Limiting
    RATE_LIMIT_WINDOW_MS: 'number',
    RATE_LIMIT_MAX_REQUESTS: 'number'
};

function validateUrl(url) {
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
}

function validateEnv() {
    const errors = [];
    
    for (const [key, type] of Object.entries(requiredEnvVars)) {
        const value = process.env[key];
        
        // Check if variable exists
        if (!value) {
            errors.push(`Missing required environment variable: ${key}`);
            continue;
        }
        
        // Validate type
        switch (type) {
            case 'string':
                if (typeof value !== 'string' || !value.trim()) {
                    errors.push(`${key} must be a non-empty string`);
                }
                break;
                
            case 'number':
                if (isNaN(Number(value))) {
                    errors.push(`${key} must be a number`);
                }
                break;
                
            case 'url':
                if (!validateUrl(value)) {
                    errors.push(`${key} must be a valid URL`);
                }
                break;
                
            default:
                if (Array.isArray(type) && !type.includes(value)) {
                    errors.push(`${key} must be one of: ${type.join(', ')}`);
                }
        }
    }
    
    if (errors.length > 0) {
        console.error('Environment validation failed:');
        errors.forEach(err => console.error('  -', err));
        throw new Error('Invalid environment configuration');
    }
    
    // Sanitize and export validated env vars
    const validatedEnv = {};
    for (const [key, type] of Object.entries(requiredEnvVars)) {
        if (type === 'number') {
            validatedEnv[key] = Number(process.env[key]);
        } else {
            validatedEnv[key] = process.env[key];
        }
    }
    
    return validatedEnv;
}

module.exports = { validateEnv };
