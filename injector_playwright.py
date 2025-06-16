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
            username = self.proxy_config.get("username")

            # Check for SOCKS5 authentication, which is not supported by Playwright
            if server.startswith("socks5:") and username:
                print("\nFATAL: Playwright does not support SOCKS5 proxy authentication.")
                print("Please use an HTTP/HTTPS proxy or a SOCKS5 proxy with IP-based authentication instead.")
                sys.exit(1)

            browser_config["proxy"] = {
                "server": server,
                "username": username,
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
            actual_ip = page.content()
            
            # Double check with another IP service
            page.goto("https://ip.oxylabs.io/location", wait_until="networkidle", timeout=30000)
            try:
                location_data = json.loads(page.content())
                print("\nProxy and Device Verification Results:")
                print(f"IP Address: {actual_ip}")
                print(f"Country: {location_data.get('country', 'Unknown')}")
                print(f"City: {location_data.get('city', 'Unknown')}")
            except json.JSONDecodeError:
                print(f"IP Address: {actual_ip}")
                print("WARNING: Could not get detailed location data")

            # Get user agent information
            user_agent = page.evaluate("() => navigator.userAgent")
            
            # Get device information
            device_info = page.evaluate("""() => {
                return {
                    screenWidth: window.screen.width,
                    screenHeight: window.screen.height,
                    isMobile: /iPhone|iPad|iPod|Android/i.test(navigator.userAgent),
                    platform: navigator.platform
                }
            }""")

            print(f"User Agent: {user_agent}")
            print(f"Screen Resolution: {device_info['screenWidth']}x{device_info['screenHeight']}")
            print(f"Mobile Device: {'Yes' if device_info['isMobile'] else 'No'}")
            print(f"Platform: {device_info['platform']}")

            # Take a screenshot of verification
            self._take_screenshot(page, "proxy_verification")

            # Verify if we're using the expected proxy
            if self.proxy_config:
                if actual_ip:
                    print("INFO: Successfully verified proxy connection")
                else:
                    print("WARNING: Could not verify proxy IP address")
                    
            # Verify device simulation
            if "iPhone" in user_agent and device_info['screenWidth'] == 428:
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
                return False
            
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
                    print("ERROR: Failed to navigate to target URL after multiple attempts")
                    return False
                
                # Take a screenshot after page load
                self._take_screenshot(page, "initial_page_load")
                    
                # Reduce break time for testing
                print("INFO: Taking a short break...")
                time.sleep(3)
                print("\nINFO: Break finished, continuing with form filling...")
                
                # Check if the form is visible
                form_visible = page.is_visible('form[id="landingForm"], form[data-testid="landingForm"]')
                if not form_visible:
                    print("WARNING: Form not immediately visible, trying to find it...")
                    # Try to scroll to find the form
                    page.evaluate("window.scrollTo(0, 0);")
                    time.sleep(1)
                    
                    # Try to find the form by scrolling down
                    for i in range(5):
                        page.evaluate(f"window.scrollTo(0, {i * 200});")
                        time.sleep(0.5)
                        if page.is_visible('form[id="landingForm"], form[data-testid="landingForm"], #firstName'):
                            print(f"INFO: Form found after scrolling {i * 200}px")
                            form_visible = True
                            break
                    
                    # Take another screenshot after scrolling
                    self._take_screenshot(page, "after_scrolling")
                    
                    # If still not visible, try to adjust zoom
                    if not form_visible:
                        print("WARNING: Form still not visible, trying to adjust zoom...")
                        page.evaluate("document.body.style.zoom = '80%'")
                        time.sleep(1)
                        self._take_screenshot(page, "after_zoom_adjustment")
                
                # Fill form fields with human-like behavior
                print("INFO: Filling form fields...")
                
                try:
                    # Debug info about the form fields
                    for key, value in lead_data.items():
                        print(f"DEBUG: {key}: {value}")
                    
                    # Wait for form fields and fill them - using proper selectors from LandingPage.jsx
                    first_name = page.wait_for_selector('#firstName', timeout=30000)
                    if not first_name:
                        print("ERROR: Could not find firstName field")
                        self._take_screenshot(page, "form_not_found")
                        return False
                        
                    self._human_like_typing(first_name, lead_data["firstName"])
                    
                    last_name = page.wait_for_selector('#lastName', timeout=30000)
                    self._human_like_typing(last_name, lead_data["lastName"])
                    
                    email = page.wait_for_selector('#email', timeout=30000)
                    self._human_like_typing(email, lead_data["email"])

                    # Check if country_code exists and isn't empty
                    if 'country_code' in lead_data and lead_data['country_code']:
                        # Format the country code with a plus sign if it doesn't have one
                        code = lead_data["country_code"]
                        if not code.startswith('+'):
                            code = f"+{code}"
                            
                        print(f"INFO: Selecting country code {code}")
                        
                        # Click the dropdown to open it
                        page.click('#prefix')
                        # Wait for dropdown to open
                        time.sleep(1)
                        # Find the correct country code option
                        try:
                            clean_code = code.replace('+', '')
                            selector = f'[data-testid="prefix-option-{clean_code}"]'
                            print(f"INFO: Using selector {selector}")
                            page.click(selector)
                        except Exception as e:
                            print(f"WARNING: Could not select country code {code}: {str(e)}")
                            # Use first option as fallback
                            page.click('[data-testid="prefix-option-1"]')

                    phone_number = lead_data['phone']
                    phone = page.wait_for_selector('#phone', timeout=30000)
                    self._human_like_typing(phone, phone_number)
                    
                    # Take a screenshot before submission
                    self._take_screenshot(page, "before_submission")
                    
                    # Set injection mode flag
                    page.evaluate("window.localStorage.setItem('isInjectionMode', 'true')")
                    
                    # Random delay before submission
                    time.sleep(random.uniform(1, 2))
                    
                    # Submit form
                    submit_button = page.wait_for_selector('#submitBtn', timeout=30000)
                    submit_button.click()
                    
                    # Wait for success indication - the Thank You message appears when form is submitted
                    try:
                        # Wait for the success message to appear
                        success_message = page.wait_for_selector('text="Thank You!"', timeout=30000)
                        if success_message:
                            print("SUCCESS: Form submitted successfully")
                            self._take_screenshot(page, "success")
                            
                            # Verify proxy and device simulation
                            verification_result = self._verify_proxy_and_device(page)
                            if verification_result:
                                print("INFO: Proxy and device verification completed")
                            else:
                                print("WARNING: Proxy and device verification failed")
                            
                            return True
                        else:
                            # Check for error message
                            error_message = page.query_selector('.MuiAlert-message')
                            if error_message:
                                error_text = error_message.inner_text()
                                print(f"WARNING: Submission error - {error_text}")
                                self._take_screenshot(page, "error")
                            else:
                                print("WARNING: Could not verify successful submission")
                                self._take_screenshot(page, "unknown_state")
                            return False
                    except Exception as e:
                        print(f"WARNING: Could not verify successful submission - {str(e)}")
                        self._take_screenshot(page, "verification_error")
                        return False
                    
                except Exception as e:
                    print(f"ERROR: Form interaction failed - {str(e)}")
                    self._take_screenshot(page, "form_interaction_error")
                    traceback.print_exc()
                    return False
                
        except Exception as e:
            print(f"ERROR: Browser initialization failed - {str(e)}")
            traceback.print_exc()
            return False
        finally:
            if browser:
                try:
                    browser.close()
                except:
                    pass

def get_proxy_config(country_code):
    """Get proxy configuration from 922proxy API."""
    try:
        print(f"INFO: Setting up proxy for country: {country_code}")

        # To get a new proxy for each lead, we generate a new random session ID.
        # This should result in a new IP for each session from the proxy provider.
        session_id = ''.join(random.choices(string.ascii_letters + string.digits, k=8))
        username = f"34998931-zone-custom-sessid-{session_id}"
        print(f"INFO: Generated new session username: {username}")

        # Proxy configuration for 922proxy
        proxy_info = {
            'username': username,
            'password': 'TPvBwkO8',
            'host': 'us.922s5.net',
            'port': 6300
        }

        # Format proxy server string for requests - socks5h resolves DNS through proxy
        proxy_url = f"socks5h://{proxy_info['username']}:{proxy_info['password']}@{proxy_info['host']}:{proxy_info['port']}"
        
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
    """Main execution function."""
    if len(sys.argv) < 2:
        print("FATAL: No input JSON provided.")
        sys.exit(1)

    try:
        lead_data_str = sys.argv[1]
        lead_data = json.loads(lead_data_str)
        print(f"INFO: Processing lead data for {lead_data.get('email', 'unknown')}")
        
        country_code = lead_data.get("country")
        if not country_code:
            print("WARNING: Country not found in lead data, using default.")
            country_code = "US"
            
        # Try to get a proxy. If it fails, exit, as it's required.
        proxy_config = get_proxy_config(country_code)
        if not proxy_config:
            print("FATAL: Could not obtain proxy configuration. Cannot proceed.")
            sys.exit(1)

        # Get target URL from lead data
        target_url = lead_data.get("landingPage")
        if not target_url:
            print("FATAL: landingPage not found in lead data.")
            sys.exit(1)
            
        print(f"INFO: Target URL: {target_url}")

        # Initialize and run injector
        injector = LeadInjector(proxy_config)
        success = injector.inject_lead(lead_data, target_url)

        if success:
            print("INFO: Lead injection completed successfully")
            return True
        else:
            print("ERROR: Lead injection failed")
            return False

    except json.JSONDecodeError:
        print(f"FATAL: Invalid JSON provided")
        sys.exit(1)
    except Exception as e:
        try:
            error_msg = str(e)
            print(f"FATAL: An error occurred during execution: {error_msg}")
            traceback.print_exc()
        except UnicodeEncodeError:
            print(f"FATAL: An error occurred during execution (encoding error when displaying message)")
        return False

if __name__ == "__main__":
    main() 