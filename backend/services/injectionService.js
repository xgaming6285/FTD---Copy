const Order = require('../models/Order');
const Lead = require('../models/Lead');
const ClientBroker = require('../models/ClientBroker');
const ErrorResponse = require('../utils/errorResponse');
const { spawn } = require('child_process');

class InjectionService {
    constructor(orderId, userId) {
        this.orderId = orderId;
        this.userId = userId;
        this.order = null;
    }

    async init() {
        this.order = await Order.findById(this.orderId).populate('clientNetwork');
        if (!this.order) {
            throw new ErrorResponse('Order not found', 404);
        }
        if (this.order.requester.toString() !== this.userId.toString() && !['admin'].includes(req.user.role) ) {
             throw new ErrorResponse('User not authorized to process this order', 403);
        }
    }

    async startInjection() {
        if (!this.order) await this.init();

        if (this.order.injectionType === 'manual') {
            await this.processManualInjection();
        } else if (this.order.injectionType === 'auto') {
            if (this.order.autoInjectionSettings.type === 'bulk') {
                await this.processBulkAutoInjection();
            } else if (this.order.autoInjectionSettings.type === 'scheduled') {
                // For scheduled, we just log that it's set up. A separate cron job/scheduler would trigger this.
                console.log(`Order ${this.order._id} is scheduled for injection from ${this.order.autoInjectionSettings.startTime} to ${this.order.autoInjectionSettings.endTime}.`);
            }
        }
    }

    async processManualInjection() {
        // In manual mode, the affiliate manager/admin is expected to manually trigger injections for leads.
        // This function could set the order status to 'injecting' to allow the UI to show injection options per lead.
        this.order.status = 'injecting';
        await this.order.save();
        console.log(`Order ${this.order._id} is now in manual injection mode.`);
    }

    async processBulkAutoInjection() {
        this.order.status = 'injecting';
        await this.order.save();

        const leadTypesToInject = Object.keys(this.order.requests).filter(type => type !== 'ftd' && this.order.requests[type] > 0);
        
        for (const leadType of leadTypesToInject) {
            const requestedCount = this.order.requests[leadType];
            const leads = await this.findLeadsForInjection(leadType, requestedCount);
            
            for (const lead of leads) {
                await this.injectLead(lead);
            }
        }

        if(this.order.requests.ftd > 0) {
            this.order.ftdSkipped = true;
            // Await admin/manager action for FTDs
        }

        this.order.status = 'injection_complete';
        await this.order.save();
        console.log(`Bulk auto-injection for order ${this.order._id} is complete.`);
    }

    async findLeadsForInjection(leadType, count) {
        // Find leads that are not assigned and have not been injected to this order's client network before.
        const leads = await Lead.find({
            leadType: leadType,
            isAssigned: false,
            'assignments.clientNetwork': { $ne: this.order.clientNetwork._id }
        }).limit(count);
        return leads;
    }

    async injectLead(lead, manualBroker = null) {
        // This is the core injection logic for a single lead.
        
        // FTD Protection: FTDs must be handled manually.
        if (lead.leadType === 'ftd' && this.order.injectionType === 'auto') {
            const errorMessage = `FATAL: Attempted to auto-inject FTD lead ${lead._id}. This is not allowed.`;
            console.error(errorMessage);
            this.order.logs.push({
                message: `FATAL: Attempted to auto-inject FTD lead ${lead.fullName || lead._id}. This action is blocked.`,
                type: 'error',
                lead: lead._id
            });
            await this.order.save();
            // We throw an error to halt the process for this lead immediately and clearly signal a problem.
            throw new ErrorResponse(errorMessage, 400); 
        }

        // Allow manual injection of FTDs
        if (lead.leadType === 'ftd' && this.order.injectionType === 'manual' && !manualBroker) {
            const errorMessage = `Manual injection for FTD lead ${lead._id} requires a specific client broker.`;
            console.warn(errorMessage);
            this.order.logs.push({
                message: errorMessage,
                type: 'warning',
                lead: lead._id
            });
            await this.order.save();
            return;
        }

        // Prevent re-assignment to the same client network
        const isAlreadyAssignedToNetwork = lead.assignments.some(
            (a) => a.clientNetwork && a.clientNetwork.equals(this.order.clientNetwork._id)
        );

        if (isAlreadyAssignedToNetwork) {
            console.log(`Lead ${lead._id} has already been assigned to Client Network ${this.order.clientNetwork.name}. Skipping.`);
            this.order.logs.push({
                message: `Lead ${lead.fullName || lead._id} was already assigned to this network. Skipped.`,
                type: 'info',
                lead: lead._id
            });
            await this.order.save();
            return;
        }
        
        let clientBroker;

        if (manualBroker) {
            clientBroker = await ClientBroker.findById(manualBroker);
        } else {
            // Auto-select a broker that the lead hasn't been injected to yet.
            const assignedBrokerIds = lead.assignments.map(a => a.clientBroker);
            clientBroker = await ClientBroker.findOne({
                clientNetwork: this.order.clientNetwork._id,
                _id: { $nin: assignedBrokerIds }
            });
        }
        
        if (!clientBroker) {
            lead.status = 'not_available_client_brokers';
            await lead.save();
            console.log(`No available client brokers for lead ${lead._id} in network ${this.order.clientNetwork.name}.`);
            
            this.order.logs.push({
                message: `No available brokers for lead ${lead.fullName || lead._id}. Status set to not_available_client_brokers.`,
                type: 'warning',
                lead: lead._id
            });
            
            const leadType = lead.leadType;
            if (this.order.unfulfilled[leadType]) {
                this.order.unfulfilled[leadType]++;
            } else {
                this.order.unfulfilled[leadType] = 1;
            }
            await this.order.save();
            return;
        }

        // Simulate injection with playwright script
        const injectionResult = await this.runPlaywrightInjection(lead, clientBroker);
        
        const assignment = {
            clientNetwork: this.order.clientNetwork._id,
            clientBroker: clientBroker._id,
            order: this.order._id,
            status: injectionResult.success ? 'pending_broker_assignment' : 'failed',
            finalUrl: injectionResult.url,
            extractedDomain: injectionResult.domain,
        };

        lead.assignments.push(assignment);
        lead.isAssigned = true; // Mark as "in progress"
        lead.assignedTo = this.userId; // Assigned to the person running the order
        await lead.save();

        if(injectionResult.success){
            // Log for review, but don't mark as fulfilled yet
            this.order.logs.push({
                message: `Lead ${lead.fullName || lead._id} injected successfully, pending broker assignment. Domain: ${injectionResult.domain}`,
                type: 'info',
                lead: lead._id
            });
        } else {
             this.order.logs.push({
                message: `Injection failed for lead ${lead.fullName || lead._id}: ${injectionResult.message}`,
                type: 'error',
                lead: lead._id
            });
        }
        await this.order.save();

        console.log(`Lead ${lead._id} processed. Status: ${assignment.status}`);
    }

    async runPlaywrightInjection(lead, clientBroker) {
        return new Promise((resolve, reject) => {
            const leadData = JSON.stringify(lead.toObject());
            const brokerData = JSON.stringify(clientBroker.toObject());

            const process = spawn('python', ['../injector_playwright.py', leadData, brokerData]);

            let output = '';
            process.stdout.on('data', (data) => {
                output += data.toString();
            });

            process.stderr.on('data', (data) => {
                console.error(`stderr from injection script: ${data}`);
            });

            process.on('close', async (code) => {
                if (code !== 0) {
                    const errorMessage = `Injection script failed for lead ${lead._id} with exit code ${code}.`;
                    console.error(errorMessage);
                    return resolve({ success: false, message: errorMessage });
                }
                try {
                    // Assuming the script prints a JSON object with the final URL
                    const result = JSON.parse(output.trim());
                    const finalUrl = result.finalUrl;

                    if (!finalUrl || !finalUrl.startsWith('http')) {
                        throw new Error('Invalid or empty URL received from injection script.');
                    }
                    
                    const urlObject = new URL(finalUrl);
                    const domain = urlObject.hostname.replace(/^www\./, '');
                    
                    // We no longer modify the broker here. We just return the extracted info.
                    resolve({ success: true, url: finalUrl, domain: domain });
                } catch (e) {
                    console.error(`Failed to process injection script output: ${e.message}`);
                    console.error(`Script output was: ${output}`);
                    resolve({ success: false, message: `Failed to process injection script output: ${e.message}` });
                }
            });
        });
    }
}

module.exports = InjectionService; 