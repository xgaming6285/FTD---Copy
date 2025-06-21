/**
 * Test script to verify session management API endpoints
 * Run with: node test_session_api.js
 */

const axios = require('axios');

// Test configuration
const TEST_CONFIG = {
    baseUrl: 'http://localhost:5000', // Adjust if your backend runs on different port
    authEndpoint: '/api/auth/login',
    leadsEndpoint: '/api/leads',
    sessionEndpoint: '/api/leads/{leadId}/session'
};

// Test credentials (adjust based on your test data)
const TEST_CREDENTIALS = {
    admin: {
        email: 'admin@test.com',
        password: 'password123'
    },
    affiliateManager: {
        email: 'manager@test.com', 
        password: 'password123'
    },
    agent: {
        email: 'agent@test.com',
        password: 'password123'
    }
};

// Sample session data for testing
const SAMPLE_SESSION_DATA = {
    sessionId: 'test_session_' + Date.now(),
    cookies: [
        {
            name: 'test_cookie',
            value: 'test_value',
            domain: 'example.com',
            path: '/',
            expires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 1 day from now
            httpOnly: false,
            secure: false,
            sameSite: 'Lax'
        }
    ],
    localStorage: {
        'test_key': 'test_value',
        'user_preference': 'dark_mode'
    },
    sessionStorage: {
        'session_key': 'session_value',
        'temp_data': 'temporary'
    },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    viewport: {
        width: 1920,
        height: 1080
    },
    metadata: {
        domain: 'example.com',
        success: true,
        injectionType: 'manual_ftd',
        notes: 'Test session for API validation'
    }
};

let authTokens = {};
let testLeadId = null;

/**
 * Authenticate users and get tokens
 */
async function authenticateUsers() {
    console.log('🔐 Authenticating test users...');
    
    for (const [role, credentials] of Object.entries(TEST_CREDENTIALS)) {
        try {
            const response = await axios.post(
                `${TEST_CONFIG.baseUrl}${TEST_CONFIG.authEndpoint}`,
                credentials,
                {
                    headers: { 'Content-Type': 'application/json' },
                    timeout: 5000,
                    validateStatus: () => true
                }
            );
            
            if (response.status === 200 && response.data.token) {
                authTokens[role] = response.data.token;
                console.log(`✅ ${role} authenticated successfully`);
            } else {
                console.log(`⚠️ ${role} authentication failed - will skip tests requiring this role`);
            }
        } catch (error) {
            console.log(`⚠️ ${role} authentication error:`, error.message);
        }
    }
    
    console.log(`🎯 Authenticated ${Object.keys(authTokens).length} users out of ${Object.keys(TEST_CREDENTIALS).length}`);
}

/**
 * Create a test lead for session testing
 */
async function createTestLead() {
    if (!authTokens.admin && !authTokens.affiliateManager) {
        console.log('⚠️ No admin or affiliate manager token available - cannot create test lead');
        return false;
    }
    
    const token = authTokens.admin || authTokens.affiliateManager;
    
    const testLead = {
        firstName: 'SessionTest',
        lastName: 'User',
        newEmail: `session.test.${Date.now()}@example.com`,
        newPhone: '+1234567890',
        country: 'United States',
        leadType: 'ftd',
        sin: '123456789'
    };
    
    try {
        console.log('👤 Creating test lead for session testing...');
        
        const response = await axios.post(
            `${TEST_CONFIG.baseUrl}${TEST_CONFIG.leadsEndpoint}`,
            testLead,
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                timeout: 5000
            }
        );
        
        if (response.status === 201 && response.data.data) {
            testLeadId = response.data.data._id;
            console.log(`✅ Test lead created with ID: ${testLeadId}`);
            return true;
        } else {
            console.error('❌ Failed to create test lead:', response.data);
            return false;
        }
        
    } catch (error) {
        console.error('💥 Error creating test lead:', error.response?.data || error.message);
        return false;
    }
}

/**
 * Test storing session data
 */
async function testStoreSession() {
    if (!testLeadId || (!authTokens.admin && !authTokens.affiliateManager)) {
        console.log('⚠️ Skipping store session test - missing requirements');
        return false;
    }
    
    const token = authTokens.admin || authTokens.affiliateManager;
    
    try {
        console.log('💾 Testing session storage...');
        
        const response = await axios.post(
            `${TEST_CONFIG.baseUrl}${TEST_CONFIG.sessionEndpoint.replace('{leadId}', testLeadId)}`,
            { sessionData: SAMPLE_SESSION_DATA },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                timeout: 5000
            }
        );
        
        if (response.status === 201 && response.data.success) {
            console.log('✅ Session stored successfully');
            console.log('📄 Response:', response.data.data);
            return true;
        } else {
            console.error('❌ Failed to store session:', response.data);
            return false;
        }
        
    } catch (error) {
        console.error('💥 Error storing session:', error.response?.data || error.message);
        return false;
    }
}

/**
 * Test retrieving session data
 */
async function testGetSession() {
    if (!testLeadId || (!authTokens.admin && !authTokens.affiliateManager)) {
        console.log('⚠️ Skipping get session test - missing requirements');
        return false;
    }
    
    const token = authTokens.admin || authTokens.affiliateManager;
    
    try {
        console.log('📥 Testing session retrieval...');
        
        const response = await axios.get(
            `${TEST_CONFIG.baseUrl}${TEST_CONFIG.sessionEndpoint.replace('{leadId}', testLeadId)}?includeHistory=true`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                timeout: 5000
            }
        );
        
        if (response.status === 200 && response.data.success) {
            console.log('✅ Session retrieved successfully');
            console.log('📄 Has active session:', response.data.data.hasActiveSession);
            console.log('📄 Session history count:', response.data.data.sessionHistory?.length || 0);
            return true;
        } else {
            console.error('❌ Failed to retrieve session:', response.data);
            return false;
        }
        
    } catch (error) {
        console.error('💥 Error retrieving session:', error.response?.data || error.message);
        return false;
    }
}

/**
 * Test updating session data
 */
async function testUpdateSession() {
    if (!testLeadId || (!authTokens.admin && !authTokens.affiliateManager)) {
        console.log('⚠️ Skipping update session test - missing requirements');
        return false;
    }
    
    const token = authTokens.admin || authTokens.affiliateManager;
    
    try {
        console.log('✏️ Testing session update...');
        
        const updateData = {
            sessionId: SAMPLE_SESSION_DATA.sessionId,
            metadata: {
                notes: 'Updated session notes',
                lastModified: new Date().toISOString()
            }
        };
        
        const response = await axios.put(
            `${TEST_CONFIG.baseUrl}${TEST_CONFIG.sessionEndpoint.replace('{leadId}', testLeadId)}`,
            updateData,
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                timeout: 5000
            }
        );
        
        if (response.status === 200 && response.data.success) {
            console.log('✅ Session updated successfully');
            console.log('📄 Response:', response.data.data);
            return true;
        } else {
            console.error('❌ Failed to update session:', response.data);
            return false;
        }
        
    } catch (error) {
        console.error('💥 Error updating session:', error.response?.data || error.message);
        return false;
    }
}

/**
 * Test access control - agent trying to access unassigned lead
 */
async function testAccessControl() {
    if (!testLeadId || !authTokens.agent) {
        console.log('⚠️ Skipping access control test - missing requirements');
        return false;
    }
    
    try {
        console.log('🔒 Testing access control...');
        
        const response = await axios.get(
            `${TEST_CONFIG.baseUrl}${TEST_CONFIG.sessionEndpoint.replace('{leadId}', testLeadId)}`,
            {
                headers: {
                    'Authorization': `Bearer ${authTokens.agent}`
                },
                timeout: 5000,
                validateStatus: () => true
            }
        );
        
        if (response.status === 403) {
            console.log('✅ Access control working correctly - agent denied access to unassigned lead');
            return true;
        } else {
            console.error('❌ Access control failed - agent should not have access:', response.status);
            return false;
        }
        
    } catch (error) {
        console.error('💥 Error testing access control:', error.message);
        return false;
    }
}

/**
 * Test clearing session data
 */
async function testClearSession() {
    if (!testLeadId || (!authTokens.admin && !authTokens.affiliateManager)) {
        console.log('⚠️ Skipping clear session test - missing requirements');
        return false;
    }
    
    const token = authTokens.admin || authTokens.affiliateManager;
    
    try {
        console.log('🗑️ Testing session clearing...');
        
        const response = await axios.delete(
            `${TEST_CONFIG.baseUrl}${TEST_CONFIG.sessionEndpoint.replace('{leadId}', testLeadId)}`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                timeout: 5000
            }
        );
        
        if (response.status === 200 && response.data.success) {
            console.log('✅ Session cleared successfully');
            console.log('📄 Response:', response.data.data);
            return true;
        } else {
            console.error('❌ Failed to clear session:', response.data);
            return false;
        }
        
    } catch (error) {
        console.error('💥 Error clearing session:', error.response?.data || error.message);
        return false;
    }
}

/**
 * Clean up test data
 */
async function cleanup() {
    if (!testLeadId || !authTokens.admin) {
        return;
    }
    
    try {
        console.log('🧹 Cleaning up test data...');
        
        await axios.delete(
            `${TEST_CONFIG.baseUrl}${TEST_CONFIG.leadsEndpoint}/${testLeadId}`,
            {
                headers: {
                    'Authorization': `Bearer ${authTokens.admin}`
                },
                timeout: 5000,
                validateStatus: () => true
            }
        );
        
        console.log('✅ Test lead cleaned up');
        
    } catch (error) {
        console.log('⚠️ Cleanup warning:', error.message);
    }
}

/**
 * Main test function
 */
async function runTests() {
    console.log('🚀 Starting Session Management API Tests');
    console.log('=' .repeat(60));
    
    let testResults = {
        authentication: false,
        createLead: false,
        storeSession: false,
        getSession: false,
        updateSession: false,
        accessControl: false,
        clearSession: false
    };
    
    try {
        // Step 1: Authenticate users
        await authenticateUsers();
        testResults.authentication = Object.keys(authTokens).length > 0;
        
        // Step 2: Create test lead
        testResults.createLead = await createTestLead();
        
        // Step 3: Test session storage
        testResults.storeSession = await testStoreSession();
        
        // Step 4: Test session retrieval
        testResults.getSession = await testGetSession();
        
        // Step 5: Test session update
        testResults.updateSession = await testUpdateSession();
        
        // Step 6: Test access control
        testResults.accessControl = await testAccessControl();
        
        // Step 7: Test session clearing
        testResults.clearSession = await testClearSession();
        
    } catch (error) {
        console.error('💥 Unexpected error during tests:', error.message);
    } finally {
        // Cleanup
        await cleanup();
    }
    
    // Results summary
    console.log('\n' + '=' .repeat(60));
    console.log('📊 Test Results Summary:');
    console.log('🔐 Authentication:', testResults.authentication ? '✅ PASSED' : '❌ FAILED');
    console.log('👤 Create Test Lead:', testResults.createLead ? '✅ PASSED' : '❌ FAILED');
    console.log('💾 Store Session:', testResults.storeSession ? '✅ PASSED' : '❌ FAILED');
    console.log('📥 Get Session:', testResults.getSession ? '✅ PASSED' : '❌ FAILED');
    console.log('✏️ Update Session:', testResults.updateSession ? '✅ PASSED' : '❌ FAILED');
    console.log('🔒 Access Control:', testResults.accessControl ? '✅ PASSED' : '❌ FAILED');
    console.log('🗑️ Clear Session:', testResults.clearSession ? '✅ PASSED' : '❌ FAILED');
    
    const passedTests = Object.values(testResults).filter(Boolean).length;
    const totalTests = Object.keys(testResults).length;
    
    console.log(`\n🎯 Overall: ${passedTests}/${totalTests} tests passed`);
    
    if (passedTests === totalTests) {
        console.log('\n🎉 All session management API tests passed!');
        console.log('✅ Your session storage endpoints are working correctly');
    } else {
        console.log('\n❌ Some tests failed. Please check the errors above.');
        console.log('💡 Common issues:');
        console.log('   - Backend server not running');
        console.log('   - Database connection issues');
        console.log('   - Authentication credentials incorrect');
        console.log('   - Missing required user roles in database');
    }
    
    process.exit(passedTests === totalTests ? 0 : 1);
}

// Run tests if this script is executed directly
if (require.main === module) {
    runTests().catch(error => {
        console.error('💥 Unexpected error running tests:', error);
        process.exit(1);
    });
}

module.exports = {
    runTests,
    TEST_CONFIG,
    SAMPLE_SESSION_DATA
}; 