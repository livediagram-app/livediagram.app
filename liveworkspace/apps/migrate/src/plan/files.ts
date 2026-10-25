// The bundle's non-SQL files, written as they are made: the rooms (one JSON file per part, listed in order in
// rooms/rooms.jsonl), the R2 copies (r2/images.json) and the pictures drawn for frozen references (r2/pictures/).
import { closeSync, mkdirSync, openSync, writeFileSync, writeSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { MigrationRoomPayload } from '@liveworkspace/migration';
import { sha256Hex } from '../ids.ts';
import type { LedgerView } from '../sql.ts';

/** A JSON array written one element at a time, so a long list never sits in memory. */
export class JsonArrayFile {
  private readonly fd: number;
  private first = true;
  count = 0;

  constructor(path: string) {
    mkdirSync(dirname(path), { recursive: true });
    this.fd = openSync(path, 'w');
    writeSync(this.fd, '[');
  }

  push(value: unknown): void {
    writeSync(this.fd, `${this.first ? '\n' : ',\n'}  ${JSON.stringify(value)}`);
    this.first = false;
    this.count++;
  }

  close(): void {
    writeSync(this.fd, this.first ? ']\n' : '\n]\n');
    closeSync(this.fd);
  }
}

/** One line per room the apply step sends, in order: `[app, id, version]`. */
export type RoomLine = [app: string, id: string, version: string];

export class RoomFiles {
  private readonly fd: number;
  private readonly dir: string;
  private readonly ledger: LedgerView;
  written = 0;
  unchanged = 0;

  constructor(bundleDir: string, ledger: LedgerView) {
    this.dir = join(bundleDir, 'rooms');
    mkdirSync(this.dir, { recursive: true });
    this.fd = openSync(join(this.dir, 'rooms.jsonl'), 'w');
    this.ledger = ledger;
  }

  /** Writes a part's payload, unless the ledger says the same payload was sent before. */
  write(payload: MigrationRoomPayload): void {
    const body = JSON.stringify(payload);
    const version = JSON.stringify(sha256Hex(body));
    if (this.ledger.version('rooms', payload.app, payload.id) === version) {
      this.unchanged++;
      return;
    }
    mkdirSync(join(this.dir, payload.app), { recursive: true });
    writeFileSync(join(this.dir, payload.app, `${payload.id}.json`), body);
    const line: RoomLine = [payload.app, payload.id, version];
    writeSync(this.fd, `${JSON.stringify(line)}\n`);
    this.written++;
  }

  close(): void {
    closeSync(this.fd);
  }
}

/** One object to put in the media bucket: copied from the old bucket under the same key, or a picture the plan drew
 *  (`file`, relative to the bundle). */
export type R2Entry = {
  key: string;
  contentType: string;
  byteSize: number;
  sha256: string;
  file?: string;
  version: string;
};
