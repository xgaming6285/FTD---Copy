import React, { useState, useEffect } from 'react';
import {
  IconButton,
  Button,
  Tooltip,
  CircularProgress,
  Alert,
  Snackbar,
  Box,
  Typography,
} from '@mui/material';
import {
  Launch as LaunchIcon,
  Warning as WarningIcon,
  Schedule as ExpiringIcon,
} from '@mui/icons-material';
import api from '../services/api';

const SessionAccessButton = ({ 
  lead, 
  user, 
  size = 'small', 
  variant = 'icon', // 'icon' or 'button'
  onSessionAccess = null,
  disabled = false 
}) => {
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState({ open: false, message: '', severity: 'info' });
  const [sessionHealth, setSessionHealth] = useState(null);

  // Check session health on component mount and when lead changes
  useEffect(() => {
    if (lead?.browserSession?.sessionId) {
      checkSessionHealth();
    }
  }, [lead?.browserSession?.sessionId]);

  const checkSessionHealth = () => {
    if (!lead.browserSession || !lead.browserSession.createdAt) return;
    
    const createdAt = new Date(lead.browserSession.createdAt);
    const expirationDate = new Date(createdAt.getTime() + (30 * 24 * 60 * 60 * 1000));
    const sevenDaysFromNow = new Date(Date.now() + (7 * 24 * 60 * 60 * 1000));
    const daysUntilExpiration = Math.ceil((expirationDate - new Date()) / (24 * 60 * 60 * 1000));
    
    if (daysUntilExpiration <= 0) {
      setSessionHealth({ status: 'expired', daysUntilExpiration: 0 });
    } else if (daysUntilExpiration <= 7) {
      setSessionHealth({ status: 'expiring', daysUntilExpiration });
    } else {
      setSessionHealth({ status: 'healthy', daysUntilExpiration });
    }
  };

  // Check if user has permission to access this lead's session
  const hasPermission = () => {
    if (!user) return false;
    
    // Admin can access all sessions
    if (user.role === 'admin') return true;
    
    // Agents can only access sessions for leads assigned to them
    if (user.role === 'agent') {
      return lead.assignedTo && lead.assignedTo._id === user._id;
    }
    
    // Affiliate managers can access sessions for leads they manage
    if (user.role === 'affiliate_manager') {
      return (lead.assignedTo && lead.assignedTo._id === user._id) ||
             (lead.createdBy && lead.createdBy._id === user._id);
    }
    
    return false;
  };

  // Check if lead has an active session
  const hasActiveSession = () => {
    return lead.browserSession && 
           lead.browserSession.sessionId && 
           lead.browserSession.isActive;
  };

  // Check if session is expired
  const isSessionExpired = () => {
    if (!lead.browserSession || !lead.browserSession.createdAt) return true;
    
    const createdAt = new Date(lead.browserSession.createdAt);
    const thirtyDaysAgo = new Date(Date.now() - (30 * 24 * 60 * 60 * 1000));
    return createdAt < thirtyDaysAgo;
  };

  const handleAccessSession = async () => {
    if (!hasPermission()) {
      setNotification({
        open: true,
        message: 'You do not have permission to access this session',
        severity: 'error'
      });
      return;
    }

    if (!hasActiveSession()) {
      setNotification({
        open: true,
        message: 'No active session available for this lead',
        severity: 'warning'
      });
      return;
    }

    if (isSessionExpired()) {
      setNotification({
        open: true,
        message: 'Session has expired and cannot be accessed',
        severity: 'error'
      });
      return;
    }

    // Show warning for expiring sessions
    if (sessionHealth?.status === 'expiring') {
      setNotification({
        open: true,
        message: `Warning: Session expires in ${sessionHealth.daysUntilExpiration} day(s). Consider creating a new session soon.`,
        severity: 'warning'
      });
    }

    setLoading(true);
    
    try {
      // Call the backend API to trigger session restoration
      const response = await api.post(`/api/leads/${lead._id}/access-session`);
      
      if (response.data.success) {
        setNotification({
          open: true,
          message: 'Browser session is being restored. Please wait for the browser window to open.',
          severity: 'success'
        });
        
        // Call the callback if provided
        if (onSessionAccess) {
          onSessionAccess(lead, response.data);
        }
      } else {
        throw new Error(response.data.message || 'Failed to access session');
      }
    } catch (error) {
      console.error('Error accessing session:', error);
      setNotification({
        open: true,
        message: error.response?.data?.message || 'Failed to access session',
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const getTooltipMessage = () => {
    if (!hasPermission()) {
      return 'You do not have permission to access this session';
    }
    
    if (!hasActiveSession()) {
      return 'No active session available';
    }
    
    if (isSessionExpired()) {
      return 'Session has expired';
    }

    if (sessionHealth?.status === 'expiring') {
      return `Session expires in ${sessionHealth.daysUntilExpiration} day(s) - Access soon!`;
    }
    
    return `Access stored browser session for ${lead.firstName} ${lead.lastName}`;
  };

  const getButtonColor = () => {
    if (sessionHealth?.status === 'expiring') return 'warning';
    return 'primary';
  };

  const isDisabled = disabled || loading || !hasPermission() || !hasActiveSession() || isSessionExpired();

  const buttonContent = loading ? (
    <CircularProgress size={size === 'small' ? 16 : 20} />
  ) : sessionHealth?.status === 'expiring' ? (
    <ExpiringIcon fontSize={size} />
  ) : (
    <LaunchIcon fontSize={size} />
  );

  const ButtonComponent = variant === 'icon' ? IconButton : Button;
  const buttonProps = {
    size,
    onClick: handleAccessSession,
    disabled: isDisabled,
    color: getButtonColor(),
    ...(variant === 'button' && {
      startIcon: buttonContent,
      variant: 'outlined'
    })
  };

  return (
    <>
      <Tooltip 
        title={
          <Box>
            <Typography variant="body2">{getTooltipMessage()}</Typography>
            {sessionHealth?.status === 'expiring' && (
              <Typography variant="caption" color="warning.light" sx={{ display: 'block', mt: 0.5 }}>
                ⚠️ Session expires soon - consider creating a new session
              </Typography>
            )}
          </Box>
        }
      >
        <span>
          <ButtonComponent {...buttonProps}>
            {variant === 'icon' ? buttonContent : 'Access Session'}
          </ButtonComponent>
        </span>
      </Tooltip>
      
      <Snackbar
        open={notification.open}
        autoHideDuration={notification.severity === 'warning' ? 8000 : 6000}
        onClose={() => setNotification({ ...notification, open: false })}
      >
        <Alert
          onClose={() => setNotification({ ...notification, open: false })}
          severity={notification.severity}
          sx={{ width: '100%' }}
        >
          {notification.message}
        </Alert>
      </Snackbar>
    </>
  );
};

export default SessionAccessButton; 