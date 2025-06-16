const faker = require('faker');
const fs = require('fs');
const path = require('path');

// Keep track of used emails to ensure uniqueness
const usedEmails = new Set();

// Function to generate a unique email
const generateUniqueEmail = () => {
    let email;
    do {
        email = faker.internet.email().toLowerCase();
    } while (usedEmails.has(email));
    usedEmails.add(email);
    return email;
};

// Function to generate a random lead
const generateRandomLead = () => {
    const leadTypes = ['ftd', 'filler', 'cold', 'live'];
    const genders = ['male', 'female', 'not_defined'];
    const documentStatuses = ['good', 'ok', 'pending'];
    const priorities = ['low', 'medium', 'high'];
    const statuses = ['active', 'contacted', 'converted', 'inactive'];

    const leadType = faker.helpers.arrayElement(leadTypes);
    const gender = faker.helpers.arrayElement(genders);

    const lead = {
        leadType,
        firstName: faker.name.firstName(),
        lastName: faker.name.lastName(),
        gender,
        newEmail: generateUniqueEmail(), // Using our unique email generator
        oldEmail: Math.random() > 0.5 ? generateUniqueEmail() : '', // Also ensure unique old emails
        newPhone: faker.phone.phoneNumber(),
        oldPhone: Math.random() > 0.5 ? faker.phone.phoneNumber() : '',
        country: faker.address.country(),
        isAssigned: false,
        client: Math.random() > 0.5 ? faker.company.companyName() : '',
        clientBroker: Math.random() > 0.5 ? faker.company.companyName() : '',
        clientNetwork: Math.random() > 0.5 ? faker.company.companyName() : '',
        socialMedia: {
            facebook: Math.random() > 0.5 ? `https://facebook.com/${faker.internet.userName()}` : '',
            twitter: Math.random() > 0.5 ? `https://twitter.com/${faker.internet.userName()}` : '',
            linkedin: Math.random() > 0.5 ? `https://linkedin.com/in/${faker.internet.userName()}` : '',
            instagram: Math.random() > 0.5 ? `https://instagram.com/${faker.internet.userName()}` : '',
            telegram: Math.random() > 0.5 ? `@${faker.internet.userName()}` : '',
            whatsapp: Math.random() > 0.5 ? faker.phone.phoneNumber() : '',
        },
        comments: [],
        source: faker.helpers.arrayElement(['website', 'referral', 'social_media', 'direct']),
        priority: faker.helpers.arrayElement(priorities),
        status: faker.helpers.arrayElement(statuses),
        createdAt: faker.date.between('2024-05-01', '2025-05-31').toISOString()
    };

    // Add FTD & Filler specific fields
    if (leadType === 'ftd' || leadType === 'filler') {
        lead.dob = faker.date.between('1960-01-01', '2003-12-31').toISOString().split('T')[0];
        lead.address = {
            street: faker.address.streetAddress(),
            city: faker.address.city(),
            postalCode: faker.address.zipCode()
        };
    }

    // Add FTD specific fields
    if (leadType === 'ftd') {
        lead.documents = {
            idFrontUrl: `https://storage.example.com/documents/${faker.datatype.uuid()}/id_front.jpg`,
            idBackUrl: `https://storage.example.com/documents/${faker.datatype.uuid()}/id_back.jpg`,
            selfieUrl: `https://storage.example.com/documents/${faker.datatype.uuid()}/selfie.jpg`,
            residenceProofUrl: `https://storage.example.com/documents/${faker.datatype.uuid()}/residence.jpg`,
            status: faker.helpers.arrayElement(documentStatuses)
        };
        lead.sin = faker.random.number({ min: 100000000, max: 999999999 }).toString();
    }

    return lead;
};

// Function to generate leads and save them to a JSON file
const generateLeads = (count) => {
    try {
        // Clear the used emails set at the start of each generation
        usedEmails.clear();

        const leads = [];
        console.log(`Generating ${count} leads...`);

        for (let i = 0; i < count; i++) {
            const lead = generateRandomLead();
            leads.push(lead);
            if ((i + 1) % 10 === 0) {
                console.log(`Generated ${i + 1} leads...`);
            }
        }

        // Create a timestamp for unique filename
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const outputDir = path.join(__dirname, '..', 'data');
        const outputFile = path.join(outputDir, `leads_${timestamp}.json`);

        // Create the data directory if it doesn't exist
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        // Write the leads to a JSON file
        fs.writeFileSync(outputFile, JSON.stringify(leads, null, 2));
        console.log(`Successfully generated and saved ${count} leads to ${outputFile}`);
    } catch (error) {
        console.error('Error:', error);
    }
};

// Get the number of leads to generate from command line argument
const count = parseInt(process.argv[2]) || 10;

// Run the main function
generateLeads(count);

module.exports = {
    generateLeads,
    generateRandomLead
}; 