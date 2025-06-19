const express = require("express");
const { body, query } = require("express-validator");
const { protect, isManager, hasPermission } = require("../middleware/auth");
const {
  createOrder,
  getOrders,
  getOrderById,
  updateOrder,
  cancelOrder,
  getOrderStats,
  exportOrderLeads,
  getExclusionOptions,
  assignClientInfoToOrderLeads,
  startOrderInjection,
  pauseOrderInjection,
  stopOrderInjection,
  skipOrderFTDs,
} = require("../controllers/orders");

const router = express.Router();

// @route   POST /api/orders
// @desc    Create a new order and pull leads
// @access  Private (Admin, Manager with canCreateOrders permission)
router.post(
  "/",
  [
    protect,
    isManager,
    hasPermission("canCreateOrders"),
    body("requests.ftd")
      .optional()
      .isInt({ min: 0 })
      .withMessage("FTD request must be a non-negative integer"),
    body("requests.filler")
      .optional()
      .isInt({ min: 0 })
      .withMessage("Filler request must be a non-negative integer"),
    body("requests.cold")
      .optional()
      .isInt({ min: 0 })
      .withMessage("Cold request must be a non-negative integer"),
    body("priority")
      .optional()
      .isIn(["low", "medium", "high"])
      .withMessage("Priority must be low, medium, or high"),
    body("notes")
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage("Notes must be less than 500 characters"),
    body("country")
      .optional({ nullable: true })
      .trim()
      .custom((value) => {
        if (value === null || value === "") {
          return true;
        }
        if (value.length < 2) {
          throw new Error("Country must be at least 2 characters");
        }
        return true;
      }),
    body("gender")
      .optional({ nullable: true })
      .isIn(["male", "female", "not_defined", null, ""])
      .withMessage("Gender must be male, female, not_defined, or empty"),
    body("excludeClients")
      .optional()
      .isArray()
      .withMessage("excludeClients must be an array"),
    body("excludeBrokers")
      .optional()
      .isArray()
      .withMessage("excludeBrokers must be an array"),
    body("excludeNetworks")
      .optional()
      .isArray()
      .withMessage("excludeNetworks must be an array"),
  ],
  createOrder
);

// @route   GET /api/orders
// @desc    Get orders with pagination and filtering
// @access  Private (Admin, Manager)
router.get(
  "/",
  [
    protect,
    isManager,
    query("page")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Page must be a positive integer"),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage("Limit must be between 1 and 100"),
  ],
  getOrders
);

// @route   GET /api/orders/stats
// @desc    Get order statistics
// @access  Private (Admin, Manager)
router.get("/stats", [protect, isManager], getOrderStats);

// @route   GET /api/orders/exclusion-options
// @desc    Get available exclusion options for orders
// @access  Private (Admin, Manager with canCreateOrders permission)
router.get(
  "/exclusion-options",
  [protect, isManager, hasPermission("canCreateOrders")],
  getExclusionOptions
);

// @route   GET /api/orders/:id
// @desc    Get a single order by ID
// @access  Private (Admin, Manager)
router.get("/:id", [protect, isManager], getOrderById);

// @route   PUT /api/orders/:id
// @desc    Update an order
// @access  Private (Admin, Manager)
router.put("/:id", [protect, isManager], updateOrder);

// @route   DELETE /api/orders/:id
// @desc    Cancel an order
// @access  Private (Admin, Manager)
router.delete("/:id", [protect, isManager], cancelOrder);

// @route   GET /api/orders/:id/export
// @desc    Export order leads to CSV
// @access  Private (Admin, Manager)
router.get("/:id/export", [protect, isManager], exportOrderLeads);

// @route   PUT /api/orders/:id/assign-client-info
// @desc    Assign client info to all leads in an order
// @access  Private (Admin, Manager)
router.put(
  "/:id/assign-client-info",
  [
    protect,
    isManager,
    body("client").optional().trim(),
    body("clientBroker").optional().trim(),
    body("clientNetwork").optional().trim(),
  ],
  assignClientInfoToOrderLeads
);

// New injection routes
// @route   POST /api/orders/:id/start-injection
// @desc    Start lead injection for an order
// @access  Private (Admin, Affiliate Manager)
router.post("/:id/start-injection", [protect, isManager], startOrderInjection);

// @route   POST /api/orders/:id/pause-injection
// @desc    Pause lead injection for an order
// @access  Private (Admin, Affiliate Manager)
router.post("/:id/pause-injection", [protect, isManager], pauseOrderInjection);

// @route   POST /api/orders/:id/stop-injection
// @desc    Stop lead injection for an order
// @access  Private (Admin, Affiliate Manager)
router.post("/:id/stop-injection", [protect, isManager], stopOrderInjection);

// @route   POST /api/orders/:id/skip-ftds
// @desc    Skip FTDs and mark them for manual filling later
// @access  Private (Admin, Affiliate Manager)
router.post("/:id/skip-ftds", [protect, isManager], skipOrderFTDs);

module.exports = router;
