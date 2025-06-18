const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const ClientNetwork = require('../models/ClientNetwork');
const advancedResults = require('../middleware/advancedResults');
const { 
    createClientNetwork,
    getClientNetworks,
    getClientNetwork,
    updateClientNetwork,
    deleteClientNetwork 
} = require('../controllers/clientNetworks');

// All routes are protected and restricted to admins
router.use(protect);

router.route('/')
    .post(authorize('admin'), createClientNetwork)
    .get(authorize('admin', 'affiliate_manager'), advancedResults(ClientNetwork, { path: 'affiliateManagers', select: 'fullName email' }), getClientNetworks);

router.route('/:id')
    .get(authorize('admin', 'affiliate_manager'), getClientNetwork)
    .put(authorize('admin'), updateClientNetwork)
    .delete(authorize('admin'), deleteClientNetwork);

module.exports = router; 