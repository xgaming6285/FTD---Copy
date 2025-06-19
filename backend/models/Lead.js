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
          default: "pending"
        },
        // Track which client network was used as intermediary (for session tracking only)
        intermediaryClientNetwork: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "ClientNetwork",
        },
        domain: {
          type: String,
          trim: true,
        }
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
      default: "available"
    },

    // Track when lead was put to sleep due to no available brokers
    sleepDetails: {
      putToSleepAt: { type: Date },
      reason: { type: String },
      lastCheckedAt: { type: Date }
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
leadSchema.index({ "clientBrokerHistory.clientBroker": 1, "clientBrokerHistory.orderId": 1 });
leadSchema.index({ "clientBrokerHistory.assignedAt": -1 });

// Client network history indexes for better performance
leadSchema.index({ "clientNetworkHistory.clientNetwork": 1 });
leadSchema.index({ "clientNetworkHistory.orderId": 1 });
leadSchema.index({ "clientNetworkHistory.clientNetwork": 1, "clientNetworkHistory.orderId": 1 });
leadSchema.index({ "clientNetworkHistory.assignedAt": -1 });

// Compound indexes for common query patterns
leadSchema.index({ leadType: 1, isAssigned: 1, status: 1 }); // Common filtering pattern
leadSchema.index({ assignedTo: 1, status: 1 }); // Agent's leads by status
leadSchema.index({ prefix: 1 }); // Add index for prefix field

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
    brokerId => brokerId.toString() === clientBrokerId.toString()
  );
};

// Assign a client broker to this lead
leadSchema.methods.assignClientBroker = function (clientBrokerId, assignedBy, orderId, intermediaryClientNetwork = null, domain = null) {
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
    injectionStatus: "pending"
  });
};

// Unassign a client broker from this lead
leadSchema.methods.unassignClientBroker = function (clientBrokerId) {
  const index = this.assignedClientBrokers.findIndex(
    brokerId => brokerId.toString() === clientBrokerId.toString()
  );
  if (index > -1) {
    this.assignedClientBrokers.splice(index, 1);
  }
};

// Update injection status for a specific assignment
leadSchema.methods.updateInjectionStatus = function (orderId, status, domain = null) {
  const assignment = this.clientBrokerHistory.find(
    history => history.orderId && history.orderId.toString() === orderId.toString()
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
  return this.assignedClientBrokers.map(id => id.toString());
};

// Get client broker assignment history
leadSchema.methods.getClientBrokerHistory = function () {
  return this.clientBrokerHistory;
};

// Check if lead can be assigned to a client broker (not already assigned)
leadSchema.statics.canAssignToClientBroker = function (leadId, clientBrokerId) {
  return this.findById(leadId).then(lead => {
    if (!lead) return false;
    return !lead.isAssignedToClientBroker(clientBrokerId);
  });
};

// Put lead to sleep when no available brokers
leadSchema.methods.putToSleep = function (reason = "No available client brokers") {
  this.brokerAvailabilityStatus = "sleep";
  this.sleepDetails = {
    putToSleepAt: new Date(),
    reason: reason,
    lastCheckedAt: new Date()
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
    brokerAvailabilityStatus: { $in: ["sleep", "not_available_brokers"] }
  });
};

// Check if lead is already assigned to a specific client network in a specific order
leadSchema.methods.isAssignedToClientNetwork = function (clientNetworkId, orderId = null) {
  return this.clientNetworkHistory.some(
    history => {
      const networkMatch = history.clientNetwork.toString() === clientNetworkId.toString();
      if (orderId) {
        return networkMatch && history.orderId && history.orderId.toString() === orderId.toString();
      }
      return networkMatch;
    }
  );
};

// Add client network assignment to history
leadSchema.methods.addClientNetworkAssignment = function (clientNetworkId, assignedBy, orderId) {
  // Check if already assigned to this network in this order
  if (this.isAssignedToClientNetwork(clientNetworkId, orderId)) {
    throw new Error('Lead is already assigned to this client network in this order');
  }

  // Add to history
  this.clientNetworkHistory.push({
    clientNetwork: clientNetworkId,
    assignedBy: assignedBy,
    orderId: orderId
  });
};

// Get client network assignment history
leadSchema.methods.getClientNetworkHistory = function () {
  return this.clientNetworkHistory;
};

// Get all client networks this lead has been assigned to
leadSchema.methods.getAssignedClientNetworks = function () {
  return [...new Set(this.clientNetworkHistory.map(history => history.clientNetwork.toString()))];
};

module.exports = mongoose.model("Lead", leadSchema);
