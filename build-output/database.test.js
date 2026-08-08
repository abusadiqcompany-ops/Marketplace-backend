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
//# sourceMappingURL=database.test.js.map