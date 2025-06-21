/**
 * Test Script for Session Cleanup Implementation
 * 
 * This script tests the session cleanup functionality to ensure it works correctly
 * Run this script to verify the Step 9 implementation
 * 
 * Usage: node test_session_cleanup.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

// Import required modules
const SessionCleanupService = require('./backend/services/sessionCleanupService');
const Lead = require('./backend/models/Lead');

// Test configuration
const TEST_CONFIG = {
  testLeadCount: 5,
  testSessionsPerLead: 3,
  expiredSessionDays: 35, // Create sessions older than 30 days
  recentSessionDays: 5,   // Create recent sessions
};

/**
 * Create test leads with various session scenarios
 */
async function createTestData() {
  console.log('🧪 Creating test data...');
  
  const testLeads = [];
  
  for (let i = 0; i < TEST_CONFIG.testLeadCount; i++) {
    const lead = new Lead({
      leadType: 'ftd',
      firstName: `Test${i}`,
      lastName: 'Lead',
      newEmail: `test${i}@example.com`,
      newPhone: `+1234567${i.toString().padStart(3, '0')}`,
      country: 'US',
    });
    
    // Create various session scenarios
    if (i === 0) {
      // Lead with expired current session
      const expiredDate = new Date(Date.now() - (TEST_CONFIG.expiredSessionDays * 24 * 60 * 60 * 1000));
      lead.browserSession = {
        sessionId: `expired_session_${i}`,
        cookies: [
          { name: 'test_cookie', value: 'test_value', domain: 'example.com' }
        ],
        localStorage: { key1: 'value1' },
        sessionStorage: { key2: 'value2' },
        userAgent: 'Test User Agent',
        viewport: { width: 1366, height: 768 },
        createdAt: expiredDate,
        lastAccessedAt: expiredDate,
        isActive: true,
        metadata: { domain: 'example.com', success: true }
      };
      lead.currentSessionId = `expired_session_${i}`;
    } else if (i === 1) {
      // Lead with active recent session
      const recentDate = new Date(Date.now() - (TEST_CONFIG.recentSessionDays * 24 * 60 * 60 * 1000));
      lead.browserSession = {
        sessionId: `recent_session_${i}`,
        cookies: [
          { name: 'test_cookie', value: 'test_value', domain: 'example.com' }
        ],
        localStorage: { key1: 'value1' },
        sessionStorage: { key2: 'value2' },
        userAgent: 'Test User Agent',
        viewport: { width: 1366, height: 768 },
        createdAt: recentDate,
        lastAccessedAt: new Date(),
        isActive: true,
        metadata: { domain: 'example.com', success: true }
      };
      lead.currentSessionId = `recent_session_${i}`;
    } else if (i === 2) {
      // Lead with multiple sessions in history (exceeding limit)
      for (let j = 0; j < 12; j++) { // Exceeds maxSessionsPerLead (10)
        const sessionDate = new Date(Date.now() - (j * 2 * 24 * 60 * 60 * 1000));
        lead.sessionHistory.push({
          sessionId: `history_session_${i}_${j}`,
          cookies: [
            { name: 'test_cookie', value: 'test_value', domain: 'example.com' }
          ],
          localStorage: { key1: 'value1' },
          sessionStorage: { key2: 'value2' },
          userAgent: 'Test User Agent',
          viewport: { width: 1366, height: 768 },
          createdAt: sessionDate,
          lastAccessedAt: sessionDate,
          isActive: false,
          metadata: { domain: 'example.com', success: true }
        });
      }
    } else if (i === 3) {
      // Lead with invalid/orphaned session data
      lead.browserSession = {
        // Missing sessionId and other required fields
        cookies: [],
        localStorage: {},
        sessionStorage: {},
        // Missing createdAt
        isActive: true
      };
    } else if (i === 4) {
      // Lead with mixed expired and recent sessions
      const expiredDate = new Date(Date.now() - (TEST_CONFIG.expiredSessionDays * 24 * 60 * 60 * 1000));
      const recentDate = new Date(Date.now() - (TEST_CONFIG.recentSessionDays * 24 * 60 * 60 * 1000));
      
      // Recent current session
      lead.browserSession = {
        sessionId: `mixed_current_${i}`,
        cookies: [
          { name: 'test_cookie', value: 'test_value', domain: 'example.com' }
        ],
        localStorage: { key1: 'value1' },
        sessionStorage: { key2: 'value2' },
        userAgent: 'Test User Agent',
        viewport: { width: 1366, height: 768 },
        createdAt: recentDate,
        lastAccessedAt: new Date(),
        isActive: true,
        metadata: { domain: 'example.com', success: true }
      };
      lead.currentSessionId = `mixed_current_${i}`;
      
      // Add expired sessions to history
      for (let j = 0; j < 3; j++) {
        lead.sessionHistory.push({
          sessionId: `mixed_expired_${i}_${j}`,
          cookies: [
            { name: 'test_cookie', value: 'test_value', domain: 'example.com' }
          ],
          localStorage: { key1: 'value1' },
          sessionStorage: { key2: 'value2' },
          userAgent: 'Test User Agent',
          viewport: { width: 1366, height: 768 },
          createdAt: expiredDate,
          lastAccessedAt: expiredDate,
          isActive: false,
          metadata: { domain: 'example.com', success: true }
        });
      }
    }
    
    await lead.save();
    testLeads.push(lead);
  }
  
  console.log(`✅ Created ${testLeads.length} test leads with various session scenarios`);
  return testLeads;
}

/**
 * Test the session cleanup service
 */
async function testSessionCleanup() {
  console.log('🧹 Testing session cleanup service...');
  
  const cleanupService = new SessionCleanupService();
  
  // Test service status
  console.log('\n📊 Service Status:');
  const status = cleanupService.getServiceStatus();
  console.log(JSON.stringify(status, null, 2));
  
  // Test daily cleanup
  console.log('\n🗑️ Testing daily cleanup...');
  const dailyStats = await cleanupService.performDailyCleanup();
  console.log('Daily cleanup results:', JSON.stringify(dailyStats, null, 2));
  
  // Test weekly compression
  console.log('\n🗜️ Testing weekly compression...');
  const compressionStats = await cleanupService.performWeeklyCompression();
  console.log('Compression results:', JSON.stringify(compressionStats, null, 2));
  
  // Test monthly analytics
  console.log('\n📊 Testing monthly analytics...');
  const monthlyReport = await cleanupService.generateMonthlyReport();
  console.log('Monthly report summary:', JSON.stringify(monthlyReport.summary, null, 2));
  console.log('Usage analytics:', JSON.stringify(monthlyReport.usageAnalytics, null, 2));
  console.log('Health metrics:', JSON.stringify(monthlyReport.healthMetrics, null, 2));
  console.log('Recommendations:', JSON.stringify(monthlyReport.recommendations, null, 2));
  
  return {
    dailyStats,
    compressionStats,
    monthlyReport
  };
}

/**
 * Verify cleanup results
 */
async function verifyCleanupResults(testLeads, results) {
  console.log('\n✅ Verifying cleanup results...');
  
  // Check remaining leads and sessions
  const remainingLeads = await Lead.find({
    _id: { $in: testLeads.map(lead => lead._id) }
  });
  
  let totalRemainingCurrentSessions = 0;
  let totalRemainingHistorySessions = 0;
  let expiredSessionsFound = 0;
  let invalidSessionsFound = 0;
  
  for (const lead of remainingLeads) {
    // Count current sessions
    if (lead.browserSession && lead.browserSession.sessionId) {
      totalRemainingCurrentSessions++;
      
      // Check if expired session still exists
      const thirtyDaysAgo = new Date(Date.now() - (30 * 24 * 60 * 60 * 1000));
      if (lead.browserSession.createdAt < thirtyDaysAgo) {
        expiredSessionsFound++;
      }
      
      // Check for invalid sessions
      if (!lead.browserSession.sessionId || !lead.browserSession.createdAt) {
        invalidSessionsFound++;
      }
    }
    
    // Count history sessions
    if (lead.sessionHistory) {
      totalRemainingHistorySessions += lead.sessionHistory.length;
      
      // Check for expired sessions in history
      for (const session of lead.sessionHistory) {
        const thirtyDaysAgo = new Date(Date.now() - (30 * 24 * 60 * 60 * 1000));
        if (session.createdAt < thirtyDaysAgo) {
          expiredSessionsFound++;
        }
        
        if (!session.sessionId || !session.createdAt) {
          invalidSessionsFound++;
        }
      }
      
      // Check session limit enforcement
      if (lead.sessionHistory.length > 10) {
        console.log(`⚠️ Lead ${lead._id} still has ${lead.sessionHistory.length} sessions (exceeds limit)`);
      }
    }
  }
  
  console.log(`📊 Verification Results:`);
  console.log(`   Remaining leads: ${remainingLeads.length}`);
  console.log(`   Remaining current sessions: ${totalRemainingCurrentSessions}`);
  console.log(`   Remaining history sessions: ${totalRemainingHistorySessions}`);
  console.log(`   Expired sessions found: ${expiredSessionsFound}`);
  console.log(`   Invalid sessions found: ${invalidSessionsFound}`);
  
  // Validate cleanup effectiveness
  const cleanupEffective = expiredSessionsFound === 0 && invalidSessionsFound === 0;
  
  if (cleanupEffective) {
    console.log('✅ Cleanup was effective - no expired or invalid sessions found');
  } else {
    console.log('⚠️ Cleanup may not have been fully effective');
  }
  
  return {
    remainingLeads: remainingLeads.length,
    remainingCurrentSessions: totalRemainingCurrentSessions,
    remainingHistorySessions: totalRemainingHistorySessions,
    expiredSessionsFound,
    invalidSessionsFound,
    cleanupEffective
  };
}

/**
 * Clean up test data
 */
async function cleanupTestData(testLeads) {
  console.log('\n🧹 Cleaning up test data...');
  
  const leadIds = testLeads.map(lead => lead._id);
  const deleteResult = await Lead.deleteMany({ _id: { $in: leadIds } });
  
  console.log(`✅ Deleted ${deleteResult.deletedCount} test leads`);
}

/**
 * Main test function
 */
async function runTests() {
  let connection;
  let testLeads = [];
  
  try {
    // Connect to MongoDB
    console.log('🔌 Connecting to MongoDB...');
    connection = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB');
    
    // Create test data
    testLeads = await createTestData();
    
    // Run tests
    const results = await testSessionCleanup();
    
    // Verify results
    const verification = await verifyCleanupResults(testLeads, results);
    
    // Summary
    console.log('\n🎯 Test Summary:');
    console.log('================');
    console.log(`Daily cleanup removed: ${results.dailyStats.totalSessionsRemoved} sessions`);
    console.log(`Compression processed: ${results.compressionStats.compression.sessionsCompressed} sessions`);
    console.log(`Space saved: ${results.compressionStats.compression.spaceSavedMB} MB`);
    console.log(`Session health score: ${results.monthlyReport.healthMetrics.sessionHealthScore}%`);
    console.log(`Cleanup effectiveness: ${verification.cleanupEffective ? 'PASS' : 'FAIL'}`);
    
    if (verification.cleanupEffective) {
      console.log('\n🎉 All tests passed! Session cleanup implementation is working correctly.');
    } else {
      console.log('\n⚠️ Some tests failed. Please review the cleanup implementation.');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
    
  } finally {
    // Clean up test data
    if (testLeads.length > 0) {
      await cleanupTestData(testLeads);
    }
    
    // Close database connection
    if (connection) {
      await mongoose.connection.close();
      console.log('🔌 Database connection closed');
    }
  }
}

/**
 * Handle script interruption
 */
process.on('SIGINT', async () => {
  console.log('\n⚠️ Test interrupted by user');
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.close();
  }
  process.exit(0);
});

// Run the tests
if (require.main === module) {
  runTests().catch(error => {
    console.error('❌ Fatal test error:', error.message);
    process.exit(1);
  });
}

module.exports = { runTests, createTestData, testSessionCleanup }; 