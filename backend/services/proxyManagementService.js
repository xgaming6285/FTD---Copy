const Proxy = require('../models/Proxy');
const Lead = require('../models/Lead');
const { generateProxyConfig, testProxyConnection } = require('../utils/proxyManager');

/**
 * Proxy Management Service
 * Handles proxy assignment with one-to-one proxy-lead relationships
 */
class ProxyManagementService {

  /**
   * Assign proxies to leads based on their countries and lead types
   * @param {Array} leads - Array of lead objects
   * @param {Object} proxyConfig - Proxy configuration from order (now ignored for one-to-one)
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
      // Group leads by country for efficient proxy assignment
      const leadGroups = this.groupLeadsByCountry(leads);
      
      console.log('Lead groups for proxy assignment:', Object.keys(leadGroups));

      // Process each group
      for (const [country, groupLeads] of Object.entries(leadGroups)) {
        try {
          const groupResults = await this.assignIndividualProxies(
            groupLeads, 
            country, 
            createdBy
          );
          
          results.successful.push(...groupResults.successful);
          results.failed.push(...groupResults.failed);
          results.skipped.push(...groupResults.skipped);
          
        } catch (error) {
          console.error(`Error assigning proxy to group ${country}:`, error);
          // Mark all leads in this group as failed
          groupLeads.forEach(lead => {
            results.failed.push({
              leadId: lead._id,
              country,
              leadType: lead.leadType,
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
   * Group leads by country for proxy assignment
   */
  static groupLeadsByCountry(leads) {
    const groups = {};

    for (const lead of leads) {
      const country = lead.country;

      if (!groups[country]) {
        groups[country] = [];
      }
      
      groups[country].push(lead);
    }

    return groups;
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

        // Mark proxy assignments as failed
        for (const lead of affectedLeads) {
          // Find the specific proxy assignment to mark as failed
          const assignment = lead.proxyAssignments.find(
            assignment => assignment.proxy.toString() === proxy._id.toString() && 
                          assignment.status === 'active'
          );
          if (assignment) {
            assignment.status = 'failed';
            assignment.completedAt = new Date();
          }
          await lead.save();
        }

        // Update proxy to mark assignment as failed (one-to-one relationship)
        if (proxy.assignedLead.leadId && proxy.assignedLead.status === 'active') {
          proxy.assignedLead.status = 'failed';
          proxy.assignedLead.completedAt = new Date();
          proxy.usage.activeConnections = 0;
          await proxy.save();
        }
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
        const assignment = lead.proxyAssignments.find(
          assignment => assignment.proxy.toString() === proxy._id.toString() && 
                        assignment.status === 'active'
        );
        if (assignment) {
          assignment.status = 'expired';
          assignment.completedAt = new Date();
        }
        await lead.save();
      }

      // Update proxy assignment (one-to-one relationship)
      if (proxy.assignedLead.leadId && proxy.assignedLead.status === 'active') {
        proxy.assignedLead.status = 'expired';
        proxy.assignedLead.completedAt = new Date();
      }

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
