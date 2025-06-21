const express = require('express');
const router = express.Router();
const { spawn } = require('child_process');
const path = require('path');
const Lead = require('../models/Lead');

// Test browser session endpoint
router.post('/browser-session', async (req, res) => {
  try {
    const { leadId, leadInfo } = req.body;
    
    console.log('🧪 Test browser session requested for lead:', leadId);
    console.log('Lead info:', leadInfo);
    
    // Get the lead from database to retrieve fingerprint
    const lead = await Lead.findById(leadId);
    if (!lead) {
      return res.status(404).json({
        success: false,
        message: 'Lead not found'
      });
    }
    
    // Get the lead's device fingerprint
    let fingerprintConfig = null;
    let deviceViewport = { width: 1366, height: 768 }; // Default desktop
    let deviceUserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    
    if (lead.fingerprint) {
      try {
        const fingerprint = await lead.getFingerprint();
        if (fingerprint) {
          console.log(`📱 Using device fingerprint: ${fingerprint.deviceType} (${fingerprint.deviceId})`);
          
          // Use the actual device configuration from fingerprint
          deviceViewport = {
            width: fingerprint.screen.availWidth || fingerprint.screen.width,
            height: fingerprint.screen.availHeight || fingerprint.screen.height
          };
          deviceUserAgent = fingerprint.navigator.userAgent;
          
          fingerprintConfig = {
            deviceId: fingerprint.deviceId,
            deviceType: fingerprint.deviceType,
            browser: fingerprint.browser,
            screen: fingerprint.screen,
            navigator: fingerprint.navigator,
            webgl: fingerprint.webgl,
            canvasFingerprint: fingerprint.canvasFingerprint,
            audioFingerprint: fingerprint.audioFingerprint,
            timezone: fingerprint.timezone,
            plugins: fingerprint.plugins,
            mobile: fingerprint.mobile,
            additional: fingerprint.additional,
          };
          
          console.log(`📐 Using ${fingerprint.deviceType} viewport: ${deviceViewport.width}x${deviceViewport.height}`);
        }
      } catch (error) {
        console.error('❌ Failed to get fingerprint for lead:', error);
        console.log('⚠️ Falling back to default desktop configuration');
      }
    } else {
      console.log('⚠️ Lead has no fingerprint assigned, using default desktop configuration');
    }

    // Create test session data with actual device configuration
    const testSessionData = {
      leadId: leadId,
      sessionId: `test_session_${Date.now()}`,
      cookies: [],
      localStorage: {},
      sessionStorage: {},
      userAgent: deviceUserAgent,
      viewport: deviceViewport,
      domain: "ftd-copy.vercel.app", // Use actual FTD domain for testing injection
      fingerprint: fingerprintConfig, // Include fingerprint data for device simulation
      leadInfo: {
        firstName: leadInfo.firstName,
        lastName: leadInfo.lastName,
        email: leadInfo.email,
        phone: leadInfo.phone,
        country: leadInfo.country,
        countryCode: leadInfo.countryCode
      },
      metadata: {
        leadName: `${leadInfo.firstName} ${leadInfo.lastName}`,
        leadEmail: leadInfo.email,
        testMode: true,
        injectionReady: true,
        originalDeviceType: fingerprintConfig?.deviceType || 'desktop'
      }
    };
    
    // Convert session data to JSON string for Python script
    const sessionDataJson = JSON.stringify(testSessionData);
    
    console.log('📝 Test session data prepared:', {
      leadId: testSessionData.leadId,
      sessionId: testSessionData.sessionId,
      domain: testSessionData.domain || 'Google homepage',
      deviceType: fingerprintConfig?.deviceType || 'desktop',
      viewport: `${deviceViewport.width}x${deviceViewport.height}`,
      userAgent: deviceUserAgent.substring(0, 50) + '...'
    });
    
    // Run the Python script with the test session data
    const pythonScript = path.join(__dirname, '..', '..', 'agent_session_browser.py');
    
    console.log('🚀 Starting Python script:', pythonScript);
    console.log('📄 Session data length:', sessionDataJson.length, 'characters');
    
    // Spawn the Python process with JSON data as argument
    console.log('🔧 Spawning Python process...');
    const pythonProcess = spawn('python', [pythonScript, sessionDataJson], {
      detached: true, // Detached so it can open GUI applications
      stdio: ['ignore', 'ignore', 'ignore'], // Ignore all stdio to avoid encoding issues
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' } // Set encoding for Python
    });
    
    // Handle process events
    pythonProcess.on('error', (error) => {
      console.error('🐍 Python process error:', error);
    });
    
    // Log that process was started
    console.log('🐍 Python process started with PID:', pythonProcess.pid);
    
    // Don't wait for the process to finish, let it run in background
    pythonProcess.unref();
    
    // No file cleanup needed since we're passing data directly
    
    res.json({
      success: true,
      message: 'Test browser session initiated',
      data: {
        leadId: leadId,
        sessionId: testSessionData.sessionId,
        testMode: true,
        pythonPid: pythonProcess.pid
      }
    });
    
  } catch (error) {
    console.error('❌ Error in test browser session:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to start test browser session',
      error: error.message
    });
  }
});

module.exports = router; 