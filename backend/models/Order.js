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
      enum: ["fulfilled", "partial", "pending", "cancelled"],
      default: "pending",
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

    // Selected client network for this order (for reference only)
    selectedClientNetwork: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ClientNetwork",
      default: null,
    },

    // Fulfillment tracking
    fulfilled: {
      ftd: { type: Number, default: 0 },
      filler: { type: Number, default: 0 },
      cold: { type: Number, default: 0 },
      live: { type: Number, default: 0 },
    },

    // Injection settings and tracking
    injectionSettings: {
      enabled: { type: Boolean, default: false },
      mode: {
        type: String,
        enum: ["manual", "bulk", "scheduled"],
        default: "manual"
      },
      // For scheduled injection
      scheduledTime: {
        startTime: { type: String }, // e.g., "10:00"
        endTime: { type: String },   // e.g., "12:00"
      },
      // Injection status tracking
      status: {
        type: String,
        enum: ["pending", "in_progress", "completed", "failed", "paused"],
        default: "pending"
      },
      // Track which lead types to inject (FTDs are always manual)
      includeTypes: {
        filler: { type: Boolean, default: true },
        cold: { type: Boolean, default: true },
        live: { type: Boolean, default: true }
      }
    },

    // FTD handling tracking
    ftdHandling: {
      status: {
        type: String,
        enum: ["pending", "skipped", "manual_fill_required", "completed"],
        default: "pending"
      },
      skippedAt: { type: Date },
      completedAt: { type: Date },
      notes: { type: String }
    },

    // Injection progress tracking
    injectionProgress: {
      totalToInject: { type: Number, default: 0 },
      totalInjected: { type: Number, default: 0 },
      successfulInjections: { type: Number, default: 0 },
      failedInjections: { type: Number, default: 0 },
      ftdsPendingManualFill: { type: Number, default: 0 },
      lastInjectionAt: { type: Date },
      completedAt: { type: Date }
    },

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
