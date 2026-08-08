import test from 'node:test';
import assert from 'node:assert/strict';
import { Database } from './database.ts';

test('deleteListing returns true when a listing is removed', async () => {
  const db = Object.create(Database.prototype) as Database & { execute: (query: string, params?: any[]) => Promise<any> };
  db.execute = async () => ({ affectedRows: 1 });

  const deleted = await db.deleteListing('listing-1');

  assert.equal(deleted, true);
});

test('deleteListing returns false when no listing is removed', async () => {
  const db = Object.create(Database.prototype) as Database & { execute: (query: string, params?: any[]) => Promise<any> };
  db.execute = async () => ({ affectedRows: 0 });

  const deleted = await db.deleteListing('missing-listing');

  assert.equal(deleted, false);
});
