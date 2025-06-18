const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
  {
    requester: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["fulfilled", "partial", "pending", "cancelled", "injecting", "injection_complete"],
      default: "pending",
    },
    clientNetwork: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ClientNetwork",
      required: true
    },
    injectionType: {
      type: String,
      enum: ['manual', 'auto'],
      default: 'manual'
    },
    autoInjectionSettings: {
      type: {
        type: String,
        enum: ['bulk', 'scheduled']
      },
      startTime: Date, // For scheduled
      endTime: Date // For scheduled
    },
    ftdSkipped: {
      type: Boolean,
      default: false
    },
    requests: {
      ftd: { type: Number, default: 0 },
      filler: { type: Number, default: 0 },
      cold: { type: Number, default: 0 },
      live: { type: Number, default: 0 },
    },
    leads: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Lead",
      },
    ],

    // Additional tracking fields
    notes: String,
    priority: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "medium",
    },

    // Country filter used when creating this order
    countryFilter: {
      type: String,
      trim: true,
    },

    // Gender filter used when creating this order
    genderFilter: {
      type: String,
      enum: ["male", "female", "not_defined", null],
      default: null,
    },

    // Exclusion filters used when creating this order
    excludeBrokers: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: 'ClientBroker',
      default: undefined,
    },
    excludeNetworks: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: 'ClientNetwork',
      default: undefined,
    },

    // Fulfillment tracking
    fulfilled: {
      ftd: { type: Number, default: 0 },
      filler: { type: Number, default: 0 },
      cold: { type: Number, default: 0 },
      live: { type: Number, default: 0 },
    },

    unfulfilled: {
      ftd: { type: Number, default: 0 },
      filler: { type: Number, default: 0 },
      cold: { type: Number, default: 0 },
      live: { type: Number, default: 0 },
    },

    logs: [{
      message: String,
      type: { type: String, enum: ['info', 'warning', 'error'] },
      lead: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead' },
      timestamp: { type: Date, default: Date.now }
    }],

    // Completion tracking
    completedAt: Date,
    cancelledAt: Date,
    cancellationReason: String,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for performance
orderSchema.index({ requester: 1 });
orderSchema.index({ status: 1 });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ priority: 1 });

// Virtual for total requested leads
orderSchema.virtual("totalRequested").get(function () {
  return (
    this.requests.ftd +
    this.requests.filler +
    this.requests.cold +
    this.requests.live
  );
});

// Virtual for total fulfilled leads
orderSchema.virtual("totalFulfilled").get(function () {
  return (
    this.fulfilled.ftd +
    this.fulfilled.filler +
    this.fulfilled.cold +
    this.fulfilled.live
  );
});

// Virtual for completion percentage
orderSchema.virtual("completionPercentage").get(function () {
  const total = this.totalRequested;
  if (total === 0) return 0;
  return Math.round((this.totalFulfilled / total) * 100);
});

// Pre-save middleware
orderSchema.pre("save", function (next) {
  // Set completion date when status changes to fulfilled
  if (this.isModified("status")) {
    if (this.status === "fulfilled" && !this.completedAt) {
      this.completedAt = new Date();
    } else if (this.status === "cancelled" && !this.cancelledAt) {
      this.cancelledAt = new Date();
    }
  }

  next();
});

// Static methods
orderSchema.statics.getOrderStats = function (userId = null) {
  const matchStage = userId
    ? { requester: new mongoose.Types.ObjectId(userId) }
    : {};

  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
        totalRequested: {
          $sum: {
            $add: [
              "$requests.ftd",
              "$requests.filler",
              "$requests.cold",
              "$requests.live",
            ],
          },
        },
        totalFulfilled: {
          $sum: {
            $add: [
              "$fulfilled.ftd",
              "$fulfilled.filler",
              "$fulfilled.cold",
              "$fulfilled.live",
            ],
          },
        },
      },
    },
  ]);
};

orderSchema.statics.getRecentOrders = function (userId = null, limit = 10) {
  const matchStage = userId
    ? { requester: new mongoose.Types.ObjectId(userId) }
    : {};

  return this.find(matchStage)
    .populate("requester", "fullName email role")
    .populate("leads", "leadType firstName lastName country")
    .sort({ createdAt: -1 })
    .limit(limit);
};

module.exports = mongoose.model("Order", orderSchema);
