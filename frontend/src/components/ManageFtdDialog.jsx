import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    List,
    ListItem,
    ListItemText,
    FormControl,
    Select,
    MenuItem,
    Box,
    Typography,
    CircularProgress,
    Alert
} from '@mui/material';
import api from '../services/api';
import { toast } from 'react-hot-toast';

const ManageFtdDialog = ({ open, onClose, order }) => {
    const [leads, setLeads] = useState([]);
    const [brokers, setBrokers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [selectedBrokers, setSelectedBrokers] = useState({}); // { leadId: brokerId }

    useEffect(() => {
        if (open && order) {
            fetchData();
        }
    }, [open, order]);

    const fetchData = async () => {
        setLoading(true);
        setError('');
        try {
            // Fetch unfulfilled FTD leads for the order
            const leadsRes = await api.get(`/api/orders/${order._id}/leads?leadType=ftd&injected=false`);
            setLeads(leadsRes.data.data);

            // Fetch available brokers for the order's network
            const brokersRes = await api.get(`/api/client-networks/${order.clientNetwork._id}/brokers`);
            setBrokers(brokersRes.data.data);

        } catch (err) {
            setError('Failed to fetch data for FTD management.');
            toast.error('Failed to fetch data.');
        } finally {
            setLoading(false);
        }
    };

    const handleBrokerChange = (leadId, brokerId) => {
        setSelectedBrokers(prev => ({ ...prev, [leadId]: brokerId }));
    };

    const handleInject = async (leadId) => {
        const clientBrokerId = selectedBrokers[leadId];
        if (!clientBrokerId) {
            toast.error('Please select a broker before injecting.');
            return;
        }

        try {
            await api.post(`/api/orders/${order._id}/leads/${leadId}/inject`, { clientBrokerId });
            toast.success(`Injection initiated for lead.`);
            fetchData(); // Refresh the list of leads
        } catch (err) {
            toast.error(err.response?.data?.message || 'Injection failed.');
        }
    };

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
            <DialogTitle>Manage FTD Leads for Order #{order?.orderNumber}</DialogTitle>
            <DialogContent>
                {loading && <CircularProgress />}
                {error && <Alert severity="error">{error}</Alert>}
                {!loading && !error && (
                    <List>
                        {leads.map(lead => (
                            <ListItem key={lead._id} divider>
                                <ListItemText 
                                    primary={`${lead.firstName} ${lead.lastName}`}
                                    secondary={lead.newEmail}
                                />
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                    <FormControl sx={{ minWidth: 200 }}>
                                        <Select
                                            value={selectedBrokers[lead._id] || ''}
                                            onChange={(e) => handleBrokerChange(lead._id, e.target.value)}
                                            displayEmpty
                                            size="small"
                                        >
                                            <MenuItem value="" disabled>Select a Broker</MenuItem>
                                            {brokers.map(broker => (
                                                <MenuItem key={broker._id} value={broker._id}>{broker.name}</MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>
                                    <Button 
                                        variant="contained" 
                                        onClick={() => handleInject(lead._id)}
                                        disabled={!selectedBrokers[lead._id]}
                                    >
                                        Inject
                                    </Button>
                                </Box>
                            </ListItem>
                        ))}
                        {leads.length === 0 && (
                            <Typography sx={{ p: 2 }}>All FTD leads for this order have been fulfilled.</Typography>
                        )}
                    </List>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Close</Button>
            </DialogActions>
        </Dialog>
    );
};

export default ManageFtdDialog; 