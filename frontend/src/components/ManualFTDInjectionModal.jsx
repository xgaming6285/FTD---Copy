import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Grid,
  Typography,
  Box,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Chip,
  Divider,
  IconButton,
  Collapse,
} from '@mui/material';
import {
  Person as PersonIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  LocationOn as LocationIcon,
  Business as BusinessIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Send as SendIcon,
} from '@mui/icons-material';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import api from '../services/api';

// Validation schema for manual FTD injection
const injectionSchema = yup.object({
  clientBroker: yup.string().required('Client broker is required'),
  domain: yup.string().url('Must be a valid URL').required('Domain/URL is required'),
  injectionNotes: yup.string().max(500, 'Notes must be less than 500 characters'),
});

const ManualFTDInjectionModal = ({ open, onClose, order, onSuccess }) => {
  const [ftdLeads, setFtdLeads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [expandedLead, setExpandedLead] = useState(null);
  const [clientBrokers, setClientBrokers] = useState([]);
  const [notification, setNotification] = useState({ message: '', severity: 'info' });

  const {
    control,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
  } = useForm({
    resolver: yupResolver(injectionSchema),
    defaultValues: {
      clientBroker: '',
      domain: '',
      injectionNotes: '',
    },
  });

  const selectedBroker = watch('clientBroker');

  // Fetch FTD leads for the order
  useEffect(() => {
    if (open && order) {
      fetchFTDLeads();
      fetchClientBrokers();
    }
  }, [open, order]);

  // Auto-fill domain when broker is selected
  useEffect(() => {
    if (selectedBroker) {
      const broker = clientBrokers.find(b => b._id === selectedBroker);
      if (broker && broker.domain) {
        setValue('domain', broker.domain);
      }
    }
  }, [selectedBroker, clientBrokers, setValue]);

  const fetchFTDLeads = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/orders/${order._id}/ftd-leads`);
      setFtdLeads(response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch FTD leads:', error);
      setNotification({
        message: error.response?.data?.message || 'Failed to load FTD leads',
        severity: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchClientBrokers = async () => {
    try {
      const response = await api.get('/client-brokers', {
        params: { 
          clientNetwork: order.selectedClientNetwork,
          active: true 
        }
      });
      setClientBrokers(response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch client brokers:', error);
      setNotification({
        message: 'Failed to load client brokers',
        severity: 'warning',
      });
    }
  };

  const onSubmit = async (data) => {
    if (ftdLeads.length === 0) {
      setNotification({
        message: 'No FTD leads to inject',
        severity: 'warning',
      });
      return;
    }

    setSubmitting(true);
    try {
      const injectionData = {
        leadIds: ftdLeads.map(lead => lead._id),
        clientBroker: data.clientBroker,
        domain: data.domain,
        notes: data.injectionNotes,
      };

      await api.post(`/orders/${order._id}/manual-ftd-injection`, injectionData);
      
      setNotification({
        message: `Successfully injected ${ftdLeads.length} FTD lead(s)!`,
        severity: 'success',
      });

      // Call success callback and close modal after a delay
      setTimeout(() => {
        onSuccess?.();
        handleClose();
      }, 1500);

    } catch (error) {
      console.error('Manual FTD injection failed:', error);
      setNotification({
        message: error.response?.data?.message || 'Failed to inject FTD leads',
        severity: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    reset();
    setNotification({ message: '', severity: 'info' });
    setExpandedLead(null);
    onClose();
  };

  const toggleLeadExpansion = (leadId) => {
    setExpandedLead(expandedLead === leadId ? null : leadId);
  };

  const renderLeadCard = (lead) => {
    const isExpanded = expandedLead === lead._id;
    
    return (
      <Card key={lead._id} sx={{ mb: 2, border: '1px solid', borderColor: 'primary.light' }}>
        <CardContent sx={{ pb: 1 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Box display="flex" alignItems="center" gap={1}>
              <PersonIcon color="primary" fontSize="small" />
              <Typography variant="subtitle2" fontWeight="bold">
                {lead.firstName} {lead.lastName}
              </Typography>
              <Chip label="FTD" color="primary" size="small" />
            </Box>
            <IconButton 
              size="small" 
              onClick={() => toggleLeadExpansion(lead._id)}
              color="primary"
            >
              {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          </Box>

          <Collapse in={isExpanded}>
            <Divider sx={{ my: 1 }} />
            <Grid container spacing={2} sx={{ mt: 0 }}>
              <Grid item xs={12} sm={6}>
                <Box display="flex" alignItems="center" gap={1} mb={1}>
                  <EmailIcon fontSize="small" color="action" />
                  <Typography variant="body2">{lead.email}</Typography>
                </Box>
                <Box display="flex" alignItems="center" gap={1} mb={1}>
                  <PhoneIcon fontSize="small" color="action" />
                  <Typography variant="body2">{lead.prefix} {lead.newPhone}</Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6}>
                {lead.address && (
                  <Box display="flex" alignItems="center" gap={1} mb={1}>
                    <LocationIcon fontSize="small" color="action" />
                    <Typography variant="body2">{lead.address}</Typography>
                  </Box>
                )}
                {lead.sin && (
                  <Box display="flex" alignItems="center" gap={1} mb={1}>
                    <BusinessIcon fontSize="small" color="action" />
                    <Typography variant="body2">SIN: {lead.sin}</Typography>
                  </Box>
                )}
              </Grid>
              {lead.documents && lead.documents.length > 0 && (
                <Grid item xs={12}>
                  <Typography variant="caption" color="text.secondary">
                    Documents: {lead.documents.length} file(s) attached
                  </Typography>
                </Grid>
              )}
            </Grid>
          </Collapse>
        </CardContent>
      </Card>
    );
  };

  return (
    <Dialog 
      open={open} 
      onClose={handleClose} 
      maxWidth="md" 
      fullWidth
      PaperProps={{
        sx: { minHeight: '60vh' }
      }}
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <SendIcon color="primary" />
          <Typography variant="h6">Manual FTD Injection</Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Order #{order?._id?.slice(-8)} - Manually inject FTD leads
        </Typography>
      </DialogTitle>

      <DialogContent>
        {notification.message && (
          <Alert 
            severity={notification.severity} 
            sx={{ mb: 2 }}
            onClose={() => setNotification({ message: '', severity: 'info' })}
          >
            {notification.message}
          </Alert>
        )}

        {loading ? (
          <Box display="flex" justifyContent="center" alignItems="center" py={4}>
            <CircularProgress />
            <Typography variant="body2" sx={{ ml: 2 }}>
              Loading FTD leads...
            </Typography>
          </Box>
        ) : (
          <>
            {/* FTD Leads Section */}
            <Typography variant="subtitle1" gutterBottom sx={{ mt: 2, fontWeight: 'bold' }}>
              FTD Leads to Inject ({ftdLeads.length})
            </Typography>
            
            {ftdLeads.length === 0 ? (
              <Alert severity="info" sx={{ mb: 3 }}>
                No FTD leads found for this order that require manual injection.
              </Alert>
            ) : (
              <Box sx={{ mb: 3, maxHeight: '300px', overflowY: 'auto' }}>
                {ftdLeads.map(renderLeadCard)}
              </Box>
            )}

            {/* Injection Form */}
            {ftdLeads.length > 0 && (
              <>
                <Divider sx={{ mb: 3 }} />
                <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold' }}>
                  Injection Details
                </Typography>

                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <Controller
                      name="clientBroker"
                      control={control}
                      render={({ field }) => (
                        <FormControl fullWidth error={!!errors.clientBroker}>
                          <InputLabel>Client Broker *</InputLabel>
                          <Select {...field} label="Client Broker *">
                            {clientBrokers.map((broker) => (
                              <MenuItem key={broker._id} value={broker._id}>
                                {broker.name} ({broker.company})
                              </MenuItem>
                            ))}
                          </Select>
                          {errors.clientBroker && (
                            <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.5 }}>
                              {errors.clientBroker.message}
                            </Typography>
                          )}
                        </FormControl>
                      )}
                    />
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <Controller
                      name="domain"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          fullWidth
                          label="Domain/URL *"
                          placeholder="https://example.com"
                          error={!!errors.domain}
                          helperText={errors.domain?.message}
                        />
                      )}
                    />
                  </Grid>

                  <Grid item xs={12}>
                    <Controller
                      name="injectionNotes"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          fullWidth
                          label="Injection Notes"
                          multiline
                          rows={3}
                          placeholder="Add any notes about this manual injection..."
                          error={!!errors.injectionNotes}
                          helperText={errors.injectionNotes?.message}
                        />
                      )}
                    />
                  </Grid>
                </Grid>
              </>
            )}
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={handleClose} disabled={submitting}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit(onSubmit)}
          variant="contained"
          disabled={submitting || ftdLeads.length === 0}
          startIcon={submitting ? <CircularProgress size={16} /> : <SendIcon />}
        >
          {submitting ? 'Injecting...' : `Inject ${ftdLeads.length} FTD Lead${ftdLeads.length !== 1 ? 's' : ''}`}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ManualFTDInjectionModal; 