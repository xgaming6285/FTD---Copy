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
                print("FATAL: No proxy configuration provided to manual injector")
                print("FATAL: Manual injection cannot proceed without proxy - STOPPING IMMEDIATELY")
                sys.exit(1)

            with sync_playwright() as p:
                # Launch browser with configuration
                print("INFO: Launching browser for manual injection...")
                browser = p.chromium.launch(**self._setup_browser_config())

                # Get fingerprint configuration
                fingerprint = lead_data.get('fingerprint')
                if fingerprint:
                    print(f"INFO: Using device fingerprint: {fingerprint.get('deviceId', 'unknown')} ({fingerprint.get('deviceType', 'unknown')})")
                    device_config = self._create_device_config_from_fingerprint(fingerprint)
                else:
                    print("WARNING: No fingerprint configuration provided, using default iPhone 14 Pro Max settings")
                    # Use default iPhone 14 Pro Max settings as fallback
                    device_config = {
                        'screen': {
                            'width': 428,
                            'height': 926
                        },
                        'viewport': {
                            'width': 428,
                            'height': 926
                        },
                        'device_scale_factor': 3,
                        'is_mobile': True,
                        'has_touch': True,
                        'user_agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/605.1 NAVER(inapp; search; 2000; 12.12.50; 14PROMAX)',
                    }

                # Create context with device configuration
                context = browser.new_context(
                    **device_config,
                    locale="en-US"
                )

                # Create a new page
                page = context.new_page()

                # Apply fingerprint properties if available
                if fingerprint:
                    self._apply_fingerprint_to_page(page, fingerprint)

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

                # Wait for the browser to be closed manually with session capture
                print("\nINFO: Browser is ready. Form has been auto-filled with FTD data.")
                print("INFO: Please review, submit the form manually, and complete the process.")
                print("INFO: After form submission, you can navigate to mail.com to test the session.")
                print("INFO: Close the browser when completely done to capture the session.")
                print("INFO: Waiting for browser to be closed manually...")

                # Keep the script running until browser is closed
                try:
                    last_url = page.url
                    form_submitted = False
                    
                    # Check if browser is still running every 2 seconds
                    while True:
                        try:
                            # Try to get current URL - this will fail if browser is closed
                            current_url = page.url
                            
                            # Check if URL changed (indicates form submission/redirect)
                            if current_url != last_url and not form_submitted:
                                print(f"INFO: URL changed from {last_url} to {current_url}")
                                print("INFO: Form appears to have been submitted successfully!")
                                form_submitted = True
                                
                                # Take screenshot after form submission
                                self._take_screenshot(page, "manual_injection_form_submitted")
                                
                                # Show mail.com navigation option
                                print("\n" + "="*60)
                                print("OPTIONAL: TEST SESSION PERSISTENCE")
                                print("="*60)
                                print("You can now navigate to mail.com to test if the session persists.")
                                print("This will help verify that the captured session works correctly.")
                                print("Navigate to: https://mail.com")
                                print("Try to register/login to see if the session is maintained.")
                                print("When you're done testing, close the browser to capture the session.")
                                print("="*60)
                            
                            last_url = current_url
                            time.sleep(2)
                        except Exception:
                            # Browser was closed
                            break

                    print("INFO: Browser was closed manually.")
                    
                    # Capture session data before closing
                    if form_submitted:
                        print("INFO: Attempting to capture browser session...")
                        session_success = self._capture_and_store_session(page, lead_data, True)
                        if session_success:
                            print("SUCCESS: Browser session captured and stored successfully!")
                        else:
                            print("WARNING: Failed to capture browser session, but injection was successful.")
                    else:
                        print("WARNING: Form may not have been submitted (no URL change detected).")
                        print("INFO: Attempting to capture session anyway...")
                        session_success = self._capture_and_store_session(page, lead_data, False)
                        if session_success:
                            print("INFO: Browser session captured (submission status unknown).")
                    
                    print("SUCCESS: Manual injection session completed.")
                    return True

                except KeyboardInterrupt:
                    print("\nINFO: Manual injection interrupted by user.")
                    # Try to capture session even if interrupted
                    try:
                        print("INFO: Attempting to capture session before exit...")
                        self._capture_and_store_session(page, lead_data, False)
                    except:
                        pass
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

    def _create_device_config_from_fingerprint(self, fingerprint):
        """Create Playwright device configuration from fingerprint data."""
        screen = fingerprint.get('screen', {})
        navigator = fingerprint.get('navigator', {})
        mobile = fingerprint.get('mobile', {})

        return {
            'screen': {
                'width': screen.get('width', 428),
                'height': screen.get('height', 926)
            },
            'viewport': {
                'width': screen.get('availWidth', screen.get('width', 428)),
                'height': screen.get('availHeight', screen.get('height', 926))
            },
            'device_scale_factor': screen.get('devicePixelRatio', 1),
            'is_mobile': mobile.get('isMobile', False),
            'has_touch': navigator.get('maxTouchPoints', 0) > 0,
            'user_agent': navigator.get('userAgent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')
        }

    def _apply_fingerprint_to_page(self, page, fingerprint):
        """Apply fingerprint properties to the page context."""
        try:
            # Set injection mode flag first (most important)
            page.evaluate("() => { localStorage.setItem('isInjectionMode', 'true'); }")
            print("INFO: Set injection mode flag for the landing page")

            # Try to apply fingerprint properties (non-critical if it fails)
            navigator = fingerprint.get('navigator', {})
            screen = fingerprint.get('screen', {})

            # Simple approach - just set the essential properties
            platform = json.dumps(navigator.get('platform', 'Win32'))
            user_agent = json.dumps(navigator.get('userAgent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'))

            page.evaluate(f"""() => {{
                try {{
                    // Set basic navigator properties
                    Object.defineProperty(navigator, 'platform', {{
                        get: () => {platform}
                    }});

                    // Set injection mode flag (redundant but important)
                    localStorage.setItem('isInjectionMode', 'true');

                    console.log('Fingerprint properties applied successfully');
                }} catch (error) {{
                    console.error('Error applying fingerprint:', error);
                    // Ensure injection mode is still set
                    localStorage.setItem('isInjectionMode', 'true');
                }}
            }};""")

            print(f"INFO: Applied fingerprint properties for device: {fingerprint.get('deviceId', 'unknown')}")

        except Exception as e:
            print(f"WARNING: Failed to apply fingerprint properties: {str(e)}")
            # Always ensure injection mode is set
            try:
                page.evaluate("() => { localStorage.setItem('isInjectionMode', 'true'); }")
                print("INFO: Set injection mode flag despite fingerprint error")
            except Exception as e2:
                print(f"WARNING: Could not set injection mode flag: {str(e2)}")

    def _capture_and_store_session(self, page, lead_data, success_status):
        """Capture browser session and send to backend for storage."""
        try:
            print("🔍 Starting browser session capture...")
            
            # Get current URL for domain extraction
            current_url = page.url
            domain = urlparse(current_url).netloc
            print(f"INFO: Capturing session from domain: {domain}")
            
            # Capture cookies from the browser context
            cookies = page.context.cookies()
            print(f"📄 Captured {len(cookies)} cookies")
            
            # Capture localStorage
            try:
                local_storage = page.evaluate("""() => {
                    const storage = {};
                    for (let i = 0; i < window.localStorage.length; i++) {
                        const key = window.localStorage.key(i);
                        storage[key] = window.localStorage.getItem(key);
                    }
                    return storage;
                }""")
            except Exception as e:
                print(f"WARNING: Could not capture localStorage: {str(e)}")
                local_storage = {}
            
            print(f"💾 Captured {len(local_storage)} localStorage items")
            
            # Capture sessionStorage
            try:
                session_storage = page.evaluate("""() => {
                    const storage = {};
                    for (let i = 0; i < window.sessionStorage.length; i++) {
                        const key = window.sessionStorage.key(i);
                        storage[key] = window.sessionStorage.getItem(key);
                    }
                    return storage;
                }""")
            except Exception as e:
                print(f"WARNING: Could not capture sessionStorage: {str(e)}")
                session_storage = {}
            
            print(f"🗂️ Captured {len(session_storage)} sessionStorage items")
            
            # Get user agent
            user_agent = page.evaluate("() => navigator.userAgent")
            
            # Get viewport size
            viewport = page.viewport_size or {'width': 1366, 'height': 768}
            
            # Generate unique session ID
            import time
            import random
            timestamp = int(time.time() * 1000)
            random_part = ''.join(random.choices(string.ascii_lowercase + string.digits, k=16))
            session_id = f"session_{timestamp}_{random_part}"
            
            # Create session data structure
            session_data = {
                'sessionId': session_id,
                'cookies': [
                    {
                        'name': cookie['name'],
                        'value': cookie['value'],
                        'domain': cookie.get('domain', ''),
                        'path': cookie.get('path', '/'),
                        'expires': cookie.get('expires'),
                        'httpOnly': cookie.get('httpOnly', False),
                        'secure': cookie.get('secure', False),
                        'sameSite': cookie.get('sameSite', 'Lax')
                    }
                    for cookie in cookies
                ],
                'localStorage': local_storage,
                'sessionStorage': session_storage,
                'userAgent': user_agent,
                'viewport': viewport,
                'metadata': {
                    'domain': domain,
                    'success': success_status,
                    'injectionType': 'manual_ftd',
                    'notes': f'Manual FTD injection completed on {domain}',
                    'capturedAt': time.time()
                }
            }
            
            print(f"✅ Session data prepared: {len(cookies)} cookies, {len(local_storage)} localStorage, {len(session_storage)} sessionStorage")
            
            # Send session data to backend
            return self._send_session_to_backend(lead_data, session_data)
            
        except Exception as e:
            print(f"❌ Error capturing session: {str(e)}")
            traceback.print_exc()
            return False

    def _send_session_to_backend(self, lead_data, session_data):
        """Send captured session data to the Node.js backend."""
        try:
            # Get backend URL from environment or use default
            backend_url = os.getenv('BACKEND_URL', 'http://localhost:5000')
            lead_id = lead_data.get('leadId') or lead_data.get('_id')
            
            if not lead_id:
                print("ERROR: No lead ID found in lead data")
                return False
            
            # Prepare API request
            api_url = f"{backend_url}/api/leads/{lead_id}/session"
            
            # Add order and user information if available
            payload = {
                'sessionData': session_data,
                'orderId': lead_data.get('orderId'),
                'assignedBy': lead_data.get('assignedBy')
            }
            
            print(f"📡 Sending session data to backend: {api_url}")
            
            # Send POST request to store session
            response = requests.post(
                api_url,
                json=payload,
                headers={'Content-Type': 'application/json'},
                timeout=30
            )
            
            if response.status_code == 200 or response.status_code == 201:
                result = response.json()
                print(f"✅ Session stored successfully in backend!")
                print(f"🔑 Session ID: {session_data['sessionId']}")
                return True
            else:
                print(f"❌ Backend returned error: {response.status_code}")
                print(f"Response: {response.text}")
                return False
                
        except requests.exceptions.RequestException as e:
            print(f"❌ Network error sending session to backend: {str(e)}")
            return False
        except Exception as e:
            print(f"❌ Error sending session to backend: {str(e)}")
            traceback.print_exc()
            return False

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
            print("FATAL: No proxy configuration provided to manual injector")
            print("FATAL: Manual injection cannot proceed without proxy - STOPPING IMMEDIATELY")
            sys.exit(1)

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