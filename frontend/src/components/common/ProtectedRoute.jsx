import React from 'react';
import { useSelector } from 'react-redux';
import { Navigate } from 'react-router-dom';
import { selectIsAuthenticated, selectUser } from '../../store/slices/authSlice';

const ProtectedRoute = ({ children, roles }) => {
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const user = useSelector(selectUser);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // If roles are specified, check if the user has one of the required roles
  if (roles && roles.length > 0 && !roles.includes(user?.role)) {
    // Redirect to dashboard or an unauthorized page if role doesn't match
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

export default ProtectedRoute; 