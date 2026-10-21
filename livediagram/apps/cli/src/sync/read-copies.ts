// The read copies on disk (docs/specs/015-api/blueprints/cli.md "Read copies", CLI76): `<cache>/copies/<key>/<rev>.json`
// with one index, where the key is the first 16 hex of SHA-256 of profile, document and tab. At most
// READ_COPY_REVS_PER_TAB revisions a tab and READ_COPY_MAX_BYTES in all, the least recently used out first; files
// 0600 in 0700 directories, as they hold document content.

import type { ReadCopies, ReadCopy } from '@livediagram/agent-verbs';
import { cacheDir } from '../config/paths';
import type { DebugLog } from '../debug';
import type { CliIo } from '../io';
import { sha256Hex } from '@livediagram/api-schema';

export const READ_COPY_REVS_PER_TAB = 3;
export const READ_COPY_MAX_BYTES = 32 * 1024 * 1024;

type Entry = { key: string; where: string; rev: number; bytes: number; usedAt: number };
type Index = { version: 1; entries: Entry[] };

async function keyOf(profile: string, documentId: string, tabId: string): Promise<string> {
  // The first 8 bytes of the digest, as 16 hex characters.
  const hex = await sha256Hex(new TextEncoder().encode(`${profile}|${documentId}|${tabId}`));
  return hex.slice(0, 16);
}

export function fileReadCopies(io: CliIo, profile: string, log: DebugLog): ReadCopies {
  const root = `${cacheDir(io)}/copies`;
  const indexPath = `${root}/index.json`;
  const fileOf = (e: Pick<Entry, 'key' | 'rev'>) => `${root}/${e.key}/${e.rev}.json`;

  async function readIndex(): Promise<Index> {
    const text = await io.files.read(indexPath);
    try {
      const index = text === null ? null : (JSON.parse(text) as Index);
      if (index?.version === 1 && Array.isArray(index.entries)) return index;
    } catch {
      // An unreadable index starts over; its files are overwritten or orphaned, never read.
    }
    return { version: 1, entries: [] };
  }

  const writeIndex = async (index: Index) => {
    await io.files.mkdir(root, 0o700);
    await io.files.write(indexPath, JSON.stringify(index), 0o600);
  };

  async function find(
    documentId: string,
    tabId: string,
    pick: (entries: Entry[]) => Entry | undefined,
  ) {
    const key = await keyOf(profile, documentId, tabId);
    const index = await readIndex();
    const entry = pick(index.entries.filter((e) => e.key === key));
    const where = `${documentId}/${tabId}`;
    const text = entry ? await io.files.read(fileOf(entry)) : null;
    if (!entry || text === null) {
      log(`copy miss ${where}`);
      return null;
    }
    entry.usedAt = io.now();
    await writeIndex(index);
    log(`copy hit ${where} rev ${entry.rev}`);
    return JSON.parse(text) as ReadCopy;
  }

  async function evict(index: Index, keep: (e: Entry) => boolean): Promise<Entry[]> {
    const evicted = index.entries.filter((e) => !keep(e));
    index.entries = index.entries.filter(keep);
    for (const e of evicted) {
      await io.files.remove(fileOf(e));
      log(`copy evicted ${e.where} rev ${e.rev}`);
    }
    return evicted;
  }

  return {
    latest: (documentId, tabId) =>
      find(documentId, tabId, (entries) => entries.toSorted((a, b) => b.rev - a.rev)[0]),
    at: (documentId, tabId, rev) =>
      find(documentId, tabId, (entries) => entries.find((e) => e.rev === rev)),
    revisions: async (documentId, tabId) => {
      const key = await keyOf(profile, documentId, tabId);
      return (await readIndex()).entries
        .filter((e) => e.key === key)
        .map((e) => e.rev)
        .sort((a, b) => a - b);
    },
    record: async (documentId, tabId, copy) => {
      const key = await keyOf(profile, documentId, tabId);
      const data = JSON.stringify(copy);
      const entry: Entry = {
        key,
        where: `${documentId}/${tabId}`,
        rev: copy.rev,
        bytes: data.length,
        usedAt: io.now(),
      };
      await io.files.mkdir(`${root}/${key}`, 0o700);
      await io.files.write(fileOf(entry), data, 0o600);
      const index = await readIndex();
      index.entries = [
        ...index.entries.filter((e) => !(e.key === key && e.rev === copy.rev)),
        entry,
      ];
      const newest = new Set(
        index.entries
          .filter((e) => e.key === key)
          .sort((a, b) => b.rev - a.rev)
          .slice(0, READ_COPY_REVS_PER_TAB),
      );
      await evict(index, (e) => e.key !== key || newest.has(e));
      // Most recently used first; a tie (one millisecond) goes to the entry recorded later.
      const order = new Map(index.entries.map((e, i) => [e, i]));
      const byUse = index.entries.toSorted(
        (a, b) => b.usedAt - a.usedAt || order.get(b)! - order.get(a)!,
      );
      let total = 0;
      const kept = new Set(
        byUse.filter((e) => (total += e.bytes) <= READ_COPY_MAX_BYTES || e === entry),
      );
      await evict(index, (e) => kept.has(e));
      await writeIndex(index);
    },
  };
}
