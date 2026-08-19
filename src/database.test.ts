import test from 'node:test';
import assert from 'node:assert/strict';
import { Database } from './database';

test('deleteListing returns true when a listing is removed', async () => {
  const db = Object.create(Database.prototype) as any;
  db.execute = async () => ({ affectedRows: 1 });

  const deleted = await Database.prototype.deleteListing.call(db, 'listing-1');

  assert.equal(deleted, true);
});

test('deleteListing returns false when no listing is removed', async () => {
  const db = Object.create(Database.prototype) as any;
  db.execute = async () => ({ affectedRows: 0 });

  const deleted = await Database.prototype.deleteListing.call(db, 'missing-listing');

  assert.equal(deleted, false);
});

test('deleteUser anonymizes the account email instead of deleting the record', async () => {
  const db = Object.create(Database.prototype) as any;
  let capturedParams: string[] | undefined;

  db.getUser = async () => ({ id: 'user-1', email: 'old@example.com' });
  db.execute = async (_sql: string, params: string[]) => {
    capturedParams = params;
    return { affectedRows: 1 };
  };

  const deleted = await Database.prototype.deleteUser.call(db, 'user-1');

  assert.equal(deleted, true);
  assert.ok(capturedParams);
  assert.equal(capturedParams?.[1], 'deleted.user-1@deleted.local');
});
