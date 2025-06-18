const ClientNetwork = require('../models/ClientNetwork');
const asyncHandler = require('../middleware/async');
const ErrorResponse = require('../utils/errorResponse');

// @desc    Create a client network
// @route   POST /api/client-networks
// @access  Private (Admin)
exports.createClientNetwork = asyncHandler(async (req, res, next) => {
    req.body.createdBy = req.user.id;
    const clientNetwork = await ClientNetwork.create(req.body);
    res.status(201).json({ success: true, data: clientNetwork });
});

// @desc    Get all client networks
// @route   GET /api/client-networks
// @access  Private (Admin)
exports.getClientNetworks = asyncHandler(async (req, res, next) => {
    if (req.user.role === 'affiliate_manager') {
        const networks = await ClientNetwork.find({ '_id': { $in: req.user.clientNetworks } });
        return res.status(200).json({
            success: true,
            count: networks.length,
            data: networks
        });
    }
    res.status(200).json(res.advancedResults);
});

// @desc    Get a single client network
// @route   GET /api/client-networks/:id
// @access  Private (Admin)
exports.getClientNetwork = asyncHandler(async (req, res, next) => {
    const clientNetwork = await ClientNetwork.findById(req.params.id).populate('affiliateManagers', 'fullName email');
    if (!clientNetwork) {
        return next(new ErrorResponse(`Client network not found with id of ${req.params.id}`, 404));
    }
    res.status(200).json({ success: true, data: clientNetwork });
});

// @desc    Update a client network
// @route   PUT /api/client-networks/:id
// @access  Private (Admin)
exports.updateClientNetwork = asyncHandler(async (req, res, next) => {
    let clientNetwork = await ClientNetwork.findById(req.params.id);
    if (!clientNetwork) {
        return next(new ErrorResponse(`Client network not found with id of ${req.params.id}`, 404));
    }
    clientNetwork = await ClientNetwork.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true
    });
    res.status(200).json({ success: true, data: clientNetwork });
});

// @desc    Delete a client network
// @route   DELETE /api/client-networks/:id
// @access  Private (Admin)
exports.deleteClientNetwork = asyncHandler(async (req, res, next) => {
    const clientNetwork = await ClientNetwork.findById(req.params.id);
    if (!clientNetwork) {
        return next(new ErrorResponse(`Client network not found with id of ${req.params.id}`, 404));
    }
    await clientNetwork.remove();
    res.status(200).json({ success: true, data: {} });
}); 