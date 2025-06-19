const mongoose = require("mongoose");

const proxySchema = new mongoose.Schema(
  {
    // Proxy identification
    proxyId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    
    // Proxy configuration
    config: {
      server: {
        type: String,
        required: true
      },
      username: {
        type: String,
        required: true
      },
      password: {
        type: String,
        required: true
      },
      host: {
        type: String,
        required: true
      },
      port: {
        type: Number,
        required: true
      }
    },
    
    // Proxy details
    country: {
      type: String,
      required: true,
      index: true
    },
    
    countryCode: {
      type: String,
      required: true,
      index: true
    },
    
    // Proxy status
    status: {
      type: String,
      enum: ["active", "expired", "failed", "testing"],
      default: "testing",
      index: true
    },
    
    // Usage tracking
    usage: {
      totalConnections: {
        type: Number,
        default: 0
      },
      activeConnections: {
        type: Number,
        default: 0
      },
      maxConcurrentConnections: {
        type: Number,
        default: 5 // Limit concurrent connections per proxy
      },
      lastUsedAt: {
        type: Date,
        default: Date.now
      },
      firstUsedAt: {
        type: Date,
        default: Date.now
      }
    },
    
    // Expiration tracking
    expiration: {
      expiresAt: {
        type: Date,
        index: true
      },
      isExpired: {
        type: Boolean,
        default: false,
        index: true
      },
      expiredAt: {
        type: Date
      },
      autoExpireAfterHours: {
        type: Number,
        default: 24 // Auto-expire after 24 hours of first use
      }
    },
    
    // Health monitoring
    health: {
      isHealthy: {
        type: Boolean,
        default: true,
        index: true
      },
      lastHealthCheck: {
        type: Date,
        default: Date.now
      },
      healthCheckInterval: {
        type: Number,
        default: 300000 // 5 minutes in milliseconds
      },
      failedHealthChecks: {
        type: Number,
        default: 0
      },
      maxFailedChecks: {
        type: Number,
        default: 3
      },
      responseTime: {
        type: Number,
        default: 0
      },
      lastError: {
        type: String,
        default: null
      }
    },
    
    // Associated leads using this proxy
    assignedLeads: [{
      leadId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Lead",
        required: true
      },
      orderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Order",
        required: true
      },
      assignedAt: {
        type: Date,
        default: Date.now
      },
      status: {
        type: String,
        enum: ["active", "completed", "failed"],
        default: "active"
      }
    }],
    
    // FTD sharing configuration
    ftdSharing: {
      isSharedProxy: {
        type: Boolean,
        default: false
      },
      maxFTDsPerProxy: {
        type: Number,
        default: 3 // Maximum FTDs that can share this proxy
      },
      currentFTDCount: {
        type: Number,
        default: 0
      },
      sharedCountries: [{
        type: String
      }]
    },
    
    // Creation metadata
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    
    // Session information from 922proxy
    sessionInfo: {
      sessionId: {
        type: String,
        required: true
      },
      originalUsername: {
        type: String,
        required: true
      }
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Indexes for performance
proxySchema.index({ country: 1, status: 1 });
proxySchema.index({ countryCode: 1, status: 1 });
proxySchema.index({ "expiration.isExpired": 1, "expiration.expiresAt": 1 });
proxySchema.index({ "health.isHealthy": 1, "health.lastHealthCheck": 1 });
proxySchema.index({ "assignedLeads.leadId": 1 });
proxySchema.index({ "assignedLeads.orderId": 1 });
proxySchema.index({ "ftdSharing.isSharedProxy": 1, "ftdSharing.currentFTDCount": 1 });
proxySchema.index({ createdBy: 1 });

// Virtual for proxy description
proxySchema.virtual("description").get(function () {
  return `${this.country} (${this.countryCode}) - ${this.config.host}:${this.config.port}`;
});

// Virtual for availability
proxySchema.virtual("isAvailable").get(function () {
  return this.status === "active" && 
         this.health.isHealthy && 
         !this.expiration.isExpired &&
         this.usage.activeConnections < this.usage.maxConcurrentConnections;
});

// Virtual for can accept FTD
proxySchema.virtual("canAcceptFTD").get(function () {
  return this.isAvailable && 
         this.ftdSharing.currentFTDCount < this.ftdSharing.maxFTDsPerProxy;
});

// Static method to create proxy from 922proxy configuration
proxySchema.statics.createFromConfig = async function(country, countryCode, createdBy) {
  const { generateProxyConfig } = require('../utils/proxyManager');
  
  try {
    const proxyConfig = await generateProxyConfig(country, countryCode);
    
    if (!proxyConfig) {
      throw new Error(`Failed to generate proxy config for ${country}`);
    }
    
    const proxyId = `${countryCode}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const proxyData = {
      proxyId,
      config: proxyConfig.config,
      country,
      countryCode,
      status: "testing",
      sessionInfo: {
        sessionId: proxyConfig.sessionId,
        originalUsername: proxyConfig.originalUsername
      },
      expiration: {
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours from now
      },
      createdBy
    };
    
    const proxy = await this.create(proxyData);
    
    // Test the proxy immediately after creation
    const isHealthy = await proxy.testConnection();
    if (isHealthy) {
      proxy.status = "active";
      await proxy.save();
    } else {
      proxy.status = "failed";
      await proxy.save();
      throw new Error(`Proxy health check failed for ${country}`);
    }
    
    return proxy;
  } catch (error) {
    console.error(`Error creating proxy for ${country}:`, error);
    throw error;
  }
};

// Method to test proxy connection
proxySchema.methods.testConnection = async function() {
  const axios = require('axios');
  const { HttpsProxyAgent } = require('https-proxy-agent');
  const startTime = Date.now();
  
  try {
    const proxyUrl = `http://${this.config.username}:${this.config.password}@${this.config.host}:${this.config.port}`;
    
    const response = await axios.get('https://api.ipify.org', {
      httpsAgent: new HttpsProxyAgent(proxyUrl),
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const responseTime = Date.now() - startTime;
    
    // Update health status
    this.health.isHealthy = true;
    this.health.lastHealthCheck = new Date();
    this.health.failedHealthChecks = 0;
    this.health.responseTime = responseTime;
    this.health.lastError = null;
    
    console.log(`Proxy health check passed for ${this.country}: ${response.data} (${responseTime}ms)`);
    return true;
    
  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    // Update health status
    this.health.isHealthy = false;
    this.health.lastHealthCheck = new Date();
    this.health.failedHealthChecks += 1;
    this.health.responseTime = responseTime;
    this.health.lastError = error.message;
    
    // Mark as failed if too many failed checks
    if (this.health.failedHealthChecks >= this.health.maxFailedChecks) {
      this.status = "failed";
    }
    
    console.error(`Proxy health check failed for ${this.country}:`, error.message);
    return false;
  }
};

// Method to assign lead to this proxy
proxySchema.methods.assignLead = function(leadId, orderId, leadType = "non-ftd") {
  // Check if lead is already assigned
  const existingAssignment = this.assignedLeads.find(
    assignment => assignment.leadId.toString() === leadId.toString()
  );
  
  if (existingAssignment) {
    return false; // Lead already assigned
  }
  
  // Add lead assignment
  this.assignedLeads.push({
    leadId,
    orderId,
    assignedAt: new Date(),
    status: "active"
  });
  
  // Update usage counters
  this.usage.activeConnections += 1;
  this.usage.totalConnections += 1;
  this.usage.lastUsedAt = new Date();
  
  // Update FTD sharing if this is an FTD
  if (leadType === "ftd") {
    this.ftdSharing.currentFTDCount += 1;
  }
  
  return true;
};

// Method to unassign lead from this proxy
proxySchema.methods.unassignLead = function(leadId, status = "completed") {
  const assignmentIndex = this.assignedLeads.findIndex(
    assignment => assignment.leadId.toString() === leadId.toString()
  );
  
  if (assignmentIndex === -1) {
    return false; // Lead not found
  }
  
  const assignment = this.assignedLeads[assignmentIndex];
  assignment.status = status;
  
  // Update usage counters
  this.usage.activeConnections = Math.max(0, this.usage.activeConnections - 1);
  
  return true;
};

// Method to check if proxy is expired
proxySchema.methods.checkExpiration = function() {
  const now = new Date();
  
  if (this.expiration.expiresAt && now > this.expiration.expiresAt) {
    this.expiration.isExpired = true;
    this.expiration.expiredAt = now;
    this.status = "expired";
    return true;
  }
  
  return false;
};

// Method to extend proxy expiration
proxySchema.methods.extendExpiration = function(hours = 24) {
  const newExpirationTime = new Date(Date.now() + hours * 60 * 60 * 1000);
  this.expiration.expiresAt = newExpirationTime;
  this.expiration.isExpired = false;
  this.expiration.expiredAt = null;
  
  if (this.status === "expired") {
    this.status = "active";
  }
};

// Static method to find available proxy for country
proxySchema.statics.findAvailableProxy = async function(country, countryCode, leadType = "non-ftd") {
  const query = {
    country,
    status: "active",
    "health.isHealthy": true,
    "expiration.isExpired": false,
    $expr: {
      $lt: ["$usage.activeConnections", "$usage.maxConcurrentConnections"]
    }
  };
  
  // For FTDs, check if proxy can accept more FTDs
  if (leadType === "ftd") {
    query.$expr.$lt = ["$ftdSharing.currentFTDCount", "$ftdSharing.maxFTDsPerProxy"];
  }
  
  return this.findOne(query).sort({ "usage.activeConnections": 1, createdAt: 1 });
};

// Static method to find or create proxy for country
proxySchema.statics.findOrCreateProxy = async function(country, countryCode, createdBy, leadType = "non-ftd") {
  // First try to find an available proxy
  let proxy = await this.findAvailableProxy(country, countryCode, leadType);
  
  if (proxy) {
    return proxy;
  }
  
  // If no available proxy, create a new one
  try {
    proxy = await this.createFromConfig(country, countryCode, createdBy);
    return proxy;
  } catch (error) {
    console.error(`Failed to create proxy for ${country}:`, error);
    throw error;
  }
};

// Static method to cleanup expired proxies
proxySchema.statics.cleanupExpiredProxies = async function() {
  const expiredProxies = await this.find({
    $or: [
      { "expiration.expiresAt": { $lt: new Date() } },
      { status: "expired" },
      { status: "failed" }
    ]
  });
  
  for (const proxy of expiredProxies) {
    proxy.checkExpiration();
    
    // If proxy has no active connections, it can be safely removed
    if (proxy.usage.activeConnections === 0) {
      await proxy.deleteOne();
      console.log(`Cleaned up expired proxy: ${proxy.description}`);
    } else {
      // Mark as expired but keep for active connections
      await proxy.save();
    }
  }
  
  return expiredProxies.length;
};

// Pre-save middleware
proxySchema.pre("save", function(next) {
  // Check expiration before saving
  this.checkExpiration();
  
  // Ensure FTD count doesn't go negative
  if (this.ftdSharing.currentFTDCount < 0) {
    this.ftdSharing.currentFTDCount = 0;
  }
  
  // Ensure active connections doesn't go negative
  if (this.usage.activeConnections < 0) {
    this.usage.activeConnections = 0;
  }
  
  next();
});

module.exports = mongoose.model("Proxy", proxySchema); 