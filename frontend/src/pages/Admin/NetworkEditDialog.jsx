import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    Box,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    OutlinedInput,
    Chip,
    CircularProgress
} from '@mui/material';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import api from '../../services/api';
import { toast } from 'react-hot-toast';

const schema = yup.object().shape({
    name: yup.string().required('Network name is required').min(3, 'Name must be at least 3 characters'),
    affiliateManagers: yup.array().of(yup.string()),
});

const NetworkEditDialog = ({ open, onClose, onSave, network }) => {
    const [allManagers, setAllManagers] = useState([]);
    const [loading, setLoading] = useState(false);

    const { control, handleSubmit, reset, setValue } = useForm({
        resolver: yupResolver(schema),
        defaultValues: {
            name: '',
            affiliateManagers: [],
        },
    });

    useEffect(() => {
        // Fetch all affiliate managers to populate the select dropdown
        const fetchManagers = async () => {
            try {
                const { data } = await api.get('/users?role=affiliate_manager');
                setAllManagers(data.data);
            } catch (error) {
                console.error('Failed to fetch affiliate managers', error);
                toast.error('Could not load affiliate managers.');
            }
        };
        fetchManagers();
    }, []);

    useEffect(() => {
        // Populate form when a network is selected for editing
        if (network) {
            setValue('name', network.name);
            setValue('affiliateManagers', network.affiliateManagers ? network.affiliateManagers.map(m => m._id) : []);
        } else {
            reset();
        }
    }, [network, setValue, reset]);

    const onSubmit = async (formData) => {
        setLoading(true);
        try {
            if (network) {
                // Update existing network
                await api.put(`/client-networks/${network._id}`, formData);
                toast.success('Network updated successfully!');
            } else {
                // Create new network
                await api.post('/client-networks', formData);
                toast.success('Network created successfully!');
            }
            onSave(); // Refresh the list on the parent page
            onClose(); // Close the dialog
        } catch (error) {
            console.error('Failed to save network', error);
            toast.error(error.response?.data?.message || 'Failed to save network.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
            <DialogTitle>{network ? 'Edit Client Network' : 'Add New Client Network'}</DialogTitle>
            <form onSubmit={handleSubmit(onSubmit)}>
                <DialogContent>
                    <Controller
                        name="name"
                        control={control}
                        render={({ field, fieldState: { error } }) => (
                            <TextField
                                {...field}
                                label="Network Name"
                                fullWidth
                                margin="normal"
                                error={!!error}
                                helperText={error?.message}
                            />
                        )}
                    />
                    <FormControl fullWidth margin="normal">
                        <InputLabel>Assign Affiliate Managers</InputLabel>
                        <Controller
                            name="affiliateManagers"
                            control={control}
                            render={({ field }) => (
                                <Select
                                    {...field}
                                    multiple
                                    input={<OutlinedInput label="Assign Affiliate Managers" />}
                                    renderValue={(selected) => (
                                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                            {allManagers.filter(m => selected.includes(m._id)).map(m => (
                                                <Chip key={m._id} label={m.fullName} />
                                            ))}
                                        </Box>
                                    )}
                                >
                                    {allManagers.map((manager) => (
                                        <MenuItem key={manager._id} value={manager._id}>
                                            {manager.fullName}
                                        </MenuItem>
                                    ))}
                                </Select>
                            )}
                        />
                    </FormControl>
                </DialogContent>
                <DialogActions>
                    <Button onClick={onClose}>Cancel</Button>
                    <Button type="submit" variant="contained" disabled={loading}>
                        {loading ? <CircularProgress size={24} /> : 'Save'}
                    </Button>
                </DialogActions>
            </form>
        </Dialog>
    );
};

export default NetworkEditDialog; 