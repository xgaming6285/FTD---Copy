#!/usr/bin/env python3
"""
QuantumAI Landing Page Injector with Popup Support
Modified from the original injector to work specifically with QuantumAI forms.
"""

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

class QuantumAIInjector:
    """QuantumAI-specific lead injector with popup support."""
    
    def __init__(self, proxy_config=None):
        self.proxy_config = proxy_config
        self.target_url = None

    def _take_screenshot(self, page, name):
        """Take a screenshot for debugging purposes."""
        try:
            screenshots_dir = Path("screenshots")
            screenshots_dir.mkdir(exist_ok=True)
            screenshot_path = screenshots_dir / f"quantumai_{name}_{int(time.time())}.png"
            page.screenshot(path=str(screenshot_path))
            print(f"INFO: Screenshot saved: {screenshot_path}")
        except Exception as e:
            print(f"WARNING: Could not take screenshot '{name}': {str(e)}")

    def _setup_browser_config(self):
        """Setup browser configuration with proxy if available."""
        config = {
            'headless': False,  # Keep visible for debugging
            'slow_mo': 500,     # Slow down for human-like behavior
            'args': [
                '--disable-blink-features=AutomationControlled',
                '--disable-dev-shm-usage',
                '--disable-extensions',
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-web-security',
                '--allow-running-insecure-content',
                '--disable-features=VizDisplayCompositor'
            ]
        }
        
        if self.proxy_config:
            config['proxy'] = {
                'server': f"http://{self.proxy_config['host']}:{self.proxy_config['port']}",
                'username': self.proxy_config.get('username'),
                'password': self.proxy_config.get('password')
            }
            print(f"INFO: Using proxy: {self.proxy_config['host']}:{self.proxy_config['port']}")
        
        return config

    def _human_like_typing(self, element, text):
        """Simulate human-like typing with random delays."""
        try:
            element.clear()
            for char in str(text):
                element.type(char)
                time.sleep(random.uniform(0.05, 0.15))
        except Exception as e:
            print(f"WARNING: Human-like typing failed: {str(e)}")
            # Fallback to direct fill
            element.fill(str(text))

    def _check_popup_visibility(self, page):
        """Check if the popup is visible on the page."""
        try:
            popup = page.query_selector('#popup_custom')
            if popup:
                style = popup.get_attribute('style')
                is_visible = 'visibility: hidden' not in style if style else True
                print(f"INFO: Popup visibility - Style: {style}, Is Visible: {is_visible}")
                return is_visible
            return False
        except Exception as e:
            print(f"WARNING: Error checking popup visibility: {str(e)}")
            return False

    def _trigger_popup(self, page):
        """Try to trigger the popup by simulating exit-intent behavior."""
        try:
            print("INFO: Attempting to trigger popup with exit-intent simulation...")
            
            # Method 1: Mouse movement to top of page (common exit-intent trigger)
            page.mouse.move(0, 0)
            time.sleep(1)
            
            # Method 2: Scroll behavior
            page.evaluate("window.scrollTo(0, 0)")
            time.sleep(1)
            page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
            time.sleep(1)
            
            # Method 3: Try to simulate leaving the page
            page.evaluate("window.dispatchEvent(new Event('beforeunload'))")
            time.sleep(1)
            
            # Method 4: Mouse movement patterns
            page.mouse.move(100, 100)
            time.sleep(0.5)
            page.mouse.move(0, 0)
            time.sleep(0.5)
            
            return self._check_popup_visibility(page)
            
        except Exception as e:
            print(f"WARNING: Error triggering popup: {str(e)}")
            return False

    def _fill_quantumai_form(self, page, lead_data, form_id):
        """Fill QuantumAI form fields for a specific form."""
        try:
            print(f"INFO: Filling QuantumAI form {form_id}...")
            
            # Determine phone field IDs based on form
            if form_id == "myform1":
                phone_id = "kabelname-1"
                hidden_phone_id = "myText-1"
            elif form_id == "myform2":
                phone_id = "kabelname-2"
                hidden_phone_id = "myText-2"
            elif form_id == "myform3":
                phone_id = "kabelname-3"
                hidden_phone_id = "myText-3"
            else:
                print(f"WARNING: Unknown form ID: {form_id}")
                return False

            form_selector = f'#{form_id}'
            page.wait_for_selector(form_selector, timeout=10000)
            
            # Fill First Name
            first_name_field = page.wait_for_selector(f'{form_selector} input[name="name"]', timeout=5000)
            self._human_like_typing(first_name_field, lead_data.get('firstName', ''))
            print(f"✓ First Name filled: {lead_data.get('firstName', '')}")
            
            # Fill Last Name
            last_name_field = page.wait_for_selector(f'{form_selector} input[name="lastname"]', timeout=5000)
            self._human_like_typing(last_name_field, lead_data.get('lastName', ''))
            print(f"✓ Last Name filled: {lead_data.get('lastName', '')}")
            
            # Fill Email
            email_field = page.wait_for_selector(f'{form_selector} input[name="email"]', timeout=5000)
            self._human_like_typing(email_field, lead_data.get('email', ''))
            print(f"✓ Email filled: {lead_data.get('email', '')}")
            
            # Fill Phone Number
            phone_field = page.wait_for_selector(f'#{phone_id}', timeout=5000)
            self._human_like_typing(phone_field, lead_data.get('phone', ''))
            print(f"✓ Phone filled: {lead_data.get('phone', '')}")
            
            # Set country code in hidden field if provided
            country_code = lead_data.get('country_code', '1')
            try:
                page.evaluate(f'document.getElementById("{hidden_phone_id}").value = "{country_code}"')
                print(f"✓ Country code set: +{country_code}")
            except Exception as e:
                print(f"WARNING: Could not set country code: {str(e)}")
            
            # Check the terms checkbox
            try:
                checkbox_label = page.wait_for_selector(f'{form_selector} .checked-svg', timeout=5000)
                checkbox_label.click()
                print("✓ Terms checkbox checked")
            except Exception as e:
                print(f"WARNING: Could not check terms checkbox: {str(e)}")
            
            return True
            
        except Exception as e:
            print(f"ERROR: Failed to fill form {form_id}: {str(e)}")
            traceback.print_exc()
            return False

    def _submit_quantumai_form(self, page, form_id):
        """Submit the specified QuantumAI form."""
        try:
            print(f"INFO: Submitting QuantumAI form {form_id}...")
            
            # Take a screenshot before clicking submit
            self._take_screenshot(page, f"before_submit_{form_id}")
            
            # Try multiple selectors for the submit button
            submit_selectors = [
                f'#{form_id} button[name="submitBtn"]',
                f'#{form_id} button[type="submit"]',
                f'#{form_id} .btn_send',
                f'#{form_id} button:contains("Register")',
                f'#{form_id} button.btn'
            ]
            
            submit_button = None
            for selector in submit_selectors:
                try:
                    submit_button = page.wait_for_selector(selector, timeout=2000)
                    if submit_button:
                        print(f"INFO: Found submit button using selector: {selector}")
                        break
                except:
                    continue
            
            if not submit_button:
                print(f"ERROR: Could not find submit button for form {form_id}")
                # Try to find any button in the form
                all_buttons = page.query_selector_all(f'#{form_id} button')
                print(f"INFO: Found {len(all_buttons)} buttons in form {form_id}")
                for i, btn in enumerate(all_buttons):
                    btn_text = btn.inner_text()
                    btn_name = btn.get_attribute('name')
                    btn_type = btn.get_attribute('type')
                    print(f"  Button {i}: text='{btn_text}', name='{btn_name}', type='{btn_type}'")
                return False
            
            # Scroll the submit button into view
            submit_button.scroll_into_view_if_needed()
            time.sleep(0.5)
            
            # Click the submit button
            print(f"INFO: Clicking submit button for form {form_id}...")
            submit_button.click()
            print(f"✓ Submit button clicked for form {form_id}")
            
            # Wait a moment and take another screenshot
            time.sleep(2)
            self._take_screenshot(page, f"after_submit_{form_id}")
            
            # Check if form submission was successful by looking for changes
            try:
                # Look for common success indicators
                success_indicators = [
                    'text="Thank you"',
                    'text="Success"',
                    'text="Submitted"',
                    '.success',
                    '.thank-you'
                ]
                
                for indicator in success_indicators:
                    try:
                        if page.wait_for_selector(indicator, timeout=1000):
                            print(f"✓ Success indicator found: {indicator}")
                            break
                    except:
                        continue
                        
            except Exception as e:
                print(f"INFO: No explicit success indicator found: {str(e)}")
            
            print(f"✓ Form {form_id} submission completed")
            return True
            
        except Exception as e:
            print(f"ERROR: Failed to submit form {form_id}: {str(e)}")
            traceback.print_exc()
            self._take_screenshot(page, f"submit_error_{form_id}")
            return False

    def inject_lead(self, lead_data, target_url):
        """Main injection method for QuantumAI with popup detection."""
        browser = None
        try:
            self.target_url = target_url
            
            with sync_playwright() as p:
                print("INFO: Launching browser for QuantumAI injection...")
                browser = p.chromium.launch(**self._setup_browser_config())
                
                # Create context with desktop settings for QuantumAI
                context = browser.new_context(
                    viewport={'width': 1366, 'height': 768},
                    user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                )
                
                page = context.new_page()
                
                # Navigate to target URL
                print(f"INFO: Navigating to QuantumAI page: {target_url}")
                page.goto(target_url, wait_until="domcontentloaded", timeout=30000)
                
                # Take initial screenshot
                self._take_screenshot(page, "initial_load")
                
                # Wait for page to fully load
                time.sleep(3)
                
                # Check if popup is visible initially
                popup_visible = self._check_popup_visibility(page)
                
                if not popup_visible:
                    print("INFO: Popup not immediately visible, attempting to trigger it...")
                    popup_visible = self._trigger_popup(page)
                
                success = False
                
                # Determine which form to fill based on popup visibility
                if popup_visible:
                    print("INFO: Popup is visible - filling popup form (highest priority)")
                    self._take_screenshot(page, "popup_detected")
                    
                    success = self._fill_quantumai_form(page, lead_data, "myform3")
                    if success:
                        success = self._submit_quantumai_form(page, "myform3")
                        if success:
                            self._take_screenshot(page, "popup_form_submitted")
                            print("SUCCESS: Popup form submitted successfully!")
                
                if not success:
                    # Try main form
                    print("INFO: Filling main QuantumAI form (myform1)")
                    page.evaluate("document.getElementById('signin').scrollIntoView({behavior: 'smooth'})")
                    time.sleep(2)
                    
                    success = self._fill_quantumai_form(page, lead_data, "myform1")
                    if success:
                        success = self._submit_quantumai_form(page, "myform1")
                        if success:
                            self._take_screenshot(page, "main_form_submitted")
                            print("SUCCESS: Main form submitted successfully!")
                
                if not success:
                    # Try footer form as last resort
                    print("INFO: Trying footer form as last resort (myform2)")
                    page.evaluate("document.getElementById('contacts').scrollIntoView({behavior: 'smooth'})")
                    time.sleep(2)
                    
                    success = self._fill_quantumai_form(page, lead_data, "myform2")
                    if success:
                        success = self._submit_quantumai_form(page, "myform2")
                        if success:
                            self._take_screenshot(page, "footer_form_submitted")
                            print("SUCCESS: Footer form submitted successfully!")
                
                if success:
                    # Wait for redirects
                    print("INFO: Waiting for redirects...")
                    time.sleep(10)
                    final_url = page.url
                    print(f"INFO: Final URL: {final_url}")
                    self._take_screenshot(page, "final_result")
                    return True
                else:
                    print("ERROR: All QuantumAI form submission attempts failed")
                    self._take_screenshot(page, "all_forms_failed")
                    return False
                
        except Exception as e:
            print(f"ERROR: QuantumAI injection failed: {str(e)}")
            traceback.print_exc()
            if browser:
                try:
                    page = browser.contexts[0].pages[0] if browser.contexts and browser.contexts[0].pages else None
                    if page:
                        self._take_screenshot(page, "error_state")
                except:
                    pass
            return False
        finally:
            if browser:
                try:
                    browser.close()
                except:
                    pass

def main():
    """Main function to run the QuantumAI injector."""
    if len(sys.argv) != 2:
        print("Usage: python quantumai_injector_playwright.py '<lead_data_json>'")
        sys.exit(1)
    
    try:
        lead_data = json.loads(sys.argv[1])
        print(f"INFO: Starting QuantumAI injection with lead data:")
        print(f"  - Name: {lead_data.get('firstName', '')} {lead_data.get('lastName', '')}")
        print(f"  - Email: {lead_data.get('email', '')}")
        print(f"  - Phone: {lead_data.get('phone', '')}")
        print(f"  - Country: {lead_data.get('country', '')}")
        
        # Extract target URL from lead data or use default
        target_url = lead_data.get('targetUrl', 'https://k8ro.info/bKkkBWkK')
        
        # Initialize injector
        injector = QuantumAIInjector()
        
        # Perform injection
        success = injector.inject_lead(lead_data, target_url)
        
        if success:
            print("SUCCESS: QuantumAI lead injection completed successfully!")
            sys.exit(0)
        else:
            print("ERROR: QuantumAI lead injection failed!")
            sys.exit(1)
            
    except json.JSONDecodeError as e:
        print(f"ERROR: Invalid JSON data: {str(e)}")
        sys.exit(1)
    except Exception as e:
        print(f"ERROR: Unexpected error: {str(e)}")
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main() 