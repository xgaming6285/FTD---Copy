import requests
import time
import random
import os
import json
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait, Select
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException

# --- 1. CONFIGURATION ---
# Replace these with your actual details

# Dolphin Anty Configuration
DOLPHIN_API_PORT = "3001"
# Get this from Dolphin Anty settings -> API
DOLPHIN_API_TOKEN = "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJhdWQiOiIxIiwianRpIjoiMjVjNDdjYjU3Mjk2ZGZmNTlmZjkwODI0NzZiY2M4MjU4NjY1MDg4OTZjMzRkOGQwYzU1ZjhkYTFmOWEwYzc4NjJkYTllY2FiZGQ3ODc5Y2MiLCJpYXQiOjE3NDk4NDU2NDcuMjkxMzExLCJuYmYiOjE3NDk4NDU2NDcuMjkxMzEzLCJleHAiOjE3NTI0Mzc2NDcuMjgxNDMsInN1YiI6IjQ0NDgxNTciLCJzY29wZXMiOltdLCJ0ZWFtX2lkIjo0MzU1MTgwLCJ0ZWFtX3BsYW4iOiJmcmVlIiwidGVhbV9wbGFuX2V4cGlyYXRpb24iOjE3NDk4Mjg0MzB9.BdMGSqY7ivZaucnTR2N-BsDgLTKDBjKAx4tH_CeAlK5IMBzmZgadBPN1jgdKoJLiz0tpQoh06K1ZDiW3wUkKfghgerDrrBs5WONQKOmMcLLpCuz6Atq-YDltWfHXh4bGeNJcVJaNyqTay_UDBL8WURH3EXn4IfmI-vQ5WdN7lwYYz-HxX85adDtNB2-gQrDK1I1Jn_wLgFAU2CNjrDjgHCA-fSosEFaIAZ3l92o4ICsVq4woWQUSMMVQ66bKzEztAScGAs-lS6XGf8zOlLMGwDibqGcut7NQRjiep0t98YKiMcWACFsR8BYlJc8zcKw4uVpz_VOSTE5aXMGmHI8upzQeYgJfXd8-MNuNt03nNpnpv4VXC07ZsfO5Jma4k-mKR0F__14xNmy20Tw2fUQaEilfqI2e9ilEdk5PQLejXeS4Sc530GappeXoacT7xz9b_5Ch3gu1d6Ma2h9mwTMf7tORdHRuigHwzq6_Dh-FWY9VLCI2Eg3zvM7MZaptEGKn2myl041WinW3FeSANXE-kw8ov7_Rt-dA4aDU3_-snKIIjPNxJJHchkh7F_ZY9imFGstw0wGSl69Dw5C_BkWeizh8Gmi9YIbbLZFUanJsZOolR6P2Ri3NJCjINN3LJJJu6pIdWZ0WZhmO_zA5MTRnQQ6gH7q7L4-aM8gbo7el394"  
# The ID of the profile you pre-configured with a proxy in Dolphin Anty
DOLPHIN_PROFILE_ID = "619172810"

# Target Website
TARGET_URL = "https://www.spotify.com/bg-bg/signup?forward_url=https%3A%2F%2Fopen.spotify.com%2F"

# --- 2. LEAD DATA MANAGEMENT ---
class LeadManager:
    """Manages leads from the JSON file."""
    def __init__(self):
        self.leads = []
        self.current_lead_index = 0
        self._load_leads()

    def _load_leads(self):
        """Loads leads from the JSON file."""
        try:
            with open('sample_leads.json', 'r') as f:
                self.leads = json.load(f)
            print(f"INFO: Loaded {len(self.leads)} leads from sample_leads.json")
        except Exception as e:
            print(f"ERROR: Failed to load leads: {e}")
            self.leads = []

    def get_next_lead(self):
        """Gets the next available lead."""
        if self.current_lead_index >= len(self.leads):
            return None
        
        lead = self.leads[self.current_lead_index]
        self.current_lead_index += 1
        return lead

    def update_lead_status(self, lead_id, status, message=""):
        """Updates the status of a lead."""
        for lead in self.leads:
            if lead.get('id') == lead_id:
                lead['status'] = status
                lead['message'] = message
                print(f"INFO: Updated lead {lead_id} status to '{status}'.")
                break

# --- 3. DOLPHIN ANTY API INTERACTION ---
class DolphinManager:
    """Manages starting and stopping Dolphin Anty profiles via API."""
    def __init__(self, port, token):
        self.base_url = f"http://localhost:{port}/v1.0"
        self.headers = {"Authorization": f"Bearer {token}"}
        # Test connection on initialization
        self._test_connection()

    def _test_connection(self):
        """Tests the connection to Dolphin Anty API."""
        try:
            test_url = f"{self.base_url}/browser_profiles"
            response = requests.get(test_url, headers=self.headers)
            response.raise_for_status()
            print(f"SUCCESS: Connected to Dolphin Anty API at {self.base_url}")
            return True
        except requests.exceptions.RequestException as e:
            print(f"FATAL: Could not connect to Dolphin Anty API: {e}")
            print("Please check:")
            print("1. Is Dolphin Anty running?")
            print("2. Is the API token valid?")
            print("3. Is the port correct?")
            return False

    def start_profile(self, profile_id):
        """Starts a profile and returns the Selenium remote URL."""
        # First try without automation for free plan users
        start_url = f"{self.base_url}/browser_profiles/{profile_id}/start"
        try:
            print(f"DEBUG: Attempting to start profile {profile_id} at {start_url}")
            response = requests.get(start_url, headers=self.headers)
            print(f"DEBUG: Response status code: {response.status_code}")
            print(f"DEBUG: Response content: {response.text}")
            
            response.raise_for_status()
            data = response.json()
            
            if data.get("success"):
                # For free plan, we'll use the default port
                remote_url = f"http://127.0.0.1:3001"
                print(f"SUCCESS: Dolphin profile {profile_id} started on {remote_url}")
                return remote_url
            else:
                print(f"ERROR: Could not start Dolphin profile. Response: {data}")
                return None
        except requests.exceptions.RequestException as e:
            print(f"FATAL: Dolphin API request failed: {e}")
            print("Hint: Is Dolphin Anty running? Is the API token correct?")
            return None

    def close_profile(self, profile_id):
        """Stops a running Dolphin Anty profile."""
        stop_url = f"{self.base_url}/browser_profiles/{profile_id}/stop"
        try:
            response = requests.get(stop_url, headers=self.headers)
            response.raise_for_status()
            print(f"INFO: Dolphin profile {profile_id} stopped.")
        except requests.exceptions.RequestException as e:
            print(f"WARNING: Could not stop Dolphin profile: {e}")

# --- 4. THE AUTOMATION INJECTOR ---
class Injector:
    """The core class that automates browser actions."""
    def __init__(self, driver):
        self.driver = driver
        self.wait = WebDriverWait(self.driver, 20)

    def _human_like_typing(self, element, text):
        """Simulates human-like typing with random delays."""
        for char in text:
            element.send_keys(char)
            time.sleep(random.uniform(0.05, 0.15))

    def fill_and_submit_form(self, lead_data, url):
        """Navigates to the form, fills it, and submits."""
        try:
            print(f"INFO: Navigating to {url}")
            self.driver.get(url)
            time.sleep(random.uniform(2, 4))  # Wait for page load

            # --- Fill Form Fields ---
            print("INFO: Starting to fill the form...")
            
            # Email
            email_input = self.wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "input[type='email']")))
            self._human_like_typing(email_input, lead_data['newEmail'])
            time.sleep(random.uniform(0.5, 1.0))

            # Password
            password = f"Spotify{random.randint(100000, 999999)}!"  # Generate a strong password
            password_input = self.driver.find_element(By.CSS_SELECTOR, "input[type='password']")
            self._human_like_typing(password_input, password)
            time.sleep(random.uniform(0.5, 1.0))

            # Display Name
            display_name = f"{lead_data['firstName']} {lead_data['lastName']}"
            display_name_input = self.driver.find_element(By.CSS_SELECTOR, "input[name='displayname']")
            self._human_like_typing(display_name_input, display_name)
            time.sleep(random.uniform(0.5, 1.0))

            # Date of Birth
            dob = lead_data.get('dob', '1990-01-01').split('-')
            year_input = self.driver.find_element(By.CSS_SELECTOR, "input[name='year']")
            self._human_like_typing(year_input, dob[0])
            time.sleep(random.uniform(0.3, 0.7))

            month_select = Select(self.driver.find_element(By.CSS_SELECTOR, "select[name='month']"))
            month_select.select_by_value(str(int(dob[1])))
            time.sleep(random.uniform(0.3, 0.7))

            day_input = self.driver.find_element(By.CSS_SELECTOR, "input[name='day']")
            self._human_like_typing(day_input, dob[2])
            time.sleep(random.uniform(0.3, 0.7))

            # Gender
            gender = lead_data.get('gender', 'not_defined').lower()
            if gender != 'not_defined':
                gender_select = Select(self.driver.find_element(By.CSS_SELECTOR, "select[name='gender']"))
                gender_select.select_by_value(gender)
                time.sleep(random.uniform(0.3, 0.7))

            # Terms and Conditions
            terms_checkbox = self.driver.find_element(By.CSS_SELECTOR, "input[name='terms']")
            if not terms_checkbox.is_selected():
                terms_checkbox.click()
            time.sleep(random.uniform(0.3, 0.7))

            # Marketing checkbox (optional)
            marketing_checkbox = self.driver.find_element(By.CSS_SELECTOR, "input[name='marketing']")
            if not marketing_checkbox.is_selected():
                marketing_checkbox.click()
            time.sleep(random.uniform(0.3, 0.7))

            print("SUCCESS: Form filled.")
            
            # --- Submit Form ---
            submit_button = self.driver.find_element(By.CSS_SELECTOR, "button[type='submit']")
            submit_button.click()
            time.sleep(random.uniform(2, 4))

            # --- Verify Success ---
            try:
                # Wait for either success or error message
                success_element = self.wait.until(
                    EC.presence_of_element_located((By.CSS_SELECTOR, ".success-message, .error-message"))
                )
                if "success" in success_element.get_attribute("class"):
                    print("SUCCESS: Account created successfully!")
                    return True, "Account created successfully"
                else:
                    error_msg = success_element.text
                    print(f"ERROR: Registration failed: {error_msg}")
                    return False, error_msg
            except TimeoutException:
                print("WARNING: Could not verify success/failure status")
                return False, "Could not verify registration status"

        except TimeoutException as e:
            error_msg = "A timeout occurred waiting for an element. Page might be slow or selectors are wrong."
            print(f"ERROR: {error_msg}")
            self.driver.save_screenshot(f"error_timeout_{lead_data.get('id', 'unknown')}.png")
            return False, error_msg
        except Exception as e:
            error_msg = f"An unexpected error occurred: {e}"
            print(f"ERROR: {error_msg}")
            self.driver.save_screenshot(f"error_unexpected_{lead_data.get('id', 'unknown')}.png")
            return False, error_msg

# --- 5. MAIN ORCHESTRATOR ---
def main():
    """Main function to run the lead injection process."""
    print("--- Lead Injection Bot Initializing ---")
    
    # Initialize managers
    lead_manager = LeadManager()
    dolphin_manager = DolphinManager(DOLPHIN_API_PORT, DOLPHIN_API_TOKEN)
    
    # Cleanup any running profiles first
    print("INFO: Cleaning up any running profiles...")
    dolphin_manager.close_profile(DOLPHIN_PROFILE_ID)
    time.sleep(2)  # Wait for profile to fully stop
    
    while True:
        lead = lead_manager.get_next_lead()
        if not lead:
            print("INFO: No more leads to process.")
            break
            
        print(f"\n--- Processing Lead: {lead['firstName']} {lead['lastName']} ---")
        
        driver = None
        remote_url = None
        try:
            # 1. Start a clean browser profile for this lead
            remote_url = dolphin_manager.start_profile(DOLPHIN_PROFILE_ID)
            if not remote_url:
                lead_manager.update_lead_status(lead.get('id'), "failed", "Dolphin profile start failed.")
                continue

            # 2. Connect Selenium to the Dolphin profile
            options = webdriver.ChromeOptions()
            options.add_argument("--disable-blink-features=AutomationControlled")
            driver = webdriver.Remote(command_executor=remote_url, options=options)
            driver.maximize_window()

            # 3. Perform the injection
            injector = Injector(driver)
            success, message = injector.fill_and_submit_form(lead, TARGET_URL)
            
            # 4. Update the lead status based on the result
            status = "success" if success else "failed"
            lead_manager.update_lead_status(lead.get('id'), status, message)

        except Exception as e:
            print(f"FATAL: A critical error occurred in the main loop: {e}")
            lead_manager.update_lead_status(lead.get('id'), "failed", str(e))
        finally:
            # 5. Clean up: ALWAYS close the driver and the profile
            if driver:
                print("INFO: Closing Selenium driver...")
                time.sleep(3)  # Keep browser open briefly for observation
                driver.quit()
            
            if remote_url:  # Only try to close if it was started
                dolphin_manager.close_profile(DOLPHIN_PROFILE_ID)
            
            # Pause before processing the next lead
            time.sleep(random.uniform(5, 10))

if __name__ == "__main__":
    main()