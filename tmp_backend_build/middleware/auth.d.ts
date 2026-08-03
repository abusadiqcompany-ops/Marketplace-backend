import { Request, Response, NextFunction } from 'express';
export interface AuthRequest extends Request {
    userId?: string;
    user?: {
        userId: string;
        email: string;
        role: 'buyer' | 'seller' | 'admin';
    };
}
/**
 * Middleware to verify JWT token
 */
export declare function verifyAuthToken(req: AuthRequest, res: Response, next: NextFunction): Response<any, Record<string, any>> | undefined;
/**
 * Middleware to require specific roles
 */
export declare function requireRole(...roles: string[]): (req: AuthRequest, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
/**
 * Optional auth middleware (doesn't fail if no token)
 */
export declare function optionalAuth(req: AuthRequest, res: Response, next: NextFunction): void;
//# sourceMappingURL=auth.d.ts.map