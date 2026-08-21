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
test('deleteUser permanently removes the account and its related records', async () => {
    const db = Object.create(Database.prototype);
    const statements = [];
    db.getUser = async () => ({ id: 'user-1', email: 'old@example.com' });
    db.init = async () => undefined;
    db.pool = {
        getConnection: async () => ({
            beginTransaction: async () => undefined,
            execute: async (sql) => {
                statements.push(sql);
                return [sql.startsWith('DELETE FROM users') ? { affectedRows: 1 } : {}];
            },
            commit: async () => undefined,
            rollback: async () => undefined,
            release: () => undefined,
        }),
    };
    const deleted = await Database.prototype.deleteUser.call(db, 'user-1');
    assert.equal(deleted, true);
    assert.deepEqual(statements, [
        'DELETE FROM listings WHERE sellerId = ?',
        'DELETE FROM orders WHERE buyerId = ? OR sellerId = ?',
        'DELETE FROM transactions WHERE userId = ? OR counterpartyId = ?',
        'DELETE FROM wallets WHERE userId = ?',
        'DELETE FROM reports WHERE reporterId = ? OR reportedUserId = ?',
        'DELETE FROM account_deletion_requests WHERE userId = ?',
        'DELETE FROM users WHERE id = ?',
    ]);
});
//# sourceMappingURL=database.test.js.map