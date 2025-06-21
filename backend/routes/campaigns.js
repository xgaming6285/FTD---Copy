const express = require("express");
const { body } = require("express-validator");
const {
  getCampaigns,
  getCampaign,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  getMyCampaigns,
  getCampaignMetrics,
} = require("../controllers/campaigns");
const { protect, isAdmin, authorize } = require("../middleware/auth");

const router = express.Router();

// @route   GET /api/campaigns
// @desc    Get all campaigns (Admin sees all, Affiliate Manager sees assigned)
// @access  Private (Admin, Affiliate Manager)
router.get(
  "/",
  [protect, authorize("admin", "affiliate_manager")],
  getCampaigns
);

// @route   GET /api/campaigns/my-campaigns
// @desc    Get campaigns assigned to current affiliate manager
// @access  Private (Affiliate Manager only)
router.get(
  "/my-campaigns",
  [protect, authorize("affiliate_manager")],
  getMyCampaigns
);

// @route   GET /api/campaigns/:id
// @desc    Get single campaign
// @access  Private (Admin, Affiliate Manager - if assigned)
router.get(
  "/:id",
  [protect, authorize("admin", "affiliate_manager")],
  getCampaign
);

// @route   GET /api/campaigns/:id/metrics
// @desc    Get campaign performance metrics
// @access  Private (Admin, Affiliate Manager - if assigned)
router.get(
  "/:id/metrics",
  [protect, authorize("admin", "affiliate_manager")],
  getCampaignMetrics
);

// @route   POST /api/campaigns
// @desc    Create campaign
// @access  Private (Admin only)
router.post(
  "/",
  [
    protect,
    isAdmin,
    body("name")
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage("Name is required and must be less than 100 characters"),
    body("description")
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage("Description must be less than 500 characters"),
    body("status")
      .optional()
      .isIn(["active", "paused", "completed", "draft"])
      .withMessage("Invalid campaign status"),
    body("budget.amount")
      .optional()
      .isNumeric()
      .withMessage("Budget amount must be a number"),
    body("budget.currency")
      .optional()
      .isLength({ min: 3, max: 3 })
      .withMessage("Currency must be 3 characters"),
    body("dateRange.startDate")
      .optional()
      .isISO8601()
      .withMessage("Start date must be a valid date"),
    body("dateRange.endDate")
      .optional()
      .isISO8601()
      .withMessage("End date must be a valid date"),
    body("assignedAffiliateManagers")
      .optional()
      .isArray()
      .withMessage("Assigned affiliate managers must be an array"),
    body("assignedAffiliateManagers.*")
      .optional()
      .isMongoId()
      .withMessage(
        "Each affiliate manager ID must be a valid MongoDB ObjectId"
      ),
  ],
  createCampaign
);

// @route   PUT /api/campaigns/:id
// @desc    Update campaign
// @access  Private (Admin only)
router.put(
  "/:id",
  [
    protect,
    isAdmin,
    body("name")
      .optional()
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage("Name must be less than 100 characters"),
    body("description")
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage("Description must be less than 500 characters"),
    body("status")
      .optional()
      .isIn(["active", "paused", "completed", "draft"])
      .withMessage("Invalid campaign status"),
    body("budget.amount")
      .optional()
      .isNumeric()
      .withMessage("Budget amount must be a number"),
    body("budget.currency")
      .optional()
      .isLength({ min: 3, max: 3 })
      .withMessage("Currency must be 3 characters"),
    body("dateRange.startDate")
      .optional()
      .isISO8601()
      .withMessage("Start date must be a valid date"),
    body("dateRange.endDate")
      .optional()
      .isISO8601()
      .withMessage("End date must be a valid date"),
    body("assignedAffiliateManagers")
      .optional()
      .isArray()
      .withMessage("Assigned affiliate managers must be an array"),
    body("assignedAffiliateManagers.*")
      .optional()
      .isMongoId()
      .withMessage(
        "Each affiliate manager ID must be a valid MongoDB ObjectId"
      ),
    body("isActive")
      .optional()
      .isBoolean()
      .withMessage("isActive must be a boolean"),
  ],
  updateCampaign
);

// @route   DELETE /api/campaigns/:id
// @desc    Delete campaign
// @access  Private (Admin only)
router.delete("/:id", [protect, isAdmin], deleteCampaign);

module.exports = router;
