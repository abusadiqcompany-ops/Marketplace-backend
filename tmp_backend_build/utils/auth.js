import jwt from 'jsonwebtoken';
import bcryptjs from 'bcryptjs';
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-key-change-in-production';
const JWT_EXPIRY = '7d';
/**
 * Generate JWT token
 */
export function generateToken(payload) {
    return jwt.sign(payload, JWT_SECRET, {
        expiresIn: JWT_EXPIRY,
    });
}
/**
 * Verify JWT token
 */
export function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    }
    catch (error) {
        return null;
    }
}
/**
 * Hash password
 */
export async function hashPassword(password) {
    const salt = await bcryptjs.genSalt(10);
    return bcryptjs.hash(password, salt);
}
/**
 * Compare password with hash
 */
export async function comparePassword(password, hash) {
    return bcryptjs.compare(password, hash);
}
/**
 * Generate access and refresh tokens
 */
export function generateTokenPair(user) {
    const accessToken = generateToken({
        userId: user.id,
        email: user.email,
        role: user.role,
    });
    // Refresh token with longer expiry
    const refreshToken = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });
    return { accessToken, refreshToken };
}
/**
 * Extract token from Authorization header
 */
export function extractTokenFromHeader(authHeader) {
    if (!authHeader)
        return null;
    const parts = authHeader.split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer') {
        return parts[1];
    }
    return null;
}
//# sourceMappingURL=auth.js.map