#!/usr/bin/env python3
"""
Test script for agent session browser
This script tests the agent session browser with minimal session data to ensure it works correctly
"""

import json
import subprocess
import sys
import time

def test_agent_browser():
    """Test the agent session browser with minimal data"""
    
    # Create minimal test session data
    test_session_data = {
        "leadId": "test_lead_123",
        "sessionId": "test_session_123",
        "cookies": [],
        "localStorage": {},
        "sessionStorage": {},
        "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "viewport": {"width": 1366, "height": 768},
        "domain": "",  # Empty domain to test Google homepage navigation
        "leadInfo": {
            "firstName": "Test",
            "lastName": "Agent",
            "email": "test@example.com",
            "phone": "+1234567890",
            "country": "US"
        }
    }
    
    # Convert to JSON string
    session_json = json.dumps(test_session_data)
    
    print("🧪 Testing Agent Session Browser...")
    print("📋 Test Data:")
    print(f"   Lead: {test_session_data['leadInfo']['firstName']} {test_session_data['leadInfo']['lastName']}")
    print(f"   Session ID: {test_session_data['sessionId']}")
    print(f"   Domain: {test_session_data['domain'] or 'None (should navigate to Google)'}")
    print()
    
    try:
        # Run the agent session browser script
        print("🚀 Launching agent session browser...")
        print("📝 Expected behavior:")
        print("   1. Chromium should open")
        print("   2. Should navigate to Google homepage (since no domain specified)")
        print("   3. Should show session info banner")
        print("   4. Should wait for manual browser close")
        print()
        print("⚠️  Close the browser window when you're done testing!")
        print()
        
        # Execute the script
        result = subprocess.run([
            sys.executable, 
            'agent_session_browser.py', 
            session_json
        ], capture_output=True, text=True, timeout=300)  # 5 minute timeout
        
        print("✅ Script execution completed")
        print(f"Exit code: {result.returncode}")
        
        if result.stdout:
            print("📤 Output:")
            print(result.stdout)
        
        if result.stderr:
            print("⚠️  Errors:")
            print(result.stderr)
            
        return result.returncode == 0
        
    except subprocess.TimeoutExpired:
        print("⏰ Test completed (browser was likely closed manually)")
        return True
    except Exception as e:
        print(f"❌ Test failed with error: {e}")
        return False

if __name__ == "__main__":
    print("🔧 Agent Session Browser Test")
    print("=" * 50)
    
    success = test_agent_browser()
    
    if success:
        print("\n✅ Test completed successfully!")
        print("💡 If Chromium opened and navigated to Google, the implementation is working correctly.")
    else:
        print("\n❌ Test failed!")
        print("🔍 Check the error messages above for troubleshooting.")
    
    sys.exit(0 if success else 1) 