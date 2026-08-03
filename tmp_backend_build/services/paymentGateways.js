import axios from 'axios';
// Paystack Payment Service
export class PaystackService {
    constructor(secretKey) {
        this.baseUrl = 'https://api.paystack.co';
        this.secretKey = secretKey;
    }
    async initializeTransaction(email, amount, metadata) {
        try {
            const response = await axios.post(`${this.baseUrl}/transaction/initialize`, {
                email,
                amount: Math.round(amount * 100), // Paystack uses kobo (1/100 of Naira)
                metadata,
                callback_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/payment/callback?provider=paystack`,
            }, {
                headers: {
                    Authorization: `Bearer ${this.secretKey}`,
                    'Content-Type': 'application/json',
                },
            });
            if (response.data.status) {
                return {
                    authorization_url: response.data.data.authorization_url,
                    access_code: response.data.data.access_code,
                    reference: response.data.data.reference,
                };
            }
            throw new Error('Failed to initialize Paystack transaction');
        }
        catch (error) {
            console.error('Paystack initialize error:', error);
            throw error;
        }
    }
    async verifyTransaction(reference) {
        try {
            const response = await axios.get(`${this.baseUrl}/transaction/verify/${reference}`, {
                headers: {
                    Authorization: `Bearer ${this.secretKey}`,
                },
            });
            return {
                status: response.data.data.status === 'success',
                message: response.data.message,
                data: response.data.data,
            };
        }
        catch (error) {
            console.error('Paystack verify error:', error);
            throw error;
        }
    }
    async createTransferRecipient(type, accountNumber, bankCode, name) {
        try {
            const response = await axios.post(`${this.baseUrl}/transferrecipient`, {
                type,
                account_number: accountNumber,
                bank_code: bankCode,
                name,
            }, {
                headers: {
                    Authorization: `Bearer ${this.secretKey}`,
                    'Content-Type': 'application/json',
                },
            });
            if (response.data.status) {
                return { recipient_code: response.data.data.recipient_code };
            }
            throw new Error('Failed to create transfer recipient');
        }
        catch (error) {
            console.error('Paystack transfer recipient error:', error);
            throw error;
        }
    }
    async initiateTransfer(recipient, amount, reason) {
        try {
            const response = await axios.post(`${this.baseUrl}/transfer`, {
                source: 'balance',
                recipient,
                amount: Math.round(amount * 100),
                reason,
            }, {
                headers: {
                    Authorization: `Bearer ${this.secretKey}`,
                    'Content-Type': 'application/json',
                },
            });
            if (response.data.status) {
                return {
                    transfer_code: response.data.data.transfer_code,
                    reference: response.data.data.reference,
                };
            }
            throw new Error('Failed to initiate transfer');
        }
        catch (error) {
            console.error('Paystack transfer error:', error);
            throw error;
        }
    }
}
// Flutterwave Payment Service
export class FlutterwaveService {
    constructor(secretKey, publicKey) {
        this.baseUrl = 'https://api.flutterwave.com/v3';
        this.secretKey = secretKey;
        this.publicKey = publicKey;
    }
    async initializePayment(email, amount, txRef, metadata, currency = 'NGN') {
        try {
            const response = await axios.post(`${this.baseUrl}/payments`, {
                tx_ref: txRef,
                amount,
                currency,
                redirect_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/payment/callback?provider=flutterwave`,
                customer: {
                    email,
                },
                customizations: {
                    title: 'MarketConnect Payment',
                    description: 'Purchase from MarketConnect',
                    logo: `${process.env.FRONTEND_URL}/logo.png`,
                },
                meta: metadata,
            }, {
                headers: {
                    Authorization: `Bearer ${this.secretKey}`,
                    'Content-Type': 'application/json',
                },
            });
            if (response.data.status === 'success') {
                return {
                    link: response.data.data.link,
                    order_ref: response.data.data.order_ref,
                };
            }
            throw new Error('Failed to initialize Flutterwave payment');
        }
        catch (error) {
            console.error('Flutterwave initialize error:', error);
            throw error;
        }
    }
    async verifyTransaction(txRef) {
        try {
            const response = await axios.get(`${this.baseUrl}/transactions/verify_by_reference?tx_ref=${txRef}`, {
                headers: {
                    Authorization: `Bearer ${this.secretKey}`,
                },
            });
            if (response.data.status === 'success') {
                const transaction = response.data.data;
                return {
                    status: transaction.status === 'successful',
                    message: response.data.message,
                    data: transaction,
                };
            }
            return {
                status: false,
                message: response.data.message,
            };
        }
        catch (error) {
            console.error('Flutterwave verify error:', error);
            throw error;
        }
    }
    async createTransfer(accountBank, accountNumber, amount, narration, reference) {
        try {
            const response = await axios.post(`${this.baseUrl}/transfers`, {
                account_bank: accountBank,
                account_number: accountNumber,
                amount,
                narration,
                reference,
                currency: 'NGN',
            }, {
                headers: {
                    Authorization: `Bearer ${this.secretKey}`,
                    'Content-Type': 'application/json',
                },
            });
            if (response.data.status === 'success') {
                return {
                    transfer_id: response.data.data.id,
                    status: response.data.data.status,
                };
            }
            throw new Error('Failed to create Flutterwave transfer');
        }
        catch (error) {
            console.error('Flutterwave transfer error:', error);
            throw error;
        }
    }
}
//# sourceMappingURL=paymentGateways.js.map