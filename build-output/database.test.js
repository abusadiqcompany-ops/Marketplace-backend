import test from 'node:test';
import assert from 'node:assert/strict';
import { Database } from './database';
test('deleteListing returns true when a listing is removed', async () => {
    const db = Object.create(Database.prototype);
    db.execute = async () => ({ affectedRows: 1 });
    const deleted = await Database.prototype.deleteListing.call(db, 'listing-1');
    assert.equal(deleted, true);
});
test('deleteListing returns false when no listing is removed', async () => {
    const db = Object.create(Database.prototype);
    db.execute = async () => ({ affectedRows: 0 });
    const deleted = await Database.prototype.deleteListing.call(db, 'missing-listing');
    assert.equal(deleted, false);
});
test('deleteUser anonymizes the account email instead of deleting the record', async () => {
    const db = Object.create(Database.prototype);
    let capturedParams;
    db.getUser = async () => ({ id: 'user-1', email: 'old@example.com' });
    db.execute = async (_sql, params) => {
        capturedParams = params;
        return { affectedRows: 1 };
    };
    const deleted = await Database.prototype.deleteUser.call(db, 'user-1');
    assert.equal(deleted, true);
    assert.ok(capturedParams);
    assert.equal(capturedParams?.[1], 'deleted.user-1@deleted.local');
});
//# sourceMappingURL=database.test.js.map