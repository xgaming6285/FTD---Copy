const mongoose = require('mongoose');

const clientBrokerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true, // A broker should be unique
    trim: true
  },
  // Belongs to which client network
  clientNetwork: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ClientNetwork',
    required: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // admin or affiliate manager
    required: true
  }
}, { timestamps: true });

module.exports = mongoose.model('ClientBroker', clientBrokerSchema); 