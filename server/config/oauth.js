const { encryptToken, decryptToken } = require('./security');

// Token refresh configuration
const REFRESH_THRESHOLD = 5 * 60 * 1000; // 5 minutes before expiry

class TokenManager {
    constructor() {
        this.tokenCache = new Map();
    }

    async getValidToken(userId, service) {
        const cachedToken = this.tokenCache.get(`${service}:${userId}`);
        
        if (!cachedToken) return null;
        
        // Decrypt stored token
        const decrypted = JSON.parse(decryptToken(cachedToken));
        
        // Check if token needs refresh
        if (Date.now() >= decrypted.expiresAt - REFRESH_THRESHOLD) {
            return await this.refreshToken(userId, service, decrypted.refreshToken);
        }
        
        return decrypted.accessToken;
    }

    async storeToken(userId, service, tokenData) {
        const encrypted = encryptToken(JSON.stringify({
            accessToken: tokenData.accessToken,
            refreshToken: tokenData.refreshToken,
            expiresAt: Date.now() + (tokenData.expiresIn * 1000)
        }));
        
        this.tokenCache.set(`${service}:${userId}`, encrypted);
    }

    async refreshToken(userId, service, refreshToken) {
        try {
            let newTokenData;
            
            if (service === 'google') {
                const oauth2Client = require('./google').getOAuth2Client();
                oauth2Client.setCredentials({ refresh_token: refreshToken });
                const { credentials } = await oauth2Client.refreshAccessToken();
                newTokenData = {
                    accessToken: credentials.access_token,
                    refreshToken: credentials.refresh_token || refreshToken,
                    expiresIn: credentials.expiry_date
                };
            } else if (service === 'todoist') {
                // Todoist doesn't support token refresh, but we'll keep the interface consistent
                return refreshToken;
            }
            
            await this.storeToken(userId, service, newTokenData);
            return newTokenData.accessToken;
        } catch (error) {
            console.error(`Error refreshing ${service} token:`, error);
            return null;
        }
    }

    removeToken(userId, service) {
        this.tokenCache.delete(`${service}:${userId}`);
    }
}

const tokenManager = new TokenManager();

module.exports = {
    tokenManager,
    oauth: {
        google: {
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: process.env.GOOGLE_REDIRECT_URI,
            scope: [
                'profile',
                'email',
                'https://www.googleapis.com/auth/calendar.readonly',
                'https://www.googleapis.com/auth/gmail.send'
            ]
        },
        todoist: {
            clientID: process.env.TODOIST_CLIENT_ID,
            clientSecret: process.env.TODOIST_CLIENT_SECRET,
            callbackURL: process.env.TODOIST_REDIRECT_URI,
            scope: ['data:read_write,data:delete']
        }
    }
};
