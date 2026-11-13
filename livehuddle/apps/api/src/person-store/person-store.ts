// A person's Durable Object (docs/specs/013-workspace/shape-libraries.md "Storage"): one SQLite-backed instance per
// person id (an account or a guest), holding what livehuddle keeps for the person rather than for one canvas.
// Today that is their shape libraries. The worker reaches it through person-client.ts; every RPC names the person,
// so a library reports its owner without the store having to remember its own name.
//
// A store that never held anything is never given storage by a read or a purge: those check for the schema first.

import { DurableObject } from 'cloudflare:workers';
import type { ShapeLibrary, ShapeLibraryItem } from '@livehuddle/api-schema';
import type { ItemSql as DocumentSql } from '@liveworkspace/index-app';
import type { Env } from '../types';
import { hasPersonSchema, migratePersonSchema } from './person-schema';
import { listMergedGuests, MERGED_GUESTS_KEEP_MS, noteMergedGuests } from './merged-guests';
import {
  createLibraryChecked,
  deleteLibrary,
  exportLibraries,
  getLibrary,
  importLibraries,
  listLibraries,
  updateLibraryChecked,
  type LibraryRecord,
  type NewShapeLibrary,
} from './shape-library-store';

export class PersonStore extends DurableObject<Env> {
  private ready = false;

  private get sql(): DocumentSql {
    return this.ctx.storage.sql;
  }

  // The schema, made on the first write.
  private writable(): DocumentSql {
    if (!this.ready) {
      migratePersonSchema(this.sql);
      this.ready = true;
    }
    return this.sql;
  }

  // The schema when the store has one, or null for a store that never held anything (a read writes nothing).
  private readable(): DocumentSql | null {
    if (this.ready) return this.sql;
    if (!hasPersonSchema(this.sql)) return null;
    return this.writable();
  }

  async shapeLibraries(ownerId: string): Promise<ShapeLibrary[]> {
    const sql = this.readable();
    return sql ? listLibraries(sql, ownerId) : [];
  }

  async shapeLibrary(ownerId: string, id: string): Promise<ShapeLibrary | null> {
    const sql = this.readable();
    return sql ? getLibrary(sql, ownerId, id) : null;
  }

  async createShapeLibrary(
    ownerId: string,
    lib: NewShapeLibrary,
    cap: number,
  ): Promise<ShapeLibrary | 'cap' | 'exists'> {
    const sql = this.writable();
    return this.ctx.storage.transactionSync(() =>
      createLibraryChecked(sql, ownerId, lib, cap, Date.now()),
    );
  }

  async updateShapeLibrary(
    ownerId: string,
    id: string,
    patch: { name?: string; items?: ShapeLibraryItem[] },
  ): Promise<ShapeLibrary | 'not_found' | 'name_taken'> {
    const sql = this.readable();
    if (!sql) return 'not_found';
    return this.ctx.storage.transactionSync(() =>
      updateLibraryChecked(sql, ownerId, id, patch, Date.now()),
    );
  }

  async deleteShapeLibrary(id: string): Promise<boolean> {
    const sql = this.readable();
    return sql ? deleteLibrary(sql, id) : false;
  }

  // A guest signing in (db/account.ts migrateAccount): their libraries, read out of the guest's store...
  async exportShapeLibraries(): Promise<LibraryRecord[]> {
    const sql = this.readable();
    return sql ? exportLibraries(sql) : [];
  }

  // ...and taken in by the account's.
  async adoptShapeLibraries(records: LibraryRecord[]): Promise<{ moved: number; renamed: number }> {
    if (records.length === 0) return { moved: 0, renamed: 0 };
    const sql = this.writable();
    return this.ctx.storage.transactionSync(() => importLibraries(sql, records));
  }

  // A guest signed in to this account (db/account.ts mergeGuest): the guests' collab keys, kept so the account's close
  // anonymises their Attendance visits too (merged-guests.ts). Answers how many were new.
  async noteMergedGuests(keys: string[]): Promise<number> {
    if (keys.length === 0) return 0;
    const sql = this.writable();
    return this.ctx.storage.transactionSync(() => noteMergedGuests(sql, keys, Date.now()));
  }

  // The guests' keys, for the account's purge (routes/internal-items.ts) and for a guest merging on into an account.
  async mergedGuestKeys(): Promise<string[]> {
    const sql = this.readable();
    return sql ? listMergedGuests(sql) : [];
  }

  // The person is gone (their account closed, or the guest they were signed in to an account): everything here
  // goes. Idempotent, and a store that never held anything stays untouched. The guests it signed in from stay
  // MERGED_GUESTS_KEEP_MS more, so the index's purge retries can still anonymise their visits; the alarm then
  // deletes them.
  async purge(): Promise<void> {
    if (!this.ready && !hasPersonSchema(this.sql)) return;
    const guests = listMergedGuests(this.writable());
    await this.ctx.storage.deleteAll();
    this.ready = false;
    if (guests.length === 0) return;
    const sql = this.writable();
    this.ctx.storage.transactionSync(() => noteMergedGuests(sql, [...guests].reverse(), Date.now()));
    await this.ctx.storage.setAlarm(Date.now() + MERGED_GUESTS_KEEP_MS);
  }

  // The kept guest keys' time is up: the store goes whole.
  override async alarm(): Promise<void> {
    await this.ctx.storage.deleteAll();
    this.ready = false;
  }
}
