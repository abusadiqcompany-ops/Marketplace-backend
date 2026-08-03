import { User } from '../database.js';
export interface LoginRequest {
    email: string;
    password: string;
}
export interface SignupRequest {
    name: string;
    email: string;
    password: string;
    role: 'buyer' | 'seller';
    location?: any;
    businessName?: string;
    phone?: string;
    sellerLocation?: any;
}
export interface AuthResponse {
    user: User;
    accessToken: string;
    refreshToken: string;
    emailOtp?: string;
    phoneOtp?: string;
    message?: string;
}
export declare function getDeveloperAdminCredentials(): {
    email: string;
    password: string;
};
export declare function getDemoPasswordForEmail(email: string): string | undefined;
export declare function isDeveloperAdminCredentials(email: string, password: string): boolean;
export declare function getVerificationDestination(user: Pick<User, 'email' | 'phone'>, type: 'email' | 'phone'): string;
export declare class AuthService {
    /**
     * Login user
     */
    login(email: string, password: string): Promise<AuthResponse>;
    sendVerification(userId: string, type: 'email' | 'phone'): Promise<{
        type: 'email' | 'phone';
        message: string;
    }>;
    verifyCode(userId: string, type: 'email' | 'phone', code: string): Promise<User>;
    /**
     * Signup new user
     */
    signup(request: SignupRequest): Promise<AuthResponse>;
    /**
     * Get current user from token
     */
    getCurrentUser(userId: string): Promise<User | undefined>;
    /**
     * Update user profile
     */
    updateProfile(userId: string, updates: Partial<User>): Promise<User | undefined>;
    /**
     * Change password
     */
    changePassword(userId: string, oldPassword: string, newPassword: string): Promise<void>;
}
//# sourceMappingURL=auth.d.ts.map