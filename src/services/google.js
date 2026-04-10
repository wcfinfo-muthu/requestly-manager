// services/google.js — Google OAuth 2.0 and Drive API integration

/**
 * Google OAuth Service
 * Handles authentication and Drive API operations
 *
 * Setup Instructions:
 * 1. Create a Google Cloud Console project
 * 2. Enable Google Drive API
 * 3. Create OAuth 2.0 credentials (OAuth Consent Screen)
 * 4. Add your extension's OAuth callback URI: chrome-extension://[EXTENSION_ID]/
 * 5. Update CLIENT_ID in this file with your credentials
 */

const CLIENT_ID = 'xxxx.apps.googleusercontent.com'; // TODO: Replace with actual client ID
const REDIRECT_URI = chrome.identity.getRedirectURL('provider_callback');
const SCOPES = [
    'https://www.googleapis.com/auth/drive.file',  // Limited Drive access
    'https://www.googleapis.com/auth/userinfo.email',
];

/**
 * OAuth 2.0 Configuration
 */
const oauth2Config = {
    client_id: CLIENT_ID,
    scopes: SCOPES,
    redirect_uri: REDIRECT_URI,
};

/**
 * Build OAuth authorization URL
 */
function buildAuthUrl() {
    const params = new URLSearchParams({
        client_id: oauth2Config.client_id,
        redirect_uri: oauth2Config.redirect_uri,
        response_type: 'code',
        scope: oauth2Config.scopes.join(' '),
        access_type: 'offline',
        prompt: 'consent',
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/**
 * Exchange authorization code for access token
 */
async function exchangeCodeForToken(code) {
    try {
        const response = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                code,
                client_id: oauth2Config.client_id,
                redirect_uri: oauth2Config.redirect_uri,
                grant_type: 'authorization_code',
                // Note: client_secret should be handled server-side in production
            }).toString(),
        });

        if (!response.ok) {
            throw new Error(`Token exchange failed: ${response.statusText}`);
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Token exchange error:', error);
        throw error;
    }
}

/**
 * Google OAuth Service
 */
export const GoogleAuth = {
    /**
     * Initiate OAuth login flow
     * @returns {Promise<Object>} Auth token response
     */
    async login() {
        try {
            const authUrl = buildAuthUrl();

            // Launch the OAuth flow
            const responseUrl = await chrome.identity.launchWebAuthFlow({
                url: authUrl,
                interactive: true,
            });

            // Extract authorization code from response
            const url = new URL(responseUrl);
            const code = url.searchParams.get('code');

            if (!code) {
                throw new Error('No authorization code received');
            }

            // Exchange code for tokens
            const tokenResponse = await exchangeCodeForToken(code);

            // Store tokens
            await this.saveTokens(tokenResponse);

            // Notify sync service of login
            this.notifySyncServiceOfLogin();

            return tokenResponse;
        } catch (error) {
            console.error('OAuth login failed:', error);
            throw error;
        }
    },

    /**
     * Logout - revoke tokens
     */
    async logout() {
        try {
            const tokens = await this.getTokens();
            if (tokens?.access_token) {
                // Revoke token
                await fetch(
                    `https://oauth2.googleapis.com/revoke?token=${tokens.access_token}`,
                    { method: 'POST' }
                );
            }
        } catch (error) {
            console.error('Logout error:', error);
        }

        // Clear stored tokens
        await this.clearTokens();

        // Notify sync service of logout
        this.notifySyncServiceOfLogout();
    },

    /**
     * Notify sync service of user login
     */
    notifySyncServiceOfLogin() {
        try {
            if (typeof chrome !== 'undefined' && chrome.runtime) {
                chrome.runtime.sendMessage({
                    type: 'SYNC_USER_LOGIN',
                }).catch(() => {
                    // Receiver not available
                });
            }
        } catch (error) {
            console.error('Failed to notify sync service:', error);
        }
    },

    /**
     * Notify sync service of user logout
     */
    notifySyncServiceOfLogout() {
        try {
            if (typeof chrome !== 'undefined' && chrome.runtime) {
                chrome.runtime.sendMessage({
                    type: 'SYNC_USER_LOGOUT',
                }).catch(() => {
                    // Receiver not available
                });
            }
        } catch (error) {
            console.error('Failed to notify sync service:', error);
        }
    },

    /**
     * Get stored tokens
     */
    async getTokens() {
        return new Promise(resolve => {
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
                chrome.storage.sync.get('google_tokens', data => {
                    resolve(data.google_tokens || null);
                });
            } else {
                // Fallback to localStorage
                try {
                    const tokens = localStorage.getItem('google_tokens');
                    resolve(tokens ? JSON.parse(tokens) : null);
                } catch (e) {
                    resolve(null);
                }
            }
        });
    },

    /**
     * Save tokens to storage
     */
    async saveTokens(tokens) {
        return new Promise(resolve => {
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
                chrome.storage.sync.set({google_tokens: tokens}, () => {
                    // Also save to localStorage
                    try {
                        localStorage.setItem('google_tokens', JSON.stringify(tokens));
                    } catch (e) {
                        // Ignore
                    }
                    resolve();
                });
            } else {
                // Fallback to localStorage
                try {
                    localStorage.setItem('google_tokens', JSON.stringify(tokens));
                } catch (e) {
                    console.error('Failed to save tokens:', e);
                }
                resolve();
            }
        });
    },

    /**
     * Clear stored tokens
     */
    async clearTokens() {
        return new Promise(resolve => {
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
                chrome.storage.sync.remove('google_tokens', () => {
                    try {
                        localStorage.removeItem('google_tokens');
                    } catch (e) {
                        // Ignore
                    }
                    resolve();
                });
            } else {
                // Fallback to localStorage
                try {
                    localStorage.removeItem('google_tokens');
                } catch (e) {
                    console.error('Failed to clear tokens:', e);
                }
                resolve();
            }
        });
    },

    /**
     * Check if user is authenticated
     */
    async isAuthenticated() {
        const tokens = await this.getTokens();
        return !!tokens?.access_token;
    },

    /**
     * Refresh access token if expired
     */
    async refreshToken() {
        try {
            const tokens = await this.getTokens();
            if (!tokens?.refresh_token) {
                return null;
            }

            const response = await fetch('https://oauth2.googleapis.com/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    client_id: oauth2Config.client_id,
                    refresh_token: tokens.refresh_token,
                    grant_type: 'refresh_token',
                }).toString(),
            });

            if (!response.ok) {
                throw new Error('Token refresh failed');
            }

            const data = await response.json();
            // Keep refresh token if not provided
            if (!data.refresh_token) {
                data.refresh_token = tokens.refresh_token;
            }
            await this.saveTokens(data);
            return data;
        } catch (error) {
            console.error('Token refresh error:', error);
            await this.clearTokens();
            return null;
        }
    },

    /**
     * Get user profile info
     */
    async getUserProfile() {
        try {
            const tokens = await this.getTokens();
            if (!tokens?.access_token) {
                return null;
            }

            const response = await fetch(
                'https://www.googleapis.com/oauth2/v2/userinfo',
                {
                    headers: {
                        'Authorization': `Bearer ${tokens.access_token}`,
                    },
                }
            );

            if (!response.ok) {
                if (response.status === 401) {
                    // Token expired, try to refresh
                    const newTokens = await this.refreshToken();
                    if (newTokens) {
                        return this.getUserProfile(); // Retry with new token
                    }
                }
                throw new Error(`Failed to fetch user profile: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Get user profile error:', error);
            return null;
        }
    },
};

/**
 * Google Drive Service
 */
export const GoogleDrive = {
    /**
     * Create or update rules file on Google Drive
     */
    async uploadRules(rules, fileName = 'requestly-rules.json') {
        try {
            const tokens = await GoogleAuth.getTokens();
            if (!tokens?.access_token) {
                throw new Error('Not authenticated');
            }

            const fileId = await this.findRulesFile(fileName);
            const fileContent = JSON.stringify(rules, null, 2);

            if (fileId) {
                // Update existing file
                return await this.updateFile(fileId, fileContent);
            } else {
                // Create new file
                return await this.createFile(fileName, fileContent);
            }
        } catch (error) {
            console.error('Upload rules error:', error);
            throw error;
        }
    },

    /**
     * Download rules from Google Drive
     */
    async downloadRules(fileName = 'requestly-rules.json') {
        try {
            const tokens = await GoogleAuth.getTokens();
            if (!tokens?.access_token) {
                throw new Error('Not authenticated');
            }

            const fileId = await this.findRulesFile(fileName);
            if (!fileId) {
                return null; // No rules file found
            }

            const response = await fetch(
                `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
                {
                    headers: {
                        'Authorization': `Bearer ${tokens.access_token}`,
                    },
                }
            );

            if (!response.ok) {
                throw new Error(`Failed to download: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Download rules error:', error);
            throw error;
        }
    },

    /**
     * Find rules file on Google Drive
     */
    async findRulesFile(fileName = 'requestly-rules.json') {
        try {
            const tokens = await GoogleAuth.getTokens();
            if (!tokens?.access_token) {
                return null;
            }

            const query = encodeURIComponent(
                `name='${fileName}' and mimeType='application/json' and trashed=false`
            );

            const response = await fetch(
                `https://www.googleapis.com/drive/v3/files?q=${query}&spaces=appDataFolder&fields=files(id,modifiedTime)`,
                {
                    headers: {
                        'Authorization': `Bearer ${tokens.access_token}`,
                    },
                }
            );

            if (!response.ok) {
                throw new Error('Failed to search for file');
            }

            const data = await response.json();
            return data.files?.[0]?.id || null;
        } catch (error) {
            console.error('Find rules file error:', error);
            return null;
        }
    },

    /**
     * Create a new file on Google Drive
     */
    async createFile(fileName, content) {
        try {
            const tokens = await GoogleAuth.getTokens();
            if (!tokens?.access_token) {
                throw new Error('Not authenticated');
            }

            const metadata = {
                name: fileName,
                mimeType: 'application/json',
                parents: ['appDataFolder'],
            };

            const form = new FormData();
            form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
            form.append('file', new Blob([content], { type: 'application/json' }));

            const response = await fetch(
                'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${tokens.access_token}`,
                    },
                    body: form,
                }
            );

            if (!response.ok) {
                throw new Error(`Failed to create file: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Create file error:', error);
            throw error;
        }
    },

    /**
     * Update existing file on Google Drive
     */
    async updateFile(fileId, content) {
        try {
            const tokens = await GoogleAuth.getTokens();
            if (!tokens?.access_token) {
                throw new Error('Not authenticated');
            }

            const response = await fetch(
                `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
                {
                    method: 'PATCH',
                    headers: {
                        'Authorization': `Bearer ${tokens.access_token}`,
                        'Content-Type': 'application/json',
                    },
                    body: content,
                }
            );

            if (!response.ok) {
                throw new Error(`Failed to update file: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Update file error:', error);
            throw error;
        }
    },
};
