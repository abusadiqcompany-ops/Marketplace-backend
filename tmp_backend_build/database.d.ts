export type Role = 'buyer' | 'seller' | 'admin';
export type PaymentStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type OrderStatus = 'pending' | 'accepted' | 'shipped' | 'delivered' | 'confirmed' | 'completed' | 'cancelled' | 'disputed';
export type TransactionType = 'deposit' | 'withdrawal' | 'payment_locked' | 'payment_released' | 'refund';
export interface Location {
    city: string;
    state: string;
    country: string;
    coordinates?: {
        latitude: number;
        longitude: number;
    };
}
export interface User {
    id: string;
    name: string;
    email: string;
    password?: string;
    role: Role;
    avatar?: string;
    walletBalance: number;
    accountNumber: string;
    location?: Location;
    buyerPreferences?: {
        preferredLocations?: Location[];
        searchRadius?: number;
    };
    businessName?: string;
    description?: string;
    phone?: string;
    sellerLocation?: Location;
    paymentMethods?: PaymentMethod[];
    verified: boolean;
    verificationLevel: 'unverified' | 'basic' | 'full';
    emailVerified?: boolean;
    phoneVerified?: boolean;
    emailOtp?: string;
    phoneOtp?: string;
    otpExpiresAt?: string;
    createdAt: string;
    updatedAt: string;
}
export interface PaymentMethod {
    id: string;
    type: 'bank_transfer' | 'card' | 'mobile_money' | 'paystack' | 'flutterwave';
    isDefault?: boolean;
    lastFour?: string;
    details?: string;
    provider?: 'paystack' | 'flutterwave';
}
export interface Listing {
    id: string;
    sellerId: string;
    sellerName: string;
    title: string;
    description: string;
    price: number;
    category: string;
    location: Location;
    images: string[];
    rating?: number;
    reviewCount?: number;
    distance?: number;
    createdAt: string;
    updatedAt: string;
}
export interface Order {
    id: string;
    listingId: string;
    listingTitle: string;
    buyerId: string;
    buyerName: string;
    sellerId: string;
    sellerName: string;
    price: number;
    status: OrderStatus;
    paymentStatus: PaymentStatus;
    paymentLockedAt?: string;
    deliveryDetails?: {
        method: 'meetup' | 'shipping';
        pickupLocation?: Location;
        shippingAddress?: string;
        trackingNumber?: string;
        estimatedDelivery?: string;
    };
    confirmationDeadline?: string;
    createdAt: string;
    updatedAt: string;
    notes?: string;
    transactionIds: string[];
}
export interface Transaction {
    id: string;
    type: TransactionType;
    userId: string;
    counterpartyId?: string;
    orderId?: string;
    amount: number;
    status: PaymentStatus;
    currency: 'NGN' | 'USD';
    paymentMethod?: PaymentMethod;
    paymentGateway?: 'paystack' | 'flutterwave' | 'manual';
    reference?: string;
    createdAt: string;
    completedAt?: string;
    details?: string;
    metadata?: Record<string, any>;
}
export interface Report {
    id: string;
    reporterId: string;
    reporterName: string;
    reportedUserId: string;
    reportedUserName: string;
    reportedRole: Role | string;
    type: 'report' | 'complaint';
    subject: string;
    details: string;
    status: 'pending' | 'resolved' | 'dismissed';
    createdAt: string;
    updatedAt: string;
}
export interface Wallet {
    id: string;
    userId: string;
    balance: number;
    currency: 'NGN' | 'USD';
    transactions: Transaction[];
    lastUpdated: string;
}
export declare class Database {
    private pool;
    private initialized;
    constructor();
    private ensureUserVerificationColumns;
    init(): Promise<void>;
    close(): Promise<void>;
    private select;
    private execute;
    private parseJson;
    private stringifyJson;
    private toSqlDateTime;
    private fromSqlDateTime;
    private toUser;
    private toListing;
    private toOrder;
    private toTransaction;
    private toWallet;
    private toReport;
    addUser(user: User): Promise<User>;
    getUser(id: string): Promise<User | undefined>;
    getUserByEmail(email: string): Promise<User | undefined>;
    updateUser(id: string, updates: Partial<User>): Promise<User | undefined>;
    getAllUsers(): Promise<User[]>;
    addReport(report: Report): Promise<Report>;
    getReport(id: string): Promise<Report | undefined>;
    getAllReports(): Promise<Report[]>;
    updateReport(id: string, updates: Partial<Report>): Promise<Report | undefined>;
    addListing(listing: Listing): Promise<Listing>;
    getListing(id: string): Promise<Listing | undefined>;
    getListingsBySeller(sellerId: string): Promise<Listing[]>;
    getAllListings(): Promise<Listing[]>;
    updateListing(id: string, updates: Partial<Listing>): Promise<Listing | undefined>;
    deleteUser(id: string): Promise<boolean>;
    deleteListing(id: string): Promise<boolean>;
    addOrder(order: Order): Promise<Order>;
    getOrder(id: string): Promise<Order | undefined>;
    getOrdersByBuyer(buyerId: string): Promise<Order[]>;
    getOrdersBySeller(sellerId: string): Promise<Order[]>;
    getAllOrders(): Promise<Order[]>;
    updateOrder(id: string, updates: Partial<Order>): Promise<Order | undefined>;
    addTransaction(transaction: Transaction): Promise<Transaction>;
    getTransaction(id: string): Promise<Transaction | undefined>;
    getTransactionsByUser(userId: string): Promise<Transaction[]>;
    getTransactionsByReference(reference: string): Promise<Transaction | undefined>;
    getAllTransactions(): Promise<Transaction[]>;
    updateTransaction(id: string, updates: Partial<Transaction>): Promise<Transaction | undefined>;
    addWallet(wallet: Wallet): Promise<Wallet>;
    getWallet(userId: string): Promise<Wallet | undefined>;
    updateWallet(userId: string, updates: Partial<Wallet>): Promise<Wallet | undefined>;
}
export declare const db: Database;
export declare function initializeDatabase(): Promise<void>;
//# sourceMappingURL=database.d.ts.map