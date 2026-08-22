const DEFAULT_FRONTEND_URL = 'https://marketplace-frontend-mu-two.vercel.app';
const DEFAULT_ALLOWED_FRONTEND_ORIGINS = [
    'https://marketconnectapp.com.ng',
    'https://www.marketconnectapp.com.ng',
    'https://marketplace-frontend-git-main-musaf-technologies.vercel.app',
    'https://marketplace-frontend-mu-two.vercel.app',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:4173',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:4173',
    'http://localhost:4174',
    'http://127.0.0.1:4174',
    'https://localhost:4173',
    'https://127.0.0.1:4173',
];
function getFrontendUrl(env = process.env) {
    const configured = env.FRONTEND_URL?.trim();
    if (!configured) {
        return DEFAULT_FRONTEND_URL;
    }
    return configured.replace(/\/$/, '');
}
function getAllowedOrigins(env = process.env) {
    return Array.from(new Set([
        getFrontendUrl(env),
        env.FRONTEND_URL?.trim().replace(/\/$/, ''),
        ...DEFAULT_ALLOWED_FRONTEND_ORIGINS,
        ...(env.ALLOWED_ORIGINS?.split(',').map((origin) => origin.trim()).filter(Boolean) || []),
    ].filter(Boolean)));
}
export { DEFAULT_FRONTEND_URL, getAllowedOrigins, getFrontendUrl };
//# sourceMappingURL=frontend.js.map