const mongoose = require("mongoose");

const campaignSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Campaign name is required"],
      trim: true,
      unique: true,
    },
    description: {
      type: String,
      trim: true,
    },
    // Campaign status
    status: {
      type: String,
      enum: ["active", "paused", "completed", "draft"],
      default: "active",
    },
    // Budget tracking
    budget: {
      amount: {
        type: Number,
        min: 0,
      },
      currency: {
        type: String,
        default: "USD",
      },
    },
    // Date range for campaign
    dateRange: {
      startDate: {
        type: Date,
      },
      endDate: {
        type: Date,
      },
    },
    // Target audience settings
    targetAudience: {
      countries: [String],
      genders: [
        {
          type: String,
          enum: ["male", "female", "not_defined"],
        },
      ],
      ageRange: {
        min: Number,
        max: Number,
      },
    },
    // Assigned affiliate managers who can use this campaign
    assignedAffiliateManagers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    // Performance tracking
    metrics: {
      totalLeads: {
        type: Number,
        default: 0,
      },
      totalOrders: {
        type: Number,
        default: 0,
      },
      conversionRate: {
        type: Number,
        default: 0,
      },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for performance
campaignSchema.index({ name: 1 });
campaignSchema.index({ status: 1 });
campaignSchema.index({ assignedAffiliateManagers: 1 });
campaignSchema.index({ createdBy: 1 });
campaignSchema.index({ isActive: 1 });
campaignSchema.index({ "dateRange.startDate": 1, "dateRange.endDate": 1 });

// Virtual for assigned affiliate managers count
campaignSchema.virtual("assignedManagersCount").get(function () {
  return this.assignedAffiliateManagers
    ? this.assignedAffiliateManagers.length
    : 0;
});

// Method to check if campaign is currently active based on date range
campaignSchema.methods.isCurrentlyActive = function () {
  if (!this.isActive || this.status !== "active") {
    return false;
  }

  const now = new Date();
  const startDate = this.dateRange?.startDate;
  const endDate = this.dateRange?.endDate;

  if (startDate && now < startDate) {
    return false;
  }

  if (endDate && now > endDate) {
    return false;
  }

  return true;
};

// Method to update campaign metrics
campaignSchema.methods.updateMetrics = async function () {
  const Lead = require("./Lead");
  const Order = require("./Order");

  try {
    // Count total leads assigned to this campaign
    const totalLeads = await Lead.countDocuments({
      "campaignHistory.campaign": this._id,
    });

    // Count total orders using this campaign
    const totalOrders = await Order.countDocuments({
      selectedCampaign: this._id,
    });

    // Calculate conversion rate (orders per lead)
    const conversionRate =
      totalLeads > 0 ? (totalOrders / totalLeads) * 100 : 0;

    this.metrics = {
      totalLeads,
      totalOrders,
      conversionRate: Math.round(conversionRate * 100) / 100, // Round to 2 decimal places
    };

    await this.save();
  } catch (error) {
    console.error("Error updating campaign metrics:", error);
  }
};

module.exports = mongoose.model("Campaign", campaignSchema);
