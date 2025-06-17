import React, { useEffect, useState } from 'react';
import axios from 'axios';

interface CallStatistics {
    userId: string;
    userName: string;
    callSuccessRate: {
        percentage: number;
        totalCalls: number;
        successfulCalls: number;
    };
    totalTalkTime: {
        formatted: string;
        seconds: number;
    };
    bonuses: {
        total: number;
        qualifiedCalls: number;
        details: {
            firstCalls: { count: number; amount: number; };
            secondCalls: { count: number; amount: number; };
            thirdCalls: { count: number; amount: number; };
            fourthCalls: { count: number; amount: number; };
            fifthCalls: { count: number; amount: number; };
            verifiedAccounts: { count: number; amount: number; };
        };
    };
    financials: {
        talkPay: number;
        totalBonuses: number;
        totalDeductions: number;
        totalPayable: number;
    };
    detailedStats: {
        totalIncomingCalls: number;
        failedCalls: number;
        successfulCalls: number;
        totalTalkTime: string;
        ratePerSecond: number;
        totalTalkPay: number;
    };
}

const ReferencePage: React.FC = () => {
    const [userData, setUserData] = useState<CallStatistics | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchUserData = async () => {
            try {
                const response = await axios.get('http://your-python-api/user-statistics');
                setUserData(response.data);
                setLoading(false);
            } catch (err) {
                setError('Error fetching user statistics');
                setLoading(false);
            }
        };

        fetchUserData();
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center min-h-screen text-red-500">
                {error}
            </div>
        );
    }

    if (!userData) return null;

    return (
        <div className="container mx-auto px-4 py-8">
            <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center text-white text-xl">
                    {userData.userName[0]}
                </div>
                <h1 className="text-2xl font-bold">{userData.userName}</h1>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {/* Success Rate Card */}
                <div className="bg-white rounded-lg shadow-md p-6">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="text-green-500">✓</span>
                        <h3 className="font-semibold">Call Success Rate</h3>
                    </div>
                    <div className="text-2xl font-bold">{userData.callSuccessRate.percentage}%</div>
                    <div className="text-sm text-gray-600">
                        {userData.callSuccessRate.successfulCalls} / {userData.callSuccessRate.totalCalls} calls
                    </div>
                </div>

                {/* Talk Time Card */}
                <div className="bg-white rounded-lg shadow-md p-6">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="text-blue-500">⏱</span>
                        <h3 className="font-semibold">Total Talk Time</h3>
                    </div>
                    <div className="text-2xl font-bold">{userData.totalTalkTime.formatted}</div>
                    <div className="text-sm text-gray-600">{userData.totalTalkTime.seconds} seconds</div>
                </div>

                {/* Bonuses Card */}
                <div className="bg-white rounded-lg shadow-md p-6">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="text-yellow-500">🏆</span>
                        <h3 className="font-semibold">Total Bonuses</h3>
                    </div>
                    <div className="text-2xl font-bold">${userData.bonuses.total}</div>
                    <div className="text-sm text-gray-600">{userData.bonuses.qualifiedCalls} qualified calls</div>
                </div>

                {/* Total Payable Card */}
                <div className="bg-white rounded-lg shadow-md p-6">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="text-green-500">$</span>
                        <h3 className="font-semibold">Total Payable</h3>
                    </div>
                    <div className="text-2xl font-bold">${userData.financials.totalPayable}</div>
                    <div className="text-sm text-gray-600">
                        {userData.financials.totalDeductions < 0 ? `Fines: $${Math.abs(userData.financials.totalDeductions)}` : 'No deductions'}
                    </div>
                </div>
            </div>

            {/* Detailed Statistics */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2">
                    <div className="bg-white rounded-lg shadow-md p-6">
                        <h2 className="text-xl font-bold mb-4">Detailed Statistics</h2>
                        <table className="w-full">
                            <tbody>
                                <tr className="border-b">
                                    <td className="py-2">Total Incoming Calls</td>
                                    <td className="py-2 text-right">{userData.detailedStats.totalIncomingCalls}</td>
                                </tr>
                                <tr className="border-b">
                                    <td className="py-2">Failed Calls</td>
                                    <td className="py-2 text-right">{userData.detailedStats.failedCalls}</td>
                                </tr>
                                <tr className="border-b">
                                    <td className="py-2">Successful Calls</td>
                                    <td className="py-2 text-right">{userData.detailedStats.successfulCalls}</td>
                                </tr>
                                <tr className="border-b">
                                    <td className="py-2">Total Talk Time</td>
                                    <td className="py-2 text-right">{userData.detailedStats.totalTalkTime}</td>
                                </tr>
                                <tr className="border-b">
                                    <td className="py-2">Rate ($/sec)</td>
                                    <td className="py-2 text-right">${userData.detailedStats.ratePerSecond.toFixed(7)}</td>
                                </tr>
                                <tr>
                                    <td className="py-2">Total Talk Pay</td>
                                    <td className="py-2 text-right">${userData.detailedStats.totalTalkPay.toFixed(2)}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <div>
                    <div className="bg-white rounded-lg shadow-md p-6">
                        <h2 className="text-xl font-bold mb-4">Bonuses & Deductions</h2>
                        <div className="mb-4">
                            <h3 className="font-semibold mb-2">Call Bonuses:</h3>
                            <ul className="space-y-1">
                                <li>1st Calls ({userData.bonuses.details.firstCalls.count}): ${userData.bonuses.details.firstCalls.amount}</li>
                                <li>2nd Calls ({userData.bonuses.details.secondCalls.count}): ${userData.bonuses.details.secondCalls.amount}</li>
                                <li>3rd Calls ({userData.bonuses.details.thirdCalls.count}): ${userData.bonuses.details.thirdCalls.amount}</li>
                                <li>4th Calls ({userData.bonuses.details.fourthCalls.count}): ${userData.bonuses.details.fourthCalls.amount}</li>
                                <li>5th Calls ({userData.bonuses.details.fifthCalls.count}): ${userData.bonuses.details.fifthCalls.amount}</li>
                            </ul>
                        </div>
                        <div className="mb-4">
                            <h3 className="font-semibold mb-2">Additional Bonuses:</h3>
                            <ul>
                                <li>Verified Accounts ({userData.bonuses.details.verifiedAccounts.count}):
                                    ${userData.bonuses.details.verifiedAccounts.amount}
                                </li>
                            </ul>
                        </div>
                        <div className="mb-4">
                            <h3 className="font-semibold mb-2">Deductions:</h3>
                            <ul>
                                <li>Fines: ${Math.abs(userData.financials.totalDeductions)}</li>
                            </ul>
                        </div>
                        <div className="border-t pt-4 mt-4">
                            <h3 className="font-semibold mb-2">Final Payment Calculation:</h3>
                            <ul className="space-y-1">
                                <li>Talk Pay: ${userData.financials.talkPay}</li>
                                <li>Total Bonuses: ${userData.financials.totalBonuses}</li>
                                <li>Total Deductions: ${Math.abs(userData.financials.totalDeductions)}</li>
                                <li className="font-bold text-blue-600">
                                    Total Payable Amount: ${userData.financials.totalPayable}
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ReferencePage; 