// The pull file (docs/specs/015-api/blueprints/cli.md "The pull file", CLI27, CLI28): the editor's
// `livehuddle.document` envelope, so "Import a copy" reads it, plus `livehuddleSync`, which the envelope parser
// ignores: the host it came from and each tab's revision and hashes. `hash` covers a tab's elements, which push sends;
// `settingsHash` covers everything else, which push names as not pushed.

import {
  canonicalJson,
  isRecord,
  isValidTab,
  parseDocumentEnvelope,
  type DocumentEnvelope,
  type Tab,
} from '@livehuddle/document';
import { sha256Hex } from '@livehuddle/api-schema';

export type PulledTab = { rev: number; hash: string; settingsHash: string };
// `pulledAt` is absent from a mirror file, which holds no time (repository-link blueprint "The mirror file").
export type PullSync = { host: string; pulledAt?: number; tabs: Record<string, PulledTab> };
export type PullFile = DocumentEnvelope & { livehuddleSync: PullSync };

export const PULL_FILE_SUFFIX = '.livehuddle.json';
const SLUG_MAX = 60;
const ID_SLUG_LENGTH = 8;

export async function sha256(text: string): Promise<string> {
  return sha256Hex(new TextEncoder().encode(text));
}

export async function tabHashes(tab: Tab): Promise<{ hash: string; settingsHash: string }> {
  const { elements, ...settings } = tab;
  return {
    hash: await sha256(canonicalJson(elements)),
    settingsHash: await sha256(canonicalJson(settings)),
  };
}

// A name as a file name: lower-cased letters, digits and single dashes, at most SLUG_MAX characters; the id's first
// characters when nothing is left (CLI27).
export function fileSlug(name: string, id: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, SLUG_MAX)
    .replace(/^-+|-+$/g, '');
  return slug || id.slice(0, ID_SLUG_LENGTH);
}

export const idSlug = (id: string) => id.slice(0, ID_SLUG_LENGTH);

export function pullFileText(file: PullFile): string {
  return `${JSON.stringify(file, null, 2)}\n`;
}

function isPulledTab(value: unknown): value is PulledTab {
  return (
    isRecord(value) &&
    typeof value.rev === 'number' &&
    typeof value.hash === 'string' &&
    typeof value.settingsHash === 'string'
  );
}

function syncOf(value: unknown): PullSync | null {
  if (!isRecord(value) || typeof value.host !== 'string') return null;
  if (value.pulledAt !== undefined && typeof value.pulledAt !== 'number') return null;
  if (!isRecord(value.tabs) || !Object.values(value.tabs).every(isPulledTab)) return null;
  return {
    host: value.host,
    ...(value.pulledAt === undefined ? {} : { pulledAt: value.pulledAt }),
    tabs: value.tabs as Record<string, PulledTab>,
  };
}

const FAILURES = {
  not_json: 'not JSON',
  wrong_kind: 'not a livehuddle document',
  unsupported_version: 'written by a newer livehuddle',
  malformed: 'its document is malformed',
} as const;

// A pull file read back, or why it is not one; a tab edited into something the editor would refuse is named (E20).
export function parsePullFile(
  text: string,
): { ok: true; file: PullFile } | { ok: false; message: string } {
  const parsed = parseDocumentEnvelope(text);
  if (!parsed.ok) return { ok: false, message: FAILURES[parsed.failure] };
  // The envelope parse has already proved the text is a JSON object.
  const sync = syncOf(Reflect.get(Object(JSON.parse(text)), 'livehuddleSync'));
  if (!sync) return { ok: false, message: 'not pulled by the CLI (no livehuddleSync)' };
  const { tabs } = parsed.envelope.document;
  const invalid = tabs.findIndex((tab: unknown) => !isValidTab(tab));
  if (invalid >= 0)
    return { ok: false, message: `tab ${JSON.stringify(tabs[invalid]!.name)} is not a valid tab` };
  return { ok: true, file: { ...parsed.envelope, livehuddleSync: sync } };
}
