const { validationResult } = require("express-validator");
const mongoose = require("mongoose");
const ClientNetwork = require("../models/ClientNetwork");
const User = require("../models/User");
const Lead = require("../models/Lead");

// @desc    Get all client networks
// @route   GET /api/client-networks
// @access  Private (Admin, Affiliate Manager)
exports.getClientNetworks = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, search, isActive } = req.query;

    // Build filter object
    const filter = {};
    if (search) {
      filter.$or = [
        { name: new RegExp(search, "i") },
        { description: new RegExp(search, "i") },
      ];
    }
    if (isActive !== undefined) {
      filter.isActive = isActive === "true";
    }

    // Role-based filtering
    if (req.user.role === "affiliate_manager") {
      // Affiliate managers can only see networks assigned to them
      filter.assignedAffiliateManagers = req.user._id;
    }

    const skip = (page - 1) * limit;

    const [clientNetworks, total] = await Promise.all([
      ClientNetwork.find(filter)
        .populate("assignedAffiliateManagers", "fullName email")
        .populate("createdBy", "fullName email")
        .skip(skip)
        .limit(parseInt(limit))
        .sort({ createdAt: -1 }),
      ClientNetwork.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: clientNetworks,
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

// @desc    Get single client network
// @route   GET /api/client-networks/:id
// @access  Private (Admin, Affiliate Manager - if assigned)
exports.getClientNetwork = async (req, res, next) => {
  try {
    const clientNetwork = await ClientNetwork.findById(req.params.id)
      .populate("assignedAffiliateManagers", "fullName email")
      .populate("createdBy", "fullName email");

    if (!clientNetwork) {
      return res.status(404).json({
        success: false,
        message: "Client network not found",
      });
    }

    // Check if affiliate manager has access
    if (req.user.role === "affiliate_manager") {
      const isAssigned = clientNetwork.assignedAffiliateManagers.some(
        (manager) => manager._id.toString() === req.user._id.toString()
      );
      if (!isAssigned) {
        return res.status(403).json({
          success: false,
          message: "Access denied - client network not assigned to you",
        });
      }
    }

    res.status(200).json({
      success: true,
      data: clientNetwork,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create client network
// @route   POST /api/client-networks
// @access  Private (Admin only)
exports.createClientNetwork = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: errors.array(),
      });
    }

    const { name, description, assignedAffiliateManagers = [] } = req.body;

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

    const clientNetwork = new ClientNetwork({
      name,
      description,
      assignedAffiliateManagers,
      createdBy: req.user._id,
    });

    await clientNetwork.save();

    // Populate for response
    await clientNetwork.populate([
      { path: "assignedAffiliateManagers", select: "fullName email" },
      { path: "createdBy", select: "fullName email" },
    ]);

    // Wake up sleeping leads that might now have available brokers
    const sleepingLeads = await Lead.findSleepingLeads();
    let wokeUpCount = 0;

    if (sleepingLeads.length > 0) {
      for (const lead of sleepingLeads) {
        // Check if this new network has brokers available for the lead
        if (clientNetwork.clientBrokers && clientNetwork.clientBrokers.length > 0) {
          const availableBrokers = clientNetwork.clientBrokers
            .filter(broker => broker.isActive)
            .map(broker => broker.domain || broker.name);

          const assignedBrokers = lead.getAssignedClientBrokers();
          const hasAvailableBrokers = availableBrokers.some(broker => !assignedBrokers.includes(broker));

          if (hasAvailableBrokers) {
            lead.wakeUp();
            await lead.save();
            wokeUpCount++;
          }
        }
      }
    }

    console.log(`Woke up ${wokeUpCount} sleeping leads after creating new client network`);

    res.status(201).json({
      success: true,
      message: `Client network created successfully. ${wokeUpCount} sleeping leads were woken up.`,
      data: clientNetwork,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Client network name already exists",
      });
    }
    next(error);
  }
};

// @desc    Update client network
// @route   PUT /api/client-networks/:id
// @access  Private (Admin only)
exports.updateClientNetwork = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: errors.array(),
      });
    }

    const { name, description, assignedAffiliateManagers, isActive } = req.body;

    const clientNetwork = await ClientNetwork.findById(req.params.id);
    if (!clientNetwork) {
      return res.status(404).json({
        success: false,
        message: "Client network not found",
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
    if (name !== undefined) clientNetwork.name = name;
    if (description !== undefined) clientNetwork.description = description;
    if (assignedAffiliateManagers !== undefined)
      clientNetwork.assignedAffiliateManagers = assignedAffiliateManagers;
    if (isActive !== undefined) clientNetwork.isActive = isActive;

    await clientNetwork.save();

    // Populate for response
    await clientNetwork.populate([
      { path: "assignedAffiliateManagers", select: "fullName email" },
      { path: "createdBy", select: "fullName email" },
    ]);

    res.status(200).json({
      success: true,
      message: "Client network updated successfully",
      data: clientNetwork,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Client network name already exists",
      });
    }
    next(error);
  }
};

// @desc    Delete client network
// @route   DELETE /api/client-networks/:id
// @access  Private (Admin only)
exports.deleteClientNetwork = async (req, res, next) => {
  try {
    const clientNetwork = await ClientNetwork.findById(req.params.id);
    if (!clientNetwork) {
      return res.status(404).json({
        success: false,
        message: "Client network not found",
      });
    }

    await ClientNetwork.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: "Client network deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Add client broker to network
// @route   POST /api/client-networks/:id/brokers
// @access  Private (Admin only)
exports.addClientBroker = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: errors.array(),
      });
    }

    const { name, domain } = req.body;

    const clientNetwork = await ClientNetwork.findById(req.params.id);
    if (!clientNetwork) {
      return res.status(404).json({
        success: false,
        message: "Client network not found",
      });
    }

    // Check if broker already exists
    const existingBroker = clientNetwork.clientBrokers.find(
      (broker) => broker.name === name || broker.domain === domain
    );

    if (existingBroker) {
      return res.status(400).json({
        success: false,
        message: "Client broker with this name or domain already exists",
      });
    }

    clientNetwork.clientBrokers.push({
      name,
      domain,
    });

    await clientNetwork.save();

    // Wake up sleeping leads that might now have available brokers
    const sleepingLeads = await Lead.findSleepingLeads();

    let wokeUpCount = 0;
    for (const lead of sleepingLeads) {
      // Check if this new broker is available for the lead
      if (!lead.isAssignedToClientBroker(domain || name)) {
        lead.wakeUp();
        await lead.save();
        wokeUpCount++;
      }
    }

    console.log(`Woke up ${wokeUpCount} sleeping leads after adding new broker`);

    res.status(201).json({
      success: true,
      message: `Client broker added successfully. ${wokeUpCount} sleeping leads were woken up.`,
      data: clientNetwork,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update client broker in network
// @route   PUT /api/client-networks/:id/brokers/:brokerId
// @access  Private (Admin only)
exports.updateClientBroker = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: errors.array(),
      });
    }

    const { name, domain, isActive } = req.body;

    const clientNetwork = await ClientNetwork.findById(req.params.id);
    if (!clientNetwork) {
      return res.status(404).json({
        success: false,
        message: "Client network not found",
      });
    }

    const broker = clientNetwork.clientBrokers.id(req.params.brokerId);
    if (!broker) {
      return res.status(404).json({
        success: false,
        message: "Client broker not found",
      });
    }

    // Update broker fields
    if (name !== undefined) broker.name = name;
    if (domain !== undefined) broker.domain = domain;
    if (isActive !== undefined) broker.isActive = isActive;

    await clientNetwork.save();

    res.status(200).json({
      success: true,
      message: "Client broker updated successfully",
      data: clientNetwork,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Remove client broker from network
// @route   DELETE /api/client-networks/:id/brokers/:brokerId
// @access  Private (Admin only)
exports.removeClientBroker = async (req, res, next) => {
  try {
    const clientNetwork = await ClientNetwork.findById(req.params.id);
    if (!clientNetwork) {
      return res.status(404).json({
        success: false,
        message: "Client network not found",
      });
    }

    const broker = clientNetwork.clientBrokers.id(req.params.brokerId);
    if (!broker) {
      return res.status(404).json({
        success: false,
        message: "Client broker not found",
      });
    }

    clientNetwork.clientBrokers.pull(req.params.brokerId);
    await clientNetwork.save();

    res.status(200).json({
      success: true,
      message: "Client broker removed successfully",
      data: clientNetwork,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get client networks assigned to current affiliate manager
// @route   GET /api/client-networks/my-networks
// @access  Private (Affiliate Manager only)
exports.getMyClientNetworks = async (req, res, next) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated"
      });
    }

    const clientNetworks = await ClientNetwork.find({
      assignedAffiliateManagers: req.user._id,
      isActive: true,
    })
      .select("name description clientBrokers")
      .sort({ name: 1 });

    res.status(200).json({
      success: true,
      data: clientNetworks,
    });
  } catch (error) {
    console.error('Error in getMyClientNetworks:', error);
    next(error);
  }
}; 