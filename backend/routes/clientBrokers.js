const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const ClientBroker = require('../models/ClientBroker');
const advancedResults = require('../middleware/advancedResults');
const { 
    createClientBroker,
    getClientBrokers,
    getClientBroker,
    updateClientBroker,
    deleteClientBroker 
} = require('../controllers/clientBrokers');

// All routes are protected
router.use(protect);

router.route('/')
    .post(authorize('admin', 'affiliate_manager'), createClientBroker)
    .get(authorize('admin', 'affiliate_manager'), advancedResults(ClientBroker, { path: 'clientNetwork', select: 'name' }), getClientBrokers);

router.route('/:id')
    .get(authorize('admin', 'affiliate_manager'), getClientBroker)
    .put(authorize('admin'), updateClientBroker)
    .delete(authorize('admin'), deleteClientBroker);

module.exports = router; 