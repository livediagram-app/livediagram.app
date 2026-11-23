'use client';

// In a call, running low (docs/specs/012-collaboration/call-minutes.md "What people see"): "80 call minutes left this
// month. Pro has 5,000." above the Call dock, once a month, only for someone who may do something about it (the
// Space's owner, or an admin of its team). The room says the month is low; the number is read from the api, which
// gives it to the owner and the owning team alone.
import { useEffect, useState } from 'react';
import { CALL_MINUTES_LOW } from '@livehuddle/api-schema';
import { Button } from '@livehuddle/ui';
import { Callout } from '@liveworkspace/ui/callout';
import { isOwnerScope, monthKey } from '@liveworkspace/subscription';
import { ownerViewOf, upgradeTier, useOwnerView, useUpgrade } from '@liveworkspace/subscription-ui';
import { apiCallMinutes, type CallsCaller } from '@/lib/api/calls';
import { clearCallMinutesLow } from '@/lib/calls/call-minutes-store';
import { callMinutesLowWords } from '@/lib/calls/call-minutes-words';

const SEEN_PREFIX = 'livehuddle:call-minutes-low:';

function wasSeen(key: string): boolean {
  try {
    return localStorage.getItem(SEEN_PREFIX + key) === '1';
  } catch {
    return false;
  }
}

function markSeen(key: string): void {
  try {
    localStorage.setItem(SEEN_PREFIX + key, '1');
  } catch {
    // Without storage the notice may come back on the next visit; it is never an error.
  }
}

export function CallMinutesLow({ owner, caller }: { owner: string; caller: CallsCaller | null }) {
  const load = useOwnerView(isOwnerScope(owner) ? owner : null);
  const upgrade = useUpgrade();
  const view = ownerViewOf(load);
  const may = view?.action === 'upgrade' || view?.action === 'manage';
  // The clock as the notice first drew, and whether this browser has shown this owner this month's notice already.
  const [now] = useState(() => Date.now());
  const seenKey = `${owner}:${monthKey(now)}`;
  const [seen] = useState(() => wasSeen(seenKey));
  const [left, setLeft] = useState<number | null>(null);
  const ask = may && !seen ? caller : null;
  useEffect(() => {
    if (!ask) return;
    let live = true;
    void apiCallMinutes(ask)
      .then((read) => {
        if (!live || !read.metered || read.used === null || read.limit === null) return;
        setLeft(Math.max(0, read.limit - read.used));
      })
      // A read that fails says nothing: the meter in Collaborators still has the count.
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [ask]);
  const showing = may && !seen && left !== null && left > 0 && left <= CALL_MINUTES_LOW;
  // Once: shown now, it is not shown again this month in this browser.
  useEffect(() => {
    if (showing) markSeen(seenKey);
  }, [showing, seenKey]);
  if (!showing || !view) return null;
  // The tier above is offered only to someone on Free who may move to it.
  const offer = view.action === 'upgrade' && view.tier === 'free' ? upgradeTier(view) : null;
  return (
    // Hung over the dock's card, centred on it, and never wider than the window.
    <div data-call-minutes-low="" className="relative w-0">
      <div className="pointer-events-auto absolute bottom-full left-1/2 mb-2 w-[min(24rem,calc(100vw-1.5rem))] -translate-x-1/2">
        <Callout tone="info" size="md" role="status" floating onClose={clearCallMinutesLow}>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="min-w-0 flex-1 basis-48">{callMinutesLowWords(left, offer, now)}</span>
            {offer ? (
              <Button
                variant="secondary"
                size="xs"
                className="relative touch-target shrink-0"
                onClick={() =>
                  upgrade.openUpgrade({ owner: view.owner, limit: 'callMinutesPerMonth' })
                }
              >
                See Pro
              </Button>
            ) : null}
          </div>
        </Callout>
      </div>
    </div>
  );
}
