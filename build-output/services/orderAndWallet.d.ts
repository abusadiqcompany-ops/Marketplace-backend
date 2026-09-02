import { Transaction, User, Wallet, Order } from '../database.js';
export declare class WalletService {
    /**
     * Get or create wallet for user
     */
    getOrCreateWallet(userId: string): Promise<Wallet>;
    /**
     * Add money to wallet
     */
    syncWalletBalanceToUser(userId: string): Promise<void>;
    addDeposit(userId: string, amount: number, paymentGateway: 'paystack' | 'flutterwave' | 'manual', reference: string): Promise<Transaction>;
    /**
     * Withdraw money from wallet
     */
    initiateWithdrawal(userId: string, amount: number, bankDetails: {
        accountNumber: string;
        bankCode: string;
        accountName: string;
    }, reference?: string, metadata?: Record<string, any>): Promise<Transaction>;
    /**
     * Get wallet balance
     */
    getBalance(userId: string): Promise<number>;
    /**
     * Get transaction history
     */
    getTransactionHistory(userId: string): Promise<Transaction[]>;
    payVerificationWithWallet(userId: string): Promise<{
        user: User;
        balance: number;
        amount: number;
    }>;
}
export declare class OrderService {
    /**
     * Create an order (buyer initiates purchase)
     */
    createOrder(listingId: string, buyerId: string, buyerName: string, sellerId: string, sellerName: string, price: number, listingTitle: string, options?: {
        originalPrice?: number;
        discountEnabled?: boolean;
        discountPercentage?: number;
        discountAmount?: number;
        finalPrice?: number;
        quantity?: number;
        totalAmount?: number;
    }): Promise<Order>;
    /**
     * Lock payment (buyer pays, money goes to escrow)
     */
    lockPayment(orderId: string, userId: string, amount: number, paymentGateway: 'paystack' | 'flutterwave', reference: string): Promise<Transaction>;
    payOrderWithWallet(orderId: string, userId: string): Promise<{
        order: Order;
        transaction: Transaction;
    }>;
    selectFulfillment(orderId: string, userId: string, method: 'meetup' | 'shipping'): Promise<Order>;
    /**
     * Accept order (seller accepts)
     */
    acceptOrder(orderId: string, userId: string): Promise<Order>;
    /**
     * Ship order (seller marks as shipped)
     */
    shipOrder(orderId: string, userId: string, trackingNumber?: string): Promise<Order>;
    /**
     * Mark as delivered
     */
    markDelivered(orderId: string, userId: string): Promise<Order>;
    /**
     * Buyer confirms delivery (releases payment to seller)
     */
    confirmDelivery(orderId: string, userId: string): Promise<{
        order: Order;
        transactions: Transaction[];
    }>;
    /**
     * Complete order
     */
    completeOrder(orderId: string): Promise<Order>;
    /**
     * Cancel order
     */
    raiseDispute(orderId: string, userId: string, reason?: string): Promise<Order>;
    cancelOrder(orderId: string, userId: string, reason?: string): Promise<{
        order: Order;
        refundTransaction?: Transaction;
    }>;
    /**
     * Get orders for a user
     */
    getUserOrders(userId: string, role: 'buyer' | 'seller'): Promise<Order[]>;
    /**
     * Get all orders (admin)
     */
    getAllOrders(): Promise<Order[]>;
}
//# sourceMappingURL=orderAndWallet.d.ts.map