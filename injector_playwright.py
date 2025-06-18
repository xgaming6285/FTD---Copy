import asyncio
import json
import sys
import time
import random
import requests
import io
import traceback
import os
import string
from pathlib import Path
from playwright.sync_api import sync_playwright

# Fix for Windows encoding issues - ensure everything uses utf-8
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

# Mappings for country names to ISO codes and phone codes
COUNTRY_TO_ISO_CODE = {
    "Bulgaria": "bg",
    "United States": "us",
    "Canada": "ca",
    "United Kingdom": "gb",
    "Germany": "de",
    "France": "fr",
    "Australia": "au",
    # Add more countries as needed
}

COUNTRY_TO_PHONE_CODE = {
    "Bulgaria": "359",
    "United States": "1",
    "Canada": "1",
    "United Kingdom": "44",
    "Germany": "49",
    "France": "33",
    "Australia": "61",
    # Add more countries as needed
}

# Retry settings for page loading
MAX_RETRIES = 3
RETRY_DELAY = 2

class LeadInjector:
    """Handles the lead injection process using Playwright."""
    
    def __init__(self, proxy_config=None):
        self.proxy_config = proxy_config
        self.screenshot_dir = Path("./screenshots")
        
        # Create screenshots directory if it doesn't exist
        if not self.screenshot_dir.exists():
            self.screenshot_dir.mkdir(parents=True, exist_ok=True)
        
    def _take_screenshot(self, page, name):
        """Take a screenshot for debugging purposes."""
        try:
            timestamp = time.strftime("%Y%m%d-%H%M%S")
            filename = self.screenshot_dir / f"{name}_{timestamp}.png"
            page.screenshot(path=str(filename))
            print(f"INFO: Screenshot saved to {filename}")
        except Exception as e:
            print(f"WARNING: Failed to take screenshot: {str(e)}")
            
    def _setup_browser_config(self):
        """Set up browser configuration with proxy and device settings."""
        browser_config = {
            "headless": False,  # Show browser for debugging
            "args": [
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-accelerated-2d-canvas",
                "--disable-gpu",
                "--window-size=428,926"  # Match the viewport size
            ]
        }
        
        # Add proxy configuration if provided
        if self.proxy_config:
            server = self.proxy_config.get("server", "")
            
            browser_config["proxy"] = {
                "server": server,
                "username": self.proxy_config.get("username"),
                "password": self.proxy_config.get("password")
            }
            print(f"INFO: Using proxy configuration: {server}")
            
        return browser_config

    def _human_like_typing(self, element, text):
        """Simulate human-like typing with random delays."""
        for char in text:
            element.type(char, delay=random.uniform(100, 300))
            
    def _verify_proxy_and_device(self, page):
        """Verify if proxy and device simulation are working correctly."""
        try:
            # First verify IP using ipify
            print("\nINFO: Verifying proxy and device simulation...")
            page.goto("https://api.ipify.org", wait_until="networkidle", timeout=30000)
            actual_ip = page.locator('pre').inner_text()
            
            # Double check with another IP service
            page.goto("https://ip.oxylabs.io/location", wait_until="networkidle", timeout=30000)
            try:
                location_data_text = page.locator('pre').inner_text()
                location_data = json.loads(location_data_text)
                print("\nProxy and Device Verification Results:")
                print(f"IP Address: {actual_ip}")
                print(f"Country: {location_data.get('country', 'Unknown')}")
                print(f"City: {location_data.get('city', 'Unknown')}")
            except (json.JSONDecodeError, Exception):
                print(f"IP Address: {actual_ip}")
                print("WARNING: Could not get detailed location data")
                print(f"DEBUG: page content from ip.oxylabs.io/location: {page.content()}")

            # Get detailed device information
            device_info = page.evaluate("""() => {
                return {
                    // From screen object
                    screenWidth: window.screen.width,
                    screenHeight: window.screen.height,
                    availWidth: window.screen.availWidth,
                    availHeight: window.screen.availHeight,
                    colorDepth: window.screen.colorDepth,
                    pixelDepth: window.screen.pixelDepth,
                    
                    // From navigator object
                    userAgent: navigator.userAgent,
                    platform: navigator.platform,
                    language: navigator.language,
                    languages: navigator.languages,
                    vendor: navigator.vendor,
                    product: navigator.product,
                    onLine: navigator.onLine,
                    hardwareConcurrency: navigator.hardwareConcurrency,
                    deviceMemory: navigator.deviceMemory,
                    
                    // Derived
                    isMobile: /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
                }
            }""")

            print(f"\nDevice Information:")
            print(f"User Agent: {device_info.get('userAgent', 'N/A')}")
            print(f"Platform: {device_info.get('platform', 'N/A')}")
            print(f"Language: {device_info.get('language', 'N/A')}")
            print(f"Vendor: {device_info.get('vendor', 'N/A')}")
            print(f"Screen Resolution: {device_info.get('screenWidth')}x{device_info.get('screenHeight')}")
            print(f"Available Screen: {device_info.get('availWidth')}x{device_info.get('availHeight')}")
            print(f"Color Depth: {device_info.get('colorDepth')}")
            print(f"Mobile Device: {'Yes' if device_info.get('isMobile') else 'No'}")
            
            if 'hardwareConcurrency' in device_info and device_info['hardwareConcurrency']:
                print(f"CPU Cores: {device_info.get('hardwareConcurrency')}")
            if 'deviceMemory' in device_info and device_info['deviceMemory']:
                print(f"Device Memory (GB): {device_info.get('deviceMemory')}")

            # Take a screenshot of verification
            self._take_screenshot(page, "proxy_verification")

            # Verify if we're using the expected proxy
            if self.proxy_config:
                if actual_ip:
                    print("INFO: Successfully verified proxy connection")
                else:
                    print("WARNING: Could not verify proxy IP address")
                    
            # Verify device simulation
            if "iPhone" in device_info.get('userAgent', '') and device_info.get('screenWidth') == 428:
                print("INFO: Successfully verified iPhone 14 Pro Max simulation")
            else:
                print("WARNING: Device simulation may not be working as expected")

            return True

        except Exception as e:
            print(f"WARNING: Proxy verification failed - {str(e)}")
            traceback.print_exc()
            return False

    def inject_lead(self, lead_data, target_url):
        """Inject a lead using Playwright."""
        browser = None
        try:
            # Store target URL for proxy configuration
            self.target_url = target_url
            
            # Get proxy configuration
            if not self.proxy_config:
                print("ERROR: No proxy configuration available. Cannot proceed without proxy.")
                return None
            
            with sync_playwright() as p:
                # Launch browser with configuration
                print("INFO: Launching browser...")
                browser = p.chromium.launch(**self._setup_browser_config())
                
                # Create a new context with iPhone 14 Pro Max settings
                iphone_14_pro_max = {
                    'screen': {
                        'width': 428,  # Standard iPhone width
                        'height': 926  # Standard iPhone height
                    },
                    'viewport': {
                        'width': 428,  # Adjusted to standard iPhone viewport width
                        'height': 926  # Adjusted to show the form properly
                    },
                    'device_scale_factor': 3,
                    'is_mobile': True,
                    'has_touch': True,
                    'user_agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/605.1 NAVER(inapp; search; 2000; 12.12.50; 14PROMAX)',
                }
                
                # Add additional context options to ensure proper rendering
                context = browser.new_context(
                    **iphone_14_pro_max,
                    locale="en-US"
                )
                
                # Create a new page
                page = context.new_page()
                
                # Set content size to ensure proper rendering
                page.evaluate("""() => {
                    const meta = document.createElement('meta');
                    meta.name = 'viewport';
                    meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
                    document.head.appendChild(meta);
                }""")
                
                # Navigate to target URL with retries
                print(f"INFO: Navigating to target URL: {target_url}")
                
                success = False
                for attempt in range(MAX_RETRIES):
                    try:
                        page.goto(target_url, wait_until="domcontentloaded", timeout=30000)
                        success = True
                        break
                    except Exception as e:
                        print(f"WARNING: Failed to navigate on attempt {attempt+1}/{MAX_RETRIES}: {str(e)}")
                        if attempt < MAX_RETRIES - 1:
                            print(f"Retrying in {RETRY_DELAY} seconds...")
                            time.sleep(RETRY_DELAY)
                
                if not success:
                    print("ERROR: Failed to navigate to target URL after multiple retries.")
                    return None

                # Wait for form elements to be available
                page.wait_for_selector('input[name="firstName"]', timeout=30000)

                # Fill the form
                print("INFO: Filling the form...")
                self._human_like_typing(page.locator('input[name="firstName"]'), lead_data["firstName"])
                self._human_like_typing(page.locator('input[name="lastName"]'), lead_data["lastName"])
                self._human_like_typing(page.locator('input[name="email"]'), lead_data["newEmail"])

                # --- Handle Phone Number and Prefix Dropdown ---
                # 1. Click the prefix dropdown to open it.
                # The dropdown is a div with a role of 'button'. Let's find it by its associated label.
                # In MUI, the select is not a native select. We need to click the div that opens the options.
                page.locator('label:has-text("Country Code") + div').click()

                # 2. Wait for the options to appear. The options are in a popover.
                page.wait_for_selector('ul[role="listbox"]', timeout=10000)
                
                # 3. Get the country code and select the right option.
                country_code_from_lead = COUNTRY_TO_PHONE_CODE.get(lead_data.get("country"))
                if country_code_from_lead:
                    option_text = f"+{country_code_from_lead}"
                    # Click the menu item that contains the country code text.
                    page.locator(f'li[role="option"]:has-text("{option_text}")').click()
                else:
                    # Fallback: if no country code, just close the dropdown by pressing escape
                    page.keyboard.press("Escape")
                    print(f"WARNING: No phone prefix found for country: {lead_data.get('country')}. Skipping prefix selection.")
                
                # 4. Fill the phone number
                phone_number = lead_data["newPhone"].lstrip(country_code_from_lead or '').lstrip('+')
                self._human_like_typing(page.locator('input[name="phone"]'), phone_number)
                # --- End Phone Number Handling ---

                # Submit the form
                print("INFO: Submitting the form...")
                # The submit button in the landing page is the one with Send icon
                page.locator('button[type="submit"]').click()

                # Wait for the "Thank You!" message to confirm submission
                page.wait_for_selector('h4:has-text("Thank You!")', timeout=30000)
                
                final_url = page.url
                print(f"INFO: Injection successful. Landed on confirmation page. Final URL: {final_url}")
                
                # Take a final screenshot
                self._take_screenshot(page, "injection_success")
                
                return final_url

        except Exception as e:
            print(f"ERROR: An error occurred during lead injection: {str(e)}")
            traceback.print_exc()
            if browser:
                self._take_screenshot(page, "injection_error")
            return None
        
        finally:
            if browser:
                browser.close()
                print("INFO: Browser closed.")

def get_proxy_config(country_name):
    """Get proxy configuration from 922proxy API."""
    try:
        # Get 2-letter ISO code for the country
        iso_code = COUNTRY_TO_ISO_CODE.get(country_name)
        if not iso_code:
            print(f"WARNING: No ISO code found for '{country_name}'. Defaulting to 'us'.")
            iso_code = "us"

        print(f"INFO: Setting up proxy for country: {country_name} ({iso_code})")

        # To get a new proxy for each lead, we generate a new random session ID.
        # This should result in a new IP for each session from the proxy provider.
        session_id = ''.join(random.choices(string.ascii_letters + string.digits, k=8))
        # The country is specified as part of the username.
        username = f"34998931-zone-custom-country-{iso_code}-sessid-{session_id}"
        print(f"INFO: Generated new session username: {username}")

        # Proxy configuration for 922proxy - host is static, country is in username
        proxy_info = {
            'username': username,
            'password': 'TPvBwkO8',
            'host': 'us.922s5.net',  # Use static host; country is selected via username
            'port': 6300
        }

        # Format proxy server string for requests.
        # Playwright's Chromium does not support SOCKS5 with authentication, so we must use HTTP.
        proxy_url = f"http://{proxy_info['username']}:{proxy_info['password']}@{proxy_info['host']}:{proxy_info['port']}"
        
        proxies = {
            'http': proxy_url,
            'https': proxy_url
        }
        
        print(f"INFO: Using proxy server: {proxy_info['host']}:{proxy_info['port']}")

        # Try multiple IP checking services in case one fails
        test_urls = [
            'https://api.ipify.org',
            'https://ip.oxylabs.io/location',
            'https://api.myip.com'
        ]

        success = False
        for test_url in test_urls:
            try:
                print(f"INFO: Testing with {test_url}")
                response = requests.get(
                    test_url,
                    proxies=proxies,
                    timeout=30,
                    headers={
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Accept': 'application/json,text/plain,*/*'
                    }
                )
                response.raise_for_status()
                test_ip = response.text.strip()
                print(f"INFO: Proxy test successful. Response: {test_ip}")
                success = True
                break
            except requests.exceptions.RequestException as e:
                print(f"WARNING: Test failed with {test_url}: {str(e)}")
                continue

        if not success:
            print("ERROR: All proxy tests failed")
            return None

        # Return proxy configuration in the format expected by Playwright
        # We use HTTP because Playwright's Chromium does not support SOCKS5 authentication.
        return {
            "server": f"http://{proxy_info['host']}:{proxy_info['port']}",
            "username": proxy_info['username'],
            "password": proxy_info['password']
        }

    except Exception as e:
        print(f"ERROR: An unexpected error occurred while setting up proxy: {str(e)}")
        traceback.print_exc()
        return None

def main():
    """Main function to run the injector."""
    if len(sys.argv) != 3:
        print("ERROR: Usage: python injector_playwright.py <lead_data_json> <broker_data_json>")
        sys.exit(1)

    try:
        lead_data = json.loads(sys.argv[1])
        broker_data = json.loads(sys.argv[2])
        
        target_url = broker_data.get("targetUrl") # Assuming the broker data contains the target URL
        if not target_url:
            # As a fallback, let's construct a URL from the broker name if it's a domain
            target_url = f'https://{broker_data["name"]}'

        # Get proxy for the lead's country
        proxy_config = get_proxy_config(lead_data.get("country"))
        
        if not proxy_config:
            print(f"ERROR: No proxy found for country: {lead_data.get('country')}")
            sys.exit(1)

        injector = LeadInjector(proxy_config)
        final_url = injector.inject_lead(lead_data, target_url)

        if final_url:
            # Output the final URL as JSON for the Node.js service to capture
            print(json.dumps({"success": True, "finalUrl": final_url}))
        else:
            print(json.dumps({"success": False, "message": "Injection failed."}))

    except json.JSONDecodeError:
        print("ERROR: Invalid JSON provided for lead or broker data.")
        traceback.print_exc()
        sys.exit(1)
    except Exception as e:
        print(f"ERROR: An unexpected error occurred in main: {str(e)}")
        traceback.print_exc()
        # Ensure we output a failure JSON
        print(json.dumps({"success": False, "message": f"An unexpected error occurred: {str(e)}"}))
        sys.exit(1)

if __name__ == "__main__":
    main() 