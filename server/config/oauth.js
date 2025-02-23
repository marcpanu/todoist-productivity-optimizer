const { encryptToken, decryptToken } = require('./security');
const { google } = require('googleapis');
const axios = require('axios');

// Token refresh configuration
const REFRESH_THRESHOLD = 5 * 60 * 1000; // 5 minutes before expiry

class TokenManager {
    constructor() {
        this.tokenCache = new Map();
    }

    async getValidToken(userId, service) {
        try {
            const cachedToken = this.tokenCache.get(`${service}:${userId}`);
            if (!cachedToken) return null;
            
            // Decrypt stored token
            const decrypted = JSON.parse(decryptToken(cachedToken));
            
            // Check if token needs refresh
            if (Date.now() >= decrypted.expiresAt - REFRESH_THRESHOLD) {
                const newToken = await this.refreshToken(userId, service, decrypted.refreshToken);
                if (!newToken) {
                    // If refresh failed, remove the invalid token
                    this.removeToken(userId, service);
                    throw new Error(`${service} token refresh failed`);
                }
                return newToken;
            }
            
            return decrypted.accessToken;
        } catch (error) {
            console.error(`Error getting valid token for ${service}:`, error);
            // Remove invalid token
            this.removeToken(userId, service);
            throw error;
        }
    }

    async storeToken(userId, service, tokenData) {
        try {
            const encrypted = encryptToken(JSON.stringify({
                accessToken: tokenData.accessToken,
                refreshToken: tokenData.refreshToken,
                expiresAt: Date.now() + (tokenData.expiresIn * 1000)
            }));
            
            this.tokenCache.set(`${service}:${userId}`, encrypted);
        } catch (error) {
            console.error(`Error storing token for ${service}:`, error);
            throw error;
        }
    }

    async refreshToken(userId, service, refreshToken) {
        try {
            let newTokenData;
            
            if (service === 'google') {
                const oauth2Client = require('./google').getOAuth2Client();
                oauth2Client.setCredentials({ refresh_token: refreshToken });
                
                try {
                    const { credentials } = await oauth2Client.refreshAccessToken();
                    newTokenData = {
                        accessToken: credentials.access_token,
                        refreshToken: credentials.refresh_token || refreshToken,
                        expiresIn: Math.floor((credentials.expiry_date - Date.now()) / 1000)
                    };
                } catch (error) {
                    if (error.message.includes('invalid_grant')) {
                        console.error('Google refresh token is invalid or has been revoked');
                        this.removeToken(userId, service);
                        return null;
                    }
                    throw error;
                }
            } else if (service === 'todoist') {
                // Todoist uses long-lived access tokens, but we'll implement refresh if needed
                const response = await axios.post('https://todoist.com/oauth/access_token', {
                    client_id: process.env.TODOIST_CLIENT_ID,
                    client_secret: process.env.TODOIST_CLIENT_SECRET,
                    refresh_token: refreshToken,
                    grant_type: 'refresh_token'
                });
                
                if (response.data.access_token) {
                    newTokenData = {
                        accessToken: response.data.access_token,
                        refreshToken: response.data.refresh_token || refreshToken,
                        expiresIn: 365 * 24 * 60 * 60 // Default to 1 year for Todoist
                    };
                } else {
                    console.error('Failed to refresh Todoist token');
                    return null;
                }
            }
            
            if (newTokenData) {
                await this.storeToken(userId, service, newTokenData);
                return newTokenData.accessToken;
            }
            
            return null;
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
