#!/usr/bin/env python3
import json
import subprocess
import sys

# Test lead data for QuantumAI landing page
test_lead_data = {
    "firstName": "John",
    "lastName": "Doe", 
    "email": "john.doe@test.com",
    "phone": "1234567890",
    "country": "United States",
    "country_code": "1",
    "targetUrl": "https://k8ro.info/bKkkBWkK"
}

def test_quantumai_injection():
    print("="*60)
    print("TESTING QUANTUMAI INJECTION SCRIPT")
    print("="*60)
    print(f"Test data: {json.dumps(test_lead_data, indent=2)}")
    print("="*60)
    
    lead_json = json.dumps(test_lead_data)
    
    try:
        result = subprocess.run([
            sys.executable,
            "quantumai_injector_playwright.py", 
            lead_json
        ], capture_output=True, text=True, timeout=180)
        
        print(f"Exit code: {result.returncode}")
        print(f"STDOUT:\n{result.stdout}")
        
        if result.stderr:
            print(f"STDERR:\n{result.stderr}")
        
        if result.returncode == 0:
            print("✅ QuantumAI injection test PASSED")
            return True
        else:
            print("❌ QuantumAI injection test FAILED")
            return False
            
    except subprocess.TimeoutExpired:
        print("❌ QuantumAI injection test TIMED OUT")
        return False
    except FileNotFoundError:
        print("❌ QuantumAI injector script not found")
        return False
    except Exception as e:
        print(f"❌ QuantumAI injection test ERROR: {e}")
        return False

if __name__ == "__main__":
    success = test_quantumai_injection()
    sys.exit(0 if success else 1)
