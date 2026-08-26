import { v4 as uuidv4 } from 'uuid';
import { db, } from '../database.js';
export class WalletService {
    /**
     * Get or create wallet for user
     */
    async getOrCreateWallet(userId) {
        let wallet = await db.getWallet(userId);
        if (!wallet) {
            wallet = {
                id: uuidv4(),
                userId,
                balance: 0,
                currency: 'NGN',
                transactions: [],
                lastUpdated: new Date().toISOString(),
            };
            await db.addWallet(wallet);
        }
        return wallet;
    }
    /**
     * Add money to wallet
     */
    async syncWalletBalanceToUser(userId) {
        const wallet = await this.getOrCreateWallet(userId);
        const user = await db.getUser(userId);
        if (user) {
            await db.updateUser(userId, {
                walletBalance: wallet.balance,
            });
        }
    }
    async addDeposit(userId, amount, paymentGateway, reference) {
        const existing = await db.getTransactionsByReference(reference);
        if (existing) {
            if (existing.type === 'deposit' && existing.userId === userId) {
                // Ensure idempotent behavior: if the transaction was recorded earlier
                // but the wallet was not updated (e.g. partial failure), apply the
                // deposit to the wallet and record the transaction id on the wallet.
                try {
                    const wallet = await this.getOrCreateWallet(userId);
                    const txs = wallet.transactions || [];
                    const alreadyRecorded = txs.some(t => t.id === existing.id);
                    if (!alreadyRecorded) {
                        const updatedTxs = [...txs, existing];
                        await db.updateWallet(userId, {
                            balance: wallet.balance + existing.amount,
                            transactions: updatedTxs,
                        });
                        await this.syncWalletBalanceToUser(userId);
                    }
                }
                catch (err) {
                    // Log but do not fail - return the existing transaction so caller
                    // can proceed. Backend error visibility will show up in logs.
                    console.error('[wallet addDeposit] idempotent sync failed', err);
                }
                return existing;
            }
            throw new Error('Duplicate transaction reference');
        }
        const transaction = {
            id: uuidv4(),
            type: 'deposit',
            userId,
            amount,
            status: 'completed',
            currency: 'NGN',
            paymentGateway,
            reference,
            createdAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
            details: `Deposit via ${paymentGateway}`,
        };
        await db.addTransaction(transaction);
        // Update wallet balance and attach transaction id for idempotency
        const wallet = await this.getOrCreateWallet(userId);
        const nextTxs = [...(wallet.transactions || []), transaction];
        await db.updateWallet(userId, {
            balance: wallet.balance + amount,
            transactions: nextTxs,
        });
        await this.syncWalletBalanceToUser(userId);
        return transaction;
    }
    /**
     * Withdraw money from wallet
     */
    async initiateWithdrawal(userId, amount, bankDetails, reference, metadata) {
        const wallet = await this.getOrCreateWallet(userId);
        if (wallet.balance < amount) {
            throw new Error('Insufficient wallet balance');
        }
        const transaction = {
            id: uuidv4(),
            type: 'withdrawal',
            userId,
            amount,
            status: 'processing',
            currency: 'NGN',
            reference: reference || `WTH_${Date.now()}`,
            createdAt: new Date().toISOString(),
            details: `Withdrawal to account ending in ${bankDetails.accountNumber.slice(-4)}`,
            metadata: { ...bankDetails, ...metadata },
        };
        await db.addTransaction(transaction);
        // Deduct from wallet (but mark as processing, not completed)
        await db.updateWallet(userId, {
            balance: wallet.balance - amount,
        });
        await this.syncWalletBalanceToUser(userId);
        return transaction;
    }
    /**
     * Get wallet balance
     */
    async getBalance(userId) {
        const wallet = await this.getOrCreateWallet(userId);
        return wallet.balance;
    }
    /**
     * Get transaction history
     */
    async getTransactionHistory(userId) {
        return db.getTransactionsByUser(userId);
    }
    async payVerificationWithWallet(userId) {
        const user = await db.getUser(userId);
        if (!user)
            throw new Error('User not found');
        if (user.verified || user.verificationRequestStatus === 'approved') {
            throw new Error('User is already verified');
        }
        if (user.verificationRequestStatus !== 'pending') {
            throw new Error('No verification payment request has been sent by admin');
        }
        const amount = Number(user.verificationFee || 0);
        if (!Number.isFinite(amount) || amount <= 0) {
            throw new Error('Invalid verification fee');
        }
        const admin = (await db.getAllUsers()).find((candidate) => candidate.role === 'admin');
        if (!admin)
            throw new Error('Admin account required to receive payment');
        const userWallet = await this.getOrCreateWallet(userId);
        if (userWallet.balance < amount)
            throw new Error('Insufficient wallet balance');
        const reference = `VERIFICATION_${userId}_${user.verificationFee}`;
        const existingPayment = await db.getTransactionsByReference(reference);
        if (existingPayment) {
            const updatedUser = await db.getUser(userId);
            if (!updatedUser)
                throw new Error('User not found');
            return { user: updatedUser, balance: await this.getBalance(userId), amount };
        }
        const paymentTransaction = {
            id: uuidv4(),
            type: 'withdrawal',
            userId,
            counterpartyId: admin.id,
            amount,
            status: 'completed',
            currency: 'NGN',
            paymentGateway: 'manual',
            reference,
            createdAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
            details: 'Verification fee paid to admin from wallet',
            metadata: { type: 'membership_verification', adminId: admin.id },
        };
        await db.addTransaction(paymentTransaction);
        await db.updateWallet(userId, {
            balance: userWallet.balance - amount,
            transactions: [...(userWallet.transactions || []), paymentTransaction],
        });
        await this.syncWalletBalanceToUser(userId);
        await this.addDeposit(admin.id, amount, 'manual', `VERIFICATION_RECEIPT_${userId}_${user.verificationFee}`);
        const approvedUser = await db.updateUser(userId, {
            verified: true,
            verificationLevel: user.verificationBadgeType === 'verified_seller' ? 'full' : 'basic',
            verificationBadgeType: user.verificationBadgeType || 'active_member',
            verificationRequestStatus: 'approved',
        });
        if (!approvedUser)
            throw new Error('Unable to approve verification');
        return { user: approvedUser, balance: userWallet.balance - amount, amount };
    }
}
export class OrderService {
    /**
     * Create an order (buyer initiates purchase)
     */
    async createOrder(listingId, buyerId, buyerName, sellerId, sellerName, price, listingTitle) {
        const order = {
            id: uuidv4(),
            listingId,
            listingTitle,
            buyerId,
            buyerName,
            sellerId,
            sellerName,
            price,
            status: 'pending',
            paymentStatus: 'pending',
            confirmationDeadline: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            transactionIds: [],
        };
        return await db.addOrder(order);
    }
    /**
     * Lock payment (buyer pays, money goes to escrow)
     */
    async lockPayment(orderId, userId, amount, paymentGateway, reference) {
        const existing = await db.getTransactionsByReference(reference);
        if (existing) {
            if (existing.type === 'payment_locked' && existing.orderId === orderId && existing.userId === userId) {
                return existing;
            }
            throw new Error('Duplicate transaction reference');
        }
        const order = await db.getOrder(orderId);
        if (!order) {
            throw new Error('Order not found');
        }
        if (order.buyerId !== userId) {
            throw new Error('Only buyer can lock payment');
        }
        // Create transaction for payment locked in escrow
        const transaction = {
            id: uuidv4(),
            type: 'payment_locked',
            userId,
            counterpartyId: order.sellerId,
            orderId,
            amount,
            status: 'completed',
            currency: 'NGN',
            paymentGateway,
            reference,
            createdAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
            details: `Payment locked in escrow for order ${orderId}`,
            metadata: { escrow: true },
        };
        await db.addTransaction(transaction);
        // Update order
        await db.updateOrder(orderId, {
            paymentStatus: 'completed',
            paymentLockedAt: new Date().toISOString(),
            transactionIds: [...order.transactionIds, transaction.id],
        });
        return transaction;
    }
    async payOrderWithWallet(orderId, userId) {
        const order = await db.getOrder(orderId);
        if (!order) {
            throw new Error('Order not found');
        }
        if (order.buyerId !== userId) {
            throw new Error('Only buyer can pay this order');
        }
        if (order.paymentStatus === 'completed') {
            throw new Error('Payment has already been completed for this order');
        }
        const walletService = new WalletService();
        const wallet = await walletService.getOrCreateWallet(userId);
        if (wallet.balance < order.price) {
            throw new Error('Insufficient wallet balance');
        }
        await db.updateWallet(userId, {
            balance: wallet.balance - order.price,
        });
        await walletService.syncWalletBalanceToUser(userId);
        const transaction = {
            id: uuidv4(),
            type: 'payment_locked',
            userId,
            counterpartyId: order.sellerId,
            orderId,
            amount: order.price,
            status: 'completed',
            currency: 'NGN',
            paymentGateway: 'manual',
            reference: `WALLET_${Date.now()}`,
            createdAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
            details: `Wallet payment locked in escrow for order ${orderId}`,
            metadata: { escrow: true },
        };
        await db.addTransaction(transaction);
        const updatedOrder = await db.updateOrder(orderId, {
            paymentStatus: 'completed',
            paymentLockedAt: new Date().toISOString(),
            transactionIds: [...order.transactionIds, transaction.id],
        });
        return { order: updatedOrder, transaction };
    }
    async selectFulfillment(orderId, userId, method) {
        const order = await db.getOrder(orderId);
        if (!order)
            throw new Error('Order not found');
        if (order.buyerId !== userId)
            throw new Error('Only buyer can select fulfillment');
        if (order.paymentStatus !== 'completed')
            throw new Error('Payment must be completed first');
        if (!['meetup', 'shipping'].includes(method))
            throw new Error('Unsupported fulfillment method');
        return (await db.updateOrder(orderId, {
            deliveryDetails: {
                ...order.deliveryDetails,
                method,
            },
        }));
    }
    /**
     * Accept order (seller accepts)
     */
    async acceptOrder(orderId, userId) {
        const order = await db.getOrder(orderId);
        if (!order) {
            throw new Error('Order not found');
        }
        if (order.sellerId !== userId) {
            throw new Error('Only seller can accept order');
        }
        return (await db.updateOrder(orderId, {
            status: 'accepted',
        }));
    }
    /**
     * Ship order (seller marks as shipped)
     */
    async shipOrder(orderId, userId, trackingNumber) {
        const order = await db.getOrder(orderId);
        if (!order) {
            throw new Error('Order not found');
        }
        if (order.sellerId !== userId) {
            throw new Error('Only seller can ship order');
        }
        return (await db.updateOrder(orderId, {
            status: 'shipped',
            deliveryDetails: {
                ...order.deliveryDetails,
                trackingNumber,
                method: order.deliveryDetails?.method || 'shipping',
            },
        }));
    }
    /**
     * Mark as delivered
     */
    async markDelivered(orderId, userId) {
        const order = await db.getOrder(orderId);
        if (!order) {
            throw new Error('Order not found');
        }
        if (order.sellerId !== userId) {
            throw new Error('Only seller can mark as delivered');
        }
        return (await db.updateOrder(orderId, {
            status: 'delivered',
        }));
    }
    /**
     * Buyer confirms delivery (releases payment to seller)
     */
    async confirmDelivery(orderId, userId) {
        const order = await db.getOrder(orderId);
        if (!order) {
            throw new Error('Order not found');
        }
        if (order.buyerId !== userId) {
            throw new Error('Only buyer can confirm delivery');
        }
        if (order.status !== 'delivered') {
            throw new Error('Order must be marked as delivered first');
        }
        const admin = (await db.getAllUsers()).find((user) => user.role === 'admin');
        if (!admin) {
            throw new Error('Admin account required to process fees');
        }
        const walletService = new WalletService();
        const sellerWallet = await walletService.getOrCreateWallet(order.sellerId);
        const adminWallet = await walletService.getOrCreateWallet(admin.id);
        const adminFee = Math.round(order.price * 0.03 * 100) / 100;
        const sellerAmount = Math.round((order.price - adminFee) * 100) / 100;
        const sellerTransaction = {
            id: uuidv4(),
            type: 'payment_released',
            userId: order.sellerId,
            counterpartyId: userId,
            orderId,
            amount: sellerAmount,
            status: 'completed',
            currency: 'NGN',
            createdAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
            details: `Payment released from escrow for order ${orderId}`,
            metadata: { orderId, adminFee },
        };
        const adminTransaction = {
            id: uuidv4(),
            type: 'payment_released',
            userId: admin.id,
            counterpartyId: userId,
            orderId,
            amount: adminFee,
            status: 'completed',
            currency: 'NGN',
            createdAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
            details: `Admin fee collected for order ${orderId}`,
            metadata: { orderId, adminFee },
        };
        await db.addTransaction(sellerTransaction);
        await db.addTransaction(adminTransaction);
        await db.updateWallet(order.sellerId, {
            balance: sellerWallet.balance + sellerAmount,
        });
        await walletService.syncWalletBalanceToUser(order.sellerId);
        await db.updateWallet(admin.id, {
            balance: adminWallet.balance + adminFee,
        });
        await walletService.syncWalletBalanceToUser(admin.id);
        const updatedOrder = (await db.updateOrder(orderId, {
            status: 'confirmed',
            transactionIds: [...order.transactionIds, sellerTransaction.id, adminTransaction.id],
        }));
        return {
            order: updatedOrder,
            transactions: [sellerTransaction, adminTransaction],
        };
    }
    /**
     * Complete order
     */
    async completeOrder(orderId) {
        const order = await db.getOrder(orderId);
        if (!order) {
            throw new Error('Order not found');
        }
        return (await db.updateOrder(orderId, {
            status: 'completed',
        }));
    }
    /**
     * Cancel order
     */
    async raiseDispute(orderId, userId, reason) {
        const order = await db.getOrder(orderId);
        if (!order) {
            throw new Error('Order not found');
        }
        if (userId !== order.buyerId && userId !== order.sellerId) {
            throw new Error('Unauthorized to dispute this order');
        }
        if (!['shipped', 'delivered'].includes(order.status)) {
            throw new Error('Disputes can only be raised after the item is shipped or delivered');
        }
        return (await db.updateOrder(orderId, {
            status: 'disputed',
            notes: reason || `Dispute raised by ${userId}`,
        }));
    }
    async cancelOrder(orderId, userId, reason) {
        const order = await db.getOrder(orderId);
        if (!order) {
            throw new Error('Order not found');
        }
        // Only buyer or admin can cancel
        if (userId !== order.buyerId && userId !== 'admin') {
            throw new Error('Unauthorized to cancel order');
        }
        // Can only cancel if payment is locked but not yet shipped
        if (!['pending', 'accepted'].includes(order.status)) {
            throw new Error('Order cannot be cancelled at this stage');
        }
        let refundTransaction;
        // If payment was locked, refund it
        if (order.paymentStatus === 'completed') {
            refundTransaction = {
                id: uuidv4(),
                type: 'refund',
                userId: order.buyerId,
                orderId,
                amount: order.price,
                status: 'completed',
                currency: 'NGN',
                createdAt: new Date().toISOString(),
                completedAt: new Date().toISOString(),
                details: `Refund for cancelled order ${orderId}. Reason: ${reason || 'N/A'}`,
            };
            await db.addTransaction(refundTransaction);
            // Add refund to buyer wallet
            const walletService = new WalletService();
            const buyerWallet = await walletService.getOrCreateWallet(order.buyerId);
            await db.updateWallet(order.buyerId, {
                balance: buyerWallet.balance + order.price,
            });
            await walletService.syncWalletBalanceToUser(order.buyerId);
        }
        const updatedOrder = (await db.updateOrder(orderId, {
            status: 'cancelled',
            transactionIds: refundTransaction
                ? [...order.transactionIds, refundTransaction.id]
                : order.transactionIds,
        }));
        return {
            order: updatedOrder,
            refundTransaction,
        };
    }
    /**
     * Get orders for a user
     */
    async getUserOrders(userId, role) {
        if (role === 'buyer') {
            return await db.getOrdersByBuyer(userId);
        }
        else {
            return await db.getOrdersBySeller(userId);
        }
    }
    /**
     * Get all orders (admin)
     */
    async getAllOrders() {
        return await db.getAllOrders();
    }
}
//# sourceMappingURL=orderAndWallet.js.map