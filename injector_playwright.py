import asyncio
import json
import sys
import time
import random
import requests
from pathlib import Path
from playwright.sync_api import sync_playwright

class LeadInjector:
    """Handles the lead injection process using Playwright."""
    
    def __init__(self, proxy_config=None):
        self.proxy_config = proxy_config
        
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
                "--window-size=1290,2796"
            ]
        }
        
        # Add proxy configuration if provided
        if self.proxy_config:
            browser_config["proxy"] = {
                "server": self.proxy_config['server'],
                "username": self.proxy_config["username"],
                "password": self.proxy_config["password"]
            }
            
        return browser_config

    def _human_like_typing(self, element, text):
        """Simulate human-like typing with random delays."""
        for char in text:
            element.type(char, delay=random.uniform(100, 300))
            
    def inject_lead(self, lead_data, target_url):
        """Inject a lead using Playwright."""
        browser = None
        try:
            with sync_playwright() as p:
                # Launch browser with configuration
                print("INFO: Launching browser...")
                browser = p.chromium.launch(**self._setup_browser_config())
                
                # Create a new context with iPhone 14 Pro Max settings
                iphone_14_pro_max = {
                    'screen': {
                        'width': 1290,
                        'height': 2796
                    },
                    'viewport': {
                        'width': 1290,
                        'height': 2796
                    },
                    'device_scale_factor': 3,
                    'is_mobile': True,
                    'has_touch': True,
                    'user_agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/605.1 NAVER(inapp; search; 2000; 12.12.50; 14PROMAX)',
                }
                
                context = browser.new_context(
                    **iphone_14_pro_max,
                    locale="en-US"
                )
                
                # Create a new page
                page = context.new_page()
                
                # Navigate to target URL
                print("INFO: Navigating to target URL...")
                page.goto(target_url, wait_until="domcontentloaded")
                
                # Add 2-minute break
                print("INFO: Taking a 2-minute break...")
                for i in range(120, 0, -1):
                    sys.stdout.write(f"\rTime remaining: {i} seconds...")
                    sys.stdout.flush()
                    time.sleep(1)
                print("\nINFO: Break finished, continuing with form filling...")
                
                # Fill form fields with human-like behavior
                print("INFO: Filling form fields...")
                
                try:
                    # Wait for form fields and fill them
                    first_name = page.wait_for_selector('input[name="firstName"]', timeout=30000)
                    self._human_like_typing(first_name, lead_data["first_name"])
                    
                    last_name = page.wait_for_selector('input[name="lastName"]', timeout=30000)
                    self._human_like_typing(last_name, lead_data["last_name"])
                    
                    email = page.wait_for_selector('input[name="email"]', timeout=30000)
                    self._human_like_typing(email, lead_data["email"])

                    if 'country_code' in lead_data:
                        # Click the dropdown to open it
                        page.click('div[id="prefix"]')
                        # Click the option
                        page.click(f'li[data-value="{lead_data["country_code"]}"]')

                    phone_number = lead_data['phone']
                    phone = page.wait_for_selector('input[name="phone"]', timeout=30000)
                    self._human_like_typing(phone, phone_number)
                    
                    # Random delay before submission
                    time.sleep(random.uniform(1, 2))
                    
                    # Submit form
                    submit_button = page.wait_for_selector('button[type="submit"]', timeout=30000)
                    submit_button.click()
                    
                    # Wait for success indication
                    try:
                        page.wait_for_url(lambda url: "/success" in url or "/dashboard" in url, timeout=30000)
                        print("SUCCESS: Form submitted successfully")
                    except Exception as e:
                        print(f"WARNING: Could not verify successful submission - {str(e)}")
                    
                    print("Press CTRL-C to close.")
                    try:
                        page.wait_for_timeout(86400000)  # 24h
                    except KeyboardInterrupt:
                        pass
                    
                    return True
                    
                except Exception as e:
                    print(f"ERROR: Form interaction failed - {str(e)}")
                    return False
                
        except Exception as e:
            print(f"ERROR: Browser initialization failed - {str(e)}")
            return False
        finally:
            if browser:
                try:
                    browser.close()
                except:
                    pass

def get_proxy_config(country_code):
    """Get proxy configuration for a given country by calling the 922Proxy API."""
    print(f"INFO: Requesting new proxy for country: {country_code}")
    api_url = f"http://127.0.0.1:5555/v1/ips?num=1&country={country_code.lower()}&state=all&city=all&zip=all&t=json&isp=all&start=&end="
    
    try:
        response = requests.get(api_url, timeout=10)
        response.raise_for_status()  # Raise an exception for bad status codes
        
        data = response.json()
        
        if data.get("code") == 0 and data.get("data"):
            proxy_info = data["data"][0]
            ip = proxy_info.get("ip")
            port = proxy_info.get("port")
            
            if ip and port:
                proxy_server = f"http://{ip}:{port}"
                print(f"SUCCESS: Obtained proxy: {proxy_server}")
                # The user-pass auth might still be needed for the fetched proxy.
                # The user provided credentials, so we should use them.
                username = f"7070a420-f59b-4b66-b692-789bf7cd3b08-zone-custom-region-{country_code.upper()}"
                password = "zd0BvafJcVhE"
                
                return {
                    "server": proxy_server,
                    "username": username,
                    "password": password
                }
        
        print(f"ERROR: Failed to parse proxy from API response: {data}")
        return None

    except requests.exceptions.RequestException as e:
        print(f"ERROR: Could not connect to 922Proxy API at {api_url}. Is the client running?")
        print(f"Details: {e}")
        return None
    except Exception as e:
        print(f"ERROR: An unexpected error occurred while getting proxy: {e}")
        return None

def main():
    """Main execution function."""
    if len(sys.argv) < 2:
        print("FATAL: No input JSON provided.")
        sys.exit(1)

    try:
        lead_data_str = sys.argv[1]
        lead_data = json.loads(lead_data_str)
        print("INFO: Processing lead data for", lead_data.get('email', 'unknown'))

        country_code = lead_data.get("country")
        if not country_code:
            print("FATAL: country not found in lead data.")
            sys.exit(1)
            
        proxy_config = get_proxy_config(country_code)
        if not proxy_config:
            print("WARNING: Could not obtain proxy configuration. Continuing without proxy.")

        # Get target URL from lead data
        target_url = lead_data.get("landingPage")
        if not target_url:
            print("FATAL: landingPage not found in lead data.")
            sys.exit(1)

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
        print(f"FATAL: Invalid JSON provided: {sys.argv[1]}")
        sys.exit(1)
    except Exception as e:
        print(f"FATAL: An error occurred during execution: {str(e)}")
        return False

if __name__ == "__main__":
    main() 