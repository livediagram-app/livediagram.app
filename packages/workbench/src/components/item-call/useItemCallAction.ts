'use client';

// The open item's call as one action (liveworkspace/docs/specs/004-index/item-calls.md "Starting", "Joining"): Join while
// someone is in it, Start for an account that may start one, nothing otherwise. Shared by the corner card's Call
// button (ItemCallButton) and the phone's Apps drawer's Call tile (phone-apps-drawer.md), so both say and do the same.
import { useState } from 'react';
import {
  callFallbackWords,
  itemCallTabName,
  readCallSpaceSetting,
  type CallSpaceFallback,
  type ItemCall,
  type ItemCallsRead,
} from '@liveworkspace/index-client';
import { focusOrOpen, isBlank, namedTab, sendTab } from '@liveworkspace/index-client/browser';
import { workbench } from '../../bindings';
import { useToast } from '../../hooks/ui/useToast';
import { indexClient } from '../../lib/index-client';
import { refreshItemCalls, useItemCalls, type CallSource } from './item-call-store';

type Starter = Pick<typeof indexClient, 'startItemCall'>;

/** Starts the item's call (or joins the live one) in the call's own tab, opened in the press so nothing blocks it: in
 *  the person's Calls Space when they chose one (item-calls.md "Your Calls Space"). `fallback`: the Space was
 *  skipped, and why. */
export async function startCall(
  source: CallSource,
  starter: Starter = indexClient,
  space: string | null = readCallSpaceSetting(workbench.readPreferences()),
): Promise<'opened' | 'blocked' | 'failed' | { fallback: CallSpaceFallback }> {
  const tab = namedTab(itemCallTabName(source.id));
  if (!tab) return 'blocked';
  // A tab already at the call: bring it forward, no second call.
  if (!isBlank(tab)) {
    tab.focus();
    return 'opened';
  }
  try {
    const { call, fallback } = await starter.startItemCall(source.id, source.share, space);
    sendTab(tab, call.link);
    return fallback ? { fallback } : 'opened';
  } catch {
    tab.close();
    return 'failed';
  }
}

/** Joins the live call in its tab (the one already there, else a new one). */
export const joinCall = (source: CallSource, call: Pick<ItemCall, 'link'>): boolean =>
  focusOrOpen(itemCallTabName(source.id), call.link);

export type ItemCallAction =
  | { kind: 'join'; source: CallSource; live: NonNullable<ItemCallsRead['live']>; run: () => void }
  | { kind: 'start'; source: CallSource; starting: boolean; run: () => void };

/** The call's action for the open item, or null when there is none to offer. */
export function useItemCallAction(): ItemCallAction | null {
  const { source, read } = useItemCalls();
  const toast = useToast();
  const [starting, setStarting] = useState(false);
  if (!source) return null;
  const live = read?.live ?? null;
  if (live && live.people > 0) {
    return {
      kind: 'join',
      source,
      live,
      run: () => {
        workbench.track('UI', 'Opened', 'ItemCall');
        if (!joinCall(source, live))
          toast.error('Your browser blocked the call’s tab. Allow pop-ups to join.');
      },
    };
  }
  if (!source.canStart) return null;
  return {
    kind: 'start',
    source,
    starting,
    run: () => {
      if (starting) return;
      setStarting(true);
      workbench.track('UI', 'Started', 'ItemCall');
      void startCall(source).then((outcome) => {
        setStarting(false);
        if (outcome === 'blocked')
          toast.error('Your browser blocked the call’s tab. Allow pop-ups to start a call.');
        if (outcome === 'failed') {
          workbench.track('UI', 'Refused', 'ItemCall');
          toast.error('The call couldn’t start. Try again in a moment.');
        }
        if (typeof outcome === 'object') toast.warning(callFallbackWords(outcome.fallback));
        void refreshItemCalls();
      });
    },
  };
}
