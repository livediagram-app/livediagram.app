'use client';

// What the Version History panel reads and does (docs/specs/006-document/version-history.md "In the editor";
// blueprint VH18): the tab's versions, the selected one's body (read when its row is chosen, the last few kept), and
// naming, restoring and copying. A restore and a copy are marked as this editor's own writes first, so the relayed
// changeset raises no changeset toast here; the panel's own toast says what happened, with Undo.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Tab } from '@liveknowledge/document';
import { COPY_SUMMARY, restoreSummary, type VersionSummary } from '@liveknowledge/api-schema';
import {
  apiCopyVersion,
  apiListVersions,
  apiNameCurrentVersion,
  apiReadVersion,
  apiRenameVersion,
  apiRestoreVersion,
} from '@/lib/api-client';
import { beginOwnVersionWrite } from '@/lib/own-version-writes';

export type VersionWho = { ownerId: string; shareCode: string | null };

// How many opened versions' bodies the panel keeps while it is open (spec "Speed").
export const VERSION_BODY_CACHE = 8;

export type VersionList =
  | { state: 'loading' }
  | { state: 'failed'; gone: boolean }
  | { state: 'ready'; versions: VersionSummary[] };

export type VersionBody = { state: 'loading' } | { state: 'failed' } | { state: 'ready'; tab: Tab };

export type RestoreOutcome =
  | { kind: 'restored'; undoVersionId: string }
  | { kind: 'unchanged' }
  | { kind: 'failed'; reason: 'held' | 'busy' | 'gone' | 'other' };

const reasonOf = (err: unknown): 'held' | 'busy' | 'gone' | 'other' => {
  const code = err && typeof err === 'object' && 'code' in err ? err.code : null;
  if (code === 'elements_held') return 'held';
  if (code === 'tab_busy') return 'busy';
  if (code === 'not_found') return 'gone';
  return 'other';
};

// One tab's: the panel is keyed on the tab, so another tab starts clean.
export function useVersionHistory(opts: { documentId: string; tabId: string; who: VersionWho }) {
  const { documentId, tabId, who } = opts;
  const [list, setList] = useState<VersionList>({ state: 'loading' });
  const [bodies, setBodies] = useState<ReadonlyMap<string, VersionBody>>(new Map());
  const whoRef = useRef(who);
  useEffect(() => {
    whoRef.current = who;
  }, [who]);
  const reload = useCallback(async () => {
    try {
      const versions = await apiListVersions(whoRef.current, documentId, tabId);
      setList({ state: 'ready', versions });
    } catch (err) {
      console.warn('[versions] list-failed', { tabId, status: statusOf(err) });
      setList({ state: 'failed', gone: statusOf(err) === 404 });
    }
  }, [documentId, tabId]);

  // The panel is drawn afresh for each tab (keyed on it), so the first read is its only one until a write.
  useEffect(() => {
    void reload();
  }, [reload]);

  const open = useCallback(
    async (versionId: string) => {
      if (bodies.get(versionId)?.state === 'ready') return;
      setBodies((prev) => withBody(prev, versionId, { state: 'loading' }));
      try {
        const { tab } = await apiReadVersion(whoRef.current, documentId, tabId, versionId);
        setBodies((prev) => withBody(prev, versionId, { state: 'ready', tab }));
      } catch (err) {
        console.warn('[versions] read-failed', { tabId, status: statusOf(err) });
        setBodies((prev) => withBody(prev, versionId, { state: 'failed' }));
      }
    },
    [bodies, documentId, tabId],
  );

  // A version as the rail lists it, replaced in place (a name given or taken off).
  const replace = useCallback((version: VersionSummary, replacedId?: string) => {
    setList((prev) =>
      prev.state !== 'ready'
        ? prev
        : { state: 'ready', versions: mergeVersion(prev.versions, version, replacedId) },
    );
  }, []);

  const nameCurrent = useCallback(
    async (name: string) => {
      const version = await apiNameCurrentVersion(whoRef.current, documentId, tabId, name);
      replace(version);
      return version;
    },
    [documentId, tabId, replace],
  );

  const rename = useCallback(
    async (versionId: string, name: string | null) => {
      const version = await apiRenameVersion(whoRef.current, documentId, tabId, versionId, name);
      replace(version, versionId);
      return version;
    },
    [documentId, tabId, replace],
  );

  const restore = useCallback(
    async (version: Pick<VersionSummary, 'id' | 'name'>): Promise<RestoreOutcome> => {
      const summary = restoreSummary(version.name);
      const done = beginOwnVersionWrite((op) => op.tabId === tabId && op.summary === summary);
      try {
        const restored = await apiRestoreVersion(whoRef.current, documentId, tabId, version.id);
        void reload();
        return restored
          ? { kind: 'restored', undoVersionId: restored.undoVersionId }
          : { kind: 'unchanged' };
      } catch (err) {
        console.warn('[versions] restore-failed', { tabId, reason: reasonOf(err) });
        return { kind: 'failed', reason: reasonOf(err) };
      } finally {
        done();
      }
    },
    [documentId, tabId, reload],
  );

  const copy = useCallback(
    async (versionId: string, name: string) => {
      const done = beginOwnVersionWrite((op) => op.summary === COPY_SUMMARY);
      try {
        return await apiCopyVersion(whoRef.current, documentId, tabId, versionId, name);
      } finally {
        done();
      }
    },
    [documentId, tabId],
  );

  return { list, bodies, reload, open, nameCurrent, rename, restore, copy };
}

function statusOf(err: unknown): number | null {
  return err && typeof err === 'object' && 'status' in err && typeof err.status === 'number'
    ? err.status
    : null;
}

// The bodies with `id`'s set, the oldest dropped past VERSION_BODY_CACHE.
function withBody(
  prev: ReadonlyMap<string, VersionBody>,
  id: string,
  body: VersionBody,
): ReadonlyMap<string, VersionBody> {
  const next = new Map(prev);
  next.delete(id);
  next.set(id, body);
  while (next.size > VERSION_BODY_CACHE) next.delete(next.keys().next().value!);
  return next;
}

// The rail's list with one version as the api answered it (docs/specs/006-document/version-history.md "Where versions
// are kept"): in place of the row it renamed (`replacedId`, which a name taken off can answer under another id, the
// automatic version already holding that revision), else at the head. A named version leaves out an automatic one at
// its revision, as the api's list does.
export function mergeVersion(
  versions: readonly VersionSummary[],
  version: VersionSummary,
  replacedId: string = version.id,
): VersionSummary[] {
  const keep = (v: VersionSummary) =>
    v.id !== version.id &&
    v.id !== replacedId &&
    !(version.name !== null && v.name === null && v.rev === version.rev);
  const at = versions.findIndex((v) => v.id === replacedId || v.id === version.id);
  if (at < 0) return [version, ...versions.filter(keep)];
  return [...versions.slice(0, at).filter(keep), version, ...versions.slice(at + 1).filter(keep)];
}
