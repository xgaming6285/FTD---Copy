const { validationResult } = require("express-validator");
const Order = require("../models/Order");
const Lead = require("../models/Lead");
const ClientBroker = require('../models/ClientBroker');
const asyncHandler = require('../middleware/async');

/**
 * @desc    Assign a Client Broker to a lead assignment that is pending broker assignment
 * @route   POST /api/v1/orders/:orderId/leads/:leadId/assign-broker
 * @access  Private (Admin, Affiliate Manager)
 */
exports.assignBrokerToLeadAssignment = asyncHandler(async (req, res, next) => {
    const { orderId, leadId } = req.params;
    const { clientBrokerId } = req.body;
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }

    const order = await Order.findById(orderId);
    if (!order) {
        return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const lead = await Lead.findById(leadId);
    if (!lead) {
        return res.status(404).json({ success: false, message: 'Lead not found' });
    }
    
    const clientBroker = await ClientBroker.findById(clientBrokerId);
    if (!clientBroker) {
        return res.status(404).json({ success: false, message: 'Client Broker not found' });
    }

    // Validation: Ensure the chosen broker belongs to the order's client network
    if (clientBroker.clientNetwork.toString() !== order.clientNetwork.toString()) {
        return res.status(400).json({ success: false, message: `Broker ${clientBroker.name} does not belong to the order's network.` });
    }

    // Find the assignment within the lead that corresponds to this order
    const assignment = lead.assignments.find(a => a.order.equals(order._id));

    if (!assignment) {
        return res.status(404).json({ success: false, message: 'No assignment found for this lead in this order.' });
    }

    if (assignment.status !== 'pending_broker_assignment') {
        return res.status(400).json({ success: false, message: `Assignment status is '${assignment.status}', not 'pending_broker_assignment'. Cannot re-assign broker.` });
    }

    // Update the assignment
    assignment.clientBroker = clientBroker._id;
    assignment.status = 'injected';
    
    // Increment the fulfilled count on the order
    if (order.fulfilled[lead.leadType] < order.requests[lead.leadType]) {
        order.fulfilled[lead.leadType]++;
    }

    order.logs.push({
        message: `Broker ${clientBroker.name} was manually assigned to lead ${lead.fullName || lead._id}. Injection complete.`,
        type: 'info',
        lead: lead._id
    });
    
    // Save both documents
    await lead.save();
    await order.save();
    
    res.status(200).json({
        success: true,
        message: `Broker successfully assigned to lead ${leadId}.`,
        data: lead
    });
}); 