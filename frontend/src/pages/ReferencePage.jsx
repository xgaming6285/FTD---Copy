import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
    Box,
    Typography,
    Grid,
    Card,
    CardContent,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    useTheme,
    alpha,
    Divider,
    Avatar,
    CircularProgress,
    Alert,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Select,
    MenuItem,
    FormControl,
    InputLabel
} from '@mui/material';
import {
    Timer as TimerIcon,
    CallReceived as IncomingIcon,
    Error as ErrorIcon,
    AccessTime as TotalTimeIcon,
    AttachMoney as MoneyIcon,
    CheckCircle as SuccessIcon,
    EmojiEvents as BonusIcon,
    History as HistoryIcon,
    ExpandMore as ExpandMoreIcon
} from '@mui/icons-material';
import { selectUser } from '../store/slices/authSlice';
import { BONUS_RATES, RATE_PER_SECOND, calculateBonuses, calculateTotalPayment } from '../services/payroll/calculations';
import { fetchAgentMetrics, fetchAllAgentsMetrics } from '../services/agents';

const ReferencePage = () => {
    const theme = useTheme();
    const user = useSelector(selectUser);
    const navigate = useNavigate();
    const [metrics, setMetrics] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [expanded, setExpanded] = useState(false);
    const [selectedAgent, setSelectedAgent] = useState(null);
    const [agents, setAgents] = useState([]);

    // Add logging to see user object
    useEffect(() => {
        console.log('Current user:', user);
    }, [user]);

    const handleAccordionChange = (panel) => (event, isExpanded) => {
        setExpanded(isExpanded ? panel : false);
    };

    // Payment history data - this could be moved to a separate service later
    const paymentHistory = [
        {
            id: 1,
            period: 'March 2024',
            totalCalls: 245,
            successRate: '95.2%',
            bonuses: 320.50,
            fines: 25.00,
            totalPaid: 1250.75,
            status: 'Paid',
            paidDate: '2024-04-01'
        },
        {
            id: 2,
            period: 'February 2024',
            totalCalls: 228,
            successRate: '93.8%',
            bonuses: 290.25,
            fines: 0,
            totalPaid: 1180.50,
            status: 'Paid',
            paidDate: '2024-03-01'
        },
        {
            id: 3,
            period: 'January 2024',
            totalCalls: 210,
            successRate: '91.5%',
            bonuses: 275.00,
            fines: 15.00,
            totalPaid: 1125.25,
            status: 'Paid',
            paidDate: '2024-02-01'
        }
    ];

    useEffect(() => {
        // Redirect non-agent/non-admin users
        if (user && user.role !== 'agent' && user.role !== 'admin') {
            navigate('/');
            return;
        }

        const fetchData = async () => {
            try {
                setLoading(true);
                setError(null);

                if (user?.role === 'admin') {
                    // Fetch all agents data for admin
                    const agentsData = await fetchAllAgentsMetrics();
                    setAgents(agentsData);
                    if (agentsData.length > 0) {
                        setSelectedAgent(agentsData[0]);
                        setMetrics(agentsData[0].metrics);
                    }
                } else if (user?.role === 'agent') {
                    // Fetch current agent's data using their name
                    const agentData = await fetchAgentMetrics(user.name);
                    setMetrics(agentData.metrics);
                }
            } catch (err) {
                console.error('Error fetching metrics:', err);
                setError('Failed to load metrics data. Please try again later.');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [user, navigate]);

    const handleAgentChange = async (event) => {
        try {
            setLoading(true);
            setError(null);

            const agentName = event.target.value;
            const selectedAgentData = agents.find(agent => agent.fullName === agentName);

            if (selectedAgentData) {
                setSelectedAgent(selectedAgentData);
                setMetrics(selectedAgentData.metrics);
            } else {
                const newAgentData = await fetchAgentMetrics(agentName);
                setSelectedAgent(newAgentData);
                setMetrics(newAgentData.metrics);
            }
        } catch (err) {
            console.error('Error changing agent:', err);
            setError('Failed to load agent data. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    // If user is not an agent or admin, show access denied
    if (user && user.role !== 'agent' && user.role !== 'admin') {
        return (
            <Box p={3}>
                <Alert severity="error">
                    Access Denied. This page is only available for agents and administrators.
                </Alert>
            </Box>
        );
    }

    // Example data structure for payment calculations
    const agentStats = {
        id: "647",
        name: "David C",
        incoming: 136,
        failed: 0,
        successful: 136,
        totalTalkTime: "30:39:40",
        totalTalkTimeSeconds: 110380,
        ratePerSecond: RATE_PER_SECOND,
        totalTalkPay: 306.86,
        callCounts: {
            firstCalls: 15,
            secondCalls: 13,
            thirdCalls: 5,
            fourthCalls: 2,
            fifthCalls: 2,
            verifiedAccounts: 8
        },
        fines: 25.00
    };

    // Calculate success rate
    const successRate = (agentStats.successful / agentStats.incoming) * 100;

    // Calculate bonuses
    const bonuses = calculateBonuses(
        agentStats.callCounts.firstCalls,
        agentStats.callCounts.secondCalls,
        agentStats.callCounts.thirdCalls,
        agentStats.callCounts.fourthCalls,
        agentStats.callCounts.fifthCalls,
        agentStats.callCounts.verifiedAccounts
    );

    const totalBonuses = Object.values(bonuses).reduce((sum, bonus) => sum + bonus, 0);
    const totalPayableAmount = calculateTotalPayment(agentStats.totalTalkPay, bonuses, agentStats.fines);

    const StatCard = ({ title, value, icon, color, subtitle }) => (
        <Card
            elevation={2}
            sx={{
                height: '100%',
                transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
                '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: theme.shadows[8],
                },
            }}
        >
            <CardContent>
                <Box display="flex" alignItems="center" mb={2}>
                    <Box
                        sx={{
                            backgroundColor: alpha(theme.palette[color].main, 0.1),
                            borderRadius: '50%',
                            p: 1,
                            mr: 2,
                        }}
                    >
                        {icon}
                    </Box>
                    <Box>
                        <Typography variant="body2" color="text.secondary">
                            {title}
                        </Typography>
                        <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                            {value}
                        </Typography>
                        {subtitle && (
                            <Typography variant="caption" color="text.secondary">
                                {subtitle}
                            </Typography>
                        )}
                    </Box>
                </Box>
            </CardContent>
        </Card>
    );

    // Show loading state
    if (loading) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
                <CircularProgress />
            </Box>
        );
    }

    // Show error state
    if (error) {
        return (
            <Box m={2}>
                <Alert severity="error">{error}</Alert>
            </Box>
        );
    }

    // Get the current agent data based on role
    const currentAgentData = user.role === 'admin' ? selectedAgent : {
        fullName: user.fullName,
        metrics: metrics,
        stats: agentStats
    };

    return (
        <Box p={3}>
            {/* Admin Agent Selector */}
            {user.role === 'admin' && (
                <Box mb={4}>
                    <FormControl fullWidth>
                        <InputLabel id="agent-select-label">Select Agent</InputLabel>
                        <Select
                            labelId="agent-select-label"
                            id="agent-select"
                            value={selectedAgent?.fullName || ''}
                            label="Select Agent"
                            onChange={handleAgentChange}
                            sx={{
                                backgroundColor: 'white',
                                '&:hover': {
                                    backgroundColor: alpha(theme.palette.primary.main, 0.05),
                                },
                            }}
                        >
                            {agents.map((agent) => (
                                <MenuItem key={agent.fullName} value={agent.fullName}>
                                    {agent.fullName}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </Box>
            )}

            {/* Agent Info Header */}
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    mb: 4,
                    backgroundColor: alpha(theme.palette.primary.main, 0.1),
                    borderRadius: 2,
                    p: 2
                }}
            >
                <Avatar
                    sx={{
                        width: 64,
                        height: 64,
                        bgcolor: theme.palette.primary.main,
                        mr: 2
                    }}
                >
                    {currentAgentData?.fullName?.charAt(0)?.toUpperCase()}
                </Avatar>
                <Box>
                    <Typography variant="h4" sx={{ fontWeight: 500 }}>
                        {currentAgentData?.fullName}
                    </Typography>
                    <Typography variant="subtitle1" color="text.secondary">
                        Agent Performance Metrics
                    </Typography>
                </Box>
            </Box>

            {/* Performance Metrics */}
            <Typography variant="h6" sx={{ mb: 2 }}>Performance Overview</Typography>
            <Grid container spacing={3} sx={{ mb: 4 }}>
                <Grid item xs={12} sm={6} md={3}>
                    <StatCard
                        title="Incoming Calls"
                        value={currentAgentData?.metrics?.incoming || 0}
                        icon={<IncomingIcon color="primary" />}
                        color="primary"
                        subtitle="Total incoming requests"
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <StatCard
                        title="Unsuccessful Calls"
                        value={currentAgentData?.metrics?.unsuccessful || 0}
                        icon={<ErrorIcon color="error" />}
                        color="error"
                        subtitle="Failed requests"
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <StatCard
                        title="Average Time"
                        value={currentAgentData?.metrics?.averageTime ? `${(currentAgentData.metrics.averageTime / 60).toFixed(1)} min` : '0 min'}
                        icon={<TimerIcon color="info" />}
                        color="info"
                        subtitle="Average processing time"
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <StatCard
                        title="Total Time"
                        value={currentAgentData?.metrics?.totalTime ? `${(currentAgentData.metrics.totalTime / 3600).toFixed(1)} hrs` : '0 hrs'}
                        icon={<TotalTimeIcon color="success" />}
                        color="success"
                        subtitle="Total processing time"
                    />
                </Grid>
            </Grid>

            {/* Payment Information */}
            <Typography variant="h6" sx={{ mb: 2 }}>Payment Information</Typography>
            <Grid container spacing={3} sx={{ mb: 4 }}>
                <Grid item xs={12} sm={6} md={4}>
                    <StatCard
                        title="Success Rate"
                        value={`${successRate.toFixed(1)}%`}
                        icon={<SuccessIcon color="success" />}
                        color="success"
                        subtitle={`${currentAgentData?.stats?.successful} / ${currentAgentData?.stats?.incoming} calls`}
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                    <StatCard
                        title="Total Bonuses"
                        value={`$${totalBonuses.toFixed(2)}`}
                        icon={<BonusIcon color="primary" />}
                        color="primary"
                        subtitle={`${Object.values(currentAgentData?.stats?.callCounts).reduce((a, b) => a + b, 0)} qualified calls`}
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                    <StatCard
                        title="Total Payable"
                        value={`$${totalPayableAmount.toFixed(2)}`}
                        icon={<MoneyIcon color="info" />}
                        color="info"
                        subtitle={currentAgentData?.stats?.fines > 0 ? `Fines: -$${currentAgentData.stats.fines.toFixed(2)}` : 'No fines'}
                    />
                </Grid>
            </Grid>

            {/* Bonus Details */}
            <Typography variant="h6" sx={{ mb: 2 }}>Bonus Details</Typography>
            <Paper elevation={2}>
                <Box p={2}>
                    <Grid container spacing={2}>
                        <Grid item xs={12} md={6}>
                            <Typography variant="subtitle1" gutterBottom sx={{ color: theme.palette.success.main }}>
                                Call Bonuses
                            </Typography>
                            <Box pl={2}>
                                <Typography variant="body2">1st Calls ({currentAgentData?.stats?.callCounts.firstCalls}): ${bonuses.firstCallBonus.toFixed(2)}</Typography>
                                <Typography variant="body2">2nd Calls ({currentAgentData?.stats?.callCounts.secondCalls}): ${bonuses.secondCallBonus.toFixed(2)}</Typography>
                                <Typography variant="body2">3rd Calls ({currentAgentData?.stats?.callCounts.thirdCalls}): ${bonuses.thirdCallBonus.toFixed(2)}</Typography>
                                <Typography variant="body2">4th Calls ({currentAgentData?.stats?.callCounts.fourthCalls}): ${bonuses.fourthCallBonus.toFixed(2)}</Typography>
                                <Typography variant="body2">5th Calls ({currentAgentData?.stats?.callCounts.fifthCalls}): ${bonuses.fifthCallBonus.toFixed(2)}</Typography>
                            </Box>
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <Typography variant="subtitle1" gutterBottom sx={{ color: theme.palette.info.main }}>
                                Additional Bonuses
                            </Typography>
                            <Box pl={2}>
                                <Typography variant="body2">
                                    Verified Accounts ({currentAgentData?.stats?.callCounts.verifiedAccounts}): ${bonuses.verifiedAccBonus.toFixed(2)}
                                </Typography>
                            </Box>
                            <Divider sx={{ my: 2 }} />
                            <Typography variant="subtitle1" gutterBottom sx={{ color: theme.palette.error.main }}>
                                Deductions
                            </Typography>
                            <Box pl={2}>
                                <Typography variant="body2">Fines: -${currentAgentData?.stats?.fines.toFixed(2)}</Typography>
                            </Box>
                        </Grid>
                    </Grid>
                </Box>
            </Paper>

            {/* Payment History Section */}
            <Box sx={{ mt: 4 }}>
                <Accordion
                    expanded={expanded === 'paymentHistory'}
                    onChange={handleAccordionChange('paymentHistory')}
                    sx={{
                        '&:before': {
                            display: 'none',
                        },
                        boxShadow: theme.shadows[2],
                        '&:hover': {
                            boxShadow: theme.shadows[4],
                        },
                    }}
                >
                    <AccordionSummary
                        expandIcon={<ExpandMoreIcon />}
                        sx={{
                            backgroundColor: alpha(theme.palette.primary.main, 0.05),
                            '&:hover': {
                                backgroundColor: alpha(theme.palette.primary.main, 0.1),
                            },
                        }}
                    >
                        <Box display="flex" alignItems="center">
                            <HistoryIcon sx={{ mr: 1, color: theme.palette.primary.main }} />
                            <Typography variant="h6">Payment History</Typography>
                        </Box>
                    </AccordionSummary>
                    <AccordionDetails sx={{ p: 0 }}>
                        <TableContainer>
                            <Table>
                                <TableHead>
                                    <TableRow sx={{ backgroundColor: alpha(theme.palette.primary.main, 0.05) }}>
                                        <TableCell>Period</TableCell>
                                        <TableCell align="right">Total Calls</TableCell>
                                        <TableCell align="right">Success Rate</TableCell>
                                        <TableCell align="right">Bonuses</TableCell>
                                        <TableCell align="right">Fines</TableCell>
                                        <TableCell align="right">Total Paid</TableCell>
                                        <TableCell>Status</TableCell>
                                        <TableCell>Paid Date</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {paymentHistory.map((payment) => (
                                        <TableRow
                                            key={payment.id}
                                            sx={{
                                                '&:hover': {
                                                    backgroundColor: alpha(theme.palette.primary.main, 0.05)
                                                }
                                            }}
                                        >
                                            <TableCell>{payment.period}</TableCell>
                                            <TableCell align="right">{payment.totalCalls}</TableCell>
                                            <TableCell align="right">{payment.successRate}</TableCell>
                                            <TableCell align="right" sx={{ color: theme.palette.success.main }}>
                                                ${payment.bonuses.toFixed(2)}
                                            </TableCell>
                                            <TableCell align="right" sx={{ color: theme.palette.error.main }}>
                                                ${payment.fines.toFixed(2)}
                                            </TableCell>
                                            <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                                                ${payment.totalPaid.toFixed(2)}
                                            </TableCell>
                                            <TableCell>
                                                <Box
                                                    sx={{
                                                        backgroundColor: payment.status === 'Paid'
                                                            ? alpha(theme.palette.success.main, 0.1)
                                                            : alpha(theme.palette.warning.main, 0.1),
                                                        color: payment.status === 'Paid'
                                                            ? theme.palette.success.main
                                                            : theme.palette.warning.main,
                                                        py: 0.5,
                                                        px: 1,
                                                        borderRadius: 1,
                                                        display: 'inline-block'
                                                    }}
                                                >
                                                    {payment.status}
                                                </Box>
                                            </TableCell>
                                            <TableCell>{payment.paidDate}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </AccordionDetails>
                </Accordion>
            </Box>
        </Box>
    );
};

export default ReferencePage; 