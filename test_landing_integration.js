/**
 * Test script to verify landing page form submission and QuantumAI injector integration
 * Run with: node test_landing_integration.js
 */

const axios = require('axios');

// Test configuration
const TEST_CONFIG = {
    baseUrl: 'http://localhost:5000', // Adjust if your backend runs on different port
    landingEndpoint: '/api/landing'
};

// Test lead data
const testLeadData = {
    firstName: 'John',
    lastName: 'TestUser',
    email: 'john.testuser@example.com',
    prefix: '+1',
    phone: '5551234567'
};

/**
 * Test the landing page form submission
 */
async function testLandingSubmission() {
    try {
        console.log('🧪 Testing landing page form submission...');
        console.log('📋 Test data:', testLeadData);
        
        const response = await axios.post(
            `${TEST_CONFIG.baseUrl}${TEST_CONFIG.landingEndpoint}`,
            testLeadData,
            {
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 10000 // 10 second timeout
            }
        );
        
        console.log('✅ Form submission successful!');
        console.log('📊 Response status:', response.status);
        console.log('📄 Response data:', response.data);
        
        if (response.data.success) {
            console.log('🎉 Lead saved successfully with ID:', response.data.leadId);
            console.log('🚀 QuantumAI injector should now be running in the background...');
            console.log('📝 Check your backend console logs for injection progress');
            return true;
        } else {
            console.error('❌ Form submission failed:', response.data.message);
            return false;
        }
        
    } catch (error) {
        console.error('💥 Test failed with error:');
        
        if (error.response) {
            console.error('📊 Status:', error.response.status);
            console.error('📄 Response:', error.response.data);
        } else if (error.request) {
            console.error('🔌 No response received - is the backend server running?');
            console.error('🌐 Trying to connect to:', `${TEST_CONFIG.baseUrl}${TEST_CONFIG.landingEndpoint}`);
        } else {
            console.error('⚠️ Error:', error.message);
        }
        
        return false;
    }
}

/**
 * Test validation errors
 */
async function testValidationErrors() {
    try {
        console.log('\n🧪 Testing validation errors...');
        
        const invalidData = {
            firstName: 'A', // Too short
            lastName: '', // Empty
            email: 'invalid-email', // Invalid format
            prefix: '1', // Missing +
            phone: '123' // Too short
        };
        
        console.log('📋 Invalid test data:', invalidData);
        
        const response = await axios.post(
            `${TEST_CONFIG.baseUrl}${TEST_CONFIG.landingEndpoint}`,
            invalidData,
            {
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 5000,
                validateStatus: () => true // Don't throw on 4xx errors
            }
        );
        
        if (response.status === 400 && response.data.errors) {
            console.log('✅ Validation working correctly!');
            console.log('📄 Validation errors:', response.data.errors);
            return true;
        } else {
            console.error('❌ Validation test failed - expected 400 status with errors');
            console.error('📊 Got status:', response.status);
            console.error('📄 Got response:', response.data);
            return false;
        }
        
    } catch (error) {
        console.error('💥 Validation test failed:', error.message);
        return false;
    }
}

/**
 * Main test function
 */
async function runTests() {
    console.log('🚀 Starting Landing Page Integration Tests');
    console.log('=' .repeat(50));
    
    let allTestsPassed = true;
    
    // Test 1: Valid form submission
    const test1Passed = await testLandingSubmission();
    allTestsPassed = allTestsPassed && test1Passed;
    
    // Test 2: Validation errors
    const test2Passed = await testValidationErrors();
    allTestsPassed = allTestsPassed && test2Passed;
    
    // Summary
    console.log('\n' + '=' .repeat(50));
    console.log('📊 Test Results Summary:');
    console.log('✅ Valid submission test:', test1Passed ? 'PASSED' : 'FAILED');
    console.log('✅ Validation test:', test2Passed ? 'PASSED' : 'FAILED');
    console.log('🎯 Overall result:', allTestsPassed ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED');
    
    if (allTestsPassed) {
        console.log('\n🎉 Great! Your landing page integration is working correctly!');
        console.log('📝 What happens when a form is submitted:');
        console.log('   1. ✅ Form data is validated');
        console.log('   2. ✅ Lead is saved to database');
        console.log('   3. ✅ Success response is sent to user');
        console.log('   4. 🚀 QuantumAI injector starts in background');
        console.log('   5. 🤖 Lead is automatically injected into QuantumAI');
    } else {
        console.log('\n❌ Some tests failed. Please check the errors above.');
        console.log('💡 Make sure:');
        console.log('   - Your backend server is running');
        console.log('   - MongoDB is connected');
        console.log('   - Python is installed for the injector script');
    }
    
    process.exit(allTestsPassed ? 0 : 1);
}

// Run tests if this script is executed directly
if (require.main === module) {
    runTests().catch(error => {
        console.error('💥 Unexpected error running tests:', error);
        process.exit(1);
    });
}

module.exports = {
    testLandingSubmission,
    testValidationErrors,
    runTests
}; 