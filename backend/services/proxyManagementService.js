const Proxy = require('../models/Proxy');
const Lead = require('../models/Lead');
const { generateProxyConfig, testProxyConnection } = require('../utils/proxyManager');

/**
 * Proxy Management Service
 * Handles proxy assignment, sharing, and expiration for leads
 */
class ProxyManagementService {

  /**
   * Assign proxies to leads based on their countries and lead types
   * @param {Array} leads - Array of lead objects
   * @param {Object} proxyConfig - Proxy configuration from order
   * @param {string} createdBy - User ID who is creating the assignment
   * @returns {Promise<Object>} Assignment results
   */
  static async assignProxiesToLeads(leads, proxyConfig, createdBy) {
    const results = {
      successful: [],
      failed: [],
      skipped: []
    };

    if (!leads || leads.length === 0) {
      return results;
    }

    try {
      // Group leads by country and type for efficient proxy assignment
      const leadGroups = this.groupLeadsByCountryAndType(leads);
      
      console.log('Lead groups for proxy assignment:', Object.keys(leadGroups));

      // Process each group
      for (const [groupKey, groupLeads] of Object.entries(leadGroups)) {
        const [country, leadType] = groupKey.split('_');
        
        try {
          const groupResults = await this.assignProxyToGroup(
            groupLeads, 
            country, 
            leadType, 
            proxyConfig, 
            createdBy
          );
          
          results.successful.push(...groupResults.successful);
          results.failed.push(...groupResults.failed);
          results.skipped.push(...groupResults.skipped);
          
        } catch (error) {
          console.error(`Error assigning proxy to group ${groupKey}:`, error);
          // Mark all leads in this group as failed
          groupLeads.forEach(lead => {
            results.failed.push({
              leadId: lead._id,
              country,
              leadType,
              error: error.message
            });
          });
        }
      }

      return results;

    } catch (error) {
      console.error('Error in proxy assignment service:', error);
      throw error;
    }
  }

  /**
   * Group leads by country and lead type for proxy assignment
   */
  static groupLeadsByCountryAndType(leads) {
    const groups = {};

    for (const lead of leads) {
      const country = lead.country;
      const leadType = lead.leadType;
      const groupKey = `${country}_${leadType}`;

      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      
      groups[groupKey].push(lead);
    }

    return groups;
  }

  /**
   * Assign proxy to a group of leads from the same country and type
   */
  static async assignProxyToGroup(leads, country, leadType, proxyConfig, createdBy) {
    const results = { successful: [], failed: [], skipped: [] };
    
    try {
      if (leadType === 'ftd') {
        return await this.assignFTDProxies(leads, country, proxyConfig, createdBy);
      } else {
        return await this.assignNonFTDProxies(leads, country, createdBy);
      }
      
    } catch (error) {
      console.error(`Error assigning proxy to ${leadType} leads in ${country}:`, error);
      throw error;
    }
  }

  /**
   * Assign proxies to FTD leads (with sharing capability)
   */
  static async assignFTDProxies(ftdLeads, country, proxyConfig, createdBy) {
    const results = { successful: [], failed: [], skipped: [] };
    
    const { ftdProxySharing } = proxyConfig;
    const maxFTDsPerProxy = ftdProxySharing.maxFTDsPerProxy || 3;
    const shareByCountry = ftdProxySharing.shareByCountry !== false;

    if (!ftdProxySharing.enabled) {
      // No sharing - assign individual proxies
      return await this.assignIndividualProxies(ftdLeads, country, createdBy);
    }

    try {
      // Find existing proxy that can accept more FTDs from this country
      let availableProxy = null;
      
      if (shareByCountry) {
        availableProxy = await Proxy.findAvailableProxy(country, null, 'ftd');
      }

      // If no available proxy or it can't accept more FTDs, create a new one
      if (!availableProxy || !availableProxy.canAcceptFTD) {
        const countryCode = require('../utils/proxyManager').getCountryISOCode(country);
        availableProxy = await Proxy.createFromConfig(country, countryCode, createdBy);
        availableProxy.ftdSharing.isSharedProxy = true;
        availableProxy.ftdSharing.maxFTDsPerProxy = maxFTDsPerProxy;
        availableProxy.ftdSharing.sharedCountries.push(country);
        await availableProxy.save();
      }

      // Assign FTDs to this proxy up to the limit
      for (const lead of ftdLeads) {
        if (availableProxy.ftdSharing.currentFTDCount >= maxFTDsPerProxy) {
          // Create new proxy for remaining FTDs
          const countryCode = require('../utils/proxyManager').getCountryISOCode(country);
          availableProxy = await Proxy.createFromConfig(country, countryCode, createdBy);
          availableProxy.ftdSharing.isSharedProxy = true;
          availableProxy.ftdSharing.maxFTDsPerProxy = maxFTDsPerProxy;
          availableProxy.ftdSharing.sharedCountries.push(country);
          await availableProxy.save();
        }

        try {
          // Assign proxy to lead
          const assigned = availableProxy.assignLead(lead._id, lead.orderId, 'ftd');
          if (assigned) {
            lead.assignProxy(availableProxy._id, lead.orderId);
            await availableProxy.save();
            await lead.save();

            results.successful.push({
              leadId: lead._id,
              proxyId: availableProxy._id,
              country,
              leadType: 'ftd',
              shared: true
            });
          } else {
            results.failed.push({
              leadId: lead._id,
              error: 'Failed to assign proxy to lead'
            });
          }

        } catch (error) {
          console.error(`Error assigning FTD proxy to lead ${lead._id}:`, error);
          results.failed.push({
            leadId: lead._id,
            error: error.message
          });
        }
      }

      return results;

    } catch (error) {
      console.error(`Error in FTD proxy assignment for ${country}:`, error);
      throw error;
    }
  }

  /**
   * Assign individual proxies to non-FTD leads
   */
  static async assignNonFTDProxies(leads, country, createdBy) {
    return await this.assignIndividualProxies(leads, country, createdBy);
  }

  /**
   * Assign individual proxies to leads (one proxy per lead)
   */
  static async assignIndividualProxies(leads, country, createdBy) {
    const results = { successful: [], failed: [], skipped: [] };

    for (const lead of leads) {
      try {
        const countryCode = require('../utils/proxyManager').getCountryISOCode(country);
        const proxy = await Proxy.createFromConfig(country, countryCode, createdBy);

        // Assign proxy to lead
        const assigned = proxy.assignLead(lead._id, lead.orderId, lead.leadType);
        if (assigned) {
          lead.assignProxy(proxy._id, lead.orderId);
          await proxy.save();
          await lead.save();

          results.successful.push({
            leadId: lead._id,
            proxyId: proxy._id,
            country,
            leadType: lead.leadType,
            shared: false
          });
        } else {
          results.failed.push({
            leadId: lead._id,
            error: 'Failed to assign proxy to lead'
          });
        }

      } catch (error) {
        console.error(`Error assigning individual proxy to lead ${lead._id}:`, error);
        results.failed.push({
          leadId: lead._id,
          error: error.message
        });
      }
    }

    return results;
  }

  /**
   * Check proxy health and handle expiration
   */
  static async monitorProxyHealth() {
    try {
      console.log('Starting proxy health monitoring...');
      
      // Find all active proxies that need health check
      const activeProxies = await Proxy.find({
        status: 'active',
        'health.isHealthy': true,
        'health.lastHealthCheck': {
          $lt: new Date(Date.now() - 5 * 60 * 1000) // Last check was more than 5 minutes ago
        }
      });

      console.log(`Found ${activeProxies.length} proxies to health check`);

      const results = {
        healthy: 0,
        unhealthy: 0,
        expired: 0,
        errors: []
      };

      for (const proxy of activeProxies) {
        try {
          const isHealthy = await proxy.testConnection();
          
          if (isHealthy) {
            results.healthy++;
          } else {
            results.unhealthy++;
            
            // Handle unhealthy proxy
            await this.handleUnhealthyProxy(proxy);
          }

          await proxy.save();

        } catch (error) {
          console.error(`Error checking proxy ${proxy.proxyId}:`, error);
          results.errors.push({
            proxyId: proxy.proxyId,
            error: error.message
          });
        }
      }

      // Clean up expired proxies
      const cleanedUp = await Proxy.cleanupExpiredProxies();
      results.expired = cleanedUp;

      console.log('Proxy health monitoring completed:', results);
      return results;

    } catch (error) {
      console.error('Error in proxy health monitoring:', error);
      throw error;
    }
  }

  /**
   * Handle unhealthy proxy by reassigning leads if necessary
   */
  static async handleUnhealthyProxy(proxy) {
    try {
      console.log(`Handling unhealthy proxy: ${proxy.proxyId}`);

      // Get all leads using this proxy
      const affectedLeads = await Lead.find({
        'proxyAssignments.proxy': proxy._id,
        'proxyAssignments.status': 'active'
      });

      if (affectedLeads.length > 0) {
        console.log(`Found ${affectedLeads.length} leads affected by unhealthy proxy`);

        // For now, just mark proxy assignments as failed
        // In a production system, you might want to reassign to new proxies
        for (const lead of affectedLeads) {
          lead.completeProxyAssignment(proxy._id, 'failed');
          await lead.save();
        }

        // Update proxy to mark all assignments as failed
        proxy.assignedLeads.forEach(assignment => {
          if (assignment.status === 'active') {
            assignment.status = 'failed';
          }
        });
      }

    } catch (error) {
      console.error(`Error handling unhealthy proxy ${proxy.proxyId}:`, error);
    }
  }

  /**
   * Get proxy statistics
   */
  static async getProxyStats() {
    try {
      const stats = await Proxy.aggregate([
        {
          $group: {
            _id: {
              status: '$status',
              country: '$country'
            },
            count: { $sum: 1 },
            totalConnections: { $sum: '$usage.totalConnections' },
            activeConnections: { $sum: '$usage.activeConnections' }
          }
        },
        {
          $group: {
            _id: '$_id.status',
            totalProxies: { $sum: '$count' },
            countries: { $addToSet: '$_id.country' },
            totalConnections: { $sum: '$totalConnections' },
            activeConnections: { $sum: '$activeConnections' }
          }
        }
      ]);

      return stats;

    } catch (error) {
      console.error('Error getting proxy stats:', error);
      throw error;
    }
  }

  /**
   * Find and reassign expired proxies
   */
  static async handleExpiredProxies() {
    try {
      const expiredProxies = await Proxy.find({
        $or: [
          { 'expiration.isExpired': true },
          { 'expiration.expiresAt': { $lt: new Date() } }
        ],
        'usage.activeConnections': { $gt: 0 }
      });

      console.log(`Found ${expiredProxies.length} expired proxies with active connections`);

      for (const proxy of expiredProxies) {
        await this.handleExpiredProxy(proxy);
      }

      return expiredProxies.length;

    } catch (error) {
      console.error('Error handling expired proxies:', error);
      throw error;
    }
  }

  /**
   * Handle a single expired proxy
   */
  static async handleExpiredProxy(proxy) {
    try {
      console.log(`Handling expired proxy: ${proxy.proxyId}`);

      // Mark proxy as expired
      proxy.checkExpiration();
      
      // Get all leads with active assignments to this proxy
      const affectedLeads = await Lead.find({
        'proxyAssignments.proxy': proxy._id,
        'proxyAssignments.status': 'active'
      });

      // Mark all active assignments as expired
      for (const lead of affectedLeads) {
        lead.completeProxyAssignment(proxy._id, 'expired');
        await lead.save();
      }

      // Update proxy assignments
      proxy.assignedLeads.forEach(assignment => {
        if (assignment.status === 'active') {
          assignment.status = 'expired';
        }
      });

      proxy.usage.activeConnections = 0;
      await proxy.save();

      console.log(`Marked proxy ${proxy.proxyId} as expired and updated ${affectedLeads.length} lead assignments`);

    } catch (error) {
      console.error(`Error handling expired proxy ${proxy.proxyId}:`, error);
    }
  }

  /**
   * Extend proxy expiration
   */
  static async extendProxyExpiration(proxyId, hours = 24) {
    try {
      const proxy = await Proxy.findById(proxyId);
      if (!proxy) {
        throw new Error('Proxy not found');
      }

      proxy.extendExpiration(hours);
      await proxy.save();

      console.log(`Extended proxy ${proxy.proxyId} expiration by ${hours} hours`);
      return proxy;

    } catch (error) {
      console.error(`Error extending proxy expiration:`, error);
      throw error;
    }
  }

  /**
   * Get proxy for a specific lead and order
   */
  static async getLeadProxy(leadId, orderId) {
    try {
      const lead = await Lead.findById(leadId);
      if (!lead) {
        throw new Error('Lead not found');
      }

      const proxyId = lead.getActiveProxy(orderId);
      if (!proxyId) {
        return null;
      }

      return await Proxy.findById(proxyId);

    } catch (error) {
      console.error(`Error getting proxy for lead ${leadId}:`, error);
      throw error;
    }
  }
}

module.exports = ProxyManagementService;
