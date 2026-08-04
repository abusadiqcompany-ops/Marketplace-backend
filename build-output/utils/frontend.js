const DEFAULT_FRONTEND_URL = 'https://marketplace-frontend-mu-two.vercel.app';
function getFrontendUrl(env = process.env) {
    const configured = env.FRONTEND_URL?.trim();
    if (!configured) {
        return DEFAULT_FRONTEND_URL;
    }
    return configured.replace(/\/$/, '');
}
export { DEFAULT_FRONTEND_URL, getFrontendUrl };
//# sourceMappingURL=frontend.js.map