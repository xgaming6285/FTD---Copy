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
                    f'--window-size={self.session_data.get("viewport", {}).get("width", 1366)},{self.session_data.get("viewport", {}).get("height", 768)}'
                ]
            }
            
            # Launch browser
            self.browser = await playwright.chromium.launch(**browser_options)
            
            # Create context with session configuration
            context_options = {
                'viewport': self.session_data.get('viewport', {'width': 1366, 'height': 768}),
                'user_agent': self.session_data.get('userAgent', ''),
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
            
            logger.info("✅ Browser setup completed successfully")
            return True
            
        except Exception as e:
            logger.error(f"❌ Error setting up browser: {e}")
            return False

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
        """Navigate to the stored domain"""
        try:
            domain = self.session_data.get('domain')
            if not domain:
                logger.warning("⚠️ No domain specified in session data")
                return False
            
            # Ensure domain has protocol
            if not domain.startswith(('http://', 'https://')):
                domain = f'https://{domain}'
            
            logger.info(f"🌐 Navigating to: {domain}")
            
            # Navigate with extended timeout
            await self.page.goto(domain, wait_until='domcontentloaded', timeout=30000)
            
            # Wait a bit for any dynamic content to load
            await self.page.wait_for_timeout(2000)
            
            logger.info(f"✅ Successfully navigated to {domain}")
            return True
            
        except Exception as e:
            logger.error(f"❌ Error navigating to domain: {e}")
            return False

    async def setup_page_info(self):
        """Add informational elements to the page"""
        try:
            lead_info = self.session_data.get('leadInfo', {})
            session_id = self.session_data.get('sessionId', 'Unknown')
            
            # Add session info banner to the page
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
                            <strong>🔗 FTD Session Restored</strong> - 
                            Lead: ${info.leadName} (${info.email}) | 
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
                'leadName': f"{lead_info.get('firstName', '')} {lead_info.get('lastName', '')}".strip(),
                'email': lead_info.get('email', ''),
                'sessionId': session_id
            })
            
            logger.info("📋 Added session information banner to page")
            
        except Exception as e:
            logger.error(f"❌ Error setting up page info: {e}")

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
            logger.info("🎯 Starting agent session restoration...")
            logger.info(f"📋 Lead: {self.session_data.get('leadInfo', {}).get('firstName', '')} {self.session_data.get('leadInfo', {}).get('lastName', '')}")
            logger.info(f"🔑 Session ID: {self.session_data.get('sessionId', 'Unknown')}")
            logger.info(f"🌐 Domain: {self.session_data.get('domain', 'Not specified')}")
            
            # Setup browser
            if not await self.setup_browser():
                logger.error("❌ Failed to setup browser")
                return False
            
            # Navigate to domain first (before restoring storage)
            if not await self.navigate_to_domain():
                # If navigation fails, try to navigate to a generic page
                logger.warning("⚠️ Navigation failed, opening blank page")
                await self.page.goto('about:blank')
            
            # Restore storage data
            await self.restore_session_storage()
            
            # If we have a domain and navigation failed initially, try again after storage restoration
            if self.session_data.get('domain') and not await self.navigate_to_domain():
                logger.warning("⚠️ Second navigation attempt failed")
            
            # Setup page information
            await self.setup_page_info()
            
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