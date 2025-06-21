const mongoose = require("mongoose");

const leadSchema = new mongoose.Schema(
  {
    // Common Fields
    leadType: {
      type: String,
      enum: ["ftd", "filler", "cold", "live"],
      required: [true, "Lead type is required"],
    },
    firstName: {
      type: String,
      required: [true, "First name is required"],
      trim: true,
    },
    lastName: {
      type: String,
      required: [true, "Last name is required"],
      trim: true,
    },
    // Add prefix field
    prefix: {
      type: String,
      trim: true,
    },
    newEmail: {
      type: String,
      required: [true, "New email is required"],
      unique: true,
      trim: true,
      lowercase: true,
    },
    oldEmail: {
      type: String,
      trim: true,
      lowercase: true,
    },
    newPhone: {
      type: String,
      trim: true,
      required: [true, "New phone is required"],
    },
    oldPhone: {
      type: String,
      trim: true,
    },
    country: {
      type: String,
      required: [true, "Country is required"],
      trim: true,
    },
    isAssigned: {
      type: Boolean,
      default: false,
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    assignedAt: {
      type: Date,
    },
    client: {
      type: String,
      trim: true,
    },
    // Many-to-many relationship with client brokers
    assignedClientBrokers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "ClientBroker",
      },
    ],
    // History of client broker assignments
    clientBrokerHistory: [
      {
        clientBroker: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "ClientBroker",
          required: true,
        },
        assignedAt: {
          type: Date,
          default: Date.now,
        },
        assignedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        orderId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Order",
        },
        injectionStatus: {
          type: String,
          enum: ["pending", "successful", "failed"],
          default: "pending",
        },
        // Track which client network was used as intermediary (for session tracking only)
        intermediaryClientNetwork: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "ClientNetwork",
        },
        domain: {
          type: String,
          trim: true,
        },
      },
    ],
    // History of client network assignments
    clientNetworkHistory: [
      {
        clientNetwork: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "ClientNetwork",
          required: true,
        },
        // Client broker assignment info (for completed injections)
        clientBroker: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "ClientBroker",
        },
        assignedAt: {
          type: Date,
          default: Date.now,
        },
        assignedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        orderId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Order",
        },
        // Injection tracking fields
        injectionStatus: {
          type: String,
          enum: ["pending", "completed", "failed"],
          default: "pending",
        },
        injectionType: {
          type: String,
          enum: ["auto", "manual_ftd"],
        },
        domain: {
          type: String,
          trim: true,
        },
        injectionNotes: {
          type: String,
          trim: true,
        },
      },
    ],
    // History of campaign assignments
    campaignHistory: [
      {
        campaign: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Campaign",
          required: true,
        },
        assignedAt: {
          type: Date,
          default: Date.now,
        },
        assignedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        orderId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Order",
        },
        // Campaign performance tracking for this lead
        performance: {
          status: {
            type: String,
            enum: ["active", "contacted", "converted", "inactive"],
            default: "active",
          },
          contactedAt: {
            type: Date,
          },
          convertedAt: {
            type: Date,
          },
          notes: {
            type: String,
            trim: true,
          },
        },
      },
    ],
    gender: {
      type: String,
      enum: ["male", "female", "not_defined"],
      default: "not_defined",
      index: true, // Add index for better query performance
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      index: true, // Add index for better query performance
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true, // Add index for better query performance
    },

    // Social Media Fields
    socialMedia: {
      facebook: { type: String, trim: true },
      twitter: { type: String, trim: true },
      linkedin: { type: String, trim: true },
      instagram: { type: String, trim: true },
      telegram: { type: String, trim: true },
      whatsapp: { type: String, trim: true },
    },

    comments: [
      {
        text: {
          type: String,
          required: true,
        },
        author: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    // FTD & Filler Specific Fields
    dob: { type: Date },
    address: {
      type: String,
    },

    // FTD Only Fields
    documents: {
      type: mongoose.Schema.Types.Mixed,
      default: [],
    },
    sin: {
      type: String,
      trim: true,
      sparse: true,
      validate: {
        validator: function (v) {
          // Only validate if the lead type is ftd
          if (this.leadType === "ftd") {
            return v && v.length > 0;
          }
          return true;
        },
        message: "SIN is required for FTD leads",
      },
    },

    // Additional tracking fields
    source: String, // Where the lead came from
    priority: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "medium",
    },
    status: {
      type: String,
      enum: ["active", "contacted", "converted", "inactive"],
      default: "active",
    },

    // Current assignment status for broker availability
    brokerAvailabilityStatus: {
      type: String,
      enum: ["available", "sleep", "not_available_brokers"],
      default: "available",
    },

    // Track when lead was put to sleep due to no available brokers
    sleepDetails: {
      putToSleepAt: { type: Date },
      reason: { type: String },
      lastCheckedAt: { type: Date },
    },

    // Device fingerprint association (one-to-one)
    fingerprint: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Fingerprint",
      sparse: true,
      index: true,
    },

    // Device type for this lead (cached from fingerprint for quick access)
    deviceType: {
      type: String,
      enum: ["windows", "android", "ios", "mac"],
      sparse: true,
      index: true,
    },

    // Proxy tracking for this lead
    proxyAssignments: [
      {
        proxy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Proxy",
          required: true,
        },
        orderId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Order",
          required: true,
        },
        assignedAt: {
          type: Date,
          default: Date.now,
        },
        status: {
          type: String,
          enum: ["active", "completed", "failed"],
          default: "active",
        },
        completedAt: {
          type: Date,
        },
      },
    ],

    // Browser Session Storage for FTD Injection
    browserSession: {
      cookies: [
        {
          name: { type: String, required: true },
          value: { type: String, required: true },
          domain: { type: String },
          path: { type: String, default: "/" },
          expires: { type: Date },
          httpOnly: { type: Boolean, default: false },
          secure: { type: Boolean, default: false },
          sameSite: { 
            type: String, 
            enum: ["Strict", "Lax", "None"],
            default: "Lax"
          }
        }
      ],
      localStorage: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
      },
      sessionStorage: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
      },
      userAgent: {
        type: String,
        trim: true
      },
      viewport: {
        width: { type: Number, default: 1366 },
        height: { type: Number, default: 768 }
      },
      sessionId: {
        type: String,
        unique: true,
        sparse: true,
        index: true
      },
      createdAt: {
        type: Date,
        default: Date.now
      },
      lastAccessedAt: {
        type: Date,
        default: Date.now
      },
      isActive: {
        type: Boolean,
        default: true
      },
      metadata: {
        domain: { type: String, trim: true },
        success: { type: Boolean, default: false },
        injectionType: { 
          type: String, 
          enum: ["manual_ftd", "auto_ftd"],
          default: "manual_ftd"
        },
        notes: { type: String, trim: true }
      }
    },

    // Session History for tracking multiple sessions
    sessionHistory: [
      {
        sessionId: {
          type: String,
          required: true,
          index: true
        },
        cookies: [
          {
            name: { type: String, required: true },
            value: { type: String, required: true },
            domain: { type: String },
            path: { type: String, default: "/" },
            expires: { type: Date },
            httpOnly: { type: Boolean, default: false },
            secure: { type: Boolean, default: false },
            sameSite: { 
              type: String, 
              enum: ["Strict", "Lax", "None"],
              default: "Lax"
            }
          }
        ],
        localStorage: {
          type: mongoose.Schema.Types.Mixed,
          default: {}
        },
        sessionStorage: {
          type: mongoose.Schema.Types.Mixed,
          default: {}
        },
        userAgent: {
          type: String,
          trim: true
        },
        viewport: {
          width: { type: Number, default: 1366 },
          height: { type: Number, default: 768 }
        },
        createdAt: {
          type: Date,
          default: Date.now
        },
        lastAccessedAt: {
          type: Date,
          default: Date.now
        },
        isActive: {
          type: Boolean,
          default: false
        },
        metadata: {
          domain: { type: String, trim: true },
          success: { type: Boolean, default: false },
          injectionType: { 
            type: String, 
            enum: ["manual_ftd", "auto_ftd"],
            default: "manual_ftd"
          },
          notes: { type: String, trim: true },
          orderId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Order"
          },
          assignedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
          }
        }
      }
    ],

    // Reference to current active session
    currentSessionId: {
      type: String,
      sparse: true,
      index: true
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Create indexes for performance
leadSchema.index({ isAssigned: 1, leadType: 1, "documents.status": 1 });
leadSchema.index({ leadType: 1 });
leadSchema.index({ country: 1 });
leadSchema.index({ assignedTo: 1 });
leadSchema.index({ createdAt: -1 });
leadSchema.index({ client: 1 }, { sparse: true });
leadSchema.index({ assignedClientBrokers: 1 });
leadSchema.index({ newEmail: 1 }, { unique: true }); // Optimize lookup by email
leadSchema.index({ status: 1 }); // Add index for status field
leadSchema.index({ assignedAt: -1 }); // Add index for assignedAt for sorting
leadSchema.index({ isAssigned: 1, assignedTo: 1 }); // Compound index for assigned leads
leadSchema.index({ firstName: 1, lastName: 1 }); // Optimize name-based sorting
leadSchema.index({ createdBy: 1 }); // Optimize filtering by creator
leadSchema.index({ updatedAt: -1 }); // Track updates efficiently

// Client broker history indexes for better performance
leadSchema.index({ "clientBrokerHistory.clientBroker": 1 });
leadSchema.index({ "clientBrokerHistory.orderId": 1 });
leadSchema.index({
  "clientBrokerHistory.clientBroker": 1,
  "clientBrokerHistory.orderId": 1,
});
leadSchema.index({ "clientBrokerHistory.assignedAt": -1 });

// Client network history indexes for better performance
leadSchema.index({ "clientNetworkHistory.clientNetwork": 1 });
leadSchema.index({ "clientNetworkHistory.orderId": 1 });
leadSchema.index({
  "clientNetworkHistory.clientNetwork": 1,
  "clientNetworkHistory.orderId": 1,
});
leadSchema.index({ "clientNetworkHistory.assignedAt": -1 });

// Campaign history indexes for better performance
leadSchema.index({ "campaignHistory.campaign": 1 });
leadSchema.index({ "campaignHistory.orderId": 1 });
leadSchema.index({
  "campaignHistory.campaign": 1,
  "campaignHistory.orderId": 1,
});
leadSchema.index({ "campaignHistory.assignedAt": -1 });

// Compound indexes for common query patterns
leadSchema.index({ leadType: 1, isAssigned: 1, status: 1 }); // Common filtering pattern
leadSchema.index({ assignedTo: 1, status: 1 }); // Agent's leads by status
leadSchema.index({ prefix: 1 }); // Add index for prefix field

// Browser session indexes for performance
leadSchema.index({ "browserSession.sessionId": 1 }); // Session lookup
leadSchema.index({ "browserSession.isActive": 1 }); // Active sessions
leadSchema.index({ "browserSession.createdAt": -1 }); // Recent sessions
leadSchema.index({ "browserSession.lastAccessedAt": -1 }); // Last accessed sessions
leadSchema.index({ currentSessionId: 1 }); // Current session reference
leadSchema.index({ "sessionHistory.sessionId": 1 }); // Session history lookup
leadSchema.index({ "sessionHistory.isActive": 1 }); // Active sessions in history
leadSchema.index({ "sessionHistory.createdAt": -1 }); // Session history by date

leadSchema.index(
  {
    firstName: "text",
    lastName: "text",
    newEmail: "text",
    newPhone: "text",
    client: "text",
  },
  {
    weights: {
      firstName: 10,
      lastName: 10,
      newEmail: 5,
      newPhone: 5,
      client: 3,
    },
    name: "lead_search_index",
  }
);

// Virtual for full name
leadSchema.virtual("fullName").get(function () {
  return this.lastName ? `${this.firstName} ${this.lastName}` : this.firstName;
});

// Pre-save middleware
leadSchema.pre("save", function (next) {
  // Set assignedAt when lead is assigned
  if (this.isModified("isAssigned") && this.isAssigned && !this.assignedAt) {
    this.assignedAt = new Date();
  }

  // Clear assignedAt when lead is unassigned
  if (this.isModified("isAssigned") && !this.isAssigned) {
    this.assignedAt = undefined;
    this.assignedTo = undefined;
  }

  // Handle address conversion if it's an object
  if (this.address && typeof this.address === "object") {
    try {
      const { street = "", city = "", postalCode = "" } = this.address;
      this.address = `${street}, ${city} ${postalCode}`.trim();
    } catch (err) {
      // If address can't be parsed as an object, stringify it
      this.address = JSON.stringify(this.address);
    }
  }

  next();
});

// Static methods for lead queries
leadSchema.statics.findAvailableLeads = function (
  leadType,
  count,
  documentStatus = null // Made optional - if null, no document status filtering
) {
  const query = {
    leadType,
    isAssigned: false,
  };

  // Add document status filter for FTD leads only if documentStatus is provided
  if (leadType === "ftd" && documentStatus && Array.isArray(documentStatus)) {
    query["documents.status"] = { $in: documentStatus };
  }

  return this.find(query).limit(count);
};

leadSchema.statics.getLeadStats = function () {
  return this.aggregate([
    {
      $group: {
        _id: {
          leadType: "$leadType",
          isAssigned: "$isAssigned",
        },
        count: { $sum: 1 },
      },
    },
  ]);
};

// Check if lead is already assigned to a specific client broker
leadSchema.methods.isAssignedToClientBroker = function (clientBrokerId) {
  return this.assignedClientBrokers.some(
    (brokerId) => brokerId.toString() === clientBrokerId.toString()
  );
};

// Assign a client broker to this lead
leadSchema.methods.assignClientBroker = function (
  clientBrokerId,
  assignedBy,
  orderId,
  intermediaryClientNetwork = null,
  domain = null
) {
  // Add to current assignments if not already assigned
  if (!this.isAssignedToClientBroker(clientBrokerId)) {
    this.assignedClientBrokers.push(clientBrokerId);
  }

  // Add to history
  this.clientBrokerHistory.push({
    clientBroker: clientBrokerId,
    assignedBy: assignedBy,
    orderId: orderId,
    intermediaryClientNetwork: intermediaryClientNetwork,
    domain: domain,
    injectionStatus: "pending",
  });
};

// Unassign a client broker from this lead
leadSchema.methods.unassignClientBroker = function (clientBrokerId) {
  const index = this.assignedClientBrokers.findIndex(
    (brokerId) => brokerId.toString() === clientBrokerId.toString()
  );
  if (index > -1) {
    this.assignedClientBrokers.splice(index, 1);
  }
};

// Update injection status for a specific assignment
leadSchema.methods.updateInjectionStatus = function (
  orderId,
  status,
  domain = null
) {
  const assignment = this.clientBrokerHistory.find(
    (history) =>
      history.orderId && history.orderId.toString() === orderId.toString()
  );

  if (assignment) {
    assignment.injectionStatus = status;
    if (domain) {
      assignment.domain = domain;
    }
  }
};

// Get all client brokers this lead has been assigned to (returns ObjectIds)
leadSchema.methods.getAssignedClientBrokers = function () {
  return this.assignedClientBrokers.map((id) => id.toString());
};

// Get client broker assignment history
leadSchema.methods.getClientBrokerHistory = function () {
  return this.clientBrokerHistory;
};

// Check if lead can be assigned to a client broker (not already assigned)
leadSchema.statics.canAssignToClientBroker = function (leadId, clientBrokerId) {
  return this.findById(leadId).then((lead) => {
    if (!lead) return false;
    return !lead.isAssignedToClientBroker(clientBrokerId);
  });
};

// Put lead to sleep when no available brokers
leadSchema.methods.putToSleep = function (
  reason = "No available client brokers"
) {
  this.brokerAvailabilityStatus = "sleep";
  this.sleepDetails = {
    putToSleepAt: new Date(),
    reason: reason,
    lastCheckedAt: new Date(),
  };
};

// Wake up lead when new brokers become available
leadSchema.methods.wakeUp = function () {
  this.brokerAvailabilityStatus = "available";
  this.sleepDetails = {};
};

// Static method to find leads that need to be woken up when new brokers are added
leadSchema.statics.findSleepingLeads = function () {
  return this.find({
    brokerAvailabilityStatus: { $in: ["sleep", "not_available_brokers"] },
  });
};

// Check if lead is already assigned to a specific client network in a specific order
leadSchema.methods.isAssignedToClientNetwork = function (
  clientNetworkId,
  orderId = null
) {
  return this.clientNetworkHistory.some((history) => {
    const networkMatch =
      history.clientNetwork.toString() === clientNetworkId.toString();
    if (orderId) {
      return (
        networkMatch &&
        history.orderId &&
        history.orderId.toString() === orderId.toString()
      );
    }
    return networkMatch;
  });
};

// Add client network assignment to history
leadSchema.methods.addClientNetworkAssignment = function (
  clientNetworkId,
  assignedBy,
  orderId
) {
  // Check if already assigned to this network in this order
  if (this.isAssignedToClientNetwork(clientNetworkId, orderId)) {
    throw new Error(
      "Lead is already assigned to this client network in this order"
    );
  }

  // Add to history
  this.clientNetworkHistory.push({
    clientNetwork: clientNetworkId,
    assignedBy: assignedBy,
    orderId: orderId,
  });
};

// Get client network assignment history
leadSchema.methods.getClientNetworkHistory = function () {
  return this.clientNetworkHistory;
};

// Get all client networks this lead has been assigned to
leadSchema.methods.getAssignedClientNetworks = function () {
  return [
    ...new Set(
      this.clientNetworkHistory.map((history) =>
        history.clientNetwork.toString()
      )
    ),
  ];
};

// Check if lead is already assigned to a specific campaign in a specific order
leadSchema.methods.isAssignedToCampaign = function (
  campaignId,
  orderId = null
) {
  return this.campaignHistory.some((history) => {
    const campaignMatch = history.campaign.toString() === campaignId.toString();
    if (orderId) {
      return (
        campaignMatch &&
        history.orderId &&
        history.orderId.toString() === orderId.toString()
      );
    }
    return campaignMatch;
  });
};

// Add campaign assignment to history
leadSchema.methods.addCampaignAssignment = function (
  campaignId,
  assignedBy,
  orderId
) {
  // Check if already assigned to this campaign in this order
  if (this.isAssignedToCampaign(campaignId, orderId)) {
    throw new Error("Lead is already assigned to this campaign in this order");
  }

  // Add to history
  this.campaignHistory.push({
    campaign: campaignId,
    assignedBy: assignedBy,
    orderId: orderId,
  });
};

// Get campaign assignment history
leadSchema.methods.getCampaignHistory = function () {
  return this.campaignHistory;
};

// Get all campaigns this lead has been assigned to
leadSchema.methods.getAssignedCampaigns = function () {
  return [
    ...new Set(
      this.campaignHistory.map((history) => history.campaign.toString())
    ),
  ];
};

// Update campaign performance for a specific assignment
leadSchema.methods.updateCampaignPerformance = function (
  campaignId,
  orderId,
  performanceData
) {
  const assignment = this.campaignHistory.find(
    (history) =>
      history.campaign.toString() === campaignId.toString() &&
      history.orderId &&
      history.orderId.toString() === orderId.toString()
  );

  if (assignment) {
    Object.assign(assignment.performance, performanceData);
  } else {
    throw new Error("Campaign assignment not found for this lead and order");
  }
};

// Device and Fingerprint Management Methods

// Assign a device fingerprint to this lead
leadSchema.methods.assignFingerprint = async function (deviceType, createdBy) {
  const Fingerprint = require("./Fingerprint");

  // Validate parameters
  if (!deviceType) {
    throw new Error("deviceType is required for fingerprint assignment");
  }
  if (!createdBy) {
    throw new Error("createdBy is required for fingerprint assignment");
  }

  // Check if lead already has a fingerprint
  if (this.fingerprint) {
    throw new Error("Lead already has a fingerprint assigned");
  }

  try {
    console.log(
      `[DEBUG] Creating fingerprint for lead ${this._id} with deviceType: ${deviceType}`
    );

    // Create new fingerprint for this lead
    const fingerprint = await Fingerprint.createForLead(
      this._id,
      deviceType,
      createdBy
    );

    // Update lead with fingerprint reference and device type
    this.fingerprint = fingerprint._id;
    this.deviceType = deviceType;

    console.log(
      `[DEBUG] Successfully assigned fingerprint ${fingerprint.deviceId} to lead ${this._id}`
    );

    return fingerprint;
  } catch (error) {
    console.error(`Error assigning fingerprint to lead ${this._id}:`, error);
    throw error;
  }
};

// Get the fingerprint associated with this lead
leadSchema.methods.getFingerprint = async function () {
  if (!this.fingerprint) {
    return null;
  }

  const Fingerprint = require("./Fingerprint");
  return await Fingerprint.findById(this.fingerprint);
};

// Update device type and create new fingerprint if needed
leadSchema.methods.updateDeviceType = async function (
  newDeviceType,
  createdBy
) {
  const Fingerprint = require("./Fingerprint");

  // If device type is the same, no need to update
  if (this.deviceType === newDeviceType) {
    return await this.getFingerprint();
  }

  // Remove existing fingerprint if it exists
  if (this.fingerprint) {
    await Fingerprint.findByIdAndDelete(this.fingerprint);
  }

  // Create new fingerprint with new device type
  const fingerprint = await Fingerprint.createForLead(
    this._id,
    newDeviceType,
    createdBy
  );

  // Update lead
  this.fingerprint = fingerprint._id;
  this.deviceType = newDeviceType;

  return fingerprint;
};

// Proxy Management Methods

// Assign a proxy to this lead for a specific order
leadSchema.methods.assignProxy = function (proxyId, orderId) {
  // Check if lead already has an active proxy for this order
  const existingAssignment = this.proxyAssignments.find(
    (assignment) =>
      assignment.orderId.toString() === orderId.toString() &&
      assignment.status === "active"
  );

  if (existingAssignment) {
    return false; // Already has active proxy for this order
  }

  // Add new proxy assignment
  this.proxyAssignments.push({
    proxy: proxyId,
    orderId: orderId,
    assignedAt: new Date(),
    status: "active",
  });

  return true;
};

// Get active proxy for a specific order
leadSchema.methods.getActiveProxy = function (orderId) {
  const assignment = this.proxyAssignments.find(
    (assignment) =>
      assignment.orderId.toString() === orderId.toString() &&
      assignment.status === "active"
  );

  return assignment ? assignment.proxy : null;
};

// Complete proxy assignment (mark as completed)
leadSchema.methods.completeProxyAssignment = function (
  orderId,
  status = "completed"
) {
  const assignment = this.proxyAssignments.find(
    (assignment) =>
      assignment.orderId.toString() === orderId.toString() &&
      assignment.status === "active"
  );

  if (assignment) {
    assignment.status = status;
    assignment.completedAt = new Date();
    return true;
  }

  return false;
};

// Get all proxy assignments for this lead
leadSchema.methods.getProxyAssignments = function () {
  return this.proxyAssignments;
};

// Check if lead has active proxy assignments
leadSchema.methods.hasActiveProxyAssignments = function () {
  return this.proxyAssignments.some(
    (assignment) => assignment.status === "active"
  );
};

// Static method to find leads by device type
leadSchema.statics.findByDeviceType = function (deviceType, options = {}) {
  const query = { deviceType };

  // Add additional filters if provided
  if (options.leadType) {
    query.leadType = options.leadType;
  }

  if (options.isAssigned !== undefined) {
    query.isAssigned = options.isAssigned;
  }

  if (options.status) {
    query.status = options.status;
  }

  return this.find(query);
};

// Static method to get device type distribution
leadSchema.statics.getDeviceTypeStats = function () {
  return this.aggregate([
    {
      $group: {
        _id: {
          deviceType: "$deviceType",
          leadType: "$leadType",
        },
        count: { $sum: 1 },
      },
    },
    {
      $group: {
        _id: "$_id.deviceType",
        totalCount: { $sum: "$count" },
        byLeadType: {
          $push: {
            leadType: "$_id.leadType",
            count: "$count",
          },
        },
      },
    },
  ]);
};

// Browser Session Management Methods

// Generate unique session ID
leadSchema.statics.generateSessionId = function () {
  const crypto = require('crypto');
  const timestamp = Date.now().toString();
  const randomBytes = crypto.randomBytes(16).toString('hex');
  return `session_${timestamp}_${randomBytes}`;
};

// Store browser session data for this lead
leadSchema.methods.storeBrowserSession = function (sessionData, orderId = null, assignedBy = null) {
  const sessionId = this.constructor.generateSessionId();
  
  // Validate required session data
  if (!sessionData || typeof sessionData !== 'object') {
    throw new Error('Session data is required and must be an object');
  }

  // Prepare session object
  const session = {
    sessionId: sessionId,
    cookies: sessionData.cookies || [],
    localStorage: sessionData.localStorage || {},
    sessionStorage: sessionData.sessionStorage || {},
    userAgent: sessionData.userAgent || '',
    viewport: sessionData.viewport || { width: 1366, height: 768 },
    createdAt: new Date(),
    lastAccessedAt: new Date(),
    isActive: true,
    metadata: {
      domain: sessionData.domain || '',
      success: sessionData.success || false,
      injectionType: sessionData.injectionType || 'manual_ftd',
      notes: sessionData.notes || '',
      orderId: orderId,
      assignedBy: assignedBy
    }
  };

  // Deactivate current session if exists
  if (this.browserSession && this.browserSession.sessionId) {
    this.deactivateCurrentSession();
  }

  // Set as current browser session
  this.browserSession = {
    ...session,
    sessionId: sessionId
  };

  // Add to session history
  this.sessionHistory.push(session);

  // Set current session reference
  this.currentSessionId = sessionId;

  return sessionId;
};

// Get current active browser session
leadSchema.methods.getCurrentBrowserSession = function () {
  if (!this.browserSession || !this.browserSession.isActive) {
    return null;
  }
  return this.browserSession;
};

// Get session by ID from history
leadSchema.methods.getSessionById = function (sessionId) {
  if (this.browserSession && this.browserSession.sessionId === sessionId) {
    return this.browserSession;
  }
  
  return this.sessionHistory.find(session => session.sessionId === sessionId) || null;
};

// Update session last accessed time
leadSchema.methods.updateSessionAccess = function (sessionId = null) {
  const targetSessionId = sessionId || this.currentSessionId;
  
  if (!targetSessionId) {
    return false;
  }

  // Update current session if it matches
  if (this.browserSession && this.browserSession.sessionId === targetSessionId) {
    this.browserSession.lastAccessedAt = new Date();
  }

  // Update in session history
  const historySession = this.sessionHistory.find(session => session.sessionId === targetSessionId);
  if (historySession) {
    historySession.lastAccessedAt = new Date();
  }

  return true;
};

// Deactivate current session
leadSchema.methods.deactivateCurrentSession = function () {
  if (this.browserSession && this.browserSession.isActive) {
    this.browserSession.isActive = false;
    
    // Update in session history as well
    const historySession = this.sessionHistory.find(
      session => session.sessionId === this.browserSession.sessionId
    );
    if (historySession) {
      historySession.isActive = false;
    }
  }
};

// Activate a session from history
leadSchema.methods.activateSession = function (sessionId) {
  const session = this.getSessionById(sessionId);
  
  if (!session) {
    throw new Error('Session not found');
  }

  // Deactivate current session
  this.deactivateCurrentSession();

  // Set as current session
  this.browserSession = {
    ...session,
    isActive: true,
    lastAccessedAt: new Date()
  };

  // Update current session reference
  this.currentSessionId = sessionId;

  // Update in history
  const historySession = this.sessionHistory.find(s => s.sessionId === sessionId);
  if (historySession) {
    historySession.isActive = true;
    historySession.lastAccessedAt = new Date();
  }

  return session;
};

// Check if lead has active browser session
leadSchema.methods.hasActiveBrowserSession = function () {
  return this.browserSession && this.browserSession.isActive && this.browserSession.sessionId;
};

// Validate session data integrity
leadSchema.methods.validateSessionData = function (sessionId = null) {
  const session = sessionId ? this.getSessionById(sessionId) : this.getCurrentBrowserSession();
  
  if (!session) {
    return { valid: false, reason: 'Session not found' };
  }

  // Check if session is expired (30 days default)
  const thirtyDaysAgo = new Date(Date.now() - (30 * 24 * 60 * 60 * 1000));
  if (session.createdAt < thirtyDaysAgo) {
    return { valid: false, reason: 'Session expired' };
  }

  // Check if session has required data
  if (!session.cookies || !Array.isArray(session.cookies)) {
    return { valid: false, reason: 'Invalid cookies data' };
  }

  return { valid: true, session: session };
};

// Get all sessions for this lead
leadSchema.methods.getAllSessions = function () {
  const sessions = [...this.sessionHistory];
  
  // Add current session if it's not in history
  if (this.browserSession && this.browserSession.sessionId) {
    const existsInHistory = sessions.some(s => s.sessionId === this.browserSession.sessionId);
    if (!existsInHistory) {
      sessions.push(this.browserSession);
    }
  }

  return sessions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
};

// Clear expired sessions (older than specified days)
leadSchema.methods.clearExpiredSessions = function (daysOld = 30) {
  const cutoffDate = new Date(Date.now() - (daysOld * 24 * 60 * 60 * 1000));
  
  // Filter out expired sessions from history
  this.sessionHistory = this.sessionHistory.filter(session => 
    session.createdAt >= cutoffDate
  );

  // Check if current session is expired
  if (this.browserSession && this.browserSession.createdAt < cutoffDate) {
    this.browserSession = {};
    this.currentSessionId = null;
  }
};

// Static method to find leads with active sessions
leadSchema.statics.findLeadsWithActiveSessions = function (options = {}) {
  const query = {
    'browserSession.isActive': true,
    'browserSession.sessionId': { $exists: true, $ne: null }
  };

  if (options.leadType) {
    query.leadType = options.leadType;
  }

  if (options.assignedTo) {
    query.assignedTo = options.assignedTo;
  }

  return this.find(query);
};

// Static method to find leads with expired sessions
leadSchema.statics.findLeadsWithExpiredSessions = function (daysOld = 30) {
  const cutoffDate = new Date(Date.now() - (daysOld * 24 * 60 * 60 * 1000));
  
  return this.find({
    $or: [
      { 'browserSession.createdAt': { $lt: cutoffDate } },
      { 'sessionHistory.createdAt': { $lt: cutoffDate } }
    ]
  });
};

module.exports = mongoose.model("Lead", leadSchema);
