import React, { useState, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Collapse,
  Grid,
  Card,
  CardContent,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Visibility as ViewIcon,
  Download as DownloadIcon,
  Assignment as AssignmentIcon,
} from '@mui/icons-material';
import api from '../services/api';
import LeadDetailCard from './LeadDetailCard';
import ManageFtdDialog from './ManageFtdDialog';

const getStatusColor = (status) => {
  const colors = {
    fulfilled: 'success',
    pending: 'warning',
    cancelled: 'error',
    partial: 'info',
  };
  return colors[status] || 'default';
};

const getPriorityColor = (priority) => {
  const colors = {
    high: 'error',
    medium: 'warning',
    low: 'info',
  };
  return colors[priority] || 'default';
};

const renderLeadCounts = (label, requested, fulfilled) => (
    <Typography variant="body2">
      {label}: {requested !== null ? `${requested} requested` : ''}
      {requested !== null && fulfilled !== null ? ', ' : ''}
      {fulfilled !== null ? `${fulfilled} fulfilled` : ''}
    </Typography>
);

const OrderTableRow = ({ order, user, injectingOrder, onInject, onView, onExport, onNotification }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [details, setDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [expandedLeads, setExpandedLeads] = useState({});
  const [manageFtdDialogOpen, setManageFtdDialogOpen] = useState(false);

  const toggleRowExpansion = useCallback(async (e) => {
    e.stopPropagation();
    const currentlyExpanded = isExpanded;
    setIsExpanded(!currentlyExpanded);

    if (!currentlyExpanded && !details) {
      setLoadingDetails(true);
      try {
        const response = await api.get(`/orders/${order._id}`);
        setDetails(response.data.data);
      } catch (err) {
        onNotification({
          message: 'Could not load order details.',
          severity: 'error'
        });
        setIsExpanded(false); // Close if error
      } finally {
        setLoadingDetails(false);
      }
    }
  }, [isExpanded, details, order._id, onNotification]);

  const toggleLeadExpansion = useCallback((leadId) => {
    setExpandedLeads(prev => ({ ...prev, [leadId]: !prev[leadId] }));
  }, []);

  const expandAllLeads = useCallback((leads = []) => {
    const nextState = {};
    leads.forEach(lead => { nextState[lead._id] = true; });
    setExpandedLeads(prev => ({ ...prev, ...nextState }));
  }, []);

  const collapseAllLeads = useCallback((leads = []) => {
    const nextState = {};
    leads.forEach(lead => { nextState[lead._id] = false; });
    setExpandedLeads(prev => ({ ...prev, ...nextState }));
  }, []);

  const formatCounts = (counts) => {
    if (!counts) return '0/0/0/0';
    return `${counts.ftd || 0}/${counts.filler || 0}/${counts.cold || 0}/${counts.live || 0}`;
  };

  return (
    <React.Fragment>
      <TableRow sx={{ '& > *': { borderBottom: 'unset' }, cursor: 'pointer' }} onClick={toggleRowExpansion}>
        <TableCell>{order.orderNumber}</TableCell>
        <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>{order.requester?.fullName || 'N/A'}</TableCell>
        <TableCell>{formatCounts(order.requests)}</TableCell>
        <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>{formatCounts(order.fulfilled)}</TableCell>
        <TableCell>
          <Chip label={order.status} color={getStatusColor(order.status)} size="small" />
        </TableCell>
        <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
          <Chip label={order.priority} color={getPriorityColor(order.priority)} size="small" />
        </TableCell>
        <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>
          {new Date(order.createdAt).toLocaleDateString()}
        </TableCell>
        <TableCell>
            <IconButton onClick={toggleRowExpansion} size="small" aria-label="expand row">
                {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
            <IconButton onClick={(e) => { e.stopPropagation(); onView(order._id); }} size="small" aria-label="view details">
                <ViewIcon />
            </IconButton>
            {(user.role === 'admin' || user.role === 'affiliate_manager') && (
            <IconButton
                onClick={(e) => { e.stopPropagation(); onInject(order._id); }}
                disabled={injectingOrder === order._id || !['pending', 'partial'].includes(order.status)}
                size="small"
                aria-label="inject order"
            >
                {injectingOrder === order._id ? <CircularProgress size={20} /> : <AssignmentIcon />}
            </IconButton>
            )}
            <IconButton onClick={(e) => { e.stopPropagation(); onExport(order._id); }} size="small" aria-label="export leads">
                <DownloadIcon />
            </IconButton>
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={8}>
          <Collapse in={isExpanded} timeout="auto" unmountOnExit>
            <Box sx={{ margin: 1 }}>
              {loadingDetails && <CircularProgress />}
              {details && (
                <>
                  <Typography variant="h6" gutterBottom>Order Details</Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <Card><CardContent>
                          <Typography variant="subtitle1">Requested</Typography>
                          {renderLeadCounts('FTD', details.requests.ftd, null)}
                          {renderLeadCounts('Filler', details.requests.filler, null)}
                          {renderLeadCounts('Cold', details.requests.cold, null)}
                          {renderLeadCounts('Live', details.requests.live, null)}
                      </CardContent></Card>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                        <Card><CardContent>
                            <Typography variant="subtitle1">Fulfilled</Typography>
                            {renderLeadCounts('FTD', null, details.fulfilled.ftd)}
                            {renderLeadCounts('Filler', null, details.fulfilled.filler)}
                            {renderLeadCounts('Cold', null, details.fulfilled.cold)}
                            {renderLeadCounts('Live', null, details.fulfilled.live)}
                        </CardContent></Card>
                    </Grid>
                  </Grid>

                  {details.requests.ftd > 0 && (
                    <Box sx={{ mt: 2, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                      <Typography variant="h6" gutterBottom>FTD Management</Typography>
                      <Typography variant="body2">Requested: {details.requests.ftd}</Typography>
                      <Typography variant="body2" sx={{ mb: 2 }}>Fulfilled: {details.fulfilled.ftd}</Typography>
                      {(user.role === 'admin' || user.role === 'affiliate_manager') && details.fulfilled.ftd < details.requests.ftd && (
                        <Button variant="contained" size="small" onClick={() => setManageFtdDialogOpen(true)}>Manage FTDs</Button>
                      )}
                      {details.ftdSkipped && (
                        <Alert severity="warning" sx={{ mt: 1 }}>
                          FTD fulfillment was skipped. They can be filled in later.
                        </Alert>
                      )}
                    </Box>
                  )}

                  <ManageFtdDialog 
                    open={manageFtdDialogOpen}
                    onClose={() => setManageFtdDialogOpen(false)}
                    order={details}
                  />

                  <Typography variant="h6" sx={{ mt: 2 }}>Leads ({details.leads.length})</Typography>
                  <Box sx={{ my: 1 }}>
                    <Button size="small" onClick={() => expandAllLeads(details.leads)} variant="outlined" sx={{ mr: 1 }}>Expand All</Button>
                    <Button size="small" onClick={() => collapseAllLeads(details.leads)} variant="outlined">Collapse All</Button>
                  </Box>
                  {details.leads.length > 0 ? (
                    <TableContainer component={Paper}>
                      <Table size="small" aria-label="leads">
                        <TableHead>
                          <TableRow>
                            <TableCell>Type</TableCell>
                            <TableCell>Name</TableCell>
                            <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>Country</TableCell>
                            <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>Email</TableCell>
                            <TableCell>Details</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {details.leads.map((lead) => (
                            <React.Fragment key={lead._id}>
                              <TableRow>
                                <TableCell><Chip label={lead.leadType.toUpperCase()} size="small" /></TableCell>
                                <TableCell>{lead.firstName} {lead.lastName}</TableCell>
                                <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>{lead.country}</TableCell>
                                <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>{lead.newEmail}</TableCell>
                                <TableCell>
                                  <IconButton size="small" onClick={() => toggleLeadExpansion(lead._id)}>
                                    {expandedLeads[lead._id] ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                                  </IconButton>
                                </TableCell>
                              </TableRow>
                              {expandedLeads[lead._id] && (
                                <TableRow><TableCell colSpan={5} sx={{ py: 0, border: 0 }}>
                                    <Collapse in={expandedLeads[lead._id]} timeout="auto" unmountOnExit>
                                      <Box sx={{ p: 2 }}><LeadDetailCard lead={lead} /></Box>
                                    </Collapse>
                                </TableCell></TableRow>
                              )}
                            </React.Fragment>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  ) : <Typography>No leads assigned to this order yet.</Typography>}
                </>
              )}
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </React.Fragment>
  );
};

export default OrderTableRow; 