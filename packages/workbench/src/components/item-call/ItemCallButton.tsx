'use client';

// Start a Call Here in the editor's corner card (liveworkspace/docs/specs/004-index/item-calls.md "Starting",
// "Joining"): Call for an account while nobody is in one; "3 in Call" with Join for anyone who can read the item while
// one is live. Either opens livehuddle's call in its own browser tab, never this one (owner, 2026-11-22). No call code
// here: the call is livehuddle's page, in its tab; this is a button and a pill over one small read.
import { callInProgressWords, inCallWords } from '@liveworkspace/index-client';
import { HoverCard, lucideGlyph } from '@liveworkspace/ui';
import { lucideVideo } from '@liveworkspace/icons/lucide';
import { APP_ITEMS } from '@liveworkspace/sites';
import { CORNER_BTN, CORNER_TONE } from '../chrome/EditorCornerActions';
import { useItemCallAction } from './useItemCallAction';

export { joinCall, startCall } from './useItemCallAction';

const VideoGlyph = lucideGlyph(lucideVideo, 14);

export function ItemCallButton() {
  const action = useItemCallAction();
  if (!action) return null;
  const noun = APP_ITEMS[action.source.app].noun.toLowerCase();

  if (action.kind === 'join') {
    const { live } = action;
    return (
      <HoverCard
        title="Call in Progress"
        description={`${callInProgressWords(live)}. Join opens it in a new tab.`}
      >
        <button
          type="button"
          onClick={action.run}
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

  const { starting } = action;
  return (
    <HoverCard
      title="Start a Call Here"
      description={`A video call about this ${noun}, in a new tab. Everyone who can open it sees the call and can join.`}
    >
      <button
        type="button"
        onClick={action.run}
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
