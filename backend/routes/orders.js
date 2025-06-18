const express = require("express");
const { body, query } = require("express-validator");
const { protect, authorize } = require("../middleware/auth");
const {
  createOrder,
  getOrders,
  getOrderById,
  updateOrder,
  deleteOrder,
  getOrderStats,
  exportOrderLeads,
  getExclusionOptions,
  assignClientInfoToOrderLeads,
  startOrderInjection,
  injectFtdLead,
  getLeadsForOrder,
} = require("../controllers/orders");
const { assignBrokerToLeadAssignment } = require("../controllers/assignments");
const advancedResults = require("../middleware/advancedResults");
const Order = require("../models/Order");

const router = express.Router();

// All routes below are protected
router.use(protect);

router.route("/")
  .get(
    authorize("admin", "affiliate_manager"),
    advancedResults(Order, { path: "requester", select: "fullName email" }),
    getOrders
  )
  .post(
    authorize("admin", "affiliate_manager"),
    // Add validation middleware here if needed
    createOrder
  );

router.route("/stats")
  .get(authorize("admin", "affiliate_manager"), getOrderStats);
  
router.route("/exclusion-options")
  .get(authorize("admin", "affiliate_manager"), getExclusionOptions);

router.route("/:id")
  .get(authorize("admin", "affiliate_manager"), getOrderById)
  .put(authorize("admin", "affiliate_manager"), updateOrder)
  .delete(authorize("admin"), deleteOrder);

router.route("/:id/export")
  .get(authorize("admin", "affiliate_manager"), exportOrderLeads);
  
router.route("/:id/inject")
  .post(authorize("admin", "affiliate_manager"), startOrderInjection);

router.route("/:id/assign-client-info")
  .put(authorize("admin", "affiliate_manager"), assignClientInfoToOrderLeads);

router.route("/:orderId/leads/:leadId/inject")
  .post(
    authorize("admin", "affiliate_manager"),
    body("clientBrokerId").isMongoId().withMessage("A valid client broker ID is required"),
    injectFtdLead
  );

router.route("/:orderId/leads/:leadId/assign-broker")
  .post(
    authorize("admin", "affiliate_manager"),
    body("clientBrokerId").isMongoId().withMessage("A valid Client Broker ID is required."),
    assignBrokerToLeadAssignment
  );

router.route("/:id/leads")
    .get(authorize("admin", "affiliate_manager"), getLeadsForOrder);

module.exports = router;
