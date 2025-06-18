import React, { useState, useEffect } from 'react';
import { 
    Box, 
    Typography, 
    Button, 
    Container, 
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    IconButton,
    CircularProgress,
    Alert
} from '@mui/material';
import { Add, Edit, Delete } from '@mui/icons-material';
import api from '../../services/api';
import { toast } from 'react-hot-toast';
import NetworkEditDialog from './NetworkEditDialog'; 

const ClientNetworksPage = () => {
    const [networks, setNetworks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    
    const [dialogOpen, setDialogOpen] = useState(false);
    const [selectedNetwork, setSelectedNetwork] = useState(null);

    useEffect(() => {
        fetchNetworks();
    }, []);

    const fetchNetworks = async () => {
        setLoading(true);
        try {
            const { data } = await api.get('/client-networks');
            setNetworks(data.data);
            setError('');
        } catch (err) {
            setError('Failed to fetch client networks.');
            toast.error('Failed to fetch client networks.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this network? This action cannot be undone.')) {
            try {
                await api.delete(`/client-networks/${id}`);
                toast.success('Client network deleted successfully.');
                fetchNetworks(); // Refresh list
            } catch (err) {
                toast.error('Failed to delete client network.');
                console.error(err);
            }
        }
    };

    return (
        <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h4" component="h1">
                    Client Network Management
                </Typography>
                <Button 
                    variant="contained" 
                    startIcon={<Add />}
                    onClick={() => { setSelectedNetwork(null); setDialogOpen(true); }}
                >
                    Add Network
                </Button>
            </Box>

            {loading ? (
                <CircularProgress />
            ) : error ? (
                <Alert severity="error">{error}</Alert>
            ) : (
                <Paper sx={{ width: '100%', overflow: 'hidden' }}>
                    <TableContainer>
                        <Table stickyHeader>
                            <TableHead>
                                <TableRow>
                                    <TableCell>Name</TableCell>
                                    <TableCell>Assigned Managers</TableCell>
                                    <TableCell>Created At</TableCell>
                                    <TableCell align="right">Actions</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {networks.map((network) => (
                                    <TableRow hover key={network._id}>
                                        <TableCell>{network.name}</TableCell>
                                        <TableCell>
                                            {network.affiliateManagers && network.affiliateManagers.length > 0
                                                ? network.affiliateManagers.map(m => m.fullName).join(', ')
                                                : 'None'}
                                        </TableCell>
                                        <TableCell>{new Date(network.createdAt).toLocaleDateString()}</TableCell>
                                        <TableCell align="right">
                                            <IconButton 
                                                onClick={() => { setSelectedNetwork(network); setDialogOpen(true); }}
                                            >
                                                <Edit />
                                            </IconButton>
                                            <IconButton onClick={() => handleDelete(network._id)}>
                                                <Delete />
                                            </IconButton>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Paper>
            )}

            <NetworkEditDialog 
                open={dialogOpen}
                onClose={() => setDialogOpen(false)}
                onSave={fetchNetworks}
                network={selectedNetwork}
            />
        </Container>
    );
};

export default ClientNetworksPage; 