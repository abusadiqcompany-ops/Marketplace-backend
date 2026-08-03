import { User } from '../database.js';
export interface JWTPayload {
    userId: string;
    email: string;
    role: 'buyer' | 'seller' | 'admin';
}
export interface TokenPair {
    accessToken: string;
    refreshToken: string;
}
/**
 * Generate JWT token
 */
export declare function generateToken(payload: JWTPayload): string;
/**
 * Verify JWT token
 */
export declare function verifyToken(token: string): JWTPayload | null;
/**
 * Hash password
 */
export declare function hashPassword(password: string): Promise<string>;
/**
 * Compare password with hash
 */
export declare function comparePassword(password: string, hash: string): Promise<boolean>;
/**
 * Generate access and refresh tokens
 */
export declare function generateTokenPair(user: User): TokenPair;
/**
 * Extract token from Authorization header
 */
export declare function extractTokenFromHeader(authHeader?: string): string | null;
//# sourceMappingURL=auth.d.ts.map