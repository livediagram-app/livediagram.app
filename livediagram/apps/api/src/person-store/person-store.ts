// A person's Durable Object (docs/specs/013-workspace/shape-libraries.md "Storage"): one SQLite-backed instance per
// person id (an account or a guest), holding what livediagram keeps for the person rather than for one canvas.
// Today that is their shape libraries and their Google Drive mirror. The worker reaches it through person-client.ts; every RPC names the person,
// so a library reports its owner without the store having to remember its own name.
//
// A store that never held anything is never given storage by a read or a purge: those check for the schema first.

import { DurableObject } from 'cloudflare:workers';
import type {
  DriveConnection,
  DriveConnectionStatus,
  DriveItem,
  DriveItemKind,
  DriveLease,
  ShapeLibrary,
  ShapeLibraryItem,
} from '@livediagram/api-schema';
import type { ItemSql as DocumentSql } from '@liveworkspace/index-app';
import type { Env } from '../types';
import * as drive from './drive-store';
import { hasPersonSchema, migratePersonSchema } from './person-schema';
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

  // ---- The Google Drive mirror (drive-store.ts; docs/specs/022-drive-mirror/drive-mirror.md). Reads of a store
  // that never held a connection answer as none; a change to a connection that isn't there writes nothing.

  async driveConnection(now: number): Promise<DriveConnection | null> {
    const sql = this.readable();
    return sql ? drive.readDriveConnection(sql, now) : null;
  }

  async driveSealedRefreshToken(): Promise<string | null> {
    const sql = this.readable();
    return sql ? drive.readSealedRefreshToken(sql) : null;
  }

  async driveUpsertBroker(sealedRefreshToken: string, now: number): Promise<void> {
    drive.upsertBrokerConnection(this.writable(), sealedRefreshToken, now);
  }

  async driveCreateBrowser(now: number): Promise<void> {
    drive.createBrowserConnection(this.writable(), now);
  }

  async driveUpdateState(
    patch: { rootFolderId?: string | null; pageToken?: string },
    now: number,
  ): Promise<void> {
    const sql = this.readable();
    if (sql) drive.updateDriveConnectionState(sql, patch, now);
  }

  async driveSetStatus(status: DriveConnectionStatus): Promise<void> {
    const sql = this.readable();
    if (sql) drive.setDriveConnectionStatus(sql, status);
  }

  async driveDisconnect(): Promise<void> {
    const sql = this.readable();
    if (sql) this.ctx.storage.transactionSync(() => drive.deleteDriveConnection(sql));
  }

  async driveItems(): Promise<DriveItem[]> {
    const sql = this.readable();
    return sql ? drive.listDriveItems(sql) : [];
  }

  // All or none: a conflict part-way rolls back the items before it.
  async drivePutItems(items: DriveItem[]): Promise<'ok' | 'conflict'> {
    if (items.length === 0) return 'ok';
    const sql = this.writable();
    try {
      return this.ctx.storage.transactionSync(() => {
        if (drive.putDriveItems(sql, items) === 'conflict') throw new DriveConflict();
        return 'ok' as const;
      });
    } catch (err) {
      if (err instanceof DriveConflict) return 'conflict';
      throw err;
    }
  }

  async driveDeleteItems(items: { kind: DriveItemKind; ldId: string }[]): Promise<void> {
    const sql = this.readable();
    if (sql && items.length > 0) {
      this.ctx.storage.transactionSync(() => drive.deleteDriveItems(sql, items));
    }
  }

  async driveAcquireLease(holder: string, now: number): Promise<DriveLease | null> {
    const sql = this.readable();
    return sql ? drive.acquireDriveLease(sql, holder, now) : null;
  }

  async driveReleaseLease(holder: string): Promise<void> {
    const sql = this.readable();
    if (sql) drive.releaseDriveLease(sql, holder);
  }

  async driveAccountId(): Promise<string | null> {
    const sql = this.readable();
    return sql ? drive.readDriveAccountId(sql) : null;
  }

  async driveRecordAccount(accountId: string): Promise<void> {
    const sql = this.readable();
    if (sql) drive.recordDriveAccount(sql, accountId);
  }

  async driveSetPendingSwitch(
    sealedRefreshToken: string,
    accountId: string,
    expiresAt: number,
  ): Promise<void> {
    const sql = this.readable();
    if (sql) drive.setPendingAccountSwitch(sql, sealedRefreshToken, accountId, expiresAt);
  }

  async driveSwitchTokens(): Promise<{ current: string | null; pending: string | null }> {
    const sql = this.readable();
    return sql ? drive.readSwitchTokens(sql) : { current: null, pending: null };
  }

  async driveConfirmSwitch(now: number): Promise<boolean> {
    const sql = this.readable();
    if (!sql) return false;
    return this.ctx.storage.transactionSync(() => drive.confirmPendingAccountSwitch(sql, now));
  }

  async driveClearSwitch(): Promise<void> {
    const sql = this.readable();
    if (sql) drive.clearPendingAccountSwitch(sql);
  }

  // The person is gone (their account closed, or the guest they were signed in to an account): everything here
  // goes. Idempotent, and a store that never held anything stays untouched.
  async purge(): Promise<void> {
    if (!this.ready && !hasPersonSchema(this.sql)) return;
    await this.ctx.storage.deleteAll();
    this.ready = false;
  }
}

// Rolls back drivePutItems' transaction when an item names a Drive file another item holds.
class DriveConflict extends Error {}
