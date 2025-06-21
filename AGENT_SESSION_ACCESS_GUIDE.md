# Agent Session Access System Guide

## Overview

The Agent Session Access System allows agents to access browser sessions created during FTD (Fake Traffic Data) injection processes. When an affiliate manager completes an FTD injection and registers on a website (like mail.com), all browser data (cookies, localStorage, sessionStorage) is captured and stored. Later, when this FTD is assigned to an agent, the agent can open a Chromium browser with all the saved session data, allowing them to access websites without needing to log in again.

## 🚀 Key Features

### For Agents
- **One-Click Access**: Click the green browser icon next to FTD leads to open Chromium
- **Pre-Authenticated Sessions**: Access websites with saved login credentials
- **Google Homepage Start**: Browser opens to Google homepage for easy navigation
- **Session Persistence**: All cookies and login data are preserved
- **Visual Indicators**: Color-coded buttons show session health status

### For System
- **Secure Storage**: All session data is encrypted in the database
- **Session Validation**: Integrity checks prevent tampering
- **Access Control**: Only assigned agents can access their leads' sessions
- **Audit Logging**: All session access is logged for security

## 🎯 How It Works

### 1. FTD Injection Process
1. Affiliate manager creates FTD lead
2. Uses injection system to register on target website
3. System captures all browser data:
   - Cookies (authentication tokens, preferences)
   - localStorage (app data, settings)
   - sessionStorage (temporary data)
   - User agent and viewport settings

### 2. Session Storage
1. Captured data is encrypted and stored in MongoDB
2. Session gets unique ID and metadata
3. Associated with the specific FTD lead

### 3. Agent Assignment
1. FTD lead is assigned to an agent
2. Agent sees green browser icon in leads list
3. Agent can access session with one click

### 4. Session Restoration
1. Agent clicks browser icon
2. System validates permissions and session integrity
3. Launches Python script with session data
4. Chromium opens with all saved data restored
5. Agent can navigate to any website with preserved logins

## 🖥️ User Interface

### In Leads Page
- **Green Browser Icon**: Appears next to FTD leads with active sessions
- **Color Coding**:
  - 🟢 Green: Active session (healthy)
  - 🟡 Yellow: Session expiring soon (within 7 days)
  - 🔴 Red: Session expired
- **Tooltip**: Hover for session information

### In Lead Details
- **Session Status**: Shows active/inactive/expired
- **Session Metadata**: Creation date, last access, domain
- **Data Summary**: Number of cookies, localStorage items, etc.
- **"Open Chromium" Button**: Full button for session access

## 🔧 Technical Implementation

### Backend Components

#### 1. Session Storage (`backend/models/Lead.js`)
```javascript
browserSession: {
  sessionId: String,
  cookies: [CookieSchema],
  localStorage: Object,
  sessionStorage: Object,
  userAgent: String,
  viewport: { width: Number, height: Number },
  isActive: Boolean,
  metadata: {
    domain: String,
    success: Boolean,
    injectionType: String
  }
}
```

#### 2. Session Service (`backend/services/browserSessionService.js`)
- `captureSession()`: Extract data from Playwright page
- `storeSession()`: Encrypt and save to database
- `restoreSession()`: Decrypt and restore to browser
- `validateSession()`: Check integrity and expiration

#### 3. API Endpoint (`backend/controllers/leads.js`)
- `POST /api/leads/:id/access-session`
- Validates permissions and session integrity
- Launches Python restoration script
- Logs access for security audit

### Frontend Components

#### 1. SessionAccessButton (`frontend/src/components/SessionAccessButton.jsx`)
- Permission checking
- Session health monitoring
- Visual status indicators
- API integration for session access

#### 2. SessionStatusChip (`frontend/src/components/SessionStatusChip.jsx`)
- Visual session status display
- Color-coded status indicators
- Expiration warnings

#### 3. LeadsPage Integration
- Browser icons in leads table
- Mobile-responsive design
- Tooltip information

### Python Script (`agent_session_browser.py`)

#### Key Functions
- `setup_browser()`: Initialize Chromium with session config
- `restore_session_storage()`: Restore localStorage/sessionStorage
- `navigate_to_domain()`: Navigate to stored domain or Google
- `setup_page_info()`: Add session info banner
- `keep_browser_open()`: Wait for agent interaction

#### Navigation Logic
1. Try to navigate to stored domain (if available)
2. If no domain or navigation fails, go to Google homepage
3. Add session info banner to page
4. Keep browser open for agent use

## 🔐 Security Features

### Data Protection
- **Encryption**: All session data encrypted before storage
- **Integrity Checks**: Detect tampering attempts
- **Session Validation**: Verify data structure and expiration

### Access Control
- **Role-Based**: Only agents can access assigned leads
- **Permission Validation**: Server-side permission checks
- **Rate Limiting**: Prevent excessive session access

### Audit Trail
- **Access Logging**: All session access attempts logged
- **User Tracking**: IP address and user agent recorded
- **Error Monitoring**: Failed access attempts tracked

## 📋 Usage Instructions

### For Agents

#### 1. Finding FTD Leads
1. Go to "My Assigned Leads" page
2. Look for leads with "FTD" type
3. Green browser icon indicates available session

#### 2. Accessing Session
1. Click the green browser icon next to FTD lead
2. Wait for "Chromium is launching" notification
3. Browser window will open automatically
4. Navigate to any website - login data is preserved

#### 3. Working with Session
1. Browser opens to Google homepage
2. Navigate to target website (e.g., mail.com)
3. Should be automatically logged in
4. Work normally - all data is preserved
5. Close browser when finished

### For Administrators

#### 1. Monitoring Sessions
- View session status in lead details
- Check session expiration dates
- Monitor access logs

#### 2. Troubleshooting
- Check browser session data integrity
- Verify Python script execution
- Review access logs for errors

## ⚠️ Important Notes

### Session Expiration
- Sessions expire after 30 days
- Warning shown when < 7 days remaining
- Expired sessions cannot be accessed

### Browser Requirements
- Requires Playwright and Chromium
- Python environment must be configured
- Network access for Google homepage

### Data Limitations
- Session data tied to original domain
- Some websites may have additional security checks
- Cross-domain restrictions may apply

## 🛠️ Troubleshooting

### Common Issues

#### 1. Browser Won't Open
- Check Python/Playwright installation
- Verify script permissions
- Check system logs

#### 2. Session Data Missing
- Verify FTD injection completed successfully
- Check session storage in database
- Confirm session not expired

#### 3. Login Not Working
- Some sites have additional security
- Session may be domain-specific
- Check cookie expiration

### Error Messages
- "No active session found": FTD injection may have failed
- "Session expired": Need new FTD injection
- "Access denied": Lead not assigned to agent
- "Script launch failed": Python/Playwright issue

## 📊 Performance Considerations

### Database
- Session data is encrypted (slight performance impact)
- Indexes on sessionId and leadId for fast lookups
- Automatic cleanup of expired sessions

### Browser Launch
- ~2-3 seconds for Chromium startup
- Session restoration adds ~1-2 seconds
- Network dependent for Google homepage

### Memory Usage
- Each session stores ~1-10MB of data
- Chromium process uses ~100-200MB RAM
- Multiple sessions can run simultaneously

## 🔄 Maintenance

### Regular Tasks
1. **Session Cleanup**: Remove expired sessions (automated)
2. **Log Rotation**: Archive old access logs
3. **Performance Monitoring**: Check session access times
4. **Security Audits**: Review access patterns

### Updates
- Keep Playwright updated for browser compatibility
- Monitor for security vulnerabilities
- Update encryption methods as needed

## 📈 Future Enhancements

### Planned Features
1. **Session Refresh**: Automatic session renewal
2. **Bulk Access**: Open multiple sessions simultaneously
3. **Session Sharing**: Temporary session sharing between agents
4. **Advanced Filtering**: Filter by session health/domain
5. **Mobile Support**: Mobile-friendly session access

### Technical Improvements
1. **Performance Optimization**: Faster session restoration
2. **Better Error Handling**: More descriptive error messages
3. **Enhanced Security**: Additional validation layers
4. **Monitoring Dashboard**: Real-time session statistics

---

## 🆘 Support

### For Technical Issues
1. Check system logs in `agent_session_browser.log`
2. Verify Python dependencies: `pip install -r requirements.txt`
3. Test with `python test_agent_session_browser.py`

### For Access Issues
1. Confirm lead assignment
2. Check session expiration
3. Verify user permissions

### Contact Information
- Technical Support: Check system logs and error messages
- User Training: Refer to this guide and UI tooltips
- Feature Requests: Submit through normal channels

---

*This system enables seamless continuation of FTD injection work by preserving all browser session data and making it easily accessible to assigned agents.* 