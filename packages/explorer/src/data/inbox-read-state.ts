'use client';

// The Inbox's read and unread (liveworkspace/docs/specs/004-index/inbox-reading.md "Read and unread"): what the index
// answers with the list (`read`: the person's Mark All Read and their rows read since, by key), with this page's own
// marks laid over it at once, so a row reads as read the moment it is opened and the badge drops with it. A mark is
// sent to the index (`PUT /inbox/read`), which keeps it for every app and device; it stays laid over until a read of
// the list that started after it was kept, and that read's answer is then the truth (another app's marks with it).
//
// A person the index keeps no read state for (a guest: the answer has no `read`) still has this page's marks, for
// this visit alone.

import { useCallback, useMemo, useRef, useState } from 'react';
import type { InboxReadState, IndexClient } from '@liveworkspace/index-client';
import { INBOX_READ_BATCH_MAX } from '@liveworkspace/index-client';

/** This page's marks: rows read (their time) or marked unread (0) by key, and a Mark All Read's time. */
type Marks = { at: ReadonlyMap<string, number>; before: number | null };

const NO_MARKS: Marks = { at: new Map(), before: null };
const EMPTY: InboxReadState = { before: 0, at: {} };

/** The index's read state with this page's marks over it. A Mark All Read here sets aside every row the index had
 *  read or marked unread before it. */
export function withMarks(
  read: InboxReadState | undefined,
  marks: Marks,
): InboxReadState | undefined {
  if (marks.at.size === 0 && marks.before === null) return read;
  const base = read ?? EMPTY;
  const before = Math.max(base.before, marks.before ?? 0);
  const at: Record<string, number> = marks.before === null ? { ...base.at } : {};
  for (const [key, value] of marks.at) at[key] = value;
  return { before, at };
}

export type InboxReadMarks = {
  /** The rows read, each at its time now. */
  markRead: (rows: readonly { key: string; at: number }[]) => void;
  /** One row back to unread, whatever its time. */
  markUnread: (key: string) => void;
  /** Every row read, as of now. */
  markAllRead: () => void;
};

/**
 * `keeps`: the index keeps read state for this person (its answer had `read`), so marks are sent; else they are this
 * page's alone. `readStarted`: when the read whose answer is on screen started, so marks it already holds are let go.
 */
export function useInboxReadMarks(
  client: IndexClient,
  read: InboxReadState | undefined,
  keeps: boolean,
  readStarted: number,
): { read: InboxReadState | undefined } & InboxReadMarks {
  const [marks, setMarks] = useState<Marks>(NO_MARKS);
  // Marks by when they were made, and when the last of them was kept (or failed): a read that started after every
  // mark was kept holds them all.
  const made = useRef(0);
  const settled = useRef(0);
  const inFlight = useRef(0);
  const [heldFrom, setHeldFrom] = useState(0);
  // A newer read than every kept mark: its answer is the truth, and this page's marks go.
  if (
    inFlight.current === 0 &&
    made.current > 0 &&
    readStarted > settled.current &&
    heldFrom !== readStarted
  ) {
    setHeldFrom(readStarted);
    setMarks(NO_MARKS);
  }

  const send = useCallback(
    (change: Parameters<IndexClient['markInbox']>[0]) => {
      made.current = Date.now();
      if (!keeps) return;
      inFlight.current++;
      void client
        .markInbox(change)
        .catch((e: unknown) => console.warn('[explorer] inbox-read-failed', e))
        .finally(() => {
          inFlight.current--;
          settled.current = Date.now();
        });
    },
    [client, keeps],
  );

  const markRead = useCallback(
    (rows: readonly { key: string; at: number }[]) => {
      if (rows.length === 0) return;
      setMarks((m) => {
        const at = new Map(m.at);
        for (const r of rows) at.set(r.key, Math.max(r.at, at.get(r.key) ?? 0));
        return { ...m, at };
      });
      for (let i = 0; i < rows.length; i += INBOX_READ_BATCH_MAX) {
        send({
          read: rows.slice(i, i + INBOX_READ_BATCH_MAX).map((r) => ({ key: r.key, at: r.at })),
        });
      }
    },
    [send],
  );
  const markUnread = useCallback(
    (key: string) => {
      setMarks((m) => ({ ...m, at: new Map(m.at).set(key, 0) }));
      send({ unread: [key] });
    },
    [send],
  );
  const markAllRead = useCallback(() => {
    setMarks({ at: new Map(), before: Date.now() });
    send({ all: true });
  }, [send]);

  const merged = useMemo(() => withMarks(read, marks), [read, marks]);
  return { read: merged, markRead, markUnread, markAllRead };
}
