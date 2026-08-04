import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_FRONTEND_URL, getFrontendUrl } from './frontend.js';
test('returns the deployed frontend URL by default', () => {
    assert.equal(getFrontendUrl({}), DEFAULT_FRONTEND_URL);
});
test('trims trailing slashes from configured frontend URLs', () => {
    assert.equal(getFrontendUrl({ FRONTEND_URL: 'https://example.com/' }), 'https://example.com');
});
//# sourceMappingURL=frontend.test.js.map