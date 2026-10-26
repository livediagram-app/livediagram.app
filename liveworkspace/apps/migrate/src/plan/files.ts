// The bundle's non-SQL files, written as they are made: the rooms (one JSON file per part, listed in order in
// rooms/rooms.jsonl), the people (one per person with shape libraries, in people/people.jsonl), the R2 copies
// (r2/images.json) and the pictures drawn for frozen references (r2/pictures/).
import { closeSync, mkdirSync, openSync, writeFileSync, writeSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { MigrationPersonPayload, MigrationRoomPayload } from '@liveworkspace/migration';
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

/** The payloads one door takes, one JSON file each under `<bundle>/<kind>/<app>/<id>.json`, listed in order in
 *  `<kind>/<kind>.jsonl` (the rooms, or the people). The ledger keeps each one's SHA-256 under `<kind>`, so a payload
 *  sent before, unchanged, is left out. */
export class PayloadFiles {
  private readonly fd: number;
  private readonly dir: string;
  private readonly ledger: LedgerView;
  private readonly kind: 'rooms' | 'people';
  written = 0;
  unchanged = 0;

  constructor(bundleDir: string, ledger: LedgerView, kind: 'rooms' | 'people') {
    this.kind = kind;
    this.dir = join(bundleDir, kind);
    mkdirSync(this.dir, { recursive: true });
    this.fd = openSync(join(this.dir, `${kind}.jsonl`), 'w');
    this.ledger = ledger;
  }

  /** Writes one payload, unless the ledger says the same payload was sent before. */
  protected writePayload(app: string, id: string, payload: unknown): void {
    const body = JSON.stringify(payload);
    const version = JSON.stringify(sha256Hex(body));
    if (this.ledger.version(this.kind, app, id) === version) {
      this.unchanged++;
      return;
    }
    mkdirSync(join(this.dir, app), { recursive: true });
    writeFileSync(join(this.dir, app, `${id}.json`), body);
    const line: RoomLine = [app, id, version];
    writeSync(this.fd, `${JSON.stringify(line)}\n`);
    this.written++;
  }

  close(): void {
    closeSync(this.fd);
  }
}

/** The rooms, for each app's migration door. */
export class RoomFiles extends PayloadFiles {
  constructor(bundleDir: string, ledger: LedgerView) {
    super(bundleDir, ledger, 'rooms');
  }

  /** Writes a part's payload, unless the ledger says the same payload was sent before. */
  write(payload: MigrationRoomPayload): void {
    this.writePayload(payload.app, payload.id, payload);
  }
}

/** The people, for livediagram's person migration door. */
export class PeopleFiles extends PayloadFiles {
  constructor(bundleDir: string, ledger: LedgerView) {
    super(bundleDir, ledger, 'people');
  }

  /** Writes a person's payload, unless the ledger says the same payload was sent before. */
  write(payload: MigrationPersonPayload): void {
    this.writePayload(payload.app, payload.personId, payload);
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
