import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import { db, initializeDatabase, } from './database.js';
import { WalletService, OrderService } from './services/orderAndWallet.js';
import { AuthService } from './services/auth.js';
import { PaystackService, FlutterwaveService } from './services/paymentGateways.js';
import { verifyAuthToken, requireRole, optionalAuth } from './middleware/auth.js';
import { verifyRefreshToken, generateTokenPair, extractTokenFromHeader } from './utils/auth.js';
import { getFrontendUrl } from './utils/frontend.js';
dotenv.config();
const app = express();
const PORT = Number(process.env.PORT || 8080);
const HOST = process.env.HOST || '0.0.0.0';
// Middleware
const frontendOrigin = getFrontendUrl();
const allowedOrigins = new Set([
    frontendOrigin,
    process.env.FRONTEND_URL,
    'https://marketplace-frontend-git-main-musaf-technologies.vercel.app',
    'https://marketplace-frontend-mu-two.vercel.app',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:4173',
    'http://127.0.0.1:4173',
    'http://localhost:4174',
    'http://127.0.0.1:4174',
    'https://localhost:4173',
    'https://127.0.0.1:4173',
    ...(process.env.ALLOWED_ORIGINS?.split(',').filter(Boolean) || []),
]);
const normalizeOrigin = (origin) => origin?.replace(/\/$/, '');
const isAllowedOrigin = (origin) => {
    if (!origin)
        return false;
    const normalizedOrigin = normalizeOrigin(origin);
    if (!normalizedOrigin)
        return false;
    if (allowedOrigins.has(normalizedOrigin))
        return true;
    return /(?:^|\.)vercel\.app$/i.test(normalizedOrigin) || /(?:^|\.)devtunnels\.ms$/i.test(normalizedOrigin) || /localhost|127\.0\.0\.1/i.test(normalizedOrigin);
};
const corsOptions = {
    origin: (origin, callback) => {
        if (!origin || isAllowedOrigin(origin)) {
            callback(null, true);
            return;
        }
        callback(new Error(`CORS policy does not allow this origin: ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
    maxAge: 86400,
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json({ limit: '1gb' }));
app.use(express.urlencoded({ extended: true, limit: '1gb' }));
app.use((req, _res, next) => {
    if (req.path === '/' || req.path === '/health' || req.path.startsWith('/api/')) {
        next();
        return;
    }
    const legacyPrefixes = ['/auth', '/users', '/listings', '/wallet', '/orders', '/payments', '/deposit', '/reports', '/account-deletion-requests'];
    if (legacyPrefixes.some((prefix) => req.path === prefix || req.path.startsWith(`${prefix}/`))) {
        req.url = `/api${req.url}`;
    }
    next();
});
// Initialize services
const walletService = new WalletService();
const orderService = new OrderService();
const authService = new AuthService();
const paystackService = new PaystackService(process.env.PAYSTACK_SECRET_KEY || '');
const flutterwaveService = new FlutterwaveService(process.env.FLUTTERWAVE_SECRET_KEY || '', process.env.FLUTTERWAVE_PUBLIC_KEY || '');
// Error handler middleware
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};
// ============== AUTHENTICATION ROUTES ==============
app.post('/api/auth/signup', asyncHandler(async (req, res) => {
    const { name, email, password, role, location, businessName, phone, sellerLocation } = req.body;
    if (!name || !email || !password || !role) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    try {
        const result = await authService.signup({
            name,
            email,
            password,
            role,
            location,
            businessName,
            phone,
            sellerLocation,
        });
        res.status(201).json(result);
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
}));
app.post('/api/auth/login', asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password required' });
    }
    try {
        const result = await authService.login(email, password);
        res.json(result);
    }
    catch (error) {
        res.status(401).json({ error: error.message });
    }
}));
app.post('/api/auth/send-verification', verifyAuthToken, asyncHandler(async (req, res) => {
    const { type } = req.body;
    if (type !== 'email' && type !== 'phone') {
        return res.status(400).json({ error: 'Verification type must be email or phone' });
    }
    const result = await authService.sendVerification(req.userId, type);
    res.json(result);
}));
app.post('/api/auth/verify-code', verifyAuthToken, asyncHandler(async (req, res) => {
    const { type, code } = req.body;
    if (type !== 'email' && type !== 'phone') {
        return res.status(400).json({ error: 'Verification type must be email or phone' });
    }
    const user = await authService.verifyCode(req.userId, type, code);
    res.json({ user, message: `${type === 'email' ? 'Email' : 'Phone'} verified successfully.` });
}));
app.get('/api/auth/me', verifyAuthToken, asyncHandler(async (req, res) => {
    const user = await authService.getCurrentUser(req.userId);
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
}));
// Refresh access token using refresh token
app.post('/api/auth/refresh', asyncHandler(async (req, res) => {
    const refreshToken = req.body?.refreshToken || extractTokenFromHeader(req.headers.authorization);
    if (!refreshToken)
        return res.status(400).json({ error: 'Missing refresh token' });
    const payload = verifyRefreshToken(refreshToken);
    if (!payload || !payload.userId)
        return res.status(401).json({ error: 'Invalid refresh token' });
    const user = await db.getUser(payload.userId);
    if (!user)
        return res.status(404).json({ error: 'User not found' });
    const tokens = generateTokenPair(user);
    res.json(tokens);
}));
app.post('/api/auth/change-password', verifyAuthToken, asyncHandler(async (req, res) => {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
        return res.status(400).json({ error: 'Old and new password required' });
    }
    try {
        await authService.changePassword(req.userId, oldPassword, newPassword);
        res.json({ message: 'Password changed successfully' });
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
}));
// ============== ADMIN ROUTES ==============
app.get('/api/admin/users', verifyAuthToken, requireRole('admin'), asyncHandler(async (req, res) => {
    const users = await db.getAllUsers();
    const safeUsers = users.map((user) => {
        const { password: _password, ...userWithoutPassword } = user;
        return userWithoutPassword;
    });
    res.json(safeUsers);
}));
app.get('/api/admin/listings', verifyAuthToken, requireRole('admin'), asyncHandler(async (req, res) => {
    const listings = await db.getAllListings();
    res.json(listings);
}));
app.get('/api/admin/orders', verifyAuthToken, requireRole('admin'), asyncHandler(async (req, res) => {
    const orders = await db.getAllOrders();
    res.json(orders);
}));
app.get('/api/admin/reports', verifyAuthToken, requireRole('admin'), asyncHandler(async (req, res) => {
    const reports = await db.getAllReports();
    res.json(reports);
}));
app.post('/api/account-deletion-requests', verifyAuthToken, asyncHandler(async (req, res) => {
    const { reason } = req.body || {};
    if (!reason || !String(reason).trim()) {
        return res.status(400).json({ error: 'A reason is required.' });
    }
    const user = await db.getUser(req.userId);
    if (!user) {
        return res.status(404).json({ error: 'User not found.' });
    }
    const request = await db.addAccountDeletionRequest({
        id: `del-${Date.now()}`,
        userId: user.id,
        userName: user.name,
        email: user.email,
        reason: String(reason).trim(),
        status: 'pending',
        createdAt: new Date().toISOString(),
    });
    res.status(201).json(request);
}));
app.get('/api/admin/account-deletion-requests', verifyAuthToken, requireRole('admin'), asyncHandler(async (req, res) => {
    const requests = await db.getAllAccountDeletionRequests();
    res.json(requests);
}));
app.post('/api/admin/account-deletion-requests/:id', verifyAuthToken, requireRole('admin'), asyncHandler(async (req, res) => {
    const { action } = req.body || {};
    if (action !== 'approve' && action !== 'reject') {
        return res.status(400).json({ error: 'Action must be approve or reject.' });
    }
    const existing = await db.getAccountDeletionRequest(req.params.id);
    if (!existing) {
        return res.status(404).json({ error: 'Deletion request not found.' });
    }
    const updated = await db.updateAccountDeletionRequest(req.params.id, {
        status: action === 'approve' ? 'approved' : 'rejected',
        reviewedAt: new Date().toISOString(),
        reviewedBy: req.userId,
    });
    res.json(updated);
}));
app.post('/api/admin/reports/:id/resolve', verifyAuthToken, requireRole('admin'), asyncHandler(async (req, res) => {
    const { status } = req.body;
    if (status !== 'resolved' && status !== 'dismissed') {
        return res.status(400).json({ error: 'Status must be resolved or dismissed' });
    }
    const updated = await db.updateReport(req.params.id, { status });
    if (!updated) {
        return res.status(404).json({ error: 'Report not found' });
    }
    res.json(updated);
}));
app.post('/api/users/:id/verify-membership', verifyAuthToken, asyncHandler(async (req, res) => {
    if (req.params.id !== req.userId) {
        return res.status(403).json({ error: 'Unauthorized' });
    }
    const user = await db.getUser(req.params.id);
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }
    const { amount, provider } = req.body;
    const verificationAmount = Number(amount || 5000);
    const selectedProvider = provider === 'flutterwave' ? 'flutterwave' : 'paystack';
    if (!Number.isFinite(verificationAmount) || verificationAmount <= 0) {
        return res.status(400).json({ error: 'Verification amount must be greater than zero' });
    }
    const email = user.email;
    const reference = `${selectedProvider.toUpperCase()}_${Date.now()}_${uuidv4().substring(0, 8)}`;
    const callbackBase = `${getFrontendUrl()}/payment/callback`;
    if (selectedProvider === 'paystack') {
        const paymentData = await paystackService.initializeTransaction(email, verificationAmount, {
            userId: user.id,
            type: 'membership_verification',
            provider: selectedProvider,
            amount: verificationAmount,
            adminInitiated: false,
        }, `${callbackBase}?type=membership_verification&userId=${user.id}&provider=paystack`);
        return res.json({ ...paymentData, provider: selectedProvider, userId: user.id, amount: verificationAmount });
    }
    const paymentData = await flutterwaveService.initializePayment(email, verificationAmount, reference, {
        userId: user.id,
        type: 'membership_verification',
        provider: selectedProvider,
        amount: verificationAmount,
        adminInitiated: false,
    }, 'NGN', `${callbackBase}?type=membership_verification&userId=${user.id}&provider=flutterwave`);
    res.json({ ...paymentData, provider: selectedProvider, userId: user.id, amount: verificationAmount, reference });
}));
app.post('/api/admin/users/:id/verify-membership/verify', verifyAuthToken, requireRole('admin'), asyncHandler(async (req, res) => {
    const { provider, reference } = req.body;
    const user = await db.getUser(req.params.id);
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }
    if (provider === 'paystack') {
        const verification = await paystackService.verifyTransaction(reference);
        if (!verification.status) {
            return res.status(400).json({ verified: false, error: verification.message });
        }
        const metadata = verification.data?.metadata || {};
        if (metadata.userId !== user.id || metadata.type !== 'membership_verification') {
            return res.status(403).json({ error: 'Invalid verification payment metadata' });
        }
        const updatedUser = await db.updateUser(user.id, {
            verified: true,
            verificationLevel: 'basic',
            walletBalance: Number(user.walletBalance || 0) + Number(metadata.amount || 0),
        });
        return res.json({ verified: true, user: updatedUser, amount: Number(metadata.amount || 0) });
    }
    if (provider === 'flutterwave') {
        const verification = await flutterwaveService.verifyTransaction(reference);
        if (!verification.status) {
            return res.status(400).json({ verified: false, error: verification.message });
        }
        const data = verification.data || {};
        const metadata = data.meta || {};
        if (metadata.userId !== user.id || metadata.type !== 'membership_verification') {
            return res.status(403).json({ error: 'Invalid verification payment metadata' });
        }
        const updatedUser = await db.updateUser(user.id, {
            verified: true,
            verificationLevel: 'basic',
            walletBalance: Number(user.walletBalance || 0) + Number(metadata.amount || 0),
        });
        return res.json({ verified: true, user: updatedUser, amount: Number(metadata.amount || 0) });
    }
    res.status(400).json({ error: 'Unsupported provider' });
}));
app.delete('/api/admin/users/:id', verifyAuthToken, requireRole('admin'), asyncHandler(async (req, res) => {
    const deleted = await db.deleteUser(req.params.id);
    if (!deleted) {
        return res.status(404).json({ error: 'User not found' });
    }
    res.json({ success: true });
}));
app.delete('/api/admin/listings/:id', verifyAuthToken, requireRole('admin'), asyncHandler(async (req, res) => {
    const deleted = await db.deleteListing(req.params.id);
    if (!deleted) {
        return res.status(404).json({ error: 'Listing not found' });
    }
    res.json({ success: true });
}));
app.post('/api/admin/orders/:id/resolve', verifyAuthToken, requireRole('admin'), asyncHandler(async (req, res) => {
    const { decision } = req.body;
    if (decision !== 'approve' && decision !== 'reject') {
        return res.status(400).json({ error: 'Decision must be approve or reject' });
    }
    const order = await db.getOrder(req.params.id);
    if (!order) {
        return res.status(404).json({ error: 'Order not found' });
    }
    if (order.status !== 'disputed') {
        return res.status(400).json({ error: 'Only disputed orders can be resolved' });
    }
    const updatedOrder = await db.updateOrder(req.params.id, {
        status: decision === 'approve' ? 'completed' : 'cancelled',
        notes: decision === 'approve' ? `${order.notes || 'Dispute resolved'} - approved by admin` : `${order.notes || 'Dispute resolved'} - rejected by admin`,
    });
    res.json(updatedOrder);
}));
app.post('/api/reports', verifyAuthToken, asyncHandler(async (req, res) => {
    const { reportedUserId, reportedUserName, reportedRole, type, subject, details } = req.body;
    if (!reportedUserId || !subject || !details) {
        return res.status(400).json({ error: 'Reported user, subject, and details are required' });
    }
    const reporter = await db.getUser(req.userId);
    const reportedUser = await db.getUser(reportedUserId);
    if (!reporter) {
        return res.status(404).json({ error: 'Reporter not found' });
    }
    if (!reportedUser) {
        return res.status(404).json({ error: 'Reported user not found' });
    }
    const report = {
        id: uuidv4(),
        reporterId: req.userId,
        reporterName: reporter.name,
        reportedUserId,
        reportedUserName: reportedUserName || reportedUser.name,
        reportedRole: reportedRole || reportedUser.role,
        type: type === 'complaint' ? 'complaint' : 'report',
        subject: subject.trim(),
        details: details.trim(),
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
    const createdReport = await db.addReport(report);
    res.status(201).json(createdReport);
}));
// ============== USER ROUTES ==============
app.get('/api/users', verifyAuthToken, asyncHandler(async (req, res) => {
    const users = await db.getAllUsers();
    const safeUsers = users.map((user) => {
        const { password: _password, ...userWithoutPassword } = user;
        return userWithoutPassword;
    });
    res.json(safeUsers);
}));
app.get('/api/users/:id', asyncHandler(async (req, res) => {
    const user = await db.getUser(req.params.id);
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }
    // Don't expose password
    const { password: _, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
}));
app.post('/api/users', asyncHandler(async (req, res) => {
    const { name, email, role, location } = req.body;
    const existingUser = await db.getUserByEmail(email);
    if (existingUser) {
        return res.status(400).json({ error: 'Email already registered' });
    }
    const user = {
        id: uuidv4(),
        name,
        email,
        role: role || 'buyer',
        avatar: `https://i.pravatar.cc/150?img=${Math.floor(Math.random() * 100)}`,
        walletBalance: 0,
        accountNumber: `MC-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`.toUpperCase(),
        location,
        verified: false,
        verificationLevel: 'unverified',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
    await db.addUser(user);
    await walletService.getOrCreateWallet(user.id);
    const { password: _, ...userWithoutPassword } = user;
    res.status(201).json(userWithoutPassword);
}));
app.put('/api/users/:id', verifyAuthToken, asyncHandler(async (req, res) => {
    // Users can only update their own profile
    if (req.userId !== req.params.id && req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'Unauthorized' });
    }
    const updated = await authService.updateProfile(req.params.id, req.body);
    if (!updated) {
        return res.status(404).json({ error: 'User not found' });
    }
    res.json(updated);
}));
// ============== LISTING ROUTES ==============
app.get('/api/listings', optionalAuth, asyncHandler(async (req, res) => {
    const listings = await db.getAllListings();
    res.json(listings);
}));
app.get('/api/listings/:id', asyncHandler(async (req, res) => {
    const listing = await db.getListing(req.params.id);
    if (!listing) {
        return res.status(404).json({ error: 'Listing not found' });
    }
    res.json(listing);
}));
app.post('/api/listings', optionalAuth, asyncHandler(async (req, res) => {
    const { sellerId, sellerName, title, description, price, category, location, images } = req.body;
    if (!sellerId || !sellerName || !title || !description || !price || !category || !location) {
        return res.status(400).json({ error: 'Missing listing fields' });
    }
    // If the request is authenticated, ensure the seller matches the token
    if (req.userId && sellerId !== req.userId) {
        return res.status(403).json({ error: 'Unauthorized' });
    }
    const listing = {
        id: uuidv4(),
        sellerId,
        sellerName,
        title,
        description,
        price,
        category,
        location,
        images: images || [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
    await db.addListing(listing);
    res.status(201).json(listing);
}));
app.get('/api/listings/seller/:sellerId', asyncHandler(async (req, res) => {
    const listings = await db.getListingsBySeller(req.params.sellerId);
    res.json(listings);
}));
app.get('/listing/new', (req, res) => {
    const frontendUrl = getFrontendUrl();
    res.redirect(`${frontendUrl}/listing/new`);
});
// ============== PROFILE ROUTES ==============
app.get('/api/profile', verifyAuthToken, asyncHandler(async (req, res) => {
    const user = await db.getUser(req.userId);
    if (!user)
        return res.status(404).json({ error: 'User not found' });
    const { password: _, ...userSafe } = user;
    res.json(userSafe);
}));
app.put('/api/profile/update', verifyAuthToken, asyncHandler(async (req, res) => {
    const updates = req.body;
    const updated = await db.updateUser(req.userId, updates);
    if (!updated)
        return res.status(404).json({ error: 'User not found' });
    const { password: _, ...userSafe } = updated;
    res.json(userSafe);
}));
app.get('/api/profile/stats', verifyAuthToken, asyncHandler(async (req, res) => {
    const sellerId = req.userId;
    const listings = await db.getListingsBySeller(sellerId);
    const activeListings = listings.length;
    const avgRating = listings.reduce((acc, l) => acc + (l.rating || 0), 0) / (listings.length || 1);
    const totalReviews = listings.reduce((acc, l) => acc + (l.reviewCount || 0), 0);
    const sales = (await db.getAllOrders()).filter((o) => o.sellerId === sellerId).length;
    res.json({ activeListings, avgRating: listings.length ? avgRating : 0, totalReviews, sales });
}));
app.post('/api/profile/avatar', verifyAuthToken, asyncHandler(async (req, res) => {
    const { image } = req.body; // expect data URL from client
    if (!image)
        return res.status(400).json({ error: 'Missing image' });
    const user = await db.getUser(req.userId);
    if (!user)
        return res.status(404).json({ error: 'User not found' });
    // store data URL as avatar
    await db.updateUser(user.id, { avatar: image });
    res.json({ avatar: image });
}));
// ============== WALLET ROUTES ==============
app.get('/api/wallet/balance', verifyAuthToken, asyncHandler(async (req, res) => {
    const balance = await walletService.getBalance(req.userId);
    res.json({ balance });
}));
app.get('/api/wallet/:userId', verifyAuthToken, asyncHandler(async (req, res) => {
    const wallet = await walletService.getOrCreateWallet(req.params.userId);
    res.json(wallet);
}));
app.get('/api/wallet/:userId/balance', verifyAuthToken, asyncHandler(async (req, res) => {
    const balance = await walletService.getBalance(req.params.userId);
    res.json({ balance });
}));
app.post('/api/wallet/:userId/deposit', verifyAuthToken, asyncHandler(async (req, res) => {
    const { amount, paymentGateway, reference } = req.body;
    if (req.params.userId !== req.userId) {
        return res.status(403).json({ error: 'Unauthorized' });
    }
    if (!amount || amount <= 0) {
        return res.status(400).json({ error: 'Invalid deposit amount' });
    }
    const transaction = walletService.addDeposit(req.params.userId, amount, paymentGateway || 'manual', reference || `WALLET_DEPOSIT_${Date.now()}`);
    res.status(201).json(transaction);
}));
app.post('/api/wallet/deposit', verifyAuthToken, asyncHandler(async (req, res) => {
    const { amount, provider, reference } = req.body;
    if (!amount || amount <= 0) {
        return res.status(400).json({ error: 'Invalid deposit amount' });
    }
    const transaction = walletService.addDeposit(req.userId, amount, provider || 'manual', reference || `WALLET_DEPOSIT_${Date.now()}`);
    res.status(201).json(transaction);
}));
app.post('/api/wallet/deposit/initialize', verifyAuthToken, asyncHandler(async (req, res) => {
    const { amount, provider } = req.body;
    if (!amount || amount <= 0) {
        return res.status(400).json({ error: 'Invalid deposit amount' });
    }
    if (!provider || !['paystack', 'flutterwave'].includes(provider)) {
        return res.status(400).json({ error: 'Unsupported deposit provider' });
    }
    const email = req.user?.email;
    if (!email) {
        return res.status(400).json({ error: 'User email is required' });
    }
    if (provider === 'paystack') {
        const paymentData = await paystackService.initializeTransaction(email, amount, {
            userId: req.userId,
            type: 'wallet_deposit',
            provider,
        });
        return res.json(paymentData);
    }
    const txRef = `WALLET_${Date.now()}_${uuidv4().substring(0, 8)}`;
    const paymentData = await flutterwaveService.initializePayment(email, amount, txRef, {
        userId: req.userId,
        type: 'wallet_deposit',
        provider,
    });
    res.json({ ...paymentData, txRef });
}));
app.post('/api/wallet/:userId/withdraw', verifyAuthToken, asyncHandler(async (req, res) => {
    const { amount, bankDetails } = req.body;
    if (req.params.userId !== req.userId) {
        return res.status(403).json({ error: 'Unauthorized' });
    }
    if (!amount || amount <= 0) {
        return res.status(400).json({ error: 'Invalid withdrawal amount' });
    }
    if (!bankDetails?.accountNumber || !bankDetails?.bankCode || !bankDetails?.accountName) {
        return res.status(400).json({ error: 'Missing bank details' });
    }
    const transaction = await walletService.initiateWithdrawal(req.params.userId, amount, bankDetails);
    res.status(201).json(transaction);
}));
app.post('/api/wallet/withdraw', verifyAuthToken, asyncHandler(async (req, res) => {
    const { amount, bankName, accountHolderName, accountNumber } = req.body;
    if (!amount || amount <= 0) {
        return res.status(400).json({ error: 'Invalid withdrawal amount' });
    }
    if (!bankName || !accountHolderName || !accountNumber) {
        return res.status(400).json({ error: 'Missing bank details' });
    }
    const transaction = await walletService.initiateWithdrawal(req.userId, amount, {
        accountNumber,
        bankCode: bankName,
        accountName: accountHolderName,
    });
    res.status(201).json(transaction);
}));
app.get('/api/wallet/:userId/transactions', verifyAuthToken, asyncHandler(async (req, res) => {
    const transactions = await walletService.getTransactionHistory(req.params.userId);
    res.json(transactions);
}));
// ============== PAYMENT GATEWAY ROUTES ==============
app.post('/api/payments/paystack/initialize', verifyAuthToken, asyncHandler(async (req, res) => {
    const { email, amount, userId, orderId } = req.body;
    if (userId !== req.userId) {
        return res.status(403).json({ error: 'Unauthorized' });
    }
    const paymentData = await paystackService.initializeTransaction(email, amount, {
        userId,
        orderId,
        timestamp: Date.now(),
    });
    res.json(paymentData);
}));
app.get('/api/payments/paystack/verify/:reference', verifyAuthToken, asyncHandler(async (req, res) => {
    const verification = await paystackService.verifyTransaction(req.params.reference);
    if (verification.status) {
        const { email, amount, orderId, userId } = verification.data?.metadata || {};
        if (orderId && userId) {
            const transaction = orderService.lockPayment(orderId, userId, amount / 100, 'paystack', req.params.reference);
            res.json({ verified: true, transaction });
        }
        else {
            res.json({ verified: true });
        }
    }
    else {
        res.status(400).json({ verified: false, error: verification.message });
    }
}));
app.post('/api/payments/flutterwave/initialize', verifyAuthToken, asyncHandler(async (req, res) => {
    const { email, amount, userId, orderId } = req.body;
    if (userId !== req.userId) {
        return res.status(403).json({ error: 'Unauthorized' });
    }
    const txRef = `FLW_${Date.now()}_${uuidv4().substring(0, 8)}`;
    const paymentData = await flutterwaveService.initializePayment(email, amount, txRef, {
        userId,
        orderId,
        timestamp: Date.now(),
    });
    res.json(paymentData);
}));
app.get('/api/payments/flutterwave/verify/:txRef', verifyAuthToken, asyncHandler(async (req, res) => {
    const verification = await flutterwaveService.verifyTransaction(req.params.txRef);
    if (verification.status) {
        const { customer, amount, meta } = verification.data || {};
        const { userId, orderId } = meta || {};
        if (orderId && userId) {
            const transaction = orderService.lockPayment(orderId, userId, amount, 'flutterwave', req.params.txRef);
            res.json({ verified: true, transaction });
        }
        else {
            res.json({ verified: true });
        }
    }
    else {
        res.status(400).json({ verified: false, error: verification.message });
    }
}));
app.post('/api/deposit/paystack', verifyAuthToken, asyncHandler(async (req, res) => {
    const { email, amount, userId, currency } = req.body;
    if (!email || !amount || !userId) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    if (userId !== req.userId) {
        return res.status(403).json({ error: 'Unauthorized' });
    }
    const paymentData = await paystackService.initializeTransaction(email, amount, {
        userId,
        currency: currency || 'NGN',
        type: 'wallet_deposit',
        timestamp: Date.now(),
    });
    res.json(paymentData);
}));
app.post('/api/deposit/flutterwave', verifyAuthToken, asyncHandler(async (req, res) => {
    const { email, amount, userId, currency } = req.body;
    if (!email || !amount || !userId) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    if (userId !== req.userId) {
        return res.status(403).json({ error: 'Unauthorized' });
    }
    const txRef = `WALLET_${Date.now()}_${uuidv4().substring(0, 8)}`;
    const paymentData = await flutterwaveService.initializePayment(email, amount, txRef, {
        userId,
        currency: currency || 'NGN',
        type: 'wallet_deposit',
        timestamp: Date.now(),
    });
    res.json({ ...paymentData, txRef });
}));
app.post('/api/deposit/verify', verifyAuthToken, asyncHandler(async (req, res) => {
    const { provider, reference } = req.body;
    if (!provider || !reference) {
        return res.status(400).json({ error: 'Missing provider or reference' });
    }
    if (provider === 'paystack') {
        const verification = await paystackService.verifyTransaction(reference);
        if (!verification.status) {
            return res.status(400).json({ verified: false, error: verification.message });
        }
        const { amount, metadata } = verification.data || {};
        const { userId, type } = metadata || {};
        if (!userId || userId !== req.userId || type !== 'wallet_deposit') {
            return res.status(403).json({ error: 'Unauthorized or invalid deposit metadata' });
        }
        const depositAmount = Number(amount) / 100;
        const transaction = await walletService.addDeposit(userId, depositAmount, 'paystack', reference);
        res.json({ verified: true, transaction });
        return;
    }
    if (provider === 'flutterwave') {
        const verification = await flutterwaveService.verifyTransaction(reference);
        if (!verification.status) {
            return res.status(400).json({ verified: false, error: verification.message });
        }
        const data = verification.data || {};
        const userId = data.meta?.userId;
        const type = data.meta?.type;
        if (!userId || userId !== req.userId || type !== 'wallet_deposit') {
            return res.status(403).json({ error: 'Unauthorized or invalid deposit metadata' });
        }
        const depositAmount = Number(data.amount);
        const transaction = await walletService.addDeposit(userId, depositAmount, 'flutterwave', reference);
        res.json({ verified: true, transaction });
        return;
    }
    res.status(400).json({ error: 'Unsupported provider' });
}));
// ============== ORDER ROUTES ==============
app.post('/api/orders', verifyAuthToken, asyncHandler(async (req, res) => {
    const { listingId, buyerId, buyerName, sellerId, sellerName, price, listingTitle } = req.body;
    if (buyerId !== req.userId) {
        return res.status(403).json({ error: 'Unauthorized' });
    }
    const order = await orderService.createOrder(listingId, buyerId, buyerName, sellerId, sellerName, price, listingTitle);
    res.status(201).json(order);
}));
app.get('/api/orders/:id', verifyAuthToken, asyncHandler(async (req, res) => {
    const order = await db.getOrder(req.params.id);
    if (!order) {
        return res.status(404).json({ error: 'Order not found' });
    }
    // User can only view their own orders (unless admin)
    if (order.buyerId !== req.userId &&
        order.sellerId !== req.userId &&
        req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'Unauthorized' });
    }
    res.json(order);
}));
app.get('/api/orders/user/:userId', verifyAuthToken, asyncHandler(async (req, res) => {
    if (req.params.userId !== req.userId && req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'Unauthorized' });
    }
    const role = req.query.role || 'buyer';
    const orders = await orderService.getUserOrders(req.params.userId, role);
    res.json(orders);
}));
app.post('/api/orders/:id/pay-wallet', verifyAuthToken, asyncHandler(async (req, res) => {
    const { userId } = req.body;
    if (userId !== req.userId) {
        return res.status(403).json({ error: 'Unauthorized' });
    }
    const result = await orderService.payOrderWithWallet(req.params.id, userId);
    res.json(result);
}));
app.post('/api/orders/:id/accept', verifyAuthToken, asyncHandler(async (req, res) => {
    const { userId } = req.body;
    if (userId !== req.userId) {
        return res.status(403).json({ error: 'Unauthorized' });
    }
    const order = await orderService.acceptOrder(req.params.id, userId);
    res.json(order);
}));
app.post('/api/orders/:id/ship', verifyAuthToken, asyncHandler(async (req, res) => {
    const { userId, trackingNumber } = req.body;
    if (userId !== req.userId) {
        return res.status(403).json({ error: 'Unauthorized' });
    }
    const order = await orderService.shipOrder(req.params.id, userId, trackingNumber);
    res.json(order);
}));
app.post('/api/orders/:id/mark-delivered', verifyAuthToken, asyncHandler(async (req, res) => {
    const { userId } = req.body;
    if (userId !== req.userId) {
        return res.status(403).json({ error: 'Unauthorized' });
    }
    const order = await orderService.markDelivered(req.params.id, userId);
    res.json(order);
}));
app.post('/api/orders/:id/confirm-delivery', verifyAuthToken, asyncHandler(async (req, res) => {
    const { userId } = req.body;
    if (userId !== req.userId) {
        return res.status(403).json({ error: 'Unauthorized' });
    }
    const result = await orderService.confirmDelivery(req.params.id, userId);
    res.json(result);
}));
app.post('/api/orders/:id/cancel', verifyAuthToken, asyncHandler(async (req, res) => {
    const { userId, reason } = req.body;
    if (userId !== req.userId && req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'Unauthorized' });
    }
    const result = await orderService.cancelOrder(req.params.id, userId, reason);
    res.json(result);
}));
app.post('/api/orders/:id/dispute', verifyAuthToken, asyncHandler(async (req, res) => {
    const { userId, reason } = req.body;
    if (userId !== req.userId) {
        return res.status(403).json({ error: 'Unauthorized' });
    }
    const order = await orderService.raiseDispute(req.params.id, userId, reason);
    res.json(order);
}));
// ============== HEALTH ==============
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'marketplace-backend' });
});
// ============== ERROR HANDLER ==============
app.use((err, req, res, next) => {
    console.error(err);
    res.status(err.status || 500).json({
        error: err.message || 'Internal server error',
    });
});
// ============== START SERVER ==============
async function startServer() {
    try {
        await initializeDatabase();
        console.log('🗄️ MySQL database initialized');
    }
    catch (error) {
        console.error('❌ MySQL initialization failed:', error);
        console.warn('⚠️ Continuing without database for now. API routes that require persistence will fail until DB is configured.');
    }
    const server = app.listen(PORT, HOST, () => {
        console.log(`🚀 MarketConnect API running on http://${HOST === '0.0.0.0' ? '127.0.0.1' : HOST}:${PORT}`);
        console.log(`📍 CORS enabled for ${process.env.FRONTEND_URL}`);
        console.log(`🔐 Authentication enabled with JWT`);
    });
    server.on('error', (error) => {
        if (error.code === 'EADDRINUSE') {
            console.error(`❌ Port ${PORT} is already in use. Please stop the existing process or change PORT in the environment.`);
        }
        else {
            console.error('❌ Server startup failed:', error);
        }
        process.exit(1);
    });
}
startServer();
//# sourceMappingURL=index.js.map