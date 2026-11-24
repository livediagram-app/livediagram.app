'use client';

// Start a Call Here in the editor's corner card (liveworkspace/docs/specs/004-index/item-calls.md "Starting",
// "Joining"): Call for an account while nobody is in one; "3 in Call" with Join for anyone who can read the item while
// one is live. Either opens livehuddle's call in its own browser tab, never this one (owner, 2026-11-22). No call code
// here: the call is livehuddle's page, in its tab; this is a button and a pill over one small read.
import { useState } from 'react';
import {
  callFallbackWords,
  callInProgressWords,
  inCallWords,
  itemCallTabName,
  readCallSpaceSetting,
  type CallSpaceFallback,
  type ItemCall,
} from '@liveworkspace/index-client';
import { HoverCard, lucideGlyph } from '@liveworkspace/ui';
import { lucideVideo } from '@liveworkspace/icons/lucide';
import { APP_ITEMS } from '@liveworkspace/sites';
import { workbench } from '../../bindings';
import { useToast } from '../../hooks/ui/useToast';
import { indexClient } from '../../lib/index-client';
import { CORNER_BTN, CORNER_TONE } from '../chrome/EditorCornerActions';
import { refreshItemCalls, useItemCalls, type CallSource } from './item-call-store';
import { focusOrOpen, isBlank, namedTab, sendTab } from '@liveworkspace/index-client/browser';

const VideoGlyph = lucideGlyph(lucideVideo, 14);

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

export function ItemCallButton() {
  const { source, read } = useItemCalls();
  const toast = useToast();
  const [starting, setStarting] = useState(false);
  if (!source) return null;
  const live = read?.live ?? null;
  const noun = APP_ITEMS[source.app].noun.toLowerCase();

  if (live && live.people > 0) {
    const onJoin = () => {
      workbench.track('UI', 'Opened', 'ItemCall');
      if (!joinCall(source, live))
        toast.error('Your browser blocked the call’s tab. Allow pop-ups to join.');
    };
    return (
      <HoverCard
        title="Call in Progress"
        description={`${callInProgressWords(live)}. Join opens it in a new tab.`}
      >
        <button
          type="button"
          onClick={onJoin}
          data-item-call="join"
          className={`${CORNER_BTN} bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-200 dark:hover:bg-emerald-900/60`}
        >
          <span aria-hidden="true" className="relative flex size-2">
            <span className="absolute inline-flex size-full rounded-full bg-emerald-500 opacity-60 motion-safe:animate-ping [animation-iteration-count:3]!" />
            <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
          </span>
          <span className="phone:sr-only [[data-compact]_&]:sr-only">
            {inCallWords(live.people)}
          </span>
          <span className="rounded-md bg-emerald-600 px-1.5 py-0.5 text-[11px] font-semibold text-white phone:sr-only [[data-compact]_&]:sr-only dark:bg-emerald-500">
            Join
          </span>
        </button>
      </HoverCard>
    );
  }

  if (!source.canStart) return null;
  const onStart = async () => {
    if (starting) return;
    setStarting(true);
    workbench.track('UI', 'Started', 'ItemCall');
    const outcome = await startCall(source);
    setStarting(false);
    if (outcome === 'blocked')
      toast.error('Your browser blocked the call’s tab. Allow pop-ups to start a call.');
    if (outcome === 'failed') {
      workbench.track('UI', 'Refused', 'ItemCall');
      toast.error('The call couldn’t start. Try again in a moment.');
    }
    if (typeof outcome === 'object') toast.warning(callFallbackWords(outcome.fallback));
    void refreshItemCalls();
  };
  return (
    <HoverCard
      title="Start a Call Here"
      description={`A video call about this ${noun}, in a new tab. Everyone who can open it sees the call and can join.`}
    >
      <button
        type="button"
        onClick={() => void onStart()}
        disabled={starting}
        data-item-call="start"
        className={`${CORNER_BTN} ${CORNER_TONE}`}
      >
        <VideoGlyph />
        <span className="phone:sr-only [[data-compact]_&]:sr-only">
          {starting ? 'Starting' : 'Call'}
        </span>
      </button>
    </HoverCard>
  );
}
