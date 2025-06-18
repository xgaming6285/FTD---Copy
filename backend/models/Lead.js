const mongoose = require("mongoose");

const assignmentSchema = new mongoose.Schema({
  clientNetwork: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ClientNetwork'
  },
  clientBroker: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ClientBroker'
  },
  assignedAt: {
    type: Date,
    default: Date.now
  },
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order'
  },
  status: {
    type: String,
    enum: ['injected', 'failed', 'pending', 'pending_broker_assignment'],
    default: 'pending'
  },
  finalUrl: {
    type: String,
    trim: true
  },
  extractedDomain: {
    type: String,
    trim: true
  }
});

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
    assignments: [assignmentSchema],
    deviceFingerprint: {
      type: String,
      trim: true,
      index: true,
      sparse: true // Allows multiple null values
    },
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
      enum: ["active", "contacted", "converted", "inactive", "sleep", "not_available_client_brokers"],
      default: "active",
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
leadSchema.index({ newEmail: 1 }, { unique: true }); // Optimize lookup by email
leadSchema.index({ status: 1 }); // Add index for status field
leadSchema.index({ assignedAt: -1 }); // Add index for assignedAt for sorting
leadSchema.index({ isAssigned: 1, assignedTo: 1 }); // Compound index for assigned leads
leadSchema.index({ firstName: 1, lastName: 1 }); // Optimize name-based sorting
leadSchema.index({ createdBy: 1 }); // Optimize filtering by creator
leadSchema.index({ updatedAt: -1 }); // Track updates efficiently

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
  },
  {
    weights: {
      firstName: 10,
      lastName: 10,
      newEmail: 5,
      newPhone: 5,
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

module.exports = mongoose.model("Lead", leadSchema);
