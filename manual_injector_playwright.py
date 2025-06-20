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
from urllib.parse import urlparse

# Fix for Windows encoding issues - ensure everything uses utf-8
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

# Constants
MAX_RETRIES = 3
RETRY_DELAY = 2

class ManualLeadInjector:
    """Manual lead injector that opens browser and auto-fills form fields."""
    
    def __init__(self, proxy_config=None):
        self.proxy_config = proxy_config
        self.target_url = None

    def _take_screenshot(self, page, name):
        """Take a screenshot for debugging purposes."""
        try:
            screenshots_dir = Path("screenshots")
            screenshots_dir.mkdir(exist_ok=True)
            screenshot_path = screenshots_dir / f"{name}_{int(time.time())}.png"
            page.screenshot(path=str(screenshot_path))
            print(f"INFO: Screenshot saved: {screenshot_path}")
        except Exception as e:
            print(f"WARNING: Could not take screenshot '{name}': {str(e)}")

    def _setup_browser_config(self):
        """Setup browser configuration."""
        config = {
            'headless': False,  # Always run in non-headless mode for manual interaction
            'args': [
                '--no-sandbox',
                '--disable-blink-features=AutomationControlled',
                '--disable-web-security',
                '--disable-features=VizDisplayCompositor',
                '--disable-extensions',
                '--no-first-run',
                '--disable-default-apps',
                '--disable-infobars',
                '--disable-dev-shm-usage',
                '--disable-background-timer-throttling',
                '--disable-backgrounding-occluded-windows',
                '--disable-renderer-backgrounding',
                '--disable-field-trial-config',
                '--disable-back-forward-cache',
                '--disable-ipc-flooding-protection',
                '--window-size=428,926',  # iPhone 14 Pro Max size
            ]
        }

        # Add proxy configuration if available
        if self.proxy_config:
            config['proxy'] = {
                'server': self.proxy_config['server'],
                'username': self.proxy_config['username'],
                'password': self.proxy_config['password']
            }
            print(f"INFO: Using proxy server: {self.proxy_config['server']}")

        return config

    def _human_like_typing(self, element, text):
        """Type text in a human-like manner with random delays."""
        if not text:
            return
        
        # Clear the field first
        element.click()
        element.fill('')  # Clear any existing content
        
        # Type character by character with random delays
        for char in str(text):
            element.type(char)
            time.sleep(random.uniform(0.05, 0.15))  # Random delay between keystrokes

    def _select_country_code(self, page, country_code):
        """Select country code from the prefix dropdown."""
        try:
            # Ensure country code has + prefix
            if not country_code.startswith('+'):
                country_code = f"+{country_code}"
            
            print(f"INFO: Selecting country code: {country_code}")
            
            # Click on the select dropdown to open it
            prefix_select = page.wait_for_selector('#prefix', timeout=10000)
            prefix_select.click()
            
            # Wait a moment for dropdown to open
            time.sleep(0.5)
            
            # Try to find and click the option with the specific country code
            # The dropdown options have data-testid attributes like "prefix-option-1", "prefix-option-44", etc.
            code_without_plus = country_code.replace('+', '')
            option_selector = f'[data-testid="prefix-option-{code_without_plus}"]'
            
            try:
                option = page.wait_for_selector(option_selector, timeout=5000)
                option.click()
                print(f"INFO: Successfully selected country code: {country_code}")
                return True
            except Exception as e:
                print(f"WARNING: Could not find exact option for {country_code}, trying alternative method")
                
                # Alternative: Look for any option containing the country code
                options = page.query_selector_all('[role="option"]')
                for option in options:
                    option_text = option.inner_text()
                    if country_code in option_text:
                        option.click()
                        print(f"INFO: Selected country code using alternative method: {country_code}")
                        return True
                
                print(f"ERROR: Could not select country code: {country_code}")
                return False
                
        except Exception as e:
            print(f"ERROR: Failed to select country code {country_code}: {str(e)}")
            return False

    def _auto_fill_form(self, page, lead_data):
        """Auto-fill the form fields with lead data."""
        try:
            print("\n" + "="*50)
            print("AUTO-FILLING FORM WITH FTD LEAD DATA:")
            print("="*50)
            
            # Wait for the form to be fully loaded
            page.wait_for_selector('#landingForm', timeout=15000)
            time.sleep(1)  # Additional wait for form to stabilize
            
            # Fill First Name
            print(f"INFO: Filling First Name: {lead_data.get('firstName', 'N/A')}")
            first_name_field = page.wait_for_selector('#firstName', timeout=10000)
            self._human_like_typing(first_name_field, lead_data.get('firstName', ''))
            
            # Fill Last Name
            print(f"INFO: Filling Last Name: {lead_data.get('lastName', 'N/A')}")
            last_name_field = page.wait_for_selector('#lastName', timeout=10000)
            self._human_like_typing(last_name_field, lead_data.get('lastName', ''))
            
            # Fill Email
            print(f"INFO: Filling Email: {lead_data.get('email', 'N/A')}")
            email_field = page.wait_for_selector('#email', timeout=10000)
            self._human_like_typing(email_field, lead_data.get('email', ''))
            
            # Select Country Code (Prefix)
            country_code = lead_data.get('country_code', '1')
            print(f"INFO: Selecting Country Code: +{country_code}")
            self._select_country_code(page, country_code)
            
            # Fill Phone Number
            print(f"INFO: Filling Phone: {lead_data.get('phone', 'N/A')}")
            phone_field = page.wait_for_selector('#phone', timeout=10000)
            self._human_like_typing(phone_field, lead_data.get('phone', ''))
            
            print("="*50)
            print("FORM AUTO-FILL COMPLETED!")
            print("="*50)
            print("INSTRUCTIONS:")
            print("1. Review the auto-filled information above")
            print("2. Make any necessary corrections manually")
            print("3. Click the submit button to submit the form")
            print("4. Wait for any redirects to complete")
            print("5. Copy the final domain/URL from the address bar")
            print("6. Close this browser window when done")
            print("="*50)
            
            return True
            
        except Exception as e:
            print(f"ERROR: Failed to auto-fill form: {str(e)}")
            traceback.print_exc()
            return False

    def open_manual_injection_browser(self, lead_data, target_url):
        """Open browser for manual lead injection with auto-filled form."""
        browser = None
        try:
            # Store target URL for proxy configuration
            self.target_url = target_url
            
            # Get proxy configuration
            if not self.proxy_config:
                print("WARNING: No proxy configuration available. Proceeding without proxy for testing.")
            
            with sync_playwright() as p:
                # Launch browser with configuration
                print("INFO: Launching browser for manual injection...")
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
                self._take_screenshot(page, "manual_injection_page_loaded")

                # Set injection mode flag
                page.evaluate("window.localStorage.setItem('isInjectionMode', 'true')")
                print("INFO: Set injection mode flag for the landing page")

                # Auto-fill the form with FTD lead data
                auto_fill_success = self._auto_fill_form(page, lead_data)
                
                if auto_fill_success:
                    # Take a screenshot after auto-fill
                    self._take_screenshot(page, "manual_injection_auto_filled")
                else:
                    print("WARNING: Auto-fill failed, but continuing with manual mode")
                    # Display lead information for manual reference as fallback
                    print("\n" + "="*50)
                    print("LEAD INFORMATION FOR MANUAL ENTRY (FALLBACK):")
                    print("="*50)
                    print(f"First Name: {lead_data.get('firstName', 'N/A')}")
                    print(f"Last Name: {lead_data.get('lastName', 'N/A')}")
                    print(f"Email: {lead_data.get('email', 'N/A')}")
                    print(f"Phone: {lead_data.get('phone', 'N/A')}")
                    print(f"Country: {lead_data.get('country', 'N/A')}")
                    print(f"Country Code: +{lead_data.get('country_code', 'N/A')}")
                    print("="*50)

                # Wait for the browser to be closed manually
                print("\nINFO: Browser is ready. Form has been auto-filled with FTD data.")
                print("INFO: Please review, submit the form manually, and close the browser when done.")
                print("INFO: Waiting for browser to be closed manually...")
                
                # Keep the script running until browser is closed
                try:
                    # Check if browser is still running every 2 seconds
                    while True:
                        try:
                            # Try to get current URL - this will fail if browser is closed
                            current_url = page.url
                            time.sleep(2)
                        except Exception:
                            # Browser was closed
                            break
                    
                    print("INFO: Browser was closed manually.")
                    print("SUCCESS: Manual injection session completed.")
                    return True
                    
                except KeyboardInterrupt:
                    print("\nINFO: Manual injection interrupted by user.")
                    return True
                
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

def main():
    """Main execution function."""
    if len(sys.argv) < 2:
        print("FATAL: No input JSON provided.")
        sys.exit(1)

    try:
        injection_data_str = sys.argv[1]
        injection_data = json.loads(injection_data_str)
        print(f"INFO: Processing manual injection data for lead {injection_data.get('leadId', 'unknown')}")
        
        # Extract proxy configuration from injection data
        proxy_config = injection_data.get('proxy')
        if not proxy_config:
            print("WARNING: No proxy configuration provided. Proceeding without proxy for testing.")
            proxy_config = None

        # Get target URL
        target_url = injection_data.get('targetUrl', "https://ftd-copy.vercel.app/landing")
        print(f"INFO: Target URL: {target_url}")

        # Initialize and run manual injector
        injector = ManualLeadInjector(proxy_config)
        success = injector.open_manual_injection_browser(injection_data, target_url)

        if success:
            print("INFO: Manual injection session completed successfully")
            return True
        else:
            print("ERROR: Manual injection session failed")
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