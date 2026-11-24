'use client';

// An invite to a call, in the Inbox's reading pane (liveworkspace/docs/specs/004-index/item-calls.md "Invites"): who
// asked, and the call as it stands now, read once on open with the reader's own access. Join opens the call in its
// own tab (the one already there, else a new one); a call that has ended says so, and the item stays a click away.
import { useEffect, useState } from 'react';
import { itemCallTabName, type ItemCall } from '@liveworkspace/index-client';
import { focusOrOpen } from '@liveworkspace/index-client/browser';
import { useExplorer } from '../context';
import type { InboxCallEntry } from './sections';

type Now = { state: 'loading' } | { state: 'live'; call: ItemCall } | { state: 'ended' };

export function CallInviteBody({ entry }: { entry: InboxCallEntry }) {
  const { client } = useExplorer();
  const r = entry.row;
  const [now, setNow] = useState<Now>({ state: 'loading' });

  useEffect(() => {
    let live = true;
    client
      .itemCalls(r.itemId)
      .then(({ live: call }) => {
        if (live) setNow(call ? { state: 'live', call } : { state: 'ended' });
      })
      .catch(() => {
        if (live) setNow({ state: 'ended' });
      });
    return () => {
      live = false;
    };
  }, [client, r.itemId]);

  return (
    <div className="flex flex-col gap-3" data-inbox-call="">
      <p className="text-sm leading-6 text-slate-700 dark:text-slate-200">
        {r.byName || 'Someone'} asked you to join a video call about{' '}
        <span className="font-medium">{r.itemTitle || 'Untitled'}</span>. It opens in livehuddle, in
        a new tab.
      </p>
      {now.state === 'live' ? (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => focusOrOpen(itemCallTabName(r.itemId), now.call.link)}
            className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-400"
          >
            <span aria-hidden="true" className="size-2 rounded-full bg-white/90" />
            Join Call
          </button>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {now.call.people === 1 ? '1 person' : `${now.call.people} people`} in it now
          </span>
        </div>
      ) : now.state === 'ended' ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          The call has ended. Its summary, once sent, is in the item’s Meetings.
        </p>
      ) : (
        <p className="text-sm text-slate-500 dark:text-slate-400">Checking the call…</p>
      )}
    </div>
  );
}
