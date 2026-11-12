'use client';

// The Audit Log's reads (liveworkspace/docs/specs/004-index/team-audit-log.md "The Audit Log on a team's view"): the
// team's log a page at a time, read again from the first page whenever the filters change, and Export CSV, which
// follows X-Next-Cursor file by file and joins them under one header.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  IndexError,
  TEAM_AUDIT_PAGE,
  type IndexClient,
  type TeamAuditEvent,
  type TeamAuditQuery,
} from '@liveworkspace/index-client';
import { isAbort } from '../../data/errors';

export type AuditFilter = Omit<TeamAuditQuery, 'limit' | 'cursor'>;

/** Why the first page could not be read: the reader is not (or no longer) an admin, or anything else. */
export type AuditFailure = 'not_admin' | 'failed';

export type AuditLogState = {
  events: TeamAuditEvent[];
  loading: boolean;
  error: AuditFailure | null;
  hasMore: boolean;
  loadingMore: boolean;
  moreFailed: boolean;
  loadMore: () => void;
  retry: () => void;
};

const failureOf = (e: unknown): AuditFailure =>
  e instanceof IndexError && e.status === 403 ? 'not_admin' : 'failed';

// The filters as one key, so an equal filter made again reads nothing new.
const keyOf = (filter: AuditFilter) =>
  JSON.stringify([filter.team, filter.person, filter.kind, filter.from, filter.to]);

export function useAuditLog(client: IndexClient, filter: AuditFilter): AuditLogState {
  const key = keyOf(filter);
  // The key is the filter's value
  const stable = useMemo(() => filter, [key]);
  const [epoch, setEpoch] = useState(0);
  const [page, setPage] = useState<{
    key: string;
    events: TeamAuditEvent[];
    cursor: string | null;
    error: AuditFailure | null;
  } | null>(null);
  const [more, setMore] = useState<{ loading: boolean; failed: boolean }>({
    loading: false,
    failed: false,
  });
  const moreRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    moreRef.current?.abort();
    setMore({ loading: false, failed: false });
    client.teamAudit({ ...stable, limit: TEAM_AUDIT_PAGE }, { signal: controller.signal }).then(
      (res) => setPage({ key, events: res.events, cursor: res.nextCursor, error: null }),
      (e: unknown) => {
        if (!isAbort(e)) setPage({ key, events: [], cursor: null, error: failureOf(e) });
      },
    );
    return () => controller.abort();
  }, [client, key, stable, epoch]);

  // A page from an earlier filter is never shown under a new one.
  const current = page?.key === key ? page : null;
  const cursor = current?.cursor ?? null;

  const loadMore = useCallback(() => {
    if (!cursor || moreRef.current) return;
    const controller = new AbortController();
    moreRef.current = controller;
    setMore({ loading: true, failed: false });
    client
      .teamAudit({ ...stable, limit: TEAM_AUDIT_PAGE, cursor }, { signal: controller.signal })
      .then(
        (res) => {
          setPage((was) =>
            was && was.key === key
              ? { ...was, events: [...was.events, ...res.events], cursor: res.nextCursor }
              : was,
          );
          setMore({ loading: false, failed: false });
        },
        (e: unknown) => {
          if (!isAbort(e)) setMore({ loading: false, failed: true });
        },
      )
      .finally(() => {
        if (moreRef.current === controller) moreRef.current = null;
      });
  }, [client, cursor, key, stable]);

  useEffect(() => () => moreRef.current?.abort(), []);

  const retry = useCallback(() => {
    setPage(null);
    setEpoch((n) => n + 1);
  }, []);

  return {
    events: current?.events ?? [],
    loading: current === null,
    error: current?.error ?? null,
    hasMore: cursor !== null,
    loadingMore: more.loading,
    moreFailed: more.failed,
    loadMore,
    retry,
  };
}

/** Files Export CSV joins at most (IDX34): 200,000 rows, the newest first. */
export const AUDIT_EXPORT_FILES_MAX = 20;

export type AuditExport = { csv: string; rows: number; capped: boolean };

// The text after a file's header line: the next file's rows join the first file's under its header. A header holds
// no line break of its own, so the first CRLF (or LF) ends it.
function bodyOf(csv: string): string {
  const end = csv.indexOf('\n');
  return end < 0 ? '' : csv.slice(end + 1);
}

// Data rows in a file's text: line breaks outside quoted cells, less the header's.
function rowsIn(csv: string): number {
  let rows = 0;
  let quoted = false;
  for (let i = 0; i < csv.length; i++) {
    const ch = csv.charCodeAt(i);
    if (ch === 34) quoted = !quoted;
    else if (ch === 10 && !quoted) rows++;
  }
  return Math.max(0, rows - 1);
}

/**
 * Every row the filter matches, file by file, handed to `write` as it is read: one file's text (10,000 rows) is all
 * that is held at a time, and the files join under the first one's header. No byte-order mark (the saver adds it).
 */
export async function streamAuditCsv(
  client: IndexClient,
  filter: AuditFilter,
  write: (chunk: string) => Promise<void> | void,
  onProgress?: (rows: number) => void,
): Promise<{ rows: number; capped: boolean }> {
  let rows = 0;
  let cursor: string | undefined;
  for (let file = 0; file < AUDIT_EXPORT_FILES_MAX; file++) {
    const res = await client.teamAuditCsv(cursor ? { ...filter, cursor } : filter);
    // A text read keeps a byte-order mark only when the runtime leaves it; one file's is never mid-text.
    const text = res.csv.charCodeAt(0) === 0xfeff ? res.csv.slice(1) : res.csv;
    await write(file === 0 ? text : bodyOf(text));
    rows += rowsIn(text);
    onProgress?.(rows);
    if (!res.nextCursor) return { rows, capped: false };
    cursor = res.nextCursor;
  }
  return { rows, capped: true };
}

/** Every row the filter matches as one CSV text (no byte-order mark; the saver adds it), file by file. */
export async function exportAuditCsv(
  client: IndexClient,
  filter: AuditFilter,
  onProgress?: (rows: number) => void,
): Promise<AuditExport> {
  let csv = '';
  const done = await streamAuditCsv(
    client,
    filter,
    (chunk) => {
      csv += chunk;
    },
    onProgress,
  );
  return { csv, ...done };
}
