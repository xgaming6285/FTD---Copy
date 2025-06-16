import time
import random
import requests
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException
from selenium.webdriver.chrome.options import Options
import sys
import json

# --- 1. CONFIGURATION ---

# The lead data to be registered.
# This will be passed dynamically to the registration function.
# The email includes a random number to ensure it's unique for each run.
LEAD_EXAMPLE = {
    "first_name": "Test",
    "last_name": "User",
    "country_code": "1",
    "phone": "5551234567",
    "email": f"test.user.{random.randint(10000, 99999)}@example.com",
    "password": f"StrongPassword{random.randint(100,999)}!"
}

# The target website for registration.
TARGET_URL = "https://phptravels.net/signup"
WHOER_URL = "https://whoer.net/"

# Dolphin Anty API configuration
DOLPHIN_API_URL = "http://localhost:3001/v1.0"


# --- 2. DOLPHIN & PROXY HANDLING ---

class DolphinHandler:
    """Handles communication with the Dolphin Anty API."""
    def __init__(self, api_url, api_token=None):
        self.api_url = api_url
        self.api_token = api_token
        self.is_authenticated = False

    def authenticate(self):
        """Authenticate with Dolphin Anty using API token."""
        if not self.api_token:
            print("WARNING: No API token provided. Attempting to proceed without authentication.")
            return True

        try:
            response = requests.post(
                f"{self.api_url}/auth/login-with-token",
                json={"token": self.api_token},
                headers={"Content-Type": "application/json"}
            )
            response.raise_for_status()
            self.is_authenticated = True
            print("INFO: Successfully authenticated with Dolphin Anty API")
            return True
        except requests.exceptions.RequestException as e:
            print(f"ERROR: Authentication failed: {e}")
            return False

    def get_profiles(self):
        """Fetches all browser profiles from Dolphin Anty."""
        try:
            # Try to authenticate first if not already authenticated
            if not self.is_authenticated and not self.authenticate():
                return None

            response = requests.get(f"{self.api_url}/browser_profiles")
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"ERROR: Could not fetch Dolphin profiles: {e}")
            return None

    def start_profile(self, profile_id):
        """Starts a specific profile and returns WebDriver connection details."""
        try:
            print(f"INFO: Attempting to start Dolphin profile: {profile_id}")
            url = f"{self.api_url}/browser_profiles/{profile_id}/start?automation=1"
            response = requests.get(url)
            response.raise_for_status()
            data = response.json()
            if "automation" in data and "port" in data["automation"]:
                print(f"SUCCESS: Dolphin profile started on port {data['automation']['port']}")
                return data['automation']['port']
            else:
                print("ERROR: Could not get automation port from Dolphin API response.")
                return None
        except requests.exceptions.RequestException as e:
            print(f"ERROR: Could not start Dolphin profile {profile_id}: {e}")
            return None

class ProxyHandler:
    """
    Handles fetching proxies.
    NOTE: This is a placeholder. It should be replaced with actual logic
    to fetch a proxy from a provider like 992 Proxy.
    """
    def get_proxy(self):
        """
        Returns a proxy string in the format user:pass:ip:port.
        This is a dummy implementation.
        """
        print("INFO: Fetching proxy (using dummy data).")
        return "user:pass:127.0.0.1:8080"


# --- 3. THE AUTOMATION INJECTOR CLASS ---

class LeadInjector:
    """A class to handle browser automation for lead registration using a remote driver."""

    def __init__(self, driver):
        """
        Initializes the Injector with a Selenium WebDriver instance.
        """
        self.driver = driver
        self.wait = WebDriverWait(self.driver, 20)

    def _human_like_typing(self, element, text: str):
        """
        Simulates a human typing character by character with small random delays.
        """
        for char in text:
            element.send_keys(char)
            time.sleep(random.uniform(0.05, 0.2))

    def whoer_check(self):
        """Navigates to Whoer.net to check the connection's anonymity."""
        try:
            print(f"INFO: Navigating to {WHOER_URL} for anonymity check.")
            self.driver.get(WHOER_URL)
            print("INFO: Taking screenshot of whoer.net result.")
            self.driver.save_screenshot("whoer_net_check.png")
            time.sleep(5) # Pause to observe
        except Exception as e:
            print(f"ERROR: An error occurred during Whoer.net check: {e}")

    def register_lead(self, lead_data: dict):
        """
        Navigates to the registration form, fills it with lead data, and submits.
        Returns True on success, False on failure.
        """
        try:
            print(f"INFO: Navigating to {TARGET_URL}")
            self.driver.get(TARGET_URL)

            print(f"INFO: Starting registration for: {lead_data['email']}")

            # --- Find and Fill Form Fields ---
            first_name_field = self.wait.until(EC.presence_of_element_located((By.NAME, "first_name")))
            self._human_like_typing(first_name_field, lead_data['first_name'])

            last_name_field = self.driver.find_element(By.NAME, "last_name")
            self._human_like_typing(last_name_field, lead_data['last_name'])

            # The form expects a single phone field.
            phone_number = lead_data.get('country_code', '') + lead_data.get('phone', '')
            phone_field = self.driver.find_element(By.NAME, "phone")
            self._human_like_typing(phone_field, phone_number)
            
            email_field = self.driver.find_element(By.NAME, "email")
            self._human_like_typing(email_field, lead_data['email'])

            password_field = self.driver.find_element(By.NAME, "password")
            self._human_like_typing(password_field, lead_data['password'])
            
            print("INFO: Form has been filled.")
            time.sleep(1)

            # --- Submit the Form ---
            signup_button = self.driver.find_element(By.ID, "button")
            signup_button.click()
            print("INFO: 'Sign Up' button clicked.")

            # --- Verify Success ---
            self.wait.until(EC.url_contains("/account"))
            print("SUCCESS: Registration successful! Redirected to account page.")
            return True

        except TimeoutException:
            error_msg = "Error: A timeout occurred. An element was not found or the page did not load correctly."
            print(f"ERROR: {error_msg}")
            self.driver.save_screenshot("error_screenshot_timeout.png")
            return False
        except Exception as e:
            error_msg = f"An unexpected error occurred: {e}"
            print(f"ERROR: {error_msg}")
            self.driver.save_screenshot("error_screenshot_unexpected.png")
            return False


# --- 4. MAIN EXECUTION BLOCK ---

def main(lead_data_json, api_token=None):
    """
    Main function to set up Dolphin Anty, get a proxy, and run the registration.
    Args:
        lead_data_json: JSON string containing lead data
        api_token: Optional API token for Dolphin Anty authentication
    """
    # Parse the lead data from the JSON argument
    try:
        lead_data = json.loads(lead_data_json)
    except json.JSONDecodeError:
        print("FATAL: Invalid JSON format for lead data.")
        return

    print("--- Selenium Lead Injection Bot (Dolphin Anty Version) ---")
    
    dolphin = DolphinHandler(DOLPHIN_API_URL, api_token)
    # proxy_handler = ProxyHandler() # Placeholder for real proxy logic

    # --- 1. Get Dolphin Profile ---
    try:
        print("INFO: Attempting to connect to Dolphin Anty API...")
        profiles = dolphin.get_profiles()
        if not profiles:
            print("FATAL: Could not retrieve Dolphin profiles. Please ensure Dolphin Anty is running and configured.")
            print("INFO: Dolphin Anty should be running and accessible at http://localhost:3001")
            print("INFO: Please check the following:")
            print("1. Dolphin Anty is installed and running")
            print("2. You have authorized with your API token")
            print("3. Port 3001 is not blocked by firewall")
            print("4. No other application is using port 3001")
            return

        # For this example, we'll just use the first profile found.
        # In a real app, you might let the user choose.
        target_profile = profiles[0]
        profile_id = target_profile.get("id")
        print(f"INFO: Selected Dolphin profile: {target_profile.get('name')} (ID: {profile_id})")
    except requests.exceptions.ConnectionError as e:
        print("FATAL: Could not connect to Dolphin Anty API. Connection error.")
        print("INFO: Please ensure Dolphin Anty is running and accessible at http://localhost:3001")
        print("INFO: Error details:", str(e))
        return
    except Exception as e:
        print("FATAL: An unexpected error occurred while connecting to Dolphin Anty API.")
        print("INFO: Error details:", str(e))
        return

    # --- 2. Get Proxy and Update Profile (Placeholder) ---
    # proxy_info = proxy_handler.get_proxy()
    # TODO: Implement logic to update the Dolphin profile with the new proxy
    # via a PATCH request to /browser_profiles/{profile_id}
    # print(f"INFO: Would update profile with proxy: {proxy_info}")

    # --- 3. Start Dolphin Profile ---
    port = dolphin.start_profile(profile_id)
    if not port:
        print("FATAL: Could not start Dolphin profile. Exiting.")
        return
        
    driver = None
    try:
        # --- 4. Connect to Remote WebDriver ---
        options = Options()
        driver = webdriver.Remote(
            command_executor=f'http://127.0.0.1:{port}',
            options=options
        )
        
        injector = LeadInjector(driver)
        
        # --- 5. Perform Checks and Registration ---
        injector.whoer_check()
        injector.register_lead(lead_data)
        
        print("\nINFO: Process finished. Closing browser in 10 seconds...")
        time.sleep(10)

    except Exception as e:
        print(f"FATAL: A critical error occurred during WebDriver operation: {e}")
    finally:
        if driver:
            driver.quit()
            print("INFO: Browser closed.")


if __name__ == "__main__":
    if len(sys.argv) > 1:
        try:
            lead_data = json.loads(sys.argv[1])
            api_token = lead_data.pop('api_token', None)  # Extract and remove api_token from lead data
            main(json.dumps(lead_data), api_token)
        except json.JSONDecodeError:
            print("FATAL: Invalid JSON format for lead data.")
    else:
        print("FATAL: No lead data provided. Please provide lead data as a JSON string argument.")
        # For testing purposes, you can fall back to example data
        # main(json.dumps(LEAD_EXAMPLE)) 