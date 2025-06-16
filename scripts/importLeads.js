const { MongoClient } = require('mongodb');
const { generateLeads } = require('./generateRandomLeads');

async function importLeads(uri, numberOfLeads) {
    const client = new MongoClient(uri);
    
    try {
        await client.connect();
        console.log('Connected to MongoDB');
        
        const db = client.db('test');
        const leads = generateLeads(numberOfLeads);
        
        const results = {
            success: [],
            duplicates: [],
            errors: []
        };

        // Import leads one by one to handle duplicates gracefully
        for (const lead of leads) {
            try {
                await db.collection('leads').insertOne(lead);
                results.success.push(lead.newEmail);
            } catch (error) {
                if (error.code === 11000) {
                    // Duplicate key error
                    results.duplicates.push(lead.newEmail);
                } else {
                    results.errors.push({
                        email: lead.newEmail,
                        error: error.message
                    });
                }
            }
        }

        // Print results
        console.log('\nImport Results:');
        console.log(`Successfully imported: ${results.success.length} leads`);
        console.log(`Skipped duplicates: ${results.duplicates.length} leads`);
        console.log(`Errors: ${results.errors.length} leads`);

        if (results.duplicates.length > 0) {
            console.log('\nDuplicate emails:');
            console.log(results.duplicates);
        }

        if (results.errors.length > 0) {
            console.log('\nErrors:');
            console.log(results.errors);
        }

    } finally {
        await client.close();
    }
}

// Get command line arguments
const args = process.argv.slice(2);
const uri = args[0] || 'mongodb://localhost:27017';
const numberOfLeads = parseInt(args[1]) || 10;

// Run the import
importLeads(uri, numberOfLeads)
    .catch(console.error); 