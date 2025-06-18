const ClientBroker = require('../models/ClientBroker');
const asyncHandler = require('../middleware/async');
const ErrorResponse = require('../utils/errorResponse');

// @desc    Create a client broker
// @route   POST /api/client-brokers
// @access  Private (Admin, Affiliate Manager)
exports.createClientBroker = asyncHandler(async (req, res, next) => {
    req.body.createdBy = req.user.id;
    const clientBroker = await ClientBroker.create(req.body);
    res.status(201).json({ success: true, data: clientBroker });
});

// @desc    Get all client brokers
// @route   GET /api/client-brokers
// @access  Private (Admin, Affiliate Manager)
exports.getClientBrokers = asyncHandler(async (req, res, next) => {
    if (req.user.role === 'affiliate_manager') {
        // Affiliate managers only see their assigned brokers
        const brokers = await ClientBroker.find({ '_id': { $in: req.user.clientBrokers } }).populate('clientNetwork', 'name');
        return res.status(200).json({
            success: true,
            count: brokers.length,
            data: brokers
        });
    }
    // Admin sees all brokers, handled by advancedResults middleware
    res.status(200).json(res.advancedResults);
});

// @desc    Get a single client broker
// @route   GET /api/client-brokers/:id
// @access  Private (Admin, Affiliate Manager)
exports.getClientBroker = asyncHandler(async (req, res, next) => {
    const clientBroker = await ClientBroker.findById(req.params.id).populate('clientNetwork', 'name');
    if (!clientBroker) {
        return next(new ErrorResponse(`Client broker not found with id of ${req.params.id}`, 404));
    }
    res.status(200).json({ success: true, data: clientBroker });
});

// @desc    Update a client broker
// @route   PUT /api/client-brokers/:id
// @access  Private (Admin)
exports.updateClientBroker = asyncHandler(async (req, res, next) => {
    let clientBroker = await ClientBroker.findById(req.params.id);
    if (!clientBroker) {
        return next(new ErrorResponse(`Client broker not found with id of ${req.params.id}`, 404));
    }
    clientBroker = await ClientBroker.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true
    });
    res.status(200).json({ success: true, data: clientBroker });
});

// @desc    Delete a client broker
// @route   DELETE /api/client-brokers/:id
// @access  Private (Admin)
exports.deleteClientBroker = asyncHandler(async (req, res, next) => {
    const clientBroker = await ClientBroker.findById(req.params.id);
    if (!clientBroker) {
        return next(new ErrorResponse(`Client broker not found with id of ${req.params.id}`, 404));
    }
    await clientBroker.remove();
    res.status(200).json({ success: true, data: {} });
}); 