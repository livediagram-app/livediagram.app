// Scanning the mirror directory (docs/specs/027-repositories/blueprints/repository-link.md "Scanning the mirror
// directory"): every `*.livediagram.json` under the link's `dir`, walked as `linksBelow` walks and skipping a
// subdirectory that holds its own livediagram.toml (that link's files are its own, RL4), each classified in order.
// Paths are relative to the mirror directory.

import { posix } from 'node:path';
import { parseDocumentEnvelope } from '@livediagram/document';
import type { CliIo } from '../io';
import { parsePullFile, PULL_FILE_SUFFIX, tabHashes } from '../sync/pull-file';
import { LINK_FILE_NAME } from './constants';
import { byName, isWalked } from './find-links';
import { sameHost, type LinkFile } from './link-file';
import { hasConflictMarkers, type MirrorFile } from './mirror-file';

export type TabHashes = Record<string, { hash: string; settingsHash: string }>;

export type ScannedFile =
  | { class: 'tracked'; path: string; file: MirrorFile; hashes: TabHashes }
  | { class: 'duplicate'; path: string; documentId: string; other: string }
  | { class: 'conflicted'; path: string }
  | { class: 'invalid'; path: string; message: string }
  | { class: 'local-new'; path: string; documentId: string; name: string }
  | { class: 'foreign-host'; path: string; host: string };

const hasSyncKey = (text: string) =>
  Object.prototype.hasOwnProperty.call(Object(JSON.parse(text)), 'livediagramSync');

async function classify(io: CliIo, path: string, rel: string, host: string): Promise<ScannedFile> {
  const text = (await io.files.read(path)) ?? '';
  if (hasConflictMarkers(text)) return { class: 'conflicted', path: rel };
  const parsed = parsePullFile(text);
  if (!parsed.ok) {
    // An envelope the editor reads, with no sync data at all, was written by hand.
    const envelope = parseDocumentEnvelope(text);
    if (envelope.ok && !hasSyncKey(text)) {
      const { id, name } = envelope.envelope.document;
      return { class: 'local-new', path: rel, documentId: id, name };
    }
    return { class: 'invalid', path: rel, message: parsed.message };
  }
  const { file } = parsed;
  if (!sameHost(file.livediagramSync.host, host))
    return { class: 'foreign-host', path: rel, host: file.livediagramSync.host };
  const hashes: TabHashes = {};
  for (const tab of file.document.tabs) hashes[tab.id] = await tabHashes(tab);
  return { class: 'tracked', path: rel, file, hashes };
}

export async function scanMirrorDir(
  io: CliIo,
  link: LinkFile,
  host: string,
): Promise<ScannedFile[]> {
  const base = posix.join(link.root, link.mirror.dir);
  const found: ScannedFile[] = [];
  const walk = async (dir: string, nested: boolean): Promise<void> => {
    const entries = [...((await io.files.list(dir)) ?? [])].sort(byName);
    if (nested && entries.some((e) => e.kind === 'file' && e.name === LINK_FILE_NAME)) return;
    for (const entry of entries) {
      const path = posix.join(dir, entry.name);
      if (entry.kind === 'dir' && isWalked(entry.name)) await walk(path, true);
      else if (entry.kind === 'file' && entry.name.endsWith(PULL_FILE_SUFFIX))
        found.push(await classify(io, path, posix.relative(base, path), host));
    }
  };
  await walk(base, false);
  // Two files naming one document are both refused, each naming the other (RL11).
  const byDocument = new Map<string, string[]>();
  for (const s of found)
    if (s.class === 'tracked')
      byDocument.set(s.file.document.id, [...(byDocument.get(s.file.document.id) ?? []), s.path]);
  return found.map((s) => {
    if (s.class !== 'tracked') return s;
    const paths = byDocument.get(s.file.document.id)!;
    if (paths.length === 1) return s;
    const other = paths.find((p) => p !== s.path)!;
    return { class: 'duplicate', path: s.path, documentId: s.file.document.id, other };
  });
}
