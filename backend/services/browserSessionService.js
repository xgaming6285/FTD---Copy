const Lead = require('../models/Lead');
const crypto = require('crypto');
const sessionSecurity = require('../utils/sessionSecurity');

/**
 * Browser Session Management Service
 * Handles capturing, storing, and restoring browser sessions for FTD injection system
 */
class BrowserSessionService {
  constructor() {
    this.sessionTimeout = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds
  }

  /**
   * Capture session data from a Playwright page
   * @param {Page} page - Playwright page object
   * @param {Object} options - Additional options
   * @returns {Object} Session data object
   */
  async captureSession(page, options = {}) {
    try {
      console.log('🔍 Starting session capture...');
      
      // Get current URL for domain extraction
      const currentUrl = page.url();
      const domain = new URL(currentUrl).hostname;
      
      // Capture cookies from the browser context
      const cookies = await page.context().cookies();
      console.log(`📄 Captured ${cookies.length} cookies`);
      
      // Capture localStorage
      const localStorage = await page.evaluate(() => {
        const storage = {};
        for (let i = 0; i < window.localStorage.length; i++) {
          const key = window.localStorage.key(i);
          storage[key] = window.localStorage.getItem(key);
        }
        return storage;
      }).catch(() => ({})); // Fallback to empty object if localStorage is not accessible
      
      console.log(`💾 Captured ${Object.keys(localStorage).length} localStorage items`);
      
      // Capture sessionStorage
      const sessionStorage = await page.evaluate(() => {
        const storage = {};
        for (let i = 0; i < window.sessionStorage.length; i++) {
          const key = window.sessionStorage.key(i);
          storage[key] = window.sessionStorage.getItem(key);
        }
        return storage;
      }).catch(() => ({})); // Fallback to empty object if sessionStorage is not accessible
      
      console.log(`🗂️ Captured ${Object.keys(sessionStorage).length} sessionStorage items`);
      
      // Get user agent
      const userAgent = await page.evaluate(() => navigator.userAgent);
      
      // Get viewport size
      const viewport = page.viewportSize() || { width: 1366, height: 768 };
      
      // Generate unique session ID
      const sessionId = this.generateSessionId();
      
      // Create session data structure
      const sessionData = {
        sessionId,
        cookies: cookies.map(cookie => ({
          name: cookie.name,
          value: cookie.value,
          domain: cookie.domain,
          path: cookie.path,
          expires: cookie.expires ? new Date(cookie.expires * 1000) : null,
          httpOnly: cookie.httpOnly || false,
          secure: cookie.secure || false,
          sameSite: cookie.sameSite || 'Lax'
        })),
        localStorage,
        sessionStorage,
        userAgent,
        viewport,
        createdAt: new Date(),
        lastAccessedAt: new Date(),
        isActive: true,
        metadata: {
          domain,
          success: options.success !== undefined ? options.success : true,
          injectionType: options.injectionType || 'manual_ftd',
          notes: options.notes || '',
          ...options.metadata
        }
      };
      
      console.log('✅ Session capture completed successfully');
      console.log(`📊 Session summary: ${cookies.length} cookies, ${Object.keys(localStorage).length} localStorage, ${Object.keys(sessionStorage).length} sessionStorage`);
      
      return sessionData;
      
    } catch (error) {
      console.error('❌ Error capturing session:', error);
      throw new Error(`Failed to capture session: ${error.message}`);
    }
  }

  /**
   * Store session data in the database for a specific lead
   * @param {String} leadId - Lead ObjectId
   * @param {Object} sessionData - Session data to store
   * @param {String} orderId - Optional Order ObjectId
   * @param {String} assignedBy - Optional User ObjectId who assigned
   * @returns {Object} Updated lead with session data
   */
  async storeSession(leadId, sessionData, orderId = null, assignedBy = null) {
    try {
      console.log(`💾 Storing session for lead: ${leadId}`);
      
      // Validate session data
      const validationResult = this.validateSession(sessionData);
      if (!validationResult.isValid) {
        throw new Error(`Invalid session data: ${validationResult.errors.join(', ')}`);
      }
      
      // Find the lead
      const lead = await Lead.findById(leadId);
      if (!lead) {
        throw new Error(`Lead not found: ${leadId}`);
      }
      
      // Encrypt session data before storage
      const encryptedSessionData = sessionSecurity.encryptSessionData(sessionData);
      
      // Store the encrypted session using the Lead model method
      const updatedLead = await lead.storeBrowserSession(encryptedSessionData, orderId, assignedBy);
      
      // Log session storage
      sessionSecurity.logSessionAccess({
        sessionId: sessionData.sessionId,
        leadId: leadId,
        userId: assignedBy,
        userRole: 'system', // This is a system operation
        action: 'store',
        success: true,
        metadata: {
          orderId: orderId,
          domain: sessionData.metadata?.domain
        }
      });
      
      console.log(`✅ Session stored and encrypted successfully for lead: ${leadId}`);
      console.log(`🔑 Session ID: ${sessionData.sessionId}`);
      
      return updatedLead;
      
    } catch (error) {
      console.error('❌ Error storing session:', error);
      throw new Error(`Failed to store session: ${error.message}`);
    }
  }

  /**
   * Restore session data to a Playwright page
   * @param {Page} page - Playwright page object
   * @param {Object} sessionData - Session data to restore (may be encrypted)
   * @param {Object} options - Restoration options
   * @returns {Boolean} Success status
   */
  async restoreSession(page, sessionData, options = {}) {
    try {
      console.log(`🔄 Restoring session: ${sessionData.sessionId || 'unknown'}`);
      
      // Decrypt session data if encrypted
      const decryptedSessionData = sessionSecurity.decryptSessionData(sessionData);
      
      // Validate session before restoration using security utility
      const validationResult = sessionSecurity.validateSessionIntegrity(decryptedSessionData);
      if (!validationResult.isValid) {
        console.warn('⚠️ Session validation failed, attempting restoration anyway');
        console.warn('Validation errors:', validationResult.errors);
        
        if (validationResult.isTampered) {
          throw new Error('Session data appears to be tampered with - restoration denied');
        }
      }
      
      // Use decrypted data for restoration
      const activeSessionData = decryptedSessionData;
      
      // Set viewport if specified
      if (activeSessionData.viewport && activeSessionData.viewport.width && activeSessionData.viewport.height) {
        await page.setViewportSize(activeSessionData.viewport);
        console.log(`📐 Viewport set to: ${activeSessionData.viewport.width}x${activeSessionData.viewport.height}`);
      }
      
      // Set user agent if specified
      if (activeSessionData.userAgent) {
        await page.setExtraHTTPHeaders({
          'User-Agent': activeSessionData.userAgent
        });
        console.log('🤖 User agent set');
      }
      
      // Restore cookies
      if (activeSessionData.cookies && activeSessionData.cookies.length > 0) {
        // Filter out expired cookies
        const validCookies = activeSessionData.cookies.filter(cookie => {
          if (!cookie.expires) return true;
          return new Date(cookie.expires) > new Date();
        });
        
        if (validCookies.length > 0) {
          await page.context().addCookies(validCookies);
          console.log(`🍪 Restored ${validCookies.length} cookies (${activeSessionData.cookies.length - validCookies.length} expired)`);
        } else {
          console.log('🍪 No valid cookies to restore (all expired)');
        }
      }
      
      // Navigate to the target domain if specified
      let targetUrl = options.targetUrl;
      if (!targetUrl && activeSessionData.metadata && activeSessionData.metadata.domain) {
        targetUrl = `https://${activeSessionData.metadata.domain}`;
      }
      
      if (targetUrl) {
        console.log(`🌐 Navigating to: ${targetUrl}`);
        await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      }
      
      // Restore localStorage
      if (activeSessionData.localStorage && Object.keys(activeSessionData.localStorage).length > 0) {
        await page.evaluate((localStorageData) => {
          for (const [key, value] of Object.entries(localStorageData)) {
            try {
              window.localStorage.setItem(key, value);
            } catch (e) {
              console.warn(`Failed to set localStorage item: ${key}`, e);
            }
          }
        }, activeSessionData.localStorage);
        console.log(`💾 Restored ${Object.keys(activeSessionData.localStorage).length} localStorage items`);
      }
      
      // Restore sessionStorage
      if (activeSessionData.sessionStorage && Object.keys(activeSessionData.sessionStorage).length > 0) {
        await page.evaluate((sessionStorageData) => {
          for (const [key, value] of Object.entries(sessionStorageData)) {
            try {
              window.sessionStorage.setItem(key, value);
            } catch (e) {
              console.warn(`Failed to set sessionStorage item: ${key}`, e);
            }
          }
        }, activeSessionData.sessionStorage);
        console.log(`🗂️ Restored ${Object.keys(activeSessionData.sessionStorage).length} sessionStorage items`);
      }
      
      // Update last accessed timestamp
      if (activeSessionData.sessionId) {
        await this.updateSessionAccess(activeSessionData.sessionId);
      }
      
      console.log('✅ Session restoration completed successfully');
      return true;
      
    } catch (error) {
      console.error('❌ Error restoring session:', error);
      throw new Error(`Failed to restore session: ${error.message}`);
    }
  }

  /**
   * Generate a unique session identifier
   * @returns {String} Unique session ID
   */
  generateSessionId() {
    const timestamp = Date.now();
    const randomBytes = crypto.randomBytes(16).toString('hex');
    return `session_${timestamp}_${randomBytes}`;
  }

  /**
   * Validate session data structure and content
   * @param {Object} sessionData - Session data to validate
   * @returns {Object} Validation result with isValid flag and errors array
   */
  validateSession(sessionData) {
    const errors = [];
    
    try {
      // Check required fields
      if (!sessionData) {
        errors.push('Session data is null or undefined');
        return { isValid: false, errors };
      }
      
      if (!sessionData.sessionId) {
        errors.push('Session ID is required');
      }
      
      if (!sessionData.createdAt) {
        errors.push('Created date is required');
      } else {
        // Check if session is expired
        const sessionAge = Date.now() - new Date(sessionData.createdAt).getTime();
        if (sessionAge > this.sessionTimeout) {
          errors.push(`Session expired (${Math.floor(sessionAge / (24 * 60 * 60 * 1000))} days old)`);
        }
      }
      
      // Validate cookies structure
      if (sessionData.cookies) {
        if (!Array.isArray(sessionData.cookies)) {
          errors.push('Cookies must be an array');
        } else {
          sessionData.cookies.forEach((cookie, index) => {
            if (!cookie.name || !cookie.value) {
              errors.push(`Cookie at index ${index} missing name or value`);
            }
          });
        }
      }
      
      // Validate localStorage structure
      if (sessionData.localStorage && typeof sessionData.localStorage !== 'object') {
        errors.push('localStorage must be an object');
      }
      
      // Validate sessionStorage structure
      if (sessionData.sessionStorage && typeof sessionData.sessionStorage !== 'object') {
        errors.push('sessionStorage must be an object');
      }
      
      // Validate viewport structure
      if (sessionData.viewport) {
        if (typeof sessionData.viewport !== 'object' || 
            typeof sessionData.viewport.width !== 'number' || 
            typeof sessionData.viewport.height !== 'number') {
          errors.push('Viewport must be an object with numeric width and height');
        }
      }
      
      // Validate metadata structure
      if (sessionData.metadata) {
        if (typeof sessionData.metadata !== 'object') {
          errors.push('Metadata must be an object');
        }
      }
      
    } catch (error) {
      errors.push(`Validation error: ${error.message}`);
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      isExpired: errors.some(error => error.includes('expired'))
    };
  }

  /**
   * Update the last accessed timestamp for a session
   * @param {String} sessionId - Session ID to update
   * @returns {Object} Updated lead document
   */
  async updateSessionAccess(sessionId) {
    try {
      // Find lead with this session ID and update last accessed time
      const lead = await Lead.findOne({
        $or: [
          { 'browserSession.sessionId': sessionId },
          { 'sessionHistory.sessionId': sessionId }
        ]
      });
      
      if (!lead) {
        throw new Error(`No lead found with session ID: ${sessionId}`);
      }
      
      // Update using the Lead model method
      await lead.updateSessionAccess(sessionId);
      
      console.log(`🕒 Updated last access time for session: ${sessionId}`);
      return lead;
      
    } catch (error) {
      console.error('❌ Error updating session access:', error);
      throw new Error(`Failed to update session access: ${error.message}`);
    }
  }

  /**
   * Get session data by lead ID
   * @param {String} leadId - Lead ObjectId
   * @param {String} sessionId - Optional specific session ID
   * @returns {Object} Session data or null
   */
  async getSessionByLeadId(leadId, sessionId = null) {
    try {
      const lead = await Lead.findById(leadId);
      if (!lead) {
        throw new Error(`Lead not found: ${leadId}`);
      }
      
      if (sessionId) {
        return lead.getSessionById(sessionId);
      } else {
        return lead.getCurrentBrowserSession();
      }
      
    } catch (error) {
      console.error('❌ Error getting session:', error);
      throw new Error(`Failed to get session: ${error.message}`);
    }
  }

  /**
   * Check if a lead has an active session
   * @param {String} leadId - Lead ObjectId
   * @returns {Boolean} True if lead has active session
   */
  async hasActiveSession(leadId) {
    try {
      const lead = await Lead.findById(leadId);
      if (!lead) {
        return false;
      }
      
      return lead.hasActiveBrowserSession();
      
    } catch (error) {
      console.error('❌ Error checking active session:', error);
      return false;
    }
  }

  /**
   * Deactivate current session for a lead
   * @param {String} leadId - Lead ObjectId
   * @returns {Object} Updated lead document
   */
  async deactivateSession(leadId) {
    try {
      const lead = await Lead.findById(leadId);
      if (!lead) {
        throw new Error(`Lead not found: ${leadId}`);
      }
      
      await lead.deactivateCurrentSession();
      console.log(`🔄 Deactivated current session for lead: ${leadId}`);
      
      return lead;
      
    } catch (error) {
      console.error('❌ Error deactivating session:', error);
      throw new Error(`Failed to deactivate session: ${error.message}`);
    }
  }

  /**
   * Clean up expired sessions for all leads
   * @param {Number} daysOld - Age threshold in days (default: 30)
   * @returns {Object} Cleanup statistics
   */
  async cleanupExpiredSessions(daysOld = 30) {
    try {
      console.log(`🧹 Starting cleanup of sessions older than ${daysOld} days...`);
      
      const leads = await Lead.find({
        $or: [
          { 'browserSession.createdAt': { $exists: true } },
          { 'sessionHistory.0': { $exists: true } }
        ]
      });
      
      let cleanedLeads = 0;
      let totalSessionsRemoved = 0;
      
      for (const lead of leads) {
        const initialSessionCount = lead.sessionHistory.length + (lead.browserSession ? 1 : 0);
        await lead.clearExpiredSessions(daysOld);
        const finalSessionCount = lead.sessionHistory.length + (lead.browserSession ? 1 : 0);
        
        const sessionsRemoved = initialSessionCount - finalSessionCount;
        if (sessionsRemoved > 0) {
          cleanedLeads++;
          totalSessionsRemoved += sessionsRemoved;
        }
      }
      
      const stats = {
        leadsProcessed: leads.length,
        leadsCleaned: cleanedLeads,
        totalSessionsRemoved,
        daysThreshold: daysOld
      };
      
      console.log('✅ Session cleanup completed:', stats);
      return stats;
      
    } catch (error) {
      console.error('❌ Error during session cleanup:', error);
      throw new Error(`Failed to cleanup sessions: ${error.message}`);
    }
  }

  /**
   * Get session statistics
   * @returns {Object} Session statistics
   */
  async getSessionStatistics() {
    try {
      const stats = await Lead.aggregate([
        {
          $match: {
            $or: [
              { 'browserSession': { $exists: true } },
              { 'sessionHistory.0': { $exists: true } }
            ]
          }
        },
        {
          $project: {
            hasActiveSession: { $ifNull: ['$browserSession.isActive', false] },
            totalSessions: { 
              $add: [
                { $cond: [{ $ifNull: ['$browserSession', false] }, 1, 0] },
                { $size: { $ifNull: ['$sessionHistory', []] } }
              ]
            },
            sessionHistoryCount: { $size: { $ifNull: ['$sessionHistory', []] } },
            lastSessionDate: {
              $max: [
                '$browserSession.createdAt',
                { $max: '$sessionHistory.createdAt' }
              ]
            }
          }
        },
        {
          $group: {
            _id: null,
            totalLeadsWithSessions: { $sum: 1 },
            leadsWithActiveSessions: { $sum: { $cond: ['$hasActiveSession', 1, 0] } },
            totalSessions: { $sum: '$totalSessions' },
            averageSessionsPerLead: { $avg: '$totalSessions' },
            mostRecentSession: { $max: '$lastSessionDate' }
          }
        }
      ]);
      
      return stats[0] || {
        totalLeadsWithSessions: 0,
        leadsWithActiveSessions: 0,
        totalSessions: 0,
        averageSessionsPerLead: 0,
        mostRecentSession: null
      };
      
    } catch (error) {
      console.error('❌ Error getting session statistics:', error);
      throw new Error(`Failed to get session statistics: ${error.message}`);
    }
  }
}

module.exports = new BrowserSessionService(); 