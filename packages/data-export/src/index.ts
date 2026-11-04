// Download Your Data's contract (liveworkspace/docs/specs/003-accounts/data-export.md): what accounts, the export
// service and the site's Settings agree on. The keys that name an export, its states, the wire shapes, the limits, the
// emailed link's message and the doors' paths. Plain data and pure functions, for a Worker and a browser alike.

// ---------- Limits (blueprint "Constants and configuration") ----------------------------------------------------

/** The most a zip may hold: under Zip64's 4 GiB with room to spare, so the plain format always does. */
export const EXPORT_MAX_BYTES = 2 * 1024 * 1024 * 1024;
/** The most items one export holds; under the plain format's 65,535 entries with each item's pictures. */
export const EXPORT_MAX_ITEMS = 10_000;
/** The zip's directory may name at most this many files (the plain format's 16-bit count, with room). */
export const EXPORT_MAX_ENTRIES = 65_000;
/** Each R2 multipart part but the last: R2 wants every other part the same size, and at least 5 MiB. */
export const EXPORT_PART_BYTES = 8 * 1024 * 1024;
/** One chunk's wall time and requests: well inside a Durable Object alarm's limits. */
export const EXPORT_CHUNK_MS = 20_000;
export const EXPORT_CHUNK_SUBREQUESTS = 400;
/** The pictures: up to this many tabs an item, each drawn at twice its size, at most this on its long side. */
export const EXPORT_TAB_PICTURES_MAX = 20;
export const EXPORT_PICTURE_SCALE = 2;
export const EXPORT_PICTURE_MAX_SIDE = 4096;
/** How long the link, and the file, last after the export is ready. */
export const EXPORT_LINK_TTL_MS = 3 * 24 * 60 * 60 * 1000;
/** Failed steps in a row before the export gives up; each waits longer (`exportRetryDelay`). */
export const EXPORT_FAILURES_MAX = 8;
/** The most exports one status call asks after: the person's own and each team they may run (accounts' cap). */
export const EXPORT_STATUS_KEYS_MAX = 51;
/** How often Settings asks again while an export it shows is being built. */
export const EXPORT_POLL_MS = 3000;

/** The wait before the next try after `failures` failed steps in a row: 5 s doubling, at most 5 minutes. */
export function exportRetryDelay(failures: number): number {
  return Math.min(5000 * 2 ** Math.max(0, failures - 1), 5 * 60 * 1000);
}

// ---------- Keys ---------------------------------------------------------------------------------------------

export type ExportScope =
  { kind: 'personal'; personId: string } | { kind: 'team'; teamId: string; teamName: string };

const ID = /^[A-Za-z0-9_-]{1,100}$/;

/** The export key of a scope: the Durable Object's name and the R2 prefix. */
export function exportKeyOf(
  scope: { kind: 'personal'; personId: string } | { kind: 'team'; teamId: string },
): string {
  return scope.kind === 'personal' ? `personal:${scope.personId}` : `team:${scope.teamId}`;
}

/** The scope a key names, or null for one that isn't a key. */
export function parseExportKey(
  key: unknown,
): { kind: 'personal'; personId: string } | { kind: 'team'; teamId: string } | null {
  if (typeof key !== 'string') return null;
  const at = key.indexOf(':');
  const kind = key.slice(0, at);
  const id = key.slice(at + 1);
  if (at < 0 || !ID.test(id)) return null;
  if (kind === 'personal') return { kind, personId: id };
  if (kind === 'team') return { kind, teamId: id };
  return null;
}

// ---------- States -------------------------------------------------------------------------------------------

export const EXPORT_STATUSES = ['running', 'ready', 'failed', 'expired'] as const;
export type ExportStatus = (typeof EXPORT_STATUSES)[number];

export const EXPORT_PHASES = ['listing', 'items', 'images', 'finishing'] as const;
export type ExportPhase = (typeof EXPORT_PHASES)[number];

/** One export's state, as the service answers it and Settings draws it. Times are epoch ms. */
export type ExportView = {
  id: string;
  status: ExportStatus;
  phase: ExportPhase | null;
  requestedBy: string;
  startedAt: number;
  finishedAt: number | null;
  expiresAt: number | null;
  // Items and images found, and done so far.
  itemsTotal: number;
  itemsDone: number;
  imagesTotal: number;
  imagesDone: number;
  // The zip's size so far, or its final size once ready.
  bytes: number;
  // Items left out by the size or item cap.
  leftOut: number;
  // Items an app refused or couldn't answer, named in the README.
  problems: number;
  // Accounts adds this for whoever may download it: the signed link.
  downloadUrl?: string;
};

/** What a running export has done of its work, from 0 to 1, for a progress bar. */
export function exportProgress(
  view: Pick<
    ExportView,
    'status' | 'phase' | 'itemsTotal' | 'itemsDone' | 'imagesTotal' | 'imagesDone'
  >,
): number {
  if (view.status !== 'running') return view.status === 'ready' ? 1 : 0;
  if (view.phase === 'listing' || view.phase === null) return 0.02;
  if (view.phase === 'finishing') return 0.97;
  const total = view.itemsTotal + view.imagesTotal;
  if (total === 0) return 0.95;
  return 0.05 + 0.9 * ((view.itemsDone + view.imagesDone) / total);
}

// ---------- Accounts' doors (the browser's, by session) -------------------------------------------------------

export const DATA_EXPORT_PATH = '/api/account/data-export';
export const DATA_EXPORT_DOWNLOAD_PATH = '/api/account/data-export/download';
export const DATA_EXPORT_READY_PATH = '/api/account/internal/data-export/ready';

export type DataExportTeam = { id: string; name: string; export: ExportView | null };

/** `GET /api/account/data-export`. */
export type DataExportState = { personal: ExportView | null; teams: DataExportTeam[] };

/** Why an emailed link was refused, as the redirect to Settings names it (`?settings=data&export=`). */
export const EXPORT_LINK_REFUSALS = ['expired', 'other-account', 'missing'] as const;
export type ExportLinkRefusal = (typeof EXPORT_LINK_REFUSALS)[number];

export const isExportLinkRefusal = (value: unknown): value is ExportLinkRefusal =>
  typeof value === 'string' && (EXPORT_LINK_REFUSALS as readonly string[]).includes(value);

/** The text the link's signature covers: who it is for, the export, the run and when it lapses. */
export function exportLinkMessage(
  requestedBy: string,
  key: string,
  exportId: string,
  expiresAt: number,
): string {
  return `${requestedBy}\n${key}\n${exportId}\n${expiresAt}`;
}

/** The export service's call to accounts when an export finishes, for the email. */
export type ExportReadyCall = {
  key: string;
  exportId: string;
  requestedBy: string;
  status: 'ready' | 'failed';
  bytes: number;
  expiresAt: number | null;
  teamName: string | null;
};

// ---------- The service's own routes (accounts only) ----------------------------------------------------------

export const EXPORT_SERVICE_PATH = '/internal/exports';

export type StartExportCall = {
  key: string;
  requestedBy: string;
  scope: ExportScope;
  // A personal export's profile.json, written by accounts from its own records.
  profile?: Record<string, unknown>;
};

/** A zip's file name for a day: `liveworkspace-data-2026-11-01.zip`. */
export function exportFileName(at: number): string {
  return `liveworkspace-data-${new Date(at).toISOString().slice(0, 10)}.zip`;
}
