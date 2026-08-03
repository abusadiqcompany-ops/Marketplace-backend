export declare class PaystackService {
    private baseUrl;
    private secretKey;
    constructor(secretKey: string);
    initializeTransaction(email: string, amount: number, metadata: Record<string, any>, callbackUrl?: string): Promise<{
        authorization_url: string;
        access_code: string;
        reference: string;
    }>;
    verifyTransaction(reference: string): Promise<{
        status: boolean;
        message: string;
        data?: Record<string, any>;
    }>;
    createTransferRecipient(type: string, accountNumber: string, bankCode: string, name: string): Promise<{
        recipient_code: string;
    }>;
    initiateTransfer(recipient: string, amount: number, reason?: string): Promise<{
        transfer_code: string;
        reference: string;
    }>;
}
export declare class FlutterwaveService {
    private baseUrl;
    private secretKey;
    private publicKey;
    constructor(secretKey: string, publicKey: string);
    initializePayment(email: string, amount: number, txRef: string, metadata: Record<string, any>, currency?: string, callbackUrl?: string): Promise<{
        link: string;
        order_ref: string;
    }>;
    verifyTransaction(txRef: string): Promise<{
        status: boolean;
        message: string;
        data?: Record<string, any>;
    }>;
    createTransfer(accountBank: string, accountNumber: string, amount: number, narration: string, reference: string): Promise<{
        transfer_id: number;
        status: string;
    }>;
}
//# sourceMappingURL=paymentGateways.d.ts.map