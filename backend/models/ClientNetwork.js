const mongoose = require("mongoose");

const clientNetworkSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Client network name is required"],
      trim: true,
      unique: true,
    },
    description: {
      type: String,
      trim: true,
    },
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
    // Client brokers associated with this network
    clientBrokers: [
      {
        name: {
          type: String,
          required: true,
          trim: true,
        },
        domain: {
          type: String,
          trim: true,
        },
        isActive: {
          type: Boolean,
          default: true,
        },
        addedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for performance
clientNetworkSchema.index({ name: 1 });
clientNetworkSchema.index({ assignedAffiliateManagers: 1 });
clientNetworkSchema.index({ createdBy: 1 });
clientNetworkSchema.index({ isActive: 1 });

// Virtual for assigned affiliate managers count
clientNetworkSchema.virtual("assignedManagersCount").get(function () {
  return this.assignedAffiliateManagers.length;
});

// Virtual for active client brokers count
clientNetworkSchema.virtual("activeBrokersCount").get(function () {
  return this.clientBrokers.filter((broker) => broker.isActive).length;
});

module.exports = mongoose.model("ClientNetwork", clientNetworkSchema); 