#!/usr/bin/env python3
"""
Agent Session Browser Script
This script restores a browser session for agents to access stored FTD sessions.
It receives session data from the Node.js backend and opens a browser with the restored session.
"""

import sys
import json
import asyncio
import logging
from datetime import datetime
from playwright.async_api import async_playwright
import argparse
import os

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('agent_session_browser.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class AgentSessionBrowser:
    def __init__(self, session_data):
        self.session_data = session_data
        self.browser = None
        self.context = None
        self.page = None
        
    async def setup_browser(self):
        """Initialize the browser with session configuration"""
        try:
            logger.info("🚀 Initializing browser for session restoration...")
            
            playwright = await async_playwright().start()
            
            # Get fingerprint configuration if available
            fingerprint = self.session_data.get('fingerprint')
            is_test_mode = self.session_data.get('metadata', {}).get('testMode', False)
            
            # Determine device configuration from fingerprint or defaults
            if fingerprint:
                device_config = self._create_device_config_from_fingerprint(fingerprint)
                logger.info(f"📱 Using {fingerprint.get('deviceType', 'unknown')} device configuration from fingerprint")
                logger.info(f"📐 Viewport: {device_config['viewport']['width']}x{device_config['viewport']['height']}")
                logger.info(f"🖥️ Mobile: {device_config.get('is_mobile', False)}")
            else:
                # Use viewport from session data or defaults
                viewport = self.session_data.get('viewport', {'width': 1366, 'height': 768})
                device_config = {
                    'viewport': viewport,
                    'user_agent': self.session_data.get('userAgent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'),
                    'is_mobile': False,
                    'has_touch': False,
                    'device_scale_factor': 1
                }
                logger.info(f"🖥️ Using default desktop configuration: {viewport['width']}x{viewport['height']}")
            
            # Browser launch options
            browser_options = {
                'headless': False,  # Always show browser for agent interaction
                'slow_mo': 100,     # Slight delay for better visibility
                'args': [
                    '--disable-blink-features=AutomationControlled',
                    '--disable-web-security',
                    '--disable-features=VizDisplayCompositor',
                    '--no-first-run',
                    '--no-default-browser-check',
                    '--disable-extensions-except=/path/to/extension',
                    '--load-extension=/path/to/extension',
                    f'--window-size={device_config["viewport"]["width"]},{device_config["viewport"]["height"]}'
                ]
            }
            
            # Launch browser
            self.browser = await playwright.chromium.launch(**browser_options)
            
            # Create context with device configuration
            context_options = {
                'viewport': device_config['viewport'],
                'user_agent': device_config.get('user_agent', ''),
                'is_mobile': device_config.get('is_mobile', False),
                'has_touch': device_config.get('has_touch', False),
                'device_scale_factor': device_config.get('device_scale_factor', 1),
                'ignore_https_errors': True,
                'java_script_enabled': True,
                'accept_downloads': True,
            }
            
            # Add cookies if available
            if 'cookies' in self.session_data and self.session_data['cookies']:
                # Convert cookies to Playwright format
                playwright_cookies = []
                for cookie in self.session_data['cookies']:
                    playwright_cookie = {
                        'name': cookie['name'],
                        'value': cookie['value'],
                        'domain': cookie.get('domain', ''),
                        'path': cookie.get('path', '/'),
                        'httpOnly': cookie.get('httpOnly', False),
                        'secure': cookie.get('secure', False),
                        'sameSite': cookie.get('sameSite', 'Lax')
                    }
                    
                    # Add expires if present
                    if 'expires' in cookie and cookie['expires']:
                        try:
                            if isinstance(cookie['expires'], str):
                                # Parse ISO date string
                                expires_date = datetime.fromisoformat(cookie['expires'].replace('Z', '+00:00'))
                                playwright_cookie['expires'] = expires_date.timestamp()
                            elif isinstance(cookie['expires'], (int, float)):
                                playwright_cookie['expires'] = cookie['expires']
                        except Exception as e:
                            logger.warning(f"Could not parse cookie expires date: {e}")
                    
                    playwright_cookies.append(playwright_cookie)
                
                logger.info(f"🍪 Prepared {len(playwright_cookies)} cookies for restoration")
            
            self.context = await self.browser.new_context(**context_options)
            
            # Add cookies to context if available
            if 'cookies' in self.session_data and self.session_data['cookies']:
                try:
                    await self.context.add_cookies(playwright_cookies)
                    logger.info(f"✅ Added {len(playwright_cookies)} cookies to browser context")
                except Exception as e:
                    logger.error(f"❌ Error adding cookies: {e}")
            
            # Create new page
            self.page = await self.context.new_page()
            
            # Apply fingerprint properties if available
            if fingerprint:
                await self._apply_fingerprint_to_page(self.page, fingerprint)
            
            logger.info("✅ Browser setup completed successfully")
            return True
            
        except Exception as e:
            logger.error(f"❌ Error setting up browser: {e}")
            return False

    def _create_device_config_from_fingerprint(self, fingerprint):
        """Create Playwright device configuration from fingerprint data."""
        screen = fingerprint.get('screen', {})
        navigator = fingerprint.get('navigator', {})
        mobile = fingerprint.get('mobile', {})

        return {
            'viewport': {
                'width': screen.get('availWidth', screen.get('width', 1366)),
                'height': screen.get('availHeight', screen.get('height', 768))
            },
            'device_scale_factor': screen.get('devicePixelRatio', 1),
            'is_mobile': mobile.get('isMobile', False),
            'has_touch': navigator.get('maxTouchPoints', 0) > 0,
            'user_agent': navigator.get('userAgent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')
        }

    async def _apply_fingerprint_to_page(self, page, fingerprint):
        """Apply fingerprint properties to the page context."""
        try:
            # Set injection mode flag first (most important)
            await page.evaluate("() => { localStorage.setItem('isInjectionMode', 'true'); }")
            logger.info("INFO: Set injection mode flag for the landing page")

            # Apply fingerprint properties
            navigator = fingerprint.get('navigator', {})
            screen = fingerprint.get('screen', {})
            mobile = fingerprint.get('mobile', {})

            # Apply device-specific properties
            await page.evaluate(f"""() => {{
                try {{
                    // Set basic navigator properties
                    Object.defineProperty(navigator, 'platform', {{
                        get: () => {json.dumps(navigator.get('platform', 'Win32'))}
                    }});
                    
                    Object.defineProperty(navigator, 'hardwareConcurrency', {{
                        get: () => {navigator.get('hardwareConcurrency', 4)}
                    }});
                    
                    Object.defineProperty(navigator, 'deviceMemory', {{
                        get: () => {navigator.get('deviceMemory', 8)}
                    }});
                    
                    Object.defineProperty(navigator, 'maxTouchPoints', {{
                        get: () => {navigator.get('maxTouchPoints', 0)}
                    }});

                    // Set screen properties
                    Object.defineProperty(screen, 'width', {{
                        get: () => {screen.get('width', 1366)}
                    }});
                    
                    Object.defineProperty(screen, 'height', {{
                        get: () => {screen.get('height', 768)}
                    }});
                    
                    Object.defineProperty(screen, 'availWidth', {{
                        get: () => {screen.get('availWidth', screen.get('width', 1366))}
                    }});
                    
                    Object.defineProperty(screen, 'availHeight', {{
                        get: () => {screen.get('availHeight', screen.get('height', 768))}
                    }});
                    
                    Object.defineProperty(screen, 'colorDepth', {{
                        get: () => {screen.get('colorDepth', 24)}
                    }});
                    
                    Object.defineProperty(screen, 'pixelDepth', {{
                        get: () => {screen.get('pixelDepth', 24)}
                    }});

                    // Set injection mode flag (redundant but important)
                    localStorage.setItem('isInjectionMode', 'true');

                    console.log('Fingerprint properties applied successfully');
                    console.log('Device type: {fingerprint.get("deviceType", "unknown")}');
                    console.log('Screen: {screen.get("width", 1366)}x{screen.get("height", 768)}');
                    console.log('Mobile: {mobile.get("isMobile", False)}');
                }} catch (error) {{
                    console.error('Error applying fingerprint:', error);
                    // Ensure injection mode is still set
                    localStorage.setItem('isInjectionMode', 'true');
                }}
            }};""")

            logger.info(f"INFO: Applied fingerprint properties for device: {fingerprint.get('deviceId', 'unknown')} ({fingerprint.get('deviceType', 'unknown')})")

        except Exception as e:
            logger.error(f"WARNING: Failed to apply fingerprint properties: {str(e)}")
            # Always ensure injection mode is set
            try:
                await page.evaluate("() => { localStorage.setItem('isInjectionMode', 'true'); }")
                logger.info("INFO: Set injection mode flag despite fingerprint error")
            except Exception as e2:
                logger.error(f"WARNING: Could not set injection mode flag: {str(e2)}")

    async def restore_session_storage(self):
        """Restore localStorage and sessionStorage data"""
        try:
            # Restore localStorage
            if 'localStorage' in self.session_data and self.session_data['localStorage']:
                local_storage = self.session_data['localStorage']
                await self.page.evaluate("""
                    (localStorageData) => {
                        for (const [key, value] of Object.entries(localStorageData)) {
                            try {
                                window.localStorage.setItem(key, value);
                            } catch (e) {
                                console.warn(`Failed to set localStorage item: ${key}`, e);
                            }
                        }
                    }
                """, local_storage)
                logger.info(f"💾 Restored {len(local_storage)} localStorage items")
            
            # Restore sessionStorage
            if 'sessionStorage' in self.session_data and self.session_data['sessionStorage']:
                session_storage = self.session_data['sessionStorage']
                await self.page.evaluate("""
                    (sessionStorageData) => {
                        for (const [key, value] of Object.entries(sessionStorageData)) {
                            try {
                                window.sessionStorage.setItem(key, value);
                            } catch (e) {
                                console.warn(`Failed to set sessionStorage item: ${key}`, e);
                            }
                        }
                    }
                """, session_storage)
                logger.info(f"🗂️ Restored {len(session_storage)} sessionStorage items")
                
        except Exception as e:
            logger.error(f"❌ Error restoring storage data: {e}")

    async def navigate_to_domain(self):
        """Navigate to the stored domain or Google homepage"""
        try:
            domain = self.session_data.get('domain')
            target_url = None
            
            if domain:
                # Ensure domain has protocol
                if not domain.startswith(('http://', 'https://')):
                    domain = f'https://{domain}'
                target_url = domain
                logger.info(f"🌐 Navigating to stored domain: {domain}")
            else:
                # Navigate to Google homepage if no domain specified
                target_url = 'https://www.google.com'
                logger.info("🌐 No domain specified, navigating to Google homepage")
            
            # Navigate with extended timeout
            await self.page.goto(target_url, wait_until='domcontentloaded', timeout=30000)
            
            # Wait a bit for any dynamic content to load
            await self.page.wait_for_timeout(2000)
            
            logger.info(f"✅ Successfully navigated to {target_url}")
            return True
            
        except Exception as e:
            logger.error(f"❌ Error navigating to {target_url}: {e}")
            # Try navigating to Google homepage as fallback
            try:
                logger.info("🔄 Attempting fallback navigation to Google homepage...")
                await self.page.goto('https://www.google.com', wait_until='domcontentloaded', timeout=30000)
                await self.page.wait_for_timeout(2000)
                logger.info("✅ Successfully navigated to Google homepage (fallback)")
                return True
            except Exception as fallback_error:
                logger.error(f"❌ Fallback navigation also failed: {fallback_error}")
                return False

    async def setup_page_info(self):
        """Add informational elements to the page"""
        try:
            lead_info = self.session_data.get('leadInfo', {})
            session_id = self.session_data.get('sessionId', 'Unknown')
            is_test_mode = self.session_data.get('metadata', {}).get('testMode', False)
            fingerprint = self.session_data.get('fingerprint')
            
            # Determine device info for banner
            device_info = "Desktop"
            if fingerprint:
                device_type = fingerprint.get('deviceType', 'unknown')
                screen = fingerprint.get('screen', {})
                device_info = f"{device_type.upper()} ({screen.get('width', '?')}x{screen.get('height', '?')})"
            elif self.session_data.get('viewport'):
                viewport = self.session_data.get('viewport')
                device_info = f"Desktop ({viewport.get('width', '?')}x{viewport.get('height', '?')})"
            
            # Add session info banner to the page
            banner_text = "🔗 FTD Session Restored" if not is_test_mode else "🧪 FTD Test Mode"
            
            await self.page.evaluate("""
                (info) => {
                    // Create info banner
                    const banner = document.createElement('div');
                    banner.id = 'session-info-banner';
                    banner.style.cssText = `
                        position: fixed;
                        top: 0;
                        left: 0;
                        right: 0;
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        color: white;
                        padding: 10px 20px;
                        font-family: Arial, sans-serif;
                        font-size: 14px;
                        z-index: 10000;
                        box-shadow: 0 2px 10px rgba(0,0,0,0.3);
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    `;
                    
                    banner.innerHTML = `
                        <div>
                            <strong>${info.bannerText}</strong> - 
                            Lead: ${info.leadName} (${info.email}) | 
                            Device: ${info.deviceInfo} | 
                            Session: ${info.sessionId.substring(0, 16)}...
                        </div>
                        <button onclick="this.parentElement.style.display='none'" 
                                style="background: rgba(255,255,255,0.2); border: none; color: white; padding: 5px 10px; border-radius: 3px; cursor: pointer;">
                            ✕
                        </button>
                    `;
                    
                    document.body.appendChild(banner);
                    
                    // Adjust body padding to account for banner
                    document.body.style.paddingTop = '50px';
                    
                    // Auto-hide after 10 seconds
                    setTimeout(() => {
                        if (banner.parentElement) {
                            banner.style.opacity = '0';
                            banner.style.transition = 'opacity 0.5s';
                            setTimeout(() => {
                                if (banner.parentElement) {
                                    banner.parentElement.removeChild(banner);
                                    document.body.style.paddingTop = '0';
                                }
                            }, 500);
                        }
                    }, 10000);
                }
            """, {
                'bannerText': banner_text,
                'leadName': f"{lead_info.get('firstName', '')} {lead_info.get('lastName', '')}".strip(),
                'email': lead_info.get('email', ''),
                'deviceInfo': device_info,
                'sessionId': session_id
            })
            
            logger.info("📋 Added session information banner to page")
            
        except Exception as e:
            logger.error(f"❌ Error setting up page info: {e}")

    async def auto_fill_ftd_form(self):
        """Auto-fill the FTD form if in test mode and on FTD domain"""
        try:
            is_test_mode = self.session_data.get('metadata', {}).get('testMode', False)
            current_url = self.page.url
            
            if not is_test_mode:
                logger.info("ℹ️ Not in test mode, skipping auto-fill")
                return
                
            if 'ftd-copy.vercel.app' not in current_url:
                logger.info("ℹ️ Not on FTD domain, skipping auto-fill")
                return
                
            lead_info = self.session_data.get('leadInfo', {})
            if not lead_info:
                logger.warning("⚠️ No lead info available for auto-fill")
                return
                
            logger.info("🖊️ Attempting to auto-fill FTD form...")
            
            # Wait for form elements to be available
            await self.page.wait_for_timeout(3000)
            
            # Set injection mode flag
            await self.page.evaluate("() => { localStorage.setItem('isInjectionMode', 'true'); }")
            
            # Try to fill form fields
            form_filled = False
            
            try:
                # Fill first name
                if lead_info.get('firstName'):
                    first_name_filled = await self.page.fill('input[name="firstName"], input[id="firstName"], input[placeholder*="first" i]', lead_info['firstName'])
                    if first_name_filled:
                        logger.info(f"✅ Filled first name: {lead_info['firstName']}")
                        form_filled = True
            except Exception as e:
                logger.warning(f"⚠️ Could not fill first name: {e}")
                
            try:
                # Fill last name
                if lead_info.get('lastName'):
                    await self.page.fill('input[name="lastName"], input[id="lastName"], input[placeholder*="last" i]', lead_info['lastName'])
                    logger.info(f"✅ Filled last name: {lead_info['lastName']}")
                    form_filled = True
            except Exception as e:
                logger.warning(f"⚠️ Could not fill last name: {e}")
                
            try:
                # Fill email
                if lead_info.get('email'):
                    await self.page.fill('input[type="email"], input[name="email"], input[id="email"]', lead_info['email'])
                    logger.info(f"✅ Filled email: {lead_info['email']}")
                    form_filled = True
            except Exception as e:
                logger.warning(f"⚠️ Could not fill email: {e}")
                
            try:
                # Fill phone
                if lead_info.get('phone'):
                    await self.page.fill('input[type="tel"], input[name="phone"], input[id="phone"]', lead_info['phone'])
                    logger.info(f"✅ Filled phone: {lead_info['phone']}")
                    form_filled = True
            except Exception as e:
                logger.warning(f"⚠️ Could not fill phone: {e}")
                
            try:
                # Select country if available
                if lead_info.get('country'):
                    # Try different country selection methods
                    country_selectors = [
                        'select[name="country"]',
                        'select[id="country"]', 
                        'select[class*="country"]'
                    ]
                    
                    for selector in country_selectors:
                        try:
                            await self.page.select_option(selector, lead_info['country'])
                            logger.info(f"✅ Selected country: {lead_info['country']}")
                            form_filled = True
                            break
                        except:
                            continue
            except Exception as e:
                logger.warning(f"⚠️ Could not select country: {e}")
            
            if form_filled:
                logger.info("✅ FTD form auto-fill completed successfully")
                
                # Add a visual indicator that form was auto-filled
                await self.page.evaluate("""
                    () => {
                        const indicator = document.createElement('div');
                        indicator.style.cssText = `
                            position: fixed;
                            top: 60px;
                            right: 20px;
                            background: #4CAF50;
                            color: white;
                            padding: 10px 15px;
                            border-radius: 5px;
                            font-family: Arial, sans-serif;
                            font-size: 12px;
                            z-index: 10001;
                            box-shadow: 0 2px 10px rgba(0,0,0,0.3);
                        `;
                        indicator.textContent = '✅ Form Auto-Filled';
                        document.body.appendChild(indicator);
                        
                        // Auto-remove after 5 seconds
                        setTimeout(() => {
                            if (indicator.parentElement) {
                                indicator.parentElement.removeChild(indicator);
                            }
                        }, 5000);
                    }
                """)
            else:
                logger.warning("⚠️ No form fields were successfully filled")
                
        except Exception as e:
            logger.error(f"❌ Error during auto-fill: {e}")

    async def keep_browser_open(self):
        """Keep the browser open for agent interaction"""
        try:
            logger.info("🔄 Browser is ready for agent interaction")
            logger.info("💡 Instructions:")
            logger.info("   - The browser session has been restored with the FTD lead's data")
            logger.info("   - You can continue from where the injection left off")
            logger.info("   - Close the browser window when you're finished")
            
            # Wait for the browser to be closed
            await self.context.wait_for_event('close')
            logger.info("🔚 Browser session ended")
            
        except Exception as e:
            logger.error(f"❌ Error during browser session: {e}")

    async def run(self):
        """Main execution flow"""
        try:
            fingerprint = self.session_data.get('fingerprint')
            device_type = fingerprint.get('deviceType', 'desktop') if fingerprint else 'desktop'
            
            logger.info("🎯 Starting agent session restoration...")
            logger.info(f"📋 Lead: {self.session_data.get('leadInfo', {}).get('firstName', '')} {self.session_data.get('leadInfo', {}).get('lastName', '')}")
            logger.info(f"🔑 Session ID: {self.session_data.get('sessionId', 'Unknown')}")
            logger.info(f"🌐 Domain: {self.session_data.get('domain', 'Not specified')}")
            logger.info(f"📱 Device Type: {device_type}")
            
            if fingerprint:
                screen = fingerprint.get('screen', {})
                logger.info(f"📐 Screen Resolution: {screen.get('width', '?')}x{screen.get('height', '?')}")
                logger.info(f"🖥️ Mobile Device: {fingerprint.get('mobile', {}).get('isMobile', False)}")
            
            # Setup browser
            if not await self.setup_browser():
                logger.error("❌ Failed to setup browser")
                return False
            
            # Navigate to domain first (before restoring storage)
            navigation_success = await self.navigate_to_domain()
            
            # Restore storage data
            await self.restore_session_storage()
            
            # If we have a domain and navigation failed initially, try again after storage restoration
            if self.session_data.get('domain') and not navigation_success:
                logger.info("🔄 Retrying navigation after storage restoration...")
                navigation_success = await self.navigate_to_domain()
            
            # If still no successful navigation, ensure we're at least on Google homepage
            if not navigation_success:
                try:
                    logger.info("🔄 Final attempt: navigating to Google homepage...")
                    await self.page.goto('https://www.google.com', wait_until='domcontentloaded', timeout=30000)
                    logger.info("✅ Successfully navigated to Google homepage")
                except Exception as e:
                    logger.warning(f"⚠️ Even Google homepage navigation failed: {e}")
                    # Continue anyway - agent can manually navigate
            
            # Setup page information
            await self.setup_page_info()
            
            # Auto-fill FTD form if in test mode and on FTD domain
            await self.auto_fill_ftd_form()
            
            # Keep browser open for agent interaction
            await self.keep_browser_open()
            
            return True
            
        except Exception as e:
            logger.error(f"❌ Error during session restoration: {e}")
            return False
        
        finally:
            # Cleanup
            try:
                if self.browser:
                    await self.browser.close()
                    logger.info("🧹 Browser cleanup completed")
            except Exception as e:
                logger.error(f"❌ Error during cleanup: {e}")

def main():
    """Main entry point"""
    try:
        # Parse command line arguments
        parser = argparse.ArgumentParser(description='Restore browser session for agent access')
        parser.add_argument('session_data', help='JSON string containing session data')
        parser.add_argument('--debug', action='store_true', help='Enable debug logging')
        
        args = parser.parse_args()
        
        if args.debug:
            logging.getLogger().setLevel(logging.DEBUG)
        
        # Parse session data
        try:
            session_data = json.loads(args.session_data)
        except json.JSONDecodeError as e:
            logger.error(f"❌ Invalid JSON in session data: {e}")
            sys.exit(1)
        
        # Validate required fields
        required_fields = ['leadId', 'sessionId']
        missing_fields = [field for field in required_fields if field not in session_data]
        if missing_fields:
            logger.error(f"❌ Missing required fields: {missing_fields}")
            sys.exit(1)
        
        # Create and run session browser
        browser = AgentSessionBrowser(session_data)
        success = asyncio.run(browser.run())
        
        if success:
            logger.info("✅ Session restoration completed successfully")
            sys.exit(0)
        else:
            logger.error("❌ Session restoration failed")
            sys.exit(1)
            
    except KeyboardInterrupt:
        logger.info("🛑 Session restoration interrupted by user")
        sys.exit(0)
    except Exception as e:
        logger.error(f"💥 Unexpected error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main() 