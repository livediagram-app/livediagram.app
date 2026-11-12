// The contract of the index's internal doors into an app's items (./internal): the handlers an app supplies, what
// they are given and answer, and the export door's formats and ETags. Re-exported from ./internal.
import type {
  CommunityStateAnswer,
  CommunityStateAsk,
  ConnectedTabWrite,
  ItemNotice,
  Level,
} from '@liveworkspace/index-client';
import type { ConnectedTabOutcome } from './connected-tabs';
import type {
  MigrationApp,
  MigrationDoorAnswer,
  MigrationPersonAnswer,
  MigrationPersonPayload,
  MigrationRoomPayload,
} from '@liveworkspace/migration';
import type { DataExportHandlers } from './data-export-door';

export const JOINED_TELEMETRY_TYPE: Record<Level, 'View' | 'Participate' | 'Edit'> = {
  view: 'View',
  participate: 'Participate',
  edit: 'Edit',
};

export const MAX_ID = 200;
export const MAX_CODES = 500;

// Who copies an item, the link they came in by, and the address they copied from (the visitor's, as the index saw
// it; null when it did not know), for anything the app counts per network.
export type Copier = { by: string | null; code: string | null; ip: string | null };

// An address as the index forwards it: IPv4 or IPv6 text, nothing longer.
export const IP_TEXT = /^[0-9A-Fa-f:.]{2,45}$/;

export type CopyOutcome = { tabs: number; items: number } | 'not_found' | 'conflict';

// ---------- The export door (liveworkspace/docs/specs/006-media/previews.md "The export door") --------------------------------------

// What an item can be exported as. `svg`: the first tab (or `tabId`) drawn, the platform's previews. `file`: the
// item's whole-item envelope as JSON text, the Drive mirror's file (`tabId` and `code` play no part).
export const EXPORT_FORMATS = ['svg', 'file'] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

// The reader's appearance a drawing is asked for (previews.md "The export door"), for an app whose drawing depends
// on one. The browser address names the same two (@liveworkspace/media PREVIEW_APPEARANCES).
export const EXPORT_APPEARANCES = ['light', 'dark'] as const;
export type ExportAppearance = (typeof EXPORT_APPEARANCES)[number];

export const isExportAppearance = (value: unknown): value is ExportAppearance =>
  typeof value === 'string' && (EXPORT_APPEARANCES as readonly string[]).includes(value);

export type ExportQuery = {
  format: ExportFormat;
  // One tab, or null for the first.
  tabId: string | null;
  // The public link (a Community post's) the reader came in by: the app draws what that link may show, or refuses
  // (`not_found`) when it shows nothing now. Null for everyone else.
  code: string | null;
  // The reader's appearance (`svg` only): null draws as the app does with no reader.
  appearance: ExportAppearance | null;
  // The version the caller already holds (`If-None-Match`): `unchanged` when it is still the content's, undrawn.
  ifVersion: number | null;
};

// `version`: the content's last save (epoch ms), sent back as the ETag.
export type ExportResult =
  | { status: 'ok'; body: string | Uint8Array; contentType: string; version: number }
  | { status: 'empty'; version: number }
  | { status: 'unchanged'; version: number }
  | { status: 'not_found' };

export const isExportFormat = (value: unknown): value is ExportFormat =>
  typeof value === 'string' && (EXPORT_FORMATS as readonly string[]).includes(value);

// An ETag of a version, and the version an If-None-Match names (weak or strong, the first of a list).
export const exportEtag = (version: number): string => `"${version}"`;
export function etagVersion(header: string | null): number | null {
  const first = header?.split(',')[0]?.trim().replace(/^W\//, '');
  const match = first ? /^"(\d{1,16})"$/.exec(first) : null;
  return match ? Number(match[1]) : null;
}

export type InternalItemHandlers = {
  // Drop everything the item stores (its Durable Object, and anything the app keeps beside it).
  purge: (itemId: string) => Promise<unknown>;
  // End the sessions of these share codes; answers how many closed. `rescoped`: reload into what the link opens.
  revoke?: (itemId: string, codes: string[], reason: 'revoked' | 'rescoped') => Promise<number>;
  // Copy the content (or one tab of it) into a new item. `copier` says who copies (`by`, null from an index that
  // does not say) and the share link they came in by (`code`, null for their own or their team's item), so the
  // app can copy only what that person may read (another's comment authors, a published post's redactions).
  // `title` is the new item's title at the index, trimmed and at most TITLE_MAX (null from an index that does not
  // send it): the app keeps it as the copy's name, so the copy's first open shows what the Explorer lists.
  copy?: (
    from: string,
    to: string,
    tabId: string | null,
    copier: Copier,
    title: string | null,
  ) => Promise<CopyOutcome>;
  // A notice for the app's emails, run off the index's path (waitUntil).
  notice?: (itemId: string, notice: ItemNotice) => Promise<unknown>;
  // A closed account (the index's person purge): what the app keeps for the person beside their items (images,
  // claims), dropped. Idempotent.
  personClosed?: (personId: string) => Promise<unknown>;
  // A guest became an account (the index's merge): what the app keeps for the guest beside their items (images,
  // a per-person store) moves to the account. Idempotent. An app with nothing to move leaves it out and the door
  // just confirms. `legacy`: a returning guest of the old livediagram.app claiming its migrated work
  // (docs/migration.md step 6), where `intoId` may be another guest (the browser's new one) as well as an account.
  personMerged?: (
    guestId: string,
    intoId: string,
    options: { legacy: boolean },
  ) => Promise<unknown>;
  // Their name off one item they worked in that outlives them (anonymise.ts). Idempotent.
  anonymise?: (itemId: string, personId: string) => Promise<unknown>;
  // The item drawn as a file (the export door). Read only: nothing is cached or written on the app's side.
  export?: (itemId: string, query: ExportQuery) => Promise<ExportResult>;
  // A new item for `owner` from a file (the Drive mirror's import door): fresh ids throughout, registered in the
  // index as the owner's personal item in `folderId`. Refuses a file of another kind or that doesn't parse
  // (`invalid_file`) and one past the app's item limits (`too_large`).
  import?: (input: ImportInput) => Promise<ImportResult>;
  // A workbench pairing was unpaired, its token revoked or its account closed (liveworkspace/docs/specs/011-workbench/workbench.md
  // "Ending access"): close that pairing's sessions in the item's room. Answers whether the room was reached.
  workbenchClose?: (itemId: string, pairingId: string) => Promise<boolean>;
  // An old livediagram.app document's part into the item's room (the migration door, docs/migration.md): one
  // Durable Object call, one transaction (migration-room.ts writeMigratedRoom). The payload is checked for shape,
  // version, app and id before it is called. Throws MigrationTabTooLarge (migration-door.ts) for a tab over the
  // app's tab cap, which the door answers 413 naming the tab.
  migrate?: (payload: MigrationRoomPayload) => Promise<MigrationDoorAnswer>;
  // What the app keeps for one old livediagram.app person beside their items (the person migration door,
  // docs/migration.md): their shape libraries into their store, added once, never updated. Checked for shape,
  // version, app and person before it is called. An app with nothing to take leaves it out and the door is a 404.
  migratePerson?: (payload: MigrationPersonPayload) => Promise<MigrationPersonAnswer>;
  // The index's reverse write of a connected tab (connected-tabs.ts appendConnectedTab): one tab, loose, at the end of
  // the item's tab bar, the same connection id again answering the tab it made. An app without it answers 404.
  connectedTab?: (itemId: string, write: ConnectedTabWrite) => Promise<ConnectedTabOutcome>;
  // Where Community posts' items stand, as the index reads them (the app's index client `communityStates`), for the
  // Community's sweep. An app without it answers 404.
  communityStates?: (posts: CommunityStateAsk[]) => Promise<CommunityStateAnswer[]>;
} & DataExportHandlers;

// The import door's body (liveworkspace/docs/specs/005-drive/drive.md "Contracts > The apps"): whose item it is (an account id,
// never a guest), the folder of theirs it goes in (null: the top), its name, and the file's text.
export type ImportInput = { owner: string; folderId: string | null; name: string; file: string };

export type ImportResult =
  { status: 'ok'; id: string } | { status: 'invalid_file' } | { status: 'too_large' };

// The largest import body the door reads: a Durable Object RPC message's cap, which an item's content crosses whole.
// A bigger body is refused by its Content-Length before it is read.
export const IMPORT_MAX_BYTES = 32 * 1024 * 1024;
// The longest item name the import door takes; each app shortens it further to its own cap.
export const IMPORT_NAME_MAX = 1000;

export type InternalItemsOptions = {
  key: string | undefined;
  // The app's name as the migration's payloads carry it (`MigrationRoomPayload.app`): needed by the migration door.
  app?: MigrationApp;
  // The app's MIGRATION_KEY, which the migrate tool calls with (docs/migration.md "Tooling"): the migration door
  // alone. Set only for the migration, and removed after it.
  migrationKey?: string | undefined;
  // A second key the export door alone takes: the app's MEDIA_KEY, which liveworkspace's previews call it with.
  exportKey?: string | undefined;
  // The app's DRIVE_KEY, which liveworkspace's Drive mirror calls with: the export door and the import door alone.
  driveKey?: string | undefined;
  // The app's DATA_EXPORT_KEY, which liveworkspace's data export calls with: the export door alone, every format.
  dataExportKey?: string | undefined;
  // The app's COMMUNITY_KEY, which the Community service's sweep calls with: the community-states door alone.
  communityKey?: string | undefined;
  handlers: InternalItemHandlers;
  waitUntil?: (promise: Promise<unknown>) => void;
};
