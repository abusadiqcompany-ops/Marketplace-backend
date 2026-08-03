import { verifyToken, extractTokenFromHeader } from '../utils/auth.js';
/**
 * Middleware to verify JWT token
 */
export function verifyAuthToken(req, res, next) {
    const authHeader = req.headers.authorization;
    const token = extractTokenFromHeader(authHeader);
    if (!token) {
        return res.status(401).json({ error: 'Missing authentication token' });
    }
    const payload = verifyToken(token);
    if (!payload) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
    req.user = payload;
    req.userId = payload.userId;
    next();
}
/**
 * Middleware to require specific roles
 */
export function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }
        next();
    };
}
/**
 * Optional auth middleware (doesn't fail if no token)
 */
export function optionalAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    const token = extractTokenFromHeader(authHeader);
    if (token) {
        const payload = verifyToken(token);
        if (payload) {
            req.user = payload;
            req.userId = payload.userId;
        }
    }
    next();
}
//# sourceMappingURL=auth.js.map