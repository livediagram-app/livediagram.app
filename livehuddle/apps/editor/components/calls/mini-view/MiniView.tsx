'use client';

// The mini view's content (docs/specs/008-canvas/avatar-mode.md "The mini view"; blueprint: space-mini-view.md
// "Rows"): In the Space and its count with Back to Space, a knock that reached you, then you and everyone with a
// character on your tab, the people you hear under Near You. Rendered by MiniViewHost into the Picture-in-Picture
// window. It subscribes to the levels, the hands, your call and the knock, and re-renders only when one changes.
import { memo } from 'react';
import { lucideArrowUpRight } from '@liveworkspace/icons/lucide';
import { Button, CountBadge, lucideGlyph } from '@livehuddle/ui';
import type { VoiceLevel } from '@livehuddle/api-schema';
import {
  levelNow,
  micOn,
  useCallHands,
  useCallPeers,
  useCallSelf,
  type CallHand,
  type CallSelf,
} from '@/lib/calls/calls-store';
import { useMiniKnock, type MiniKnock } from '@/lib/mini-view/mini-view-knock';
import type { MiniGroup, MiniPerson } from '@/lib/mini-view/mini-view-people';
import { focusSpace } from '@/lib/mini-view/mini-view-window';
import { useStaleClock } from '../TalkingBars';
import { MiniViewRow, type MiniHand } from './MiniViewRow';

const BackIcon = lucideGlyph(lucideArrowUpRight, 14);

export const GROUP_TITLE: Record<MiniGroup['id'], string> = {
  near: 'Near You',
  space: 'In the Space',
};
export const ALONE_TEXT = 'Nobody else is here yet.';

function selfHand(self: CallSelf): MiniHand {
  return self.hand === 'down' ? null : self.hand;
}

function peerHand(hand: CallHand | undefined, tabId: string): MiniHand {
  if (!hand || hand.tabId !== tabId) return null;
  return hand.letSpeak ? 'speaking' : 'raised';
}

function selfLevel(self: CallSelf): VoiceLevel {
  return self.canSpeak && micOn(self) ? self.level : 0;
}

function KnockCard({ knock }: { knock: MiniKnock }) {
  return (
    <div
      data-mini-knock=""
      className="rounded-lg bg-amber-50 p-2.5 ring-1 ring-amber-200 dark:bg-amber-500/15 dark:ring-amber-400/30"
    >
      <p className="text-[13px] leading-5 font-medium text-amber-900 dark:text-amber-100">
        {knock.name} is knocking
      </p>
      <div className="mt-2 flex gap-1.5">
        <Button size="xs" onClick={() => knock.answer('in')}>
          Let In
        </Button>
        <Button size="xs" variant="secondary" onClick={() => knock.answer('later')}>
          Not Now
        </Button>
      </div>
    </div>
  );
}

function MiniViewBody({
  count,
  groups,
  tabId,
  doNotDisturb,
}: {
  count: number;
  groups: readonly MiniGroup[];
  tabId: string;
  doNotDisturb: boolean;
}) {
  const self = useCallSelf();
  const peers = useCallPeers();
  const { hands } = useCallHands();
  const knock = useMiniKnock();
  // Re-renders when the oldest live level goes stale, so a lost stop clears its bars as on the canvas.
  useStaleClock(peers);
  const levelOf = (person: MiniPerson): VoiceLevel => {
    if (person.self) return selfLevel(self);
    return doNotDisturb ? 0 : levelNow(peers.get(person.id));
  };
  const handOf = (person: MiniPerson): MiniHand =>
    person.self ? selfHand(self) : peerHand(hands.get(person.id), tabId);
  return (
    <div className="flex h-screen flex-col bg-white font-sans text-slate-900 dark:bg-slate-900 dark:text-slate-100">
      <header
        onClick={focusSpace}
        className="flex shrink-0 cursor-pointer items-center gap-2 border-b border-slate-200 py-2 pr-2 pl-3 dark:border-slate-800"
      >
        <span className="text-[13px] font-semibold">In the Space</span>
        <CountBadge count={count} label={`${count} ${count === 1 ? 'person' : 'people'}`} />
        <Button
          size="xs"
          variant="ghost"
          className="ml-auto"
          onClick={(e) => {
            e.stopPropagation();
            focusSpace();
          }}
        >
          <BackIcon />
          Back to Space
        </Button>
      </header>
      <div aria-live="polite" className="shrink-0 px-2 empty:hidden [&:not(:empty)]:pt-2">
        {knock ? <KnockCard knock={knock} /> : null}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pt-1 pb-2">
        {groups.map((group) => (
          <section key={group.id} aria-label={GROUP_TITLE[group.id]} className="pt-1">
            <h2 className="px-2 pt-1.5 pb-1 text-[11px] font-semibold tracking-wide text-slate-600 uppercase dark:text-slate-300">
              {GROUP_TITLE[group.id]}
            </h2>
            <ul className="flex flex-col">
              {group.people.map((person) => (
                <MiniViewRow
                  key={person.self ? 'self' : person.id}
                  person={person}
                  hand={handOf(person)}
                  level={levelOf(person)}
                />
              ))}
            </ul>
          </section>
        ))}
        {count === 1 ? (
          <p className="px-2 pt-2 text-xs text-slate-600 dark:text-slate-300">{ALONE_TEXT}</p>
        ) : null}
      </div>
    </div>
  );
}

/** Memoised: the host hands it the same groups until a fact they show changes. */
export const MiniView = memo(MiniViewBody);
