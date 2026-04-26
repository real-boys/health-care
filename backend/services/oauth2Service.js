const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');
const querystring = require('querystring');

class OAuth2Service {
  constructor() {
    this.dbPath = process.env.DB_PATH || path.join(__dirname, '../database/healthcare.db');
    this.db = null;
    this.providers = new Map();
    this.initialize();
  }

  async initialize() {
    try {
      await this.initializeDatabase();
      await this.loadProviders();
      console.log('✅ OAuth2 Service initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize OAuth2 Service:', error);
      throw error;
    }
  }

  async initializeDatabase() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          reject(err);
        } else {
          console.log('Connected to SQLite database for OAuth2');
          resolve();
        }
      });
    });
  }

  async loadProviders() {
    try {
      const providers = await this.getOAuthProviders();
      
      for (const provider of providers) {
        if (provider.is_active) {
          this.providers.set(provider.name, {
            ...provider,
            scopes: JSON.parse(provider.scopes || '[]')
          });
        }
      }
      
      console.log(`Loaded ${this.providers.size} OAuth2 providers`);
    } catch (error) {
      console.error('Error loading OAuth2 providers:', error);
      throw error;
    }
  }

  /**
   * Get OAuth provider configuration from database
   */
  async getOAuthProviders() {
    return new Promise((resolve, reject) => {
      const query = 'SELECT * FROM oauth_providers WHERE is_active = true';
      
      this.db.all(query, [], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });
  }

  /**
   * Get authorization URL for OAuth provider
   * @param {string} providerName - Provider name (google, microsoft, facebook)
   * @param {object} options - Additional options
   */
  getAuthorizationUrl(providerName, options = {}) {
    const provider = this.providers.get(providerName);
    
    if (!provider) {
      throw new Error(`OAuth provider not found: ${providerName}`);
    }

    const state = crypto.randomBytes(32).toString('hex');
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');

    // Store state and code verifier in session/cache
    this.storeOAuthState(state, {
      provider: providerName,
      codeVerifier,
      redirectUri: options.redirectUri || provider.redirect_uri,
      scopes: options.scopes || provider.scopes
    });

    let authUrl;
    
    switch (providerName) {
      case 'google':
        authUrl = this.buildGoogleAuthUrl(provider, state, codeChallenge, options);
        break;
      case 'microsoft':
        authUrl = this.buildMicrosoftAuthUrl(provider, state, codeChallenge, options);
        break;
      case 'facebook':
        authUrl = this.buildFacebookAuthUrl(provider, state, options);
        break;
      default:
        throw new Error(`Unsupported OAuth provider: ${providerName}`);
    }

    return {
      authUrl,
      state,
      codeVerifier
    };
  }

  /**
   * Build Google OAuth2 authorization URL
   */
  buildGoogleAuthUrl(provider, state, codeChallenge, options) {
    const params = {
      client_id: provider.client_id,
      redirect_uri: options.redirectUri || provider.redirect_uri,
      response_type: 'code',
      scope: (options.scopes || provider.scopes).join(' '),
      state: state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      access_type: 'offline',
      prompt: options.prompt || 'consent'
    };

    return `https://accounts.google.com/o/oauth2/v2/auth?${querystring.stringify(params)}`;
  }

  /**
   * Build Microsoft OAuth2 authorization URL
   */
  buildMicrosoftAuthUrl(provider, state, codeChallenge, options) {
    const params = {
      client_id: provider.client_id,
      redirect_uri: options.redirectUri || provider.redirect_uri,
      response_type: 'code',
      scope: (options.scopes || provider.scopes).join(' '),
      state: state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      response_mode: 'query'
    };

    return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${querystring.stringify(params)}`;
  }

  /**
   * Build Facebook OAuth2 authorization URL
   */
  buildFacebookAuthUrl(provider, state, options) {
    const params = {
      client_id: provider.client_id,
      redirect_uri: options.redirectUri || provider.redirect_uri,
      response_type: 'code',
      scope: (options.scopes || provider.scopes).join(','),
      state: state
    };

    return `https://www.facebook.com/v18.0/dialog/oauth?${querystring.stringify(params)}`;
  }

  /**
   * Exchange authorization code for access token
   * @param {string} providerName - Provider name
   * @param {string} code - Authorization code
   * @param {string} state - State parameter
   * @param {string} codeVerifier - PKCE code verifier
   */
  async exchangeCodeForToken(providerName, code, state, codeVerifier) {
    const storedState = this.getOAuthState(state);
    
    if (!storedState || storedState.provider !== providerName) {
      throw new Error('Invalid state parameter');
    }

    const provider = this.providers.get(providerName);
    let tokenResponse;

    switch (providerName) {
      case 'google':
        tokenResponse = await this.exchangeGoogleCode(provider, code, storedState);
        break;
      case 'microsoft':
        tokenResponse = await this.exchangeMicrosoftCode(provider, code, storedState);
        break;
      case 'facebook':
        tokenResponse = await this.exchangeFacebookCode(provider, code, storedState);
        break;
      default:
        throw new Error(`Unsupported OAuth provider: ${providerName}`);
    }

    // Get user profile
    const userProfile = await this.getUserProfile(providerName, tokenResponse.access_token);

    return {
      provider: providerName,
      accessToken: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token,
      tokenExpiresAt: tokenResponse.expires_in ? 
        new Date(Date.now() + tokenResponse.expires_in * 1000) : null,
      profile: userProfile
    };
  }

  /**
   * Exchange code with Google
   */
  async exchangeGoogleCode(provider, code, storedState) {
    const tokenUrl = 'https://oauth2.googleapis.com/token';
    const params = {
      client_id: provider.client_id,
      client_secret: provider.client_secret,
      code: code,
      grant_type: 'authorization_code',
      redirect_uri: storedState.redirectUri,
      code_verifier: storedState.codeVerifier
    };

    try {
      const response = await axios.post(tokenUrl, querystring.stringify(params), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      return response.data;
    } catch (error) {
      console.error('Google token exchange error:', error.response?.data || error.message);
      throw new Error('Failed to exchange Google authorization code');
    }
  }

  /**
   * Exchange code with Microsoft
   */
  async exchangeMicrosoftCode(provider, code, storedState) {
    const tokenUrl = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
    const params = {
      client_id: provider.client_id,
      client_secret: provider.client_secret,
      code: code,
      grant_type: 'authorization_code',
      redirect_uri: storedState.redirectUri,
      code_verifier: storedState.codeVerifier
    };

    try {
      const response = await axios.post(tokenUrl, querystring.stringify(params), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      return response.data;
    } catch (error) {
      console.error('Microsoft token exchange error:', error.response?.data || error.message);
      throw new Error('Failed to exchange Microsoft authorization code');
    }
  }

  /**
   * Exchange code with Facebook
   */
  async exchangeFacebookCode(provider, code, storedState) {
    const tokenUrl = `https://graph.facebook.com/v18.0/oauth/access_token`;
    const params = {
      client_id: provider.client_id,
      client_secret: provider.client_secret,
      code: code,
      redirect_uri: storedState.redirectUri
    };

    try {
      const response = await axios.get(tokenUrl, { params });
      return response.data;
    } catch (error) {
      console.error('Facebook token exchange error:', error.response?.data || error.message);
      throw new Error('Failed to exchange Facebook authorization code');
    }
  }

  /**
   * Get user profile from OAuth provider
   * @param {string} providerName - Provider name
   * @param {string} accessToken - Access token
   */
  async getUserProfile(providerName, accessToken) {
    switch (providerName) {
      case 'google':
        return await this.getGoogleProfile(accessToken);
      case 'microsoft':
        return await this.getMicrosoftProfile(accessToken);
      case 'facebook':
        return await this.getFacebookProfile(accessToken);
      default:
        throw new Error(`Unsupported OAuth provider: ${providerName}`);
    }
  }

  /**
   * Get Google user profile
   */
  async getGoogleProfile(accessToken) {
    try {
      const response = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      const profile = response.data;
      return {
        id: profile.id,
        email: profile.email,
        name: profile.name,
        firstName: profile.given_name,
        lastName: profile.family_name,
        avatar: profile.picture,
        verified: profile.verified_email
      };
    } catch (error) {
      console.error('Google profile error:', error.response?.data || error.message);
      throw new Error('Failed to get Google user profile');
    }
  }

  /**
   * Get Microsoft user profile
   */
  async getMicrosoftProfile(accessToken) {
    try {
      const response = await axios.get('https://graph.microsoft.com/v1.0/me', {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      const profile = response.data;
      return {
        id: profile.id,
        email: profile.mail || profile.userPrincipalName,
        name: profile.displayName,
        firstName: profile.givenName,
        lastName: profile.surname,
        avatar: null, // Microsoft doesn't provide avatar in basic profile
        verified: true
      };
    } catch (error) {
      console.error('Microsoft profile error:', error.response?.data || error.message);
      throw new Error('Failed to get Microsoft user profile');
    }
  }

  /**
   * Get Facebook user profile
   */
  async getFacebookProfile(accessToken) {
    try {
      const response = await axios.get('https://graph.facebook.com/v18.0/me', {
        params: {
          fields: 'id,name,email,picture,first_name,last_name,verified'
        },
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      const profile = response.data;
      return {
        id: profile.id,
        email: profile.email,
        name: profile.name,
        firstName: profile.first_name,
        lastName: profile.last_name,
        avatar: profile.picture?.data?.url,
        verified: profile.verified
      };
    } catch (error) {
      console.error('Facebook profile error:', error.response?.data || error.message);
      throw new Error('Failed to get Facebook user profile');
    }
  }

  /**
   * Find or create user from OAuth profile
   * @param {object} oauthData - OAuth response data
   * @param {object} deviceInfo - Device information
   */
  async findOrCreateUser(oauthData, deviceInfo = {}) {
    try {
      // Check if user already exists with this OAuth account
      let oauthAccount = await this.findOAuthAccount(oauthData.provider, oauthData.profile.id);
      
      if (oauthAccount) {
        // User exists, update tokens and return user
        await this.updateOAuthAccount(oauthAccount.id, oauthData);
        const user = await this.getUserById(oauthAccount.user_id);
        
        // Log OAuth login
        await this.logAuthEvent(user.id, 'oauth_login', true, {
          provider: oauthData.provider,
          deviceInfo
        });
        
        return { user, isNew: false };
      }

      // Check if user exists with same email
      if (oauthData.profile.email) {
        const existingUser = await this.getUserByEmail(oauthData.profile.email);
        
        if (existingUser) {
          // Link OAuth account to existing user
          await this.createOAuthAccount(existingUser.id, oauthData);
          
          // Log OAuth account linking
          await this.logAuthEvent(existingUser.id, 'oauth_account_linked', true, {
            provider: oauthData.provider,
            deviceInfo
          });
          
          return { user: existingUser, isNew: false };
        }
      }

      // Create new user
      const newUser = await this.createUserFromOAuth(oauthData);
      
      // Log user creation
      await this.logAuthEvent(newUser.id, 'user_created_oauth', true, {
        provider: oauthData.provider,
        deviceInfo
      });
      
      return { user: newUser, isNew: true };
    } catch (error) {
      console.error('Error finding/creating OAuth user:', error);
      throw error;
    }
  }

  /**
   * Find OAuth account by provider and provider user ID
   */
  async findOAuthAccount(provider, providerUserId) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT oa.*, u.* FROM oauth_accounts oa
        JOIN users u ON oa.user_id = u.id
        WHERE oa.provider_id = (SELECT id FROM oauth_providers WHERE name = ?) 
        AND oa.provider_user_id = ?
      `;
      
      this.db.get(query, [provider, providerUserId], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  /**
   * Update OAuth account tokens
   */
  async updateOAuthAccount(oauthAccountId, oauthData) {
    return new Promise((resolve, reject) => {
      const query = `
        UPDATE oauth_accounts 
        SET access_token = ?, refresh_token = ?, token_expires_at = ?, profile_data = ?, updated_at = datetime('now')
        WHERE id = ?
      `;
      
      this.db.run(query, [
        oauthData.accessToken,
        oauthData.refreshToken,
        oauthData.tokenExpiresAt?.toISOString(),
        JSON.stringify(oauthData.profile),
        oauthAccountId
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes);
        }
      });
    });
  }

  /**
   * Create OAuth account for user
   */
  async createOAuthAccount(userId, oauthData) {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO oauth_accounts 
        (user_id, provider_id, provider_user_id, access_token, refresh_token, token_expires_at, profile_data)
        VALUES (?, (SELECT id FROM oauth_providers WHERE name = ?), ?, ?, ?, ?, ?)
      `;
      
      this.db.run(query, [
        userId,
        oauthData.provider,
        oauthData.profile.id,
        oauthData.accessToken,
        oauthData.refreshToken,
        oauthData.tokenExpiresAt?.toISOString(),
        JSON.stringify(oauthData.profile)
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.lastID);
        }
      });
    });
  }

  /**
   * Get user by ID
   */
  async getUserById(userId) {
    return new Promise((resolve, reject) => {
      const query = 'SELECT * FROM users WHERE id = ?';
      
      this.db.get(query, [userId], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email) {
    return new Promise((resolve, reject) => {
      const query = 'SELECT * FROM users WHERE email = ?';
      
      this.db.get(query, [email], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  /**
   * Create user from OAuth profile
   */
  async createUserFromOAuth(oauthData) {
    const profile = oauthData.profile;
    
    // Generate a random password for OAuth users (they won't use it)
    const randomPassword = crypto.randomBytes(32).toString('hex');
    const salt = crypto.randomBytes(16).toString('hex');
    const passwordHash = crypto.pbkdf2Sync(randomPassword, salt, 10000, 64, 'sha512').toString('hex');

    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO users 
        (username, email, password_hash, salt, first_name, last_name, avatar_url, 
         is_verified, oauth_provider, oauth_id, oauth_data, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `;
      
      this.db.run(query, [
        profile.email || profile.id, // Use email as username, fallback to ID
        profile.email,
        passwordHash,
        salt,
        profile.firstName || '',
        profile.lastName || '',
        profile.avatar,
        profile.verified || false,
        oauthData.provider,
        profile.id,
        JSON.stringify(profile)
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          // Create OAuth account
          createOAuthAccount(this.lastID, oauthData).then(() => {
            // Assign default role (patient)
            assignDefaultRole(this.lastID).then(() => {
              resolve({ id: this.lastID, ...profile });
            }).catch(reject);
          }).catch(reject);
        }
      });
    });
  }

  /**
   * Assign default role to new user
   */
  async assignDefaultRole(userId) {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO user_roles (user_id, role_id)
        VALUES (?, (SELECT id FROM roles WHERE name = 'patient'))
      `;
      
      this.db.run(query, [userId], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.lastID);
        }
      });
    });
  }

  /**
   * Refresh access token
   * @param {string} providerName - Provider name
   * @param {string} refreshToken - Refresh token
   */
  async refreshAccessToken(providerName, refreshToken) {
    const provider = this.providers.get(providerName);
    
    if (!provider) {
      throw new Error(`OAuth provider not found: ${providerName}`);
    }

    let tokenResponse;

    switch (providerName) {
      case 'google':
        tokenResponse = await this.refreshGoogleToken(provider, refreshToken);
        break;
      case 'microsoft':
        tokenResponse = await this.refreshMicrosoftToken(provider, refreshToken);
        break;
      case 'facebook':
        tokenResponse = await this.refreshFacebookToken(provider, refreshToken);
        break;
      default:
        throw new Error(`Token refresh not supported for: ${providerName}`);
    }

    return {
      accessToken: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token || refreshToken,
      tokenExpiresAt: tokenResponse.expires_in ? 
        new Date(Date.now() + tokenResponse.expires_in * 1000) : null
    };
  }

  /**
   * Refresh Google token
   */
  async refreshGoogleToken(provider, refreshToken) {
    const tokenUrl = 'https://oauth2.googleapis.com/token';
    const params = {
      client_id: provider.client_id,
      client_secret: provider.client_secret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    };

    try {
      const response = await axios.post(tokenUrl, querystring.stringify(params), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      return response.data;
    } catch (error) {
      console.error('Google token refresh error:', error.response?.data || error.message);
      throw new Error('Failed to refresh Google access token');
    }
  }

  /**
   * Refresh Microsoft token
   */
  async refreshMicrosoftToken(provider, refreshToken) {
    const tokenUrl = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
    const params = {
      client_id: provider.client_id,
      client_secret: provider.client_secret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    };

    try {
      const response = await axios.post(tokenUrl, querystring.stringify(params), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      return response.data;
    } catch (error) {
      console.error('Microsoft token refresh error:', error.response?.data || error.message);
      throw new Error('Failed to refresh Microsoft access token');
    }
  }

  /**
   * Refresh Facebook token
   */
  async refreshFacebookToken(provider, refreshToken) {
    // Facebook short-lived tokens cannot be refreshed programmatically
    // User must re-authenticate
    throw new Error('Facebook tokens must be refreshed by user re-authentication');
  }

  /**
   * Revoke OAuth access
   * @param {number} userId - User ID
   * @param {string} providerName - Provider name (optional, revoke all if not specified)
   */
  async revokeOAuthAccess(userId, providerName = null) {
    try {
      let oauthAccounts;
      
      if (providerName) {
        oauthAccounts = await this.getUserOAuthAccounts(userId, providerName);
      } else {
        oauthAccounts = await this.getUserOAuthAccounts(userId);
      }

      for (const account of oauthAccounts) {
        // Revoke token with provider if possible
        await this.revokeProviderToken(account.provider_name, account.access_token);
        
        // Delete OAuth account record
        await this.deleteOAuthAccount(account.id);
      }

      // Log OAuth revocation
      await this.logAuthEvent(userId, 'oauth_access_revoked', true, {
        provider: providerName || 'all'
      });

      return { success: true, revoked: oauthAccounts.length };
    } catch (error) {
      console.error('Error revoking OAuth access:', error);
      throw error;
    }
  }

  /**
   * Revoke token with provider
   */
  async revokeProviderToken(providerName, accessToken) {
    try {
      switch (providerName) {
        case 'google':
          await axios.post('https://oauth2.googleapis.com/revoke', querystring.stringify({
            token: accessToken
          }));
          break;
        case 'microsoft':
          await axios.post('https://login.microsoftonline.com/common/oauth2/v2.0/logout', {
            token: accessToken
          });
          break;
        // Facebook doesn't have a programmatic revoke endpoint
        default:
          console.log(`Token revocation not supported for ${providerName}`);
      }
    } catch (error) {
      console.error(`Error revoking ${providerName} token:`, error.message);
      // Don't throw error, continue with local cleanup
    }
  }

  /**
   * Get user's OAuth accounts
   */
  async getUserOAuthAccounts(userId, providerName = null) {
    return new Promise((resolve, reject) => {
      let query = `
        SELECT oa.*, op.name as provider_name
        FROM oauth_accounts oa
        JOIN oauth_providers op ON oa.provider_id = op.id
        WHERE oa.user_id = ?
      `;
      
      const params = [userId];
      
      if (providerName) {
        query += ' AND op.name = ?';
        params.push(providerName);
      }
      
      this.db.all(query, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });
  }

  /**
   * Delete OAuth account
   */
  async deleteOAuthAccount(oauthAccountId) {
    return new Promise((resolve, reject) => {
      const query = 'DELETE FROM oauth_accounts WHERE id = ?';
      
      this.db.run(query, [oauthAccountId], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes);
        }
      });
    });
  }

  /**
   * Store OAuth state (in production, use Redis or proper cache)
   */
  storeOAuthState(state, data) {
    // For now, store in memory (production: use Redis with TTL)
    if (!this.oauthStates) {
      this.oauthStates = new Map();
    }
    
    // Set expiration for 10 minutes
    const expiration = Date.now() + 10 * 60 * 1000;
    this.oauthStates.set(state, { ...data, expiration });
  }

  /**
   * Get OAuth state
   */
  getOAuthState(state) {
    if (!this.oauthStates) {
      return null;
    }
    
    const data = this.oauthStates.get(state);
    
    if (!data || data.expiration < Date.now()) {
      this.oauthStates.delete(state);
      return null;
    }
    
    // Clean up after use
    this.oauthStates.delete(state);
    return data;
  }

  /**
   * Log authentication event
   */
  async logAuthEvent(userId, action, success, details = {}) {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO auth_audit_log 
        (user_id, action, success, details, created_at)
        VALUES (?, ?, ?, ?, datetime('now'))
      `;
      
      this.db.run(query, [userId, action, success, JSON.stringify(details)], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.lastID);
        }
      });
    });
  }

  /**
   * Get OAuth provider configuration
   */
  getProviderConfig(providerName) {
    const provider = this.providers.get(providerName);
    
    if (!provider) {
      throw new Error(`OAuth provider not found: ${providerName}`);
    }

    return {
      name: provider.name,
      displayName: provider.display_name,
      scopes: provider.scopes,
      redirectUri: provider.redirect_uri
    };
  }

  /**
   * Update OAuth provider configuration
   */
  async updateProviderConfig(providerName, config) {
    return new Promise((resolve, reject) => {
      const query = `
        UPDATE oauth_providers 
        SET client_id = ?, client_secret = ?, redirect_uri = ?, scopes = ?, updated_at = datetime('now')
        WHERE name = ?
      `;
      
      this.db.run(query, [
        config.clientId,
        config.clientSecret,
        config.redirectUri,
        JSON.stringify(config.scopes || []),
        providerName
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          // Reload providers
          this.loadProviders().then(() => {
            resolve(this.changes);
          }).catch(reject);
        }
      });
    });
  }

  /**
   * Validate OAuth configuration
   */
  validateProviderConfig(providerName, config) {
    const required = ['clientId', 'clientSecret', 'redirectUri'];
    
    for (const field of required) {
      if (!config[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    // Validate redirect URI format
    try {
      new URL(config.redirectUri);
    } catch {
      throw new Error('Invalid redirect URI format');
    }

    return true;
  }
}

module.exports = new OAuth2Service();
