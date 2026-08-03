import { v4 as uuidv4 } from 'uuid';
import { db } from '../database.js';
import { hashPassword, comparePassword, generateTokenPair, } from '../utils/auth.js';
const DEV_ADMIN_EMAIL = process.env.DEV_ADMIN_EMAIL || 'developer@marketconnect.dev';
const DEV_ADMIN_PASSWORD = process.env.DEV_ADMIN_PASSWORD || 'MarketConnectDev2026!';
const DEMO_ACCOUNT_PASSWORDS = {
    'developer@marketconnect.dev': DEV_ADMIN_PASSWORD,
    'chioma@buyer.ng': 'MarketConnectBuyer2026!',
    'emeka@seller.ng': 'MarketConnectSeller2026!',
    'fatima@seller.ng': 'MarketConnectSeller2026!',
};
export function getDeveloperAdminCredentials() {
    return {
        email: DEV_ADMIN_EMAIL,
        password: DEV_ADMIN_PASSWORD,
    };
}
export function getDemoPasswordForEmail(email) {
    return DEMO_ACCOUNT_PASSWORDS[email.trim().toLowerCase()];
}
export function isDeveloperAdminCredentials(email, password) {
    const credentials = getDeveloperAdminCredentials();
    return (email.trim().toLowerCase() === credentials.email.trim().toLowerCase() &&
        password === credentials.password);
}
function generateOtp() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}
async function ensureDemoUser(email, password) {
    const normalizedEmail = email.trim().toLowerCase();
    const demoPassword = getDemoPasswordForEmail(normalizedEmail);
    if (!demoPassword || password !== demoPassword) {
        return undefined;
    }
    const existingUser = await db.getUserByEmail(normalizedEmail);
    if (existingUser) {
        const updatedUser = await db.updateUser(existingUser.id, {
            password: await hashPassword(password),
            verified: true,
            verificationLevel: 'full',
            ...(normalizedEmail === 'chioma@buyer.ng' && {
                name: 'Chioma Obi',
                role: 'buyer',
                walletBalance: 500000,
                accountNumber: 'MC-CHIOMA-BUYER',
                location: {
                    city: 'Lekki',
                    state: 'Lagos',
                    country: 'Nigeria',
                },
            }),
            ...(normalizedEmail === 'emeka@seller.ng' && {
                name: 'Emeka Electronics',
                role: 'seller',
                businessName: 'Emeka Electronics',
                walletBalance: 1200000,
                accountNumber: 'MC-EMEKA-SELLER',
                sellerLocation: {
                    city: 'Lagos Island',
                    state: 'Lagos',
                    country: 'Nigeria',
                },
            }),
            ...(normalizedEmail === 'fatima@seller.ng' && {
                name: 'Fatima Fashion',
                role: 'seller',
                businessName: 'Fatima Fashion',
                walletBalance: 800000,
                accountNumber: 'MC-FATIMA-SELLER',
                sellerLocation: {
                    city: 'Abuja',
                    state: 'Abuja',
                    country: 'Nigeria',
                },
            }),
        });
        return updatedUser || existingUser;
    }
    const demoUser = {
        id: uuidv4(),
        name: normalizedEmail === 'chioma@buyer.ng' ? 'Chioma Obi' : normalizedEmail === 'emeka@seller.ng' ? 'Emeka Electronics' : 'Fatima Fashion',
        email: normalizedEmail,
        password: await hashPassword(password),
        role: normalizedEmail === 'chioma@buyer.ng' ? 'buyer' : 'seller',
        avatar: 'https://i.pravatar.cc/150?img=31',
        walletBalance: normalizedEmail === 'chioma@buyer.ng' ? 500000 : normalizedEmail === 'emeka@seller.ng' ? 1200000 : 800000,
        accountNumber: normalizedEmail === 'chioma@buyer.ng'
            ? 'MC-CHIOMA-BUYER'
            : normalizedEmail === 'emeka@seller.ng'
                ? 'MC-EMEKA-SELLER'
                : 'MC-FATIMA-SELLER',
        verified: true,
        verificationLevel: 'full',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...(normalizedEmail === 'chioma@buyer.ng' && {
            location: {
                city: 'Lekki',
                state: 'Lagos',
                country: 'Nigeria',
            },
        }),
        ...(normalizedEmail === 'emeka@seller.ng' && {
            businessName: 'Emeka Electronics',
            sellerLocation: {
                city: 'Lagos Island',
                state: 'Lagos',
                country: 'Nigeria',
            },
        }),
        ...(normalizedEmail === 'fatima@seller.ng' && {
            businessName: 'Fatima Fashion',
            sellerLocation: {
                city: 'Abuja',
                state: 'Abuja',
                country: 'Nigeria',
            },
        }),
    };
    await db.addUser(demoUser);
    return demoUser;
}
export class AuthService {
    /**
     * Login user
     */
    async login(email, password) {
        const normalizedEmail = email.trim().toLowerCase();
        const isDeveloperLogin = isDeveloperAdminCredentials(email, password);
        const demoPassword = getDemoPasswordForEmail(normalizedEmail);
        const loginEmail = isDeveloperLogin ? getDeveloperAdminCredentials().email : normalizedEmail;
        let user = await db.getUserByEmail(loginEmail);
        if (isDeveloperLogin) {
            if (!user) {
                const developerAdmin = {
                    id: uuidv4(),
                    name: 'Developer Admin',
                    email: loginEmail,
                    password: await hashPassword(getDeveloperAdminCredentials().password),
                    role: 'admin',
                    avatar: 'https://i.pravatar.cc/150?img=31',
                    walletBalance: 0,
                    accountNumber: 'MC-DEV-ADMIN',
                    verified: true,
                    verificationLevel: 'full',
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                };
                await db.addUser(developerAdmin);
                user = developerAdmin;
            }
            else {
                await db.updateUser(user.id, {
                    role: 'admin',
                    password: await hashPassword(getDeveloperAdminCredentials().password),
                    verified: true,
                    verificationLevel: 'full',
                });
                user = (await db.getUser(user.id)) || user;
            }
        }
        if (!user) {
            const demoUser = await ensureDemoUser(normalizedEmail, password);
            user = demoUser;
        }
        if (!user) {
            throw new Error('User not found');
        }
        if (!user.password) {
            throw new Error('Invalid credentials');
        }
        const isPasswordValid = await comparePassword(password, user.password);
        const isDemoPasswordValid = demoPassword ? password === demoPassword : false;
        if (!isPasswordValid && !isDemoPasswordValid) {
            throw new Error('Invalid credentials');
        }
        if ((isDemoPasswordValid || demoPassword === password) && user.password && !(await comparePassword(password, user.password))) {
            await db.updateUser(user.id, {
                password: await hashPassword(password),
            });
            user = (await db.getUser(user.id)) || user;
        }
        const tokens = generateTokenPair(user);
        // Remove password from returned user object
        const { password: _, ...userWithoutPassword } = user;
        return {
            user: userWithoutPassword,
            ...tokens,
        };
    }
    async sendVerification(userId, type) {
        const user = await db.getUser(userId);
        if (!user) {
            throw new Error('User not found');
        }
        const otp = generateOtp();
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
        const updates = {
            otpExpiresAt: expiresAt,
            ...(type === 'email'
                ? { emailOtp: otp, emailVerified: false }
                : { phoneOtp: otp, phoneVerified: false }),
        };
        await db.updateUser(userId, updates);
        return {
            type,
            code: otp,
            message: `${type === 'email' ? 'Email' : 'SMS'} verification code sent successfully. Use the code below to confirm it.`,
        };
    }
    async verifyCode(userId, type, code) {
        const user = await db.getUser(userId);
        if (!user) {
            throw new Error('User not found');
        }
        const otp = type === 'email' ? user.emailOtp : user.phoneOtp;
        const expiry = user.otpExpiresAt ? new Date(user.otpExpiresAt) : null;
        if (!otp || !code || !expiry || expiry.getTime() < Date.now()) {
            throw new Error('Verification code is invalid or expired.');
        }
        if (otp !== code.trim()) {
            throw new Error('Verification code is incorrect.');
        }
        const updates = {
            otpExpiresAt: undefined,
            ...(type === 'email'
                ? { emailOtp: undefined, emailVerified: true }
                : { phoneOtp: undefined, phoneVerified: true }),
        };
        const updatedUser = await db.updateUser(userId, updates);
        if (!updatedUser) {
            throw new Error('Unable to update verification status.');
        }
        return updatedUser;
    }
    /**
     * Signup new user
     */
    async signup(request) {
        // Check if user already exists
        const existingUser = await db.getUserByEmail(request.email);
        if (existingUser) {
            throw new Error('Email already registered');
        }
        // Hash password
        const hashedPassword = await hashPassword(request.password);
        // Create user
        const emailOtp = generateOtp();
        const newUser = {
            id: uuidv4(),
            name: request.name,
            email: request.email,
            password: hashedPassword,
            role: request.role,
            avatar: `https://i.pravatar.cc/150?img=${Math.floor(Math.random() * 100)}`,
            walletBalance: 0,
            accountNumber: `MC-${Date.now()}-${Math.random()
                .toString(36)
                .substr(2, 5)}`
                .toUpperCase(),
            verified: false,
            verificationLevel: 'unverified',
            emailVerified: false,
            phoneVerified: false,
            emailOtp,
            otpExpiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            // Buyer/Seller specific
            ...(request.role === 'buyer' && { location: request.location }),
            ...(request.role === 'seller' && {
                businessName: request.businessName,
                phone: request.phone,
                sellerLocation: request.sellerLocation,
                description: '',
            }),
        };
        await db.addUser(newUser);
        // Generate tokens
        const tokens = generateTokenPair(newUser);
        // Remove password from returned user object
        const { password: _, ...userWithoutPassword } = newUser;
        return {
            user: userWithoutPassword,
            ...tokens,
        };
    }
    /**
     * Get current user from token
     */
    async getCurrentUser(userId) {
        const user = await db.getUser(userId);
        if (user) {
            const { password: _, ...userWithoutPassword } = user;
            return userWithoutPassword;
        }
        return undefined;
    }
    /**
     * Update user profile
     */
    async updateProfile(userId, updates) {
        const updated = await db.updateUser(userId, updates);
        if (updated) {
            const { password: _, ...userWithoutPassword } = updated;
            return userWithoutPassword;
        }
        return undefined;
    }
    /**
     * Change password
     */
    async changePassword(userId, oldPassword, newPassword) {
        const user = await db.getUser(userId);
        if (!user || !user.password) {
            throw new Error('User not found');
        }
        const isPasswordValid = await comparePassword(oldPassword, user.password);
        if (!isPasswordValid) {
            throw new Error('Invalid current password');
        }
        const hashedPassword = await hashPassword(newPassword);
        await db.updateUser(userId, { password: hashedPassword });
    }
}
//# sourceMappingURL=auth.js.map