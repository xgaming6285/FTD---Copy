import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSelector } from 'react-redux';
import {
  Box,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Grid,
  Card,
  CardContent,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TablePagination,
  IconButton,
  Collapse,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  useMediaQuery,
  useTheme,
  Radio,
  RadioGroup,
  FormControlLabel,
} from '@mui/material';
import {
  Add as AddIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Visibility as ViewIcon,
  Download as DownloadIcon,
  Assignment as AssignmentIcon,
} from '@mui/icons-material';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import api from '../services/api';
import { selectUser } from '../store/slices/authSlice';
import { getSortedCountries } from '../constants/countries';
import AssignClientInfoDialog from '../components/AssignClientInfoDialog';
import LeadDetailCard from '../components/LeadDetailCard';
import OrderTableRow from '../components/OrderTableRow';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';

// --- Best Practice: Define constants and schemas outside the component ---
// This prevents them from being recreated on every render.

// Validation schema for order creation
const orderSchema = yup.object({
  clientNetwork: yup.string().required('Client Network is required'),
  injectionType: yup.string().oneOf(['manual', 'auto']).required(),
  autoInjectionType: yup.string().when('injectionType', {
    is: 'auto',
    then: (schema) => schema.oneOf(['bulk', 'scheduled']).required('Auto injection type is required'),
    otherwise: (schema) => schema.notRequired(),
  }),
  startTime: yup.date().nullable().when('autoInjectionType', {
    is: 'scheduled',
    then: (schema) => schema.required('Start time is required for scheduled injection').min(new Date(), 'Start time must be in the future'),
  }),
  endTime: yup.date().nullable().when('autoInjectionType', {
    is: 'scheduled',
    then: (schema) => schema.required('End time is required for scheduled injection').min(yup.ref('startTime'), 'End time must be after start time'),
  }),
  ftd: yup.number().min(0, 'Must be 0 or greater').integer('Must be a whole number').default(0),
  filler: yup.number().min(0, 'Must be 0 or greater').integer('Must be a whole number').default(0),
  cold: yup.number().min(0, 'Must be 0 or greater').integer('Must be a whole number').default(0),
  live: yup.number().min(0, 'Must be 0 or greater').integer('Must be a whole number').default(0),
  priority: yup.string().oneOf(['low', 'medium', 'high'], 'Invalid priority').default('medium'),
  notes: yup.string(),
  country: yup.string().nullable(),
  gender: yup.string().oneOf(['', 'male', 'female', 'not_defined'], 'Invalid gender').nullable().default(''),
  excludeClients: yup.array().of(yup.string()).default([]),
  excludeBrokers: yup.array().of(yup.string()).default([]),
  excludeNetworks: yup.array().of(yup.string()).default([]),
  clientBroker: yup.object({
    id: yup.string(),
    name: yup.string(),
  }).nullable(),
  newClientBroker: yup.string().when('clientBroker', {
    is: (val) => val && val.id === 'add_new',
    then: (schema) => schema.required('New broker name is required'),
    otherwise: (schema) => schema.notRequired(),
  }),
}).test('at-least-one', 'At least one lead type must be requested', (value) => {
  return (value.ftd || 0) + (value.filler || 0) + (value.cold || 0) + (value.live || 0) > 0;
});

// Helper functions for status/priority colors
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

// --- Optimization: Custom hook for debouncing input ---
// This prevents rapid API calls while the user is typing in filters.
const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  return debouncedValue;
};


// --- Suggestion: This component is large. Consider splitting it into smaller components: ---
// - OrderFilters.jsx
// - OrderTable.jsx
// - OrderTableRow.jsx (to handle row logic and expansion)
// - CreateOrderDialog.jsx
// - ViewOrderDialog.jsx

const OrdersPage = () => {
  const user = useSelector(selectUser);
  const theme = useTheme();
  const isSmallScreen = useMediaQuery(theme.breakpoints.down('sm'));

  // State
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState({ message: '', severity: 'info' });

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [assignClientDialogOpen, setAssignClientDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedOrderForClient, setSelectedOrderForClient] = useState(null);
  const [isAssigningClient, setIsAssigningClient] = useState(false);
  const [injectingOrder, setInjectingOrder] = useState(null);

  // Exclusion options state
  const [exclusionOptions, setExclusionOptions] = useState({
    clients: [],
    brokers: [],
    networks: [],
  });
  const [loadingExclusionOptions, setLoadingExclusionOptions] = useState(false);

  // Pagination and filtering
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalOrders, setTotalOrders] = useState(0);
  const [filters, setFilters] = useState({
    status: '',
    priority: '',
    startDate: '',
    endDate: '',
  });
  const debouncedFilters = useDebounce(filters, 500); // Debounce filter state
  const [showFilters, setShowFilters] = useState(false);
  const [clientNetworks, setClientNetworks] = useState([]);
  const [clientBrokers, setClientBrokers] = useState([]);
  const [loadingBrokers, setLoadingBrokers] = useState(false);

  // --- Bug Fix: Use an object to store data for each expanded row individually ---
  const [expandedRowData, setExpandedRowData] = useState({});

  // State for individual lead expansion within orders
  const [expandedLeads, setExpandedLeads] = useState({});

  const {
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: yupResolver(orderSchema),
    defaultValues: {
      ...orderSchema.getDefault(),
      clientNetwork: '',
      injectionType: 'manual',
      autoInjectionType: 'bulk',
      clientBroker: null,
      newClientBroker: '',
    },
  });

  const injectionType = watch('injectionType');
  const autoInjectionType = watch('autoInjectionType');
  const selectedClientNetwork = watch('clientNetwork');

  // Fetch client brokers when a client network is selected
  useEffect(() => {
    const fetchBrokers = async () => {
      if (selectedClientNetwork) {
        setLoadingBrokers(true);
        setClientBrokers([]); // Clear previous brokers
        setValue('clientBroker', null); // Reset broker selection
        try {
          const response = await api.get(`/client-networks/${selectedClientNetwork}/brokers`);
          if (response.data.success) {
            setClientBrokers(response.data.data);
          }
        } catch (err) {
          setNotification({
            message: 'Failed to fetch client brokers for the selected network.',
            severity: 'error',
          });
        } finally {
          setLoadingBrokers(false);
        }
      } else {
        setClientBrokers([]); // Clear brokers if no network is selected
      }
    };

    fetchBrokers();
  }, [selectedClientNetwork, setValue]);

  // --- Optimization: `useCallback` to memoize functions ---
  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setNotification({ message: '', severity: 'info' });
    try {
      const params = new URLSearchParams({
        page: page + 1,
        limit: rowsPerPage,
      });

      // Append non-empty filter values from the debounced state
      Object.entries(debouncedFilters).forEach(([key, value]) => {
        if (value) {
          params.append(key, value);
        }
      });

      const response = await api.get(`/orders?${params}`);
      setOrders(response.data.data);
      setTotalOrders(response.data.pagination.total);
    } catch (err) {
      setNotification({
        message: err.response?.data?.message || 'Failed to fetch orders',
        severity: 'error',
      });
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, debouncedFilters]);

  // Effect for fetching orders when dependencies change
  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    const fetchClientNetworks = async () => {
      try {
        const response = await api.get('/client-networks');
        if (response.data.success) {
          setClientNetworks(response.data.data);
        }
      } catch (err) {
        setNotification({
          message: 'Failed to fetch client networks',
          severity: 'error',
        });
      }
    };
    if (user.role === 'admin' || user.role === 'affiliate_manager') {
       fetchClientNetworks();
    }
  }, [user.role]);

  // Effect for auto-clearing notifications
  useEffect(() => {
    if (notification.message) {
      const timer = setTimeout(() => {
        setNotification({ message: '', severity: 'info' });
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [notification.message]);

  // Fetch exclusion options
  const fetchExclusionOptions = useCallback(async () => {
    setLoadingExclusionOptions(true);
    try {
      const response = await api.get('/orders/exclusion-options');
      const data = response.data.data;
      
      // Ensure the response has the expected structure
      setExclusionOptions({
        clients: data.clients || [],
        brokers: data.brokers || [],
        networks: data.networks || [],
      });
    } catch (err) {
      console.error('Failed to fetch exclusion options:', err);
      setNotification({
        message: 'Failed to load exclusion options',
        severity: 'warning',
      });
      // Reset to default structure on error
      setExclusionOptions({
        clients: [],
        brokers: [],
        networks: [],
      });
    } finally {
      setLoadingExclusionOptions(false);
    }
  }, []);

  const onSubmitOrder = useCallback(async (data) => {
    try {
      const orderData = {
        requests: {
          ftd: data.ftd || 0,
          filler: data.filler || 0,
          cold: data.cold || 0,
          live: data.live || 0,
        },
        priority: data.priority,
        notes: data.notes,
        country: data.country || null,
        gender: data.gender || null,
        excludeBrokers: data.excludeBrokers || [],
        excludeNetworks: data.excludeNetworks || [],
        clientNetwork: data.clientNetwork,
        injectionType: data.injectionType,
        clientBroker: data.clientBroker?.id === 'add_new' 
          ? { name: data.newClientBroker } 
          : data.clientBroker 
            ? { id: data.clientBroker.id } 
            : undefined,
        autoInjectionSettings: data.injectionType === 'auto' ? {
          type: data.autoInjectionType,
          startTime: data.autoInjectionType === 'scheduled' ? data.startTime : null,
          endTime: data.autoInjectionType === 'scheduled' ? data.endTime : null,
        } : undefined,
      };

      await api.post('/orders', orderData);
      setNotification({ message: 'Order created successfully', severity: 'success' });
      setCreateDialogOpen(false);
      reset();
      fetchOrders(); // Refresh the orders list
    } catch (err) {
      setNotification({
        message: err.response?.data?.message || 'Failed to create order',
        severity: 'error',
      });
    }
  }, [reset, fetchOrders]);

  const handleViewOrder = useCallback(async (orderId) => {
    try {
      const response = await api.get(`/orders/${orderId}`);
      setSelectedOrder(response.data.data);
      setViewDialogOpen(true);
    } catch (err) {
      setNotification({
        message: err.response?.data?.message || 'Failed to fetch order details',
        severity: 'error',
      });
    }
  }, []);

  const toggleLeadExpansion = useCallback((leadId) => {
    setExpandedLeads(prev => ({
      ...prev,
      [leadId]: !prev[leadId]
    }));
  }, []);

  const expandAllLeads = useCallback((leads) => {
    const expandedState = {};
    leads.forEach(lead => {
      expandedState[lead._id] = true;
    });
    setExpandedLeads(prev => ({ ...prev, ...expandedState }));
  }, []);

  const collapseAllLeads = useCallback((leads) => {
    const collapsedState = {};
    leads.forEach(lead => {
      collapsedState[lead._id] = false;
    });
    setExpandedLeads(prev => ({ ...prev, ...collapsedState }));
  }, []);

  const handleExportLeads = useCallback(async (orderId) => {
    try {
      setNotification({ message: 'Preparing CSV export...', severity: 'info' });

      const response = await api.get(`/orders/${orderId}/export`, {
        responseType: 'blob', // Important for file downloads
      });

      // Create blob link to download
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;

      // Get filename from response header or create default
      const contentDisposition = response.headers['content-disposition'];
      let filename = `order_${orderId}_leads_${new Date().toISOString().split('T')[0]}.csv`;
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      setNotification({ message: 'CSV export completed successfully!', severity: 'success' });
    } catch (err) {
      setNotification({
        message: err.response?.data?.message || 'Failed to export leads',
        severity: 'error',
      });
    }
  }, []);

  const toggleRowExpansion = useCallback(async (orderId) => {
    const isCurrentlyExpanded = !!expandedRowData[orderId];
    if (isCurrentlyExpanded) {
      // Collapse the row by removing its data
      const newExpandedData = { ...expandedRowData };
      delete newExpandedData[orderId];
      setExpandedRowData(newExpandedData);
    } else {
      // Expand the row: fetch its details and store them
      try {
        const response = await api.get(`/orders/${orderId}`);
        setExpandedRowData(prev => ({ ...prev, [orderId]: response.data.data }));
      } catch (err) {
        setNotification({
          message: 'Could not load order details for expansion.',
          severity: 'error'
        });
      }
    }
  }, [expandedRowData]);

  // Pagination handlers
  const handleChangePage = useCallback((event, newPage) => {
    setPage(newPage);
  }, []);

  const handleChangeRowsPerPage = useCallback((event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  }, []);

  // Filter handlers
  const handleFilterChange = useCallback((field) => (event) => {
    const value = event.target.value;
    setFilters(prev => ({ ...prev, [field]: value }));
    setPage(0);
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({ status: '', priority: '', startDate: '', endDate: '' });
    setPage(0);
  }, []);

  // Client assignment handlers
  const handleOpenAssignClientDialog = useCallback(async (orderId) => {
    try {
      const response = await api.get(`/orders/${orderId}`);
      setSelectedOrderForClient(response.data.data);
      setAssignClientDialogOpen(true);
    } catch (err) {
      setNotification({
        message: err.response?.data?.message || 'Failed to fetch order details',
        severity: 'error',
      });
    }
  }, []);

  const handleAssignClientInfo = useCallback(async (clientData) => {
    if (!selectedOrderForClient) return;

    setIsAssigningClient(true);
    try {
      const response = await api.put(`/orders/${selectedOrderForClient._id}/assign-client-info`, clientData);
      setNotification({
        message: response.data.message || 'Client information assigned successfully!',
        severity: 'success'
      });
      setAssignClientDialogOpen(false);
      setSelectedOrderForClient(null);
      fetchOrders(); // Refresh the orders list
    } catch (err) {
      setNotification({
        message: err.response?.data?.message || 'Failed to assign client information',
        severity: 'error',
      });
    } finally {
      setIsAssigningClient(false);
    }
  }, [selectedOrderForClient, fetchOrders]);

  const handleCloseAssignClientDialog = useCallback(() => {
    setAssignClientDialogOpen(false);
    setSelectedOrderForClient(null);
  }, []);

  // Handle opening create dialog and fetching exclusion options
  const handleOpenCreateDialog = useCallback(() => {
    setCreateDialogOpen(true);
    fetchExclusionOptions();
  }, [fetchExclusionOptions]);

  // Readability: Helper component for rendering lead counts
  const renderLeadCounts = (label, requested, fulfilled) => (
    <Typography variant="body2">
      {label}: {requested || 0} requested, {fulfilled || 0} fulfilled
    </Typography>
  );

  const handleInjectOrder = useCallback(async (orderId) => {
    setInjectingOrder(orderId);
    setNotification({ message: 'Starting injection process...', severity: 'info' });
    try {
      const response = await api.post(`/orders/${orderId}/inject`);
      setNotification({ message: response.data.message || 'Injection process started successfully.', severity: 'success' });
      fetchOrders(); // Refresh orders to show updated status
    } catch (err) {
      setNotification({
        message: err.response?.data?.message || 'Failed to start injection.',
        severity: 'error',
      });
    } finally {
      setInjectingOrder(null);
    }
  }, [fetchOrders]);

  const renderCreateOrderDialog = () => (
    <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="md" fullWidth>
      <DialogTitle>Create New Order</DialogTitle>
      <form onSubmit={handleSubmit(onSubmitOrder)}>
        <DialogContent>
          <Grid container spacing={3} sx={{ pt: 1 }}>
             <Grid item xs={12}>
              <FormControl fullWidth error={!!errors.clientNetwork}>
                <InputLabel id="client-network-label">Client Network</InputLabel>
                <Controller
                  name="clientNetwork"
                  control={control}
                  render={({ field }) => (
                    <Select {...field} labelId="client-network-label" label="Client Network">
                      {clientNetworks.map((network) => (
                        <MenuItem key={network._id} value={network._id}>
                          {network.name}
                        </MenuItem>
                      ))}
                    </Select>
                  )}
                />
                {errors.clientNetwork && <Typography color="error" variant="caption">{errors.clientNetwork.message}</Typography>}
              </FormControl>
            </Grid>

            {selectedClientNetwork && (
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth error={!!errors.clientBroker}>
                  <InputLabel id="client-broker-label">Client Broker</InputLabel>
                  <Controller
                    name="clientBroker"
                    control={control}
                    render={({ field }) => (
                      <Select {...field} labelId="client-broker-label" label="Client Broker" disabled={loadingBrokers}>
                        {loadingBrokers && <MenuItem value=""><em>Loading brokers...</em></MenuItem>}
                        {!loadingBrokers && clientBrokers.map((broker) => (
                          <MenuItem key={broker._id} value={{ id: broker._id, name: broker.name }}>
                            {broker.name}
                          </MenuItem>
                        ))}
                        {!loadingBrokers && (user.role === 'admin' || user.role === 'affiliate_manager') && (
                          <MenuItem value={{ id: 'add_new', name: 'Add New Broker' }}>
                            <em>+ Add New Broker</em>
                          </MenuItem>
                        )}
                      </Select>
                    )}
                  />
                  {errors.clientBroker && <Typography color="error" variant="caption">{errors.clientBroker.message}</Typography>}
                </FormControl>
              </Grid>
            )}

            {watch('clientBroker')?.id === 'add_new' && (
              <Grid item xs={12} sm={6}>
                <Controller
                  name="newClientBroker"
                  control={control}
                  render={({ field }) => (
                    <TextField {...field} label="New Client Broker Name" fullWidth error={!!errors.newClientBroker} helperText={errors.newClientBroker?.message} />
                  )}
                />
              </Grid>
            )}

            <Grid item xs={12}>
              <FormControl component="fieldset">
                <Controller
                  name="injectionType"
                  control={control}
                  render={({ field }) => (
                    <RadioGroup row {...field}>
                      <FormControlLabel value="manual" control={<Radio />} label="Manual Injection" />
                      <FormControlLabel value="auto" control={<Radio />} label="Auto Injection" />
                    </RadioGroup>
                  )}
                />
              </FormControl>
            </Grid>

            {injectionType === 'auto' && (
              <>
                <Grid item xs={12}>
                   <FormControl component="fieldset">
                      <Controller
                        name="autoInjectionType"
                        control={control}
                        render={({ field }) => (
                          <RadioGroup row {...field}>
                            <FormControlLabel value="bulk" control={<Radio />} label="Bulk" />
                            <FormControlLabel value="scheduled" control={<Radio />} label="Scheduled" />
                          </RadioGroup>
                        )}
                      />
                   </FormControl>
                </Grid>
                {autoInjectionType === 'scheduled' && (
                  <LocalizationProvider dateAdapter={AdapterDayjs}>
                    <Grid item xs={12} sm={6}>
                      <Controller
                        name="startTime"
                        control={control}
                        render={({ field, fieldState }) => (
                            <DateTimePicker
                                {...field}
                                label="Start Time"
                                slotProps={{
                                    textField: {
                                        fullWidth: true,
                                        error: !!fieldState.error,
                                        helperText: fieldState.error?.message,
                                    },
                                }}
                            />
                        )}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                       <Controller
                        name="endTime"
                        control={control}
                        render={({ field, fieldState }) => (
                           <DateTimePicker
                                {...field}
                                label="End Time"
                                slotProps={{
                                    textField: {
                                        fullWidth: true,
                                        error: !!fieldState.error,
                                        helperText: fieldState.error?.message,
                                    },
                                }}
                            />
                        )}
                      />
                    </Grid>
                  </LocalizationProvider>
                )}
              </>
            )}

            <Grid item xs={12}><Typography variant="h6" sx={{mt: 2}}>Lead Requests</Typography></Grid>
            <Grid item xs={6} sm={3}><Controller name="ftd" control={control} render={({ field }) => <TextField {...field} fullWidth label="FTD" type="number" error={!!errors.ftd} helperText={errors.ftd?.message} inputProps={{ min: 0 }} size="small" />}/></Grid>
            <Grid item xs={6} sm={3}><Controller name="filler" control={control} render={({ field }) => <TextField {...field} fullWidth label="Filler" type="number" error={!!errors.filler} helperText={errors.filler?.message} inputProps={{ min: 0 }} size="small" />}/></Grid>
            <Grid item xs={6} sm={3}><Controller name="cold" control={control} render={({ field }) => <TextField {...field} fullWidth label="Cold" type="number" error={!!errors.cold} helperText={errors.cold?.message} inputProps={{ min: 0 }} size="small" />}/></Grid>
            <Grid item xs={6} sm={3}><Controller name="live" control={control} render={({ field }) => <TextField {...field} fullWidth label="Live" type="number" error={!!errors.live} helperText={errors.live?.message} inputProps={{ min: 0 }} size="small" />}/></Grid>

            <Grid item xs={12}><Typography variant="h6" sx={{mt: 2}}>Order Details</Typography></Grid>
            <Grid item xs={12}>
              <Controller name="priority" control={control} render={({ field }) => (
                <FormControl fullWidth size="small" error={!!errors.priority}>
                  <InputLabel>Priority</InputLabel>
                  <Select {...field} label="Priority"><MenuItem value="low">Low</MenuItem><MenuItem value="medium">Medium</MenuItem><MenuItem value="high">High</MenuItem></Select>
                </FormControl>
              )}/>
            </Grid>
            <Grid item xs={12}>
              <Controller name="gender" control={control} render={({ field }) => (
                <FormControl fullWidth size="small" error={!!errors.gender}>
                  <InputLabel>Gender (Optional)</InputLabel>
                  <Select {...field} label="Gender (Optional)"><MenuItem value="">All</MenuItem><MenuItem value="male">Male</MenuItem><MenuItem value="female">Female</MenuItem><MenuItem value="not_defined">Not Defined</MenuItem></Select>
                </FormControl>
              )}/>
            </Grid>
            <Grid item xs={12}>
              <Controller name="country" control={control} render={({ field }) => (
                <FormControl fullWidth size="small" error={!!errors.country}>
                  <InputLabel>Country Filter (Optional)</InputLabel>
                  <Select
                    {...field}
                    label="Country Filter (Optional)"
                    value={field.value || ''}
                  >
                    <MenuItem value="">All Countries</MenuItem>
                    {getSortedCountries().map((country) => (
                      <MenuItem key={country.code} value={country.name}>
                        {country.name}
                      </MenuItem>
                    ))}
                  </Select>
                  {errors.country?.message && (
                    <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.5 }}>
                      {errors.country.message}
                    </Typography>
                  )}
                  {!errors.country?.message && (
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, ml: 1.5 }}>
                      Leave empty for all countries
                    </Typography>
                  )}
                </FormControl>
              )}/>
            </Grid>
            <Grid item xs={12}>
              <Controller name="notes" control={control} render={({ field }) => <TextField {...field} fullWidth label="Notes" multiline rows={3} error={!!errors.notes} helperText={errors.notes?.message} size="small" />}/>
            </Grid>

            <Grid item xs={12}>
              <Typography variant="h6" sx={{mt: 2}}>Exclusion Filters</Typography>
              <Typography variant="body2" color="text.secondary" sx={{mb: 1}}>
                Prevent leads already assigned to these groups from being included in this order.
              </Typography>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Controller
                name="excludeClients"
                control={control}
                render={({ field }) => (
                  <FormControl fullWidth size="small">
                    <InputLabel>Exclude Clients</InputLabel>
                    <Select {...field} multiple label="Exclude Clients" disabled={loadingExclusionOptions}>
                      {(exclusionOptions.clients || []).map(client => (
                        <MenuItem key={client} value={client}>{client}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <Controller
                name="excludeBrokers"
                control={control}
                render={({ field }) => (
                  <FormControl fullWidth size="small">
                    <InputLabel>Exclude Brokers</InputLabel>
                    <Select {...field} multiple label="Exclude Brokers" disabled={loadingExclusionOptions}>
                      {(exclusionOptions.brokers || []).map(broker => (
                        <MenuItem key={broker} value={broker}>{broker}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <Controller
                name="excludeNetworks"
                control={control}
                render={({ field }) => (
                  <FormControl fullWidth size="small">
                    <InputLabel>Exclude Networks</InputLabel>
                    <Select {...field} multiple label="Exclude Networks" disabled={loadingExclusionOptions}>
                      {(exclusionOptions.networks || []).map(network => (
                        <MenuItem key={network} value={network}>{network}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}
              />
            </Grid>
          </Grid>
          {errors[''] && <Alert severity="error" sx={{ mt: 2 }}>{errors['']?.message}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={isSubmitting}>
            {isSubmitting ? <CircularProgress size={24} /> : 'Create'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );

  return (
    <Box sx={{ p: isSmallScreen ? 1 : 3 }}>
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        flexDirection={isSmallScreen ? 'column' : 'row'}
        sx={{ mb: 3, alignItems: isSmallScreen ? 'flex-start' : 'center' }}
      >
        <Typography variant={isSmallScreen ? 'h5' : 'h4'} gutterBottom sx={{ mb: isSmallScreen ? 2 : 0 }}>
          Orders
        </Typography>
        {(user?.role === 'admin' || user?.role === 'affiliate_manager') && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleOpenCreateDialog}
            size={isSmallScreen ? 'small' : 'medium'}
            sx={{ width: isSmallScreen ? '100%' : 'auto' }}
          >
            Create Order
          </Button>
        )}
      </Box>

      {/* Unified Notification Alert */}
      {notification.message && (
        <Collapse in={!!notification.message}>
          <Alert
            severity={notification.severity}
            sx={{ mb: 2 }}
            onClose={() => setNotification({ message: '', severity: 'info' })}
          >
            {notification.message}
          </Alert>
        </Collapse>
      )}

      {/* Filters Card */}
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ p: isSmallScreen ? 1.5 : 2, '&:last-child': { pb: isSmallScreen ? 1.5 : 2 } }}>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">Filters</Typography>
            <IconButton onClick={() => setShowFilters(!showFilters)}>
              {showFilters ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          </Box>
          <Collapse in={showFilters}>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12} sm={6} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>Status</InputLabel>
                  <Select value={filters.status} label="Status" onChange={handleFilterChange('status')}>
                    <MenuItem value="">All</MenuItem>
                    <MenuItem value="pending">Pending</MenuItem>
                    <MenuItem value="fulfilled">Fulfilled</MenuItem>
                    <MenuItem value="partial">Partial</MenuItem>
                    <MenuItem value="cancelled">Cancelled</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>Priority</InputLabel>
                  <Select value={filters.priority} label="Priority" onChange={handleFilterChange('priority')}>
                    <MenuItem value="">All</MenuItem>
                    <MenuItem value="low">Low</MenuItem>
                    <MenuItem value="medium">Medium</MenuItem>
                    <MenuItem value="high">High</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <TextField fullWidth label="Start Date" type="date" value={filters.startDate} onChange={handleFilterChange('startDate')} InputLabelProps={{ shrink: true }} size="small"/>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <TextField fullWidth label="End Date" type="date" value={filters.endDate} onChange={handleFilterChange('endDate')} InputLabelProps={{ shrink: true }} size="small" />
              </Grid>
              <Grid item xs={12}>
                <Button onClick={clearFilters} variant="outlined" size="small">Clear Filters</Button>
              </Grid>
            </Grid>
          </Collapse>
        </CardContent>
      </Card>

      {/* Orders Table */}
      <Paper>
        <TableContainer>
          <Table size={isSmallScreen ? 'small' : 'medium'}>
            <TableHead>
              <TableRow>
                <TableCell>Order ID</TableCell>
                <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>Requester</TableCell>
                <TableCell>Requests (F/Fi/C/L)</TableCell>
                <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>Fulfilled (F/Fi/C/L)</TableCell>
                <TableCell>Status</TableCell>
                <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>Priority</TableCell>
                <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>Created</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} align="center"><CircularProgress /></TableCell>
                </TableRow>
              ) : orders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center">No orders found</TableCell>
                </TableRow>
              ) : (
                orders.map((order) => (
                  <OrderTableRow
                    key={order._id}
                    order={order}
                    user={user}
                    injectingOrder={injectingOrder}
                    onInject={handleInjectOrder}
                    onView={handleViewOrder}
                    onExport={handleExportLeads}
                    onNotification={setNotification}
                  />
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          rowsPerPageOptions={[5, 10, 25]}
          component="div"
          count={totalOrders}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </Paper>

      {/* Create Order Dialog */}
      {renderCreateOrderDialog()}

      {/* View Order Dialog */}
      <Dialog open={viewDialogOpen} onClose={() => setViewDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Order Details</DialogTitle>
        <DialogContent dividers>
          {selectedOrder && (
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}><Typography variant="subtitle2">Order ID</Typography><Typography variant="body2">{selectedOrder._id}</Typography></Grid>
              <Grid item xs={12} sm={6}><Typography variant="subtitle2">Requester</Typography><Typography variant="body2">{selectedOrder.requester?.fullName} ({selectedOrder.requester?.email})</Typography></Grid>
              <Grid item xs={12} sm={6}><Typography variant="subtitle2">Status</Typography><Chip label={selectedOrder.status} color={getStatusColor(selectedOrder.status)} size="small" /></Grid>
              <Grid item xs={12} sm={6}><Typography variant="subtitle2">Priority</Typography><Chip label={selectedOrder.priority} color={getPriorityColor(selectedOrder.priority)} size="small" /></Grid>
              <Grid item xs={12}><Typography variant="subtitle2">Requests vs Fulfilled</Typography>
                {renderLeadCounts('FTD', selectedOrder.requests?.ftd, selectedOrder.fulfilled?.ftd)}
                {renderLeadCounts('Filler', selectedOrder.requests?.filler, selectedOrder.fulfilled?.filler)}
                {renderLeadCounts('Cold', selectedOrder.requests?.cold, selectedOrder.fulfilled?.cold)}
                {renderLeadCounts('Live', selectedOrder.requests?.live, selectedOrder.fulfilled?.live)}
              </Grid>
              <Grid item xs={12} sm={6}><Typography variant="subtitle2">Country Filter</Typography><Typography variant="body2">{selectedOrder.countryFilter || 'Any'}</Typography></Grid>
              <Grid item xs={12} sm={6}><Typography variant="subtitle2">Gender Filter</Typography><Typography variant="body2">{selectedOrder.genderFilter || 'Any'}</Typography></Grid>

              {/* Show exclusion filters if any were applied */}
              {(selectedOrder.excludeClients?.length > 0 || selectedOrder.excludeBrokers?.length > 0 || selectedOrder.excludeNetworks?.length > 0) && (
                <Grid item xs={12}>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>Exclusion Filters Applied</Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {selectedOrder.excludeClients?.length > 0 && (
                      <Box>
                        <Typography variant="body2" component="span" sx={{ fontWeight: 'medium' }}>Excluded Clients: </Typography>
                        {selectedOrder.excludeClients.map((client, index) => (
                          <Chip key={client} label={client} size="small" sx={{ mr: 0.5, mb: 0.5 }} />
                        ))}
                      </Box>
                    )}
                    {selectedOrder.excludeBrokers?.length > 0 && (
                      <Box>
                        <Typography variant="body2" component="span" sx={{ fontWeight: 'medium' }}>Excluded Brokers: </Typography>
                        {selectedOrder.excludeBrokers.map((broker, index) => (
                          <Chip key={broker} label={broker} size="small" sx={{ mr: 0.5, mb: 0.5 }} />
                        ))}
                      </Box>
                    )}
                    {selectedOrder.excludeNetworks?.length > 0 && (
                      <Box>
                        <Typography variant="body2" component="span" sx={{ fontWeight: 'medium' }}>Excluded Networks: </Typography>
                        {selectedOrder.excludeNetworks.map((network, index) => (
                          <Chip key={network} label={network} size="small" sx={{ mr: 0.5, mb: 0.5 }} />
                        ))}
                      </Box>
                    )}
                  </Box>
                </Grid>
              )}
              <Grid item xs={12}><Typography variant="subtitle2">Notes</Typography><Typography variant="body2">{selectedOrder.notes || 'N/A'}</Typography></Grid>
              <Grid item xs={12}><Typography variant="subtitle2">Created</Typography><Typography variant="body2">{new Date(selectedOrder.createdAt).toLocaleString()}</Typography></Grid>
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="subtitle2">Assigned Leads ({selectedOrder.leads?.length || 0})</Typography>
                  {selectedOrder.leads?.length > 0 && (
                    <Box>
                      <Button
                        size="small"
                        onClick={() => expandAllLeads(selectedOrder.leads)}
                        variant="outlined"
                        sx={{ mr: 1 }}
                      >
                        Expand All
                      </Button>
                      <Button
                        size="small"
                        onClick={() => collapseAllLeads(selectedOrder.leads)}
                        variant="outlined"
                      >
                        Collapse All
                      </Button>
                    </Box>
                  )}
                </Box>
                {selectedOrder.leads?.length > 0 ? (
                  <TableContainer component={Paper}><Table size="small">
                    <TableHead><TableRow>
                      <TableCell>Type</TableCell><TableCell>Name</TableCell>
                      <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>Country</TableCell>
                      <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>Email</TableCell>
                      <TableCell>Details</TableCell>
                    </TableRow></TableHead>
                    <TableBody>
                      {selectedOrder.leads.map((lead) => (
                        <React.Fragment key={lead._id}>
                          <TableRow>
                            <TableCell><Chip label={lead.leadType.toUpperCase()} size="small" /></TableCell>
                            <TableCell>{lead.firstName} {lead.lastName}</TableCell>
                            <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>{lead.country}</TableCell>
                            <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>{lead.newEmail}</TableCell>
                            <TableCell>
                              <IconButton
                                size="small"
                                onClick={() => toggleLeadExpansion(lead._id)}
                                aria-label={expandedLeads[lead._id] ? 'collapse' : 'expand'}
                              >
                                {expandedLeads[lead._id] ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                              </IconButton>
                            </TableCell>
                          </TableRow>
                          {expandedLeads[lead._id] && (
                            <TableRow>
                              <TableCell colSpan={5} sx={{ py: 0, border: 0 }}>
                                <Collapse in={expandedLeads[lead._id]} timeout="auto" unmountOnExit>
                                  <Box sx={{ p: 2 }}>
                                    <LeadDetailCard lead={lead} />
                                  </Box>
                                </Collapse>
                              </TableCell>
                            </TableRow>
                          )}
                        </React.Fragment>
                      ))}
                    </TableBody>
                  </Table></TableContainer>
                ) : <Typography variant="body2">No leads assigned</Typography>}
              </Grid>
            </Grid>
          )}
        </DialogContent>
                  <DialogActions>
            <Button onClick={() => setViewDialogOpen(false)}>Close</Button>
            <Button
              onClick={() => handleExportLeads(selectedOrder._id)}
              startIcon={<DownloadIcon />}
              variant="contained"
              color="primary"
            >
              Export Leads CSV
            </Button>
          </DialogActions>
      </Dialog>

      {/* Assign Client Info Dialog */}
      <AssignClientInfoDialog
        open={assignClientDialogOpen}
        onClose={handleCloseAssignClientDialog}
        onSubmit={handleAssignClientInfo}
        isSubmitting={isAssigningClient}
        orderData={selectedOrderForClient}
      />
    </Box>
  );
};

export default OrdersPage;