const mongoose = require('mongoose');
require('dotenv').config();

async function fixIndexConflict() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/ftd_leads');
    console.log('Connected to MongoDB');

    // Get the leads collection
    const db = mongoose.connection.db;
    const collection = db.collection('leads');

    // Check existing indexes
    const indexes = await collection.indexes();
    console.log('Existing indexes:', indexes.map(idx => ({ name: idx.name, key: idx.key })));

    // Drop the conflicting text index if it exists
    try {
      await collection.dropIndex('lead_search_index');
      console.log('Successfully dropped conflicting text index: lead_search_index');
    } catch (error) {
      if (error.code === 27) {
        console.log('Index lead_search_index does not exist, no need to drop');
      } else {
        console.log('Error dropping index:', error.message);
      }
    }

    // Now import the Lead model to recreate the index with correct configuration
    const Lead = require('../models/Lead');
    
    // Force index creation
    await Lead.createIndexes();
    console.log('Successfully recreated indexes with correct configuration');

    // Verify the new index
    const newIndexes = await collection.indexes();
    const textIndex = newIndexes.find(idx => idx.name === 'lead_search_index');
    if (textIndex) {
      console.log('New text index created successfully:', {
        name: textIndex.name,
        weights: textIndex.weights
      });
    }

  } catch (error) {
    console.error('Error fixing index conflict:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

fixIndexConflict(); 