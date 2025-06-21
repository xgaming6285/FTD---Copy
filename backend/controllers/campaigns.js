const { validationResult } = require("express-validator");
const mongoose = require("mongoose");
const Campaign = require("../models/Campaign");
const User = require("../models/User");
const Lead = require("../models/Lead");
const ClientNetwork = require("../models/ClientNetwork");

// @desc    Get all campaigns
// @route   GET /api/campaigns
// @access  Private (Admin, Affiliate Manager)
exports.getCampaigns = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, search, status, isActive } = req.query;

    // Build filter object
    const filter = {};
    if (search) {
      filter.$or = [
        { name: new RegExp(search, "i") },
        { description: new RegExp(search, "i") },
      ];
    }
    if (status) {
      filter.status = status;
    }
    if (isActive !== undefined) {
      filter.isActive = isActive === "true";
    }

    // Role-based filtering
    if (req.user.role === "affiliate_manager") {
      // Affiliate managers can only see campaigns assigned to them
      filter.assignedAffiliateManagers = req.user._id;
    }

    const skip = (page - 1) * limit;

    const [campaigns, total] = await Promise.all([
      Campaign.find(filter)
        .populate("assignedAffiliateManagers", "fullName email")
        .populate("createdBy", "fullName email")
        .skip(skip)
        .limit(parseInt(limit))
        .sort({ createdAt: -1 }),
      Campaign.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: campaigns,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total,
        limit: parseInt(limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single campaign
// @route   GET /api/campaigns/:id
// @access  Private (Admin, Affiliate Manager - if assigned)
exports.getCampaign = async (req, res, next) => {
  try {
    const campaign = await Campaign.findById(req.params.id)
      .populate("assignedAffiliateManagers", "fullName email")
      .populate("createdBy", "fullName email");

    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: "Campaign not found",
      });
    }

    // Check if affiliate manager has access
    if (req.user.role === "affiliate_manager") {
      const isAssigned = campaign.assignedAffiliateManagers.some(
        (manager) => manager._id.toString() === req.user._id.toString()
      );
      if (!isAssigned) {
        return res.status(403).json({
          success: false,
          message: "Access denied - campaign not assigned to you",
        });
      }
    }

    res.status(200).json({
      success: true,
      data: campaign,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create campaign
// @route   POST /api/campaigns
// @access  Private (Admin only)
exports.createCampaign = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: errors.array(),
      });
    }

    const {
      name,
      description,
      status,
      budget,
      dateRange,
      targetAudience,
      assignedAffiliateManagers = [],
    } = req.body;

    // Validate affiliate managers exist and have correct role
    if (assignedAffiliateManagers.length > 0) {
      const managers = await User.find({
        _id: { $in: assignedAffiliateManagers },
        role: "affiliate_manager",
        isActive: true,
        status: "approved",
      });

      if (managers.length !== assignedAffiliateManagers.length) {
        return res.status(400).json({
          success: false,
          message: "One or more affiliate managers are invalid or inactive",
        });
      }
    }

    const campaign = new Campaign({
      name,
      description,
      status,
      budget,
      dateRange,
      targetAudience,
      assignedAffiliateManagers,
      createdBy: req.user._id,
    });

    await campaign.save();

    // Populate for response
    await campaign.populate([
      { path: "assignedAffiliateManagers", select: "fullName email" },
      { path: "createdBy", select: "fullName email" },
    ]);

    res.status(201).json({
      success: true,
      message: "Campaign created successfully",
      data: campaign,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Campaign name already exists",
      });
    }
    next(error);
  }
};

// @desc    Update campaign
// @route   PUT /api/campaigns/:id
// @access  Private (Admin only)
exports.updateCampaign = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: errors.array(),
      });
    }

    const {
      name,
      description,
      status,
      budget,
      dateRange,
      targetAudience,
      assignedAffiliateManagers,
      isActive,
    } = req.body;

    const campaign = await Campaign.findById(req.params.id);
    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: "Campaign not found",
      });
    }

    // Validate affiliate managers if provided
    if (assignedAffiliateManagers && assignedAffiliateManagers.length > 0) {
      const managers = await User.find({
        _id: { $in: assignedAffiliateManagers },
        role: "affiliate_manager",
        isActive: true,
        status: "approved",
      });

      if (managers.length !== assignedAffiliateManagers.length) {
        return res.status(400).json({
          success: false,
          message: "One or more affiliate managers are invalid or inactive",
        });
      }
    }

    // Update fields
    if (name !== undefined) campaign.name = name;
    if (description !== undefined) campaign.description = description;
    if (status !== undefined) campaign.status = status;
    if (budget !== undefined) campaign.budget = budget;
    if (dateRange !== undefined) campaign.dateRange = dateRange;
    if (targetAudience !== undefined) campaign.targetAudience = targetAudience;
    if (assignedAffiliateManagers !== undefined)
      campaign.assignedAffiliateManagers = assignedAffiliateManagers;
    if (isActive !== undefined) campaign.isActive = isActive;

    await campaign.save();

    // Populate for response
    await campaign.populate([
      { path: "assignedAffiliateManagers", select: "fullName email" },
      { path: "createdBy", select: "fullName email" },
    ]);

    res.status(200).json({
      success: true,
      message: "Campaign updated successfully",
      data: campaign,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Campaign name already exists",
      });
    }
    next(error);
  }
};

// @desc    Delete campaign
// @route   DELETE /api/campaigns/:id
// @access  Private (Admin only)
exports.deleteCampaign = async (req, res, next) => {
  try {
    const campaign = await Campaign.findById(req.params.id);
    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: "Campaign not found",
      });
    }

    await Campaign.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: "Campaign deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get campaigns assigned to current affiliate manager
// @route   GET /api/campaigns/my-campaigns
// @access  Private (Affiliate Manager only)
exports.getMyCampaigns = async (req, res, next) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

    const campaigns = await Campaign.find({
      assignedAffiliateManagers: req.user._id,
      isActive: true,
      status: "active",
    })
      .select("name description campaignType status")
      .sort({ name: 1 });

    res.status(200).json({
      success: true,
      data: campaigns,
    });
  } catch (error) {
    console.error("Error in getMyCampaigns:", error);
    next(error);
  }
};

// @desc    Get campaign performance metrics
// @route   GET /api/campaigns/:id/metrics
// @access  Private (Admin, Affiliate Manager - if assigned)
exports.getCampaignMetrics = async (req, res, next) => {
  try {
    const campaign = await Campaign.findById(req.params.id);
    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: "Campaign not found",
      });
    }

    // Check if affiliate manager has access
    if (req.user.role === "affiliate_manager") {
      const isAssigned = campaign.assignedAffiliateManagers.some(
        (managerId) => managerId.toString() === req.user._id.toString()
      );
      if (!isAssigned) {
        return res.status(403).json({
          success: false,
          message: "Access denied - campaign not assigned to you",
        });
      }
    }

    // Update metrics before returning
    await campaign.updateMetrics();

    // Get detailed metrics
    const Order = require("../models/Order");

    // Get order statuses for this campaign
    const orderStats = await Order.aggregate([
      { $match: { selectedCampaign: campaign._id } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    // Get lead performance for this campaign
    const leadStats = await Lead.aggregate([
      { $match: { "campaignHistory.campaign": campaign._id } },
      { $unwind: "$campaignHistory" },
      { $match: { "campaignHistory.campaign": campaign._id } },
      {
        $group: {
          _id: "$campaignHistory.performance.status",
          count: { $sum: 1 },
        },
      },
    ]);

    res.status(200).json({
      success: true,
      data: {
        campaign: {
          _id: campaign._id,
          name: campaign.name,
          metrics: campaign.metrics,
        },
        orderStats,
        leadStats,
      },
    });
  } catch (error) {
    next(error);
  }
};
