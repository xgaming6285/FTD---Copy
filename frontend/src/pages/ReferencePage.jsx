import React from 'react';
import { useSelector } from 'react-redux';
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
    LinearProgress,
    Tooltip,
    Chip
} from '@mui/material';
import {
    Phone as PhoneIcon,
    Timer as TimerIcon,
    AttachMoney as MoneyIcon,
    CheckCircle as SuccessIcon,
    Cancel as FailedIcon,
    EmojiEvents as BonusIcon,
    Verified as VerifiedIcon,
    Person as PersonIcon
} from '@mui/icons-material';
import { selectUser } from '../store/slices/authSlice';
import { BONUS_RATES, RATE_PER_SECOND, calculateBonuses, calculateTotalPayment } from '../services/payroll/calculations';

const ReferencePage = () => {
    const theme = useTheme();
    const user = useSelector(selectUser);

    // Example data structure matching the real table
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

    const StatCard = ({ title, value, secondaryValue, icon, color }) => (
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
                        {secondaryValue && (
                            <Typography variant="caption" color="text.secondary">
                                {secondaryValue}
                            </Typography>
                        )}
                    </Box>
                </Box>
            </CardContent>
        </Card>
    );

    return (
        <Box p={3}>
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
                    {user?.fullName?.charAt(0)?.toUpperCase()}
                </Avatar>
                <Box>
                    <Typography variant="h4" sx={{ fontWeight: 500 }}>
                        {user?.fullName}
                    </Typography>
                </Box>
            </Box>

            {/* Summary Cards */}
            <Grid container spacing={3} sx={{ mb: 4 }}>
                <Grid item xs={12} sm={6} md={3}>
                    <StatCard
                        title="Call Success Rate"
                        value={`${successRate.toFixed(1)}%`}
                        secondaryValue={`${agentStats.successful} / ${agentStats.incoming} calls`}
                        icon={<SuccessIcon color="success" />}
                        color="success"
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <StatCard
                        title="Total Talk Time"
                        value={agentStats.totalTalkTime}
                        secondaryValue={`${agentStats.totalTalkTimeSeconds} seconds`}
                        icon={<TimerIcon color="secondary" />}
                        color="secondary"
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <StatCard
                        title="Total Bonuses"
                        value={`$${totalBonuses.toFixed(2)}`}
                        secondaryValue={`${Object.values(agentStats.callCounts).reduce((a, b) => a + b, 0)} qualified calls`}
                        icon={<BonusIcon color="primary" />}
                        color="primary"
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <StatCard
                        title="Total Payable"
                        value={`$${totalPayableAmount.toFixed(2)}`}
                        secondaryValue={agentStats.fines > 0 ? `Fines: -$${agentStats.fines.toFixed(2)}` : 'No fines'}
                        icon={<MoneyIcon color="info" />}
                        color="info"
                    />
                </Grid>
            </Grid>

            {/* Detailed Statistics */}
            <Grid container spacing={3}>
                <Grid item xs={12} md={8}>
                    <TableContainer component={Paper} elevation={2}>
                        <Table>
                            <TableHead>
                                <TableRow sx={{ backgroundColor: theme.palette.primary.main }}>
                                    <TableCell colSpan={2}>
                                        <Typography variant="h6" sx={{ color: 'white' }}>
                                            Detailed Statistics
                                        </Typography>
                                    </TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                <TableRow>
                                    <TableCell>Total Incoming Calls</TableCell>
                                    <TableCell align="right">
                                        <Box display="flex" alignItems="center" justifyContent="flex-end">
                                            <Typography>{agentStats.incoming}</Typography>
                                            <Chip
                                                size="small"
                                                label={`${successRate.toFixed(1)}% success`}
                                                color="success"
                                                sx={{ ml: 1 }}
                                            />
                                        </Box>
                                    </TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell>Failed Calls</TableCell>
                                    <TableCell align="right">{agentStats.failed}</TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell>Successful Calls</TableCell>
                                    <TableCell align="right">{agentStats.successful}</TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell>Total Talk Time</TableCell>
                                    <TableCell align="right">{agentStats.totalTalkTime} ({agentStats.totalTalkTimeSeconds} sec)</TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell>Rate ($/sec)</TableCell>
                                    <TableCell align="right">${agentStats.ratePerSecond.toFixed(7)}</TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell>Total Talk Pay</TableCell>
                                    <TableCell align="right">${agentStats.totalTalkPay.toFixed(2)}</TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Grid>

                <Grid item xs={12} md={4}>
                    <Paper elevation={2}>
                        <Box p={2}>
                            <Typography variant="h6" gutterBottom>Bonuses & Deductions</Typography>
                            <Divider sx={{ mb: 2 }} />

                            <Typography variant="subtitle1" gutterBottom sx={{ color: theme.palette.success.main }}>
                                Call Bonuses:
                            </Typography>
                            <Box pl={2} mb={2}>
                                <Typography variant="body2">
                                    1st Calls ({agentStats.callCounts.firstCalls}): ${bonuses.firstCallBonus.toFixed(2)}
                                </Typography>
                                <Typography variant="body2">
                                    2nd Calls ({agentStats.callCounts.secondCalls}): ${bonuses.secondCallBonus.toFixed(2)}
                                </Typography>
                                <Typography variant="body2">
                                    3rd Calls ({agentStats.callCounts.thirdCalls}): ${bonuses.thirdCallBonus.toFixed(2)}
                                </Typography>
                                <Typography variant="body2">
                                    4th Calls ({agentStats.callCounts.fourthCalls}): ${bonuses.fourthCallBonus.toFixed(2)}
                                </Typography>
                                <Typography variant="body2">
                                    5th Calls ({agentStats.callCounts.fifthCalls}): ${bonuses.fifthCallBonus.toFixed(2)}
                                </Typography>
                            </Box>

                            <Typography variant="subtitle1" gutterBottom sx={{ color: theme.palette.info.main }}>
                                Additional Bonuses:
                            </Typography>
                            <Box pl={2} mb={2}>
                                <Typography variant="body2">
                                    Verified Accounts ({agentStats.callCounts.verifiedAccounts}): ${bonuses.verifiedAccBonus.toFixed(2)}
                                </Typography>
                            </Box>

                            <Typography variant="subtitle1" gutterBottom sx={{ color: theme.palette.error.main }}>
                                Deductions:
                            </Typography>
                            <Box pl={2} mb={2}>
                                <Typography variant="body2">Fines: -${agentStats.fines.toFixed(2)}</Typography>
                            </Box>

                            <Divider sx={{ my: 2 }} />

                            <Typography variant="subtitle1" gutterBottom>
                                Final Payment Calculation:
                            </Typography>
                            <Box pl={2}>
                                <Typography variant="body2">Talk Pay: ${agentStats.totalTalkPay.toFixed(2)}</Typography>
                                <Typography variant="body2">Total Bonuses: ${totalBonuses.toFixed(2)}</Typography>
                                <Typography variant="body2">Total Deductions: -${agentStats.fines.toFixed(2)}</Typography>
                                <Typography variant="h6" sx={{ mt: 1, color: theme.palette.primary.main }}>
                                    Total Payable Amount: ${totalPayableAmount.toFixed(2)}
                                </Typography>
                            </Box>
                        </Box>
                    </Paper>
                </Grid>
            </Grid>
        </Box>
    );
};

export default ReferencePage; 