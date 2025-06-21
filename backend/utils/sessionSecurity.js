const crypto = require('crypto');
const mongoose = require('mongoose');

/**
 * Session Security and Encryption Utility
 * Provides security measures for browser session data including encryption,
 * access logging, and session validation for the FTD injection system.
 */
class SessionSecurity {
  constructor() {
    // Encryption configuration
    this.algorithm = 'aes-256-cbc';
    this.keyLength = 32; // 256 bits
    this.ivLength = 16; // 128 bits
    this.tagLength = 16; // 128 bits
    this.saltLength = 32; // 256 bits
    
    // Get encryption key from environment or generate a default one
    this.masterKey = this.getMasterKey();
    
    // Session validation rules
    this.validationRules = {
      maxSessionAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      maxCookieSize: 4096, // 4KB per cookie
      maxStorageItemSize: 1024 * 1024, // 1MB per storage item
      maxTotalCookies: 100,
      maxStorageItems: 50,
      requiredFields: ['sessionId', 'createdAt', 'cookies'],
      sensitiveFields: ['cookies', 'localStorage', 'sessionStorage']
    };
    
    // Access logging configuration
    this.accessLog = [];
    this.maxLogEntries = 1000;
    this.suspiciousActivityThreshold = 10; // attempts per minute
  }

  /**
   * Get or generate master encryption key
   * @returns {Buffer} Master key for encryption
   */
  getMasterKey() {
    const envKey = process.env.SESSION_ENCRYPTION_KEY;
    
    if (envKey) {
      // Use key from environment variable
      if (envKey.length !== 64) { // 32 bytes = 64 hex chars
        console.warn('⚠️ SESSION_ENCRYPTION_KEY should be 64 hex characters (32 bytes)');
      }
      return Buffer.from(envKey.substring(0, 64), 'hex');
    } else {
      // Generate a default key (NOT recommended for production)
      console.warn('⚠️ No SESSION_ENCRYPTION_KEY found in environment. Using default key.');
      console.warn('⚠️ Please set SESSION_ENCRYPTION_KEY for production use.');
      
      // Generate a deterministic key based on a seed
      const seed = 'ftd-session-encryption-default-key-2024';
      return crypto.pbkdf2Sync(seed, 'salt', 100000, 32, 'sha256');
    }
  }

  /**
   * Derive encryption key from master key and salt
   * @param {Buffer} salt - Random salt
   * @returns {Buffer} Derived key
   */
  deriveKey(salt) {
    return crypto.pbkdf2Sync(this.masterKey, salt, 100000, this.keyLength, 'sha256');
  }

  /**
   * Encrypt sensitive session data
   * @param {Object} sessionData - Session data to encrypt
   * @returns {Object} Encrypted session data with metadata
   */
  encryptSessionData(sessionData) {
    try {
      console.log('🔐 Encrypting session data...');
      
      // Validate input
      if (!sessionData || typeof sessionData !== 'object') {
        throw new Error('Session data must be a valid object');
      }

      // Create a copy to avoid modifying original
      const dataToEncrypt = JSON.parse(JSON.stringify(sessionData));
      
      // Generate salt and IV
      const salt = crypto.randomBytes(this.saltLength);
      const iv = crypto.randomBytes(this.ivLength);
      
      // Derive encryption key
      const key = this.deriveKey(salt);
      
      // Encrypt sensitive fields
      const encryptedData = { ...dataToEncrypt };
      
      for (const field of this.validationRules.sensitiveFields) {
        if (dataToEncrypt[field]) {
          const plaintext = JSON.stringify(dataToEncrypt[field]);
          const fieldIv = crypto.randomBytes(this.ivLength);
          
          // Create new cipher for each field using AES-256-CBC with explicit IV
          const fieldCipher = crypto.createCipheriv('aes-256-cbc', key, fieldIv);
          
          let encrypted = fieldCipher.update(plaintext, 'utf8', 'hex');
          encrypted += fieldCipher.final('hex');
          
          encryptedData[field] = {
            encrypted: encrypted,
            iv: fieldIv.toString('hex'),
            _encrypted: true
          };
        }
      }
      
      // Add encryption metadata
      encryptedData._encryption = {
        algorithm: this.algorithm,
        salt: salt.toString('hex'),
        encryptedAt: new Date(),
        version: '1.0'
      };
      
      console.log('✅ Session data encrypted successfully');
      return encryptedData;
      
    } catch (error) {
      console.error('❌ Error encrypting session data:', error);
      throw new Error(`Failed to encrypt session data: ${error.message}`);
    }
  }

  /**
   * Decrypt sensitive session data
   * @param {Object} encryptedSessionData - Encrypted session data
   * @returns {Object} Decrypted session data
   */
  decryptSessionData(encryptedSessionData) {
    try {
      console.log('🔓 Decrypting session data...');
      
      // Validate input
      if (!encryptedSessionData || typeof encryptedSessionData !== 'object') {
        throw new Error('Encrypted session data must be a valid object');
      }

      // Check if data is actually encrypted
      if (!encryptedSessionData._encryption) {
        console.log('ℹ️ Session data is not encrypted, returning as-is');
        return encryptedSessionData;
      }

      // Create a copy to avoid modifying original
      const dataToDecrypt = JSON.parse(JSON.stringify(encryptedSessionData));
      
      // Extract encryption metadata
      const { salt, algorithm, version } = dataToDecrypt._encryption;
      
      if (algorithm !== this.algorithm) {
        throw new Error(`Unsupported encryption algorithm: ${algorithm}`);
      }
      
      // Derive decryption key
      const key = this.deriveKey(Buffer.from(salt, 'hex'));
      
      // Decrypt sensitive fields
      const decryptedData = { ...dataToDecrypt };
      
      for (const field of this.validationRules.sensitiveFields) {
        if (dataToDecrypt[field] && dataToDecrypt[field]._encrypted) {
          const fieldData = dataToDecrypt[field];
          const iv = Buffer.from(fieldData.iv, 'hex');
          
          // Create decipher using AES-256-CBC with explicit IV
          const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
          
          let decrypted = decipher.update(fieldData.encrypted, 'hex', 'utf8');
          decrypted += decipher.final('utf8');
          
          // Parse decrypted JSON
          decryptedData[field] = JSON.parse(decrypted);
        }
      }
      
      // Remove encryption metadata
      delete decryptedData._encryption;
      
      console.log('✅ Session data decrypted successfully');
      return decryptedData;
      
    } catch (error) {
      console.error('❌ Error decrypting session data:', error);
      throw new Error(`Failed to decrypt session data: ${error.message}`);
    }
  }

  /**
   * Log session access attempt
   * @param {Object} accessInfo - Information about the access attempt
   */
  logSessionAccess(accessInfo) {
    try {
      const logEntry = {
        timestamp: new Date(),
        sessionId: accessInfo.sessionId,
        leadId: accessInfo.leadId,
        userId: accessInfo.userId,
        userRole: accessInfo.userRole,
        action: accessInfo.action, // 'access', 'store', 'update', 'delete'
        ipAddress: accessInfo.ipAddress,
        userAgent: accessInfo.userAgent,
        success: accessInfo.success !== false, // default to true
        errorMessage: accessInfo.errorMessage,
        metadata: accessInfo.metadata || {}
      };

      // Add to in-memory log
      this.accessLog.push(logEntry);
      
      // Maintain log size limit
      if (this.accessLog.length > this.maxLogEntries) {
        this.accessLog = this.accessLog.slice(-this.maxLogEntries);
      }

      // Log to console for debugging
      const logLevel = logEntry.success ? 'info' : 'warn';
      console.log(`📋 Session access logged [${logLevel.toUpperCase()}]:`, {
        action: logEntry.action,
        sessionId: logEntry.sessionId?.substring(0, 12) + '...',
        userId: logEntry.userId,
        success: logEntry.success,
        timestamp: logEntry.timestamp.toISOString()
      });

      // Check for suspicious activity
      this.detectSuspiciousActivity(logEntry);

    } catch (error) {
      console.error('❌ Error logging session access:', error);
    }
  }

  /**
   * Detect suspicious session activity
   * @param {Object} logEntry - Latest log entry
   */
  detectSuspiciousActivity(logEntry) {
    try {
      const now = new Date();
      const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
      
      // Check for rapid access attempts from same user
      const recentAttempts = this.accessLog.filter(entry => 
        entry.userId === logEntry.userId &&
        entry.timestamp > oneMinuteAgo &&
        entry.action === 'access'
      );

      if (recentAttempts.length > this.suspiciousActivityThreshold) {
        console.warn('🚨 SUSPICIOUS ACTIVITY DETECTED:', {
          userId: logEntry.userId,
          attempts: recentAttempts.length,
          timeWindow: '1 minute',
          lastAttempt: logEntry.timestamp.toISOString()
        });

        // Could integrate with external alerting system here
        this.triggerSecurityAlert('rapid_session_access', {
          userId: logEntry.userId,
          attempts: recentAttempts.length,
          ipAddress: logEntry.ipAddress
        });
      }

      // Check for failed access attempts
      const recentFailures = this.accessLog.filter(entry =>
        entry.userId === logEntry.userId &&
        entry.timestamp > oneMinuteAgo &&
        !entry.success
      );

      if (recentFailures.length > 5) {
        console.warn('🚨 MULTIPLE FAILED ACCESS ATTEMPTS:', {
          userId: logEntry.userId,
          failures: recentFailures.length,
          timeWindow: '1 minute'
        });

        this.triggerSecurityAlert('multiple_access_failures', {
          userId: logEntry.userId,
          failures: recentFailures.length,
          ipAddress: logEntry.ipAddress
        });
      }

    } catch (error) {
      console.error('❌ Error detecting suspicious activity:', error);
    }
  }

  /**
   * Trigger security alert
   * @param {String} alertType - Type of security alert
   * @param {Object} alertData - Alert data
   */
  triggerSecurityAlert(alertType, alertData) {
    // This would integrate with external monitoring/alerting systems
    console.warn(`🚨 SECURITY ALERT [${alertType.toUpperCase()}]:`, alertData);
    
    // Could send to external services like:
    // - Slack notifications
    // - Email alerts
    // - Security monitoring dashboards
    // - Incident response systems
  }

  /**
   * Validate session data integrity and authenticity
   * @param {Object} sessionData - Session data to validate
   * @returns {Object} Validation result
   */
  validateSessionIntegrity(sessionData) {
    const errors = [];
    const warnings = [];

    try {
      // Basic structure validation
      if (!sessionData || typeof sessionData !== 'object') {
        errors.push('Session data must be a valid object');
        return { isValid: false, errors, warnings };
      }

      // Check required fields
      for (const field of this.validationRules.requiredFields) {
        if (!sessionData[field]) {
          errors.push(`Missing required field: ${field}`);
        }
      }

      // Validate session ID format
      if (sessionData.sessionId && !sessionData.sessionId.match(/^session_\d+_[a-f0-9]+$/)) {
        errors.push('Invalid session ID format');
      }

      // Check session age
      if (sessionData.createdAt) {
        const sessionAge = Date.now() - new Date(sessionData.createdAt).getTime();
        if (sessionAge > this.validationRules.maxSessionAge) {
          errors.push(`Session expired (${Math.floor(sessionAge / (24 * 60 * 60 * 1000))} days old)`);
        }
      }

      // Validate cookies
      if (sessionData.cookies) {
        if (!Array.isArray(sessionData.cookies)) {
          errors.push('Cookies must be an array');
        } else {
          if (sessionData.cookies.length > this.validationRules.maxTotalCookies) {
            warnings.push(`Too many cookies (${sessionData.cookies.length}), consider cleanup`);
          }

          sessionData.cookies.forEach((cookie, index) => {
            if (!cookie.name || !cookie.value) {
              errors.push(`Cookie at index ${index} missing name or value`);
            }
            if (cookie.value && cookie.value.length > this.validationRules.maxCookieSize) {
              warnings.push(`Cookie '${cookie.name}' is very large (${cookie.value.length} bytes)`);
            }
          });
        }
      }

      // Validate storage data
      ['localStorage', 'sessionStorage'].forEach(storageType => {
        if (sessionData[storageType] && typeof sessionData[storageType] === 'object') {
          const items = Object.keys(sessionData[storageType]);
          if (items.length > this.validationRules.maxStorageItems) {
            warnings.push(`Too many ${storageType} items (${items.length})`);
          }

          items.forEach(key => {
            const value = sessionData[storageType][key];
            if (typeof value === 'string' && value.length > this.validationRules.maxStorageItemSize) {
              warnings.push(`${storageType} item '${key}' is very large (${value.length} bytes)`);
            }
          });
        }
      });

      // Check for tampering indicators
      if (sessionData._encryption && sessionData._encryption.version) {
        // Validate encryption metadata
        const { salt, algorithm, encryptedAt } = sessionData._encryption;
        if (!salt || !algorithm || !encryptedAt) {
          errors.push('Incomplete encryption metadata - possible tampering');
        }
      }

      // Validate viewport
      if (sessionData.viewport) {
        const { width, height } = sessionData.viewport;
        if (typeof width !== 'number' || typeof height !== 'number') {
          errors.push('Invalid viewport dimensions');
        }
        if (width < 100 || height < 100 || width > 4000 || height > 4000) {
          warnings.push('Unusual viewport dimensions');
        }
      }

    } catch (error) {
      errors.push(`Validation error: ${error.message}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      hasWarnings: warnings.length > 0,
      isExpired: errors.some(error => error.includes('expired')),
      isTampered: errors.some(error => error.includes('tampering'))
    };
  }

  /**
   * Generate secure session hash for integrity checking
   * @param {Object} sessionData - Session data to hash
   * @returns {String} SHA-256 hash of session data
   */
  generateSessionHash(sessionData) {
    try {
      // Create a normalized version for hashing
      const normalizedData = {
        sessionId: sessionData.sessionId,
        createdAt: sessionData.createdAt,
        cookieCount: sessionData.cookies ? sessionData.cookies.length : 0,
        localStorageKeys: sessionData.localStorage ? Object.keys(sessionData.localStorage).sort() : [],
        sessionStorageKeys: sessionData.sessionStorage ? Object.keys(sessionData.sessionStorage).sort() : [],
        userAgent: sessionData.userAgent,
        domain: sessionData.metadata?.domain
      };

      const dataString = JSON.stringify(normalizedData);
      return crypto.createHash('sha256').update(dataString).digest('hex');

    } catch (error) {
      console.error('❌ Error generating session hash:', error);
      return null;
    }
  }

  /**
   * Get session access statistics
   * @param {Object} filters - Optional filters for statistics
   * @returns {Object} Access statistics
   */
  getAccessStatistics(filters = {}) {
    try {
      const { userId, sessionId, timeRange, action } = filters;
      
      let filteredLogs = this.accessLog;

      // Apply filters
      if (userId) {
        filteredLogs = filteredLogs.filter(entry => entry.userId === userId);
      }
      if (sessionId) {
        filteredLogs = filteredLogs.filter(entry => entry.sessionId === sessionId);
      }
      if (action) {
        filteredLogs = filteredLogs.filter(entry => entry.action === action);
      }
      if (timeRange) {
        const cutoff = new Date(Date.now() - timeRange);
        filteredLogs = filteredLogs.filter(entry => entry.timestamp > cutoff);
      }

      // Calculate statistics
      const stats = {
        totalAccesses: filteredLogs.length,
        successfulAccesses: filteredLogs.filter(entry => entry.success).length,
        failedAccesses: filteredLogs.filter(entry => !entry.success).length,
        uniqueUsers: new Set(filteredLogs.map(entry => entry.userId)).size,
        uniqueSessions: new Set(filteredLogs.map(entry => entry.sessionId)).size,
        actionBreakdown: {},
        userBreakdown: {},
        timeRange: {
          earliest: filteredLogs.length > 0 ? Math.min(...filteredLogs.map(e => e.timestamp)) : null,
          latest: filteredLogs.length > 0 ? Math.max(...filteredLogs.map(e => e.timestamp)) : null
        }
      };

      // Action breakdown
      filteredLogs.forEach(entry => {
        stats.actionBreakdown[entry.action] = (stats.actionBreakdown[entry.action] || 0) + 1;
      });

      // User breakdown
      filteredLogs.forEach(entry => {
        if (!stats.userBreakdown[entry.userId]) {
          stats.userBreakdown[entry.userId] = { total: 0, successful: 0, failed: 0 };
        }
        stats.userBreakdown[entry.userId].total++;
        if (entry.success) {
          stats.userBreakdown[entry.userId].successful++;
        } else {
          stats.userBreakdown[entry.userId].failed++;
        }
      });

      return stats;

    } catch (error) {
      console.error('❌ Error getting access statistics:', error);
      return null;
    }
  }

  /**
   * Clear access logs older than specified time
   * @param {Number} maxAge - Maximum age in milliseconds
   * @returns {Number} Number of entries removed
   */
  cleanupAccessLogs(maxAge = 7 * 24 * 60 * 60 * 1000) { // 7 days default
    try {
      const cutoff = new Date(Date.now() - maxAge);
      const initialLength = this.accessLog.length;
      
      this.accessLog = this.accessLog.filter(entry => entry.timestamp > cutoff);
      
      const removedCount = initialLength - this.accessLog.length;
      
      if (removedCount > 0) {
        console.log(`🧹 Cleaned up ${removedCount} old access log entries`);
      }
      
      return removedCount;

    } catch (error) {
      console.error('❌ Error cleaning up access logs:', error);
      return 0;
    }
  }

  /**
   * Generate security report
   * @returns {Object} Comprehensive security report
   */
  generateSecurityReport() {
    try {
      const now = new Date();
      const last24Hours = 24 * 60 * 60 * 1000;
      const last7Days = 7 * 24 * 60 * 60 * 1000;

      return {
        reportGeneratedAt: now,
        accessStatistics: {
          last24Hours: this.getAccessStatistics({ timeRange: last24Hours }),
          last7Days: this.getAccessStatistics({ timeRange: last7Days }),
          overall: this.getAccessStatistics()
        },
        securityMetrics: {
          totalLogEntries: this.accessLog.length,
          encryptionStatus: {
            algorithm: this.algorithm,
            keyLength: this.keyLength,
            hasEnvironmentKey: !!process.env.SESSION_ENCRYPTION_KEY
          },
          validationRules: this.validationRules,
          suspiciousActivityThreshold: this.suspiciousActivityThreshold
        },
        recommendations: this.generateSecurityRecommendations()
      };

    } catch (error) {
      console.error('❌ Error generating security report:', error);
      return null;
    }
  }

  /**
   * Generate security recommendations based on current state
   * @returns {Array} Array of security recommendations
   */
  generateSecurityRecommendations() {
    const recommendations = [];

    // Check encryption key
    if (!process.env.SESSION_ENCRYPTION_KEY) {
      recommendations.push({
        priority: 'HIGH',
        category: 'encryption',
        message: 'Set SESSION_ENCRYPTION_KEY environment variable for production security',
        action: 'Generate a secure 64-character hex key and set it as SESSION_ENCRYPTION_KEY'
      });
    }

    // Check log size
    if (this.accessLog.length > this.maxLogEntries * 0.8) {
      recommendations.push({
        priority: 'MEDIUM',
        category: 'logging',
        message: 'Access log is approaching maximum size',
        action: 'Consider implementing persistent logging or increasing cleanup frequency'
      });
    }

    // Check for failed access patterns
    const recentFailures = this.accessLog.filter(entry => 
      !entry.success && 
      entry.timestamp > new Date(Date.now() - 24 * 60 * 60 * 1000)
    );

    if (recentFailures.length > 10) {
      recommendations.push({
        priority: 'HIGH',
        category: 'security',
        message: `High number of failed access attempts (${recentFailures.length}) in last 24 hours`,
        action: 'Review failed access patterns and consider implementing additional security measures'
      });
    }

    return recommendations;
  }
}

module.exports = new SessionSecurity();