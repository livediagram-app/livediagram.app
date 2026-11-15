'use client';

// One person in the mini view (docs/specs/008-canvas/avatar-mode.md "The mini view"; blueprint: space-mini-view.md
// "Rows"): their bust in the sprite's own pixels, their name and status, then their raised hand and, while they
// speak, the canvas's three bars and a ring round the bust. A press on the row brings the Space's tab to the front.
import { memo } from 'react';
import type { VoiceLevel } from '@livehuddle/api-schema';
import { HeadFront } from '@livehuddle/avatar/components/avatar-sprite-head';
import { SKIN_DARK } from '@livehuddle/avatar/components/avatar-sprite-palette';
import { StatusDot } from '@livehuddle/avatar/components/AvatarWalker';
import type { AvatarConfig } from '@livehuddle/avatar/config';
import { avatarStatusLabel } from '@livehuddle/avatar/status';
import type { HandState } from '@/lib/calls/calls-store';
import { focusSpace } from '@/lib/mini-view/mini-view-window';
import type { MiniPerson } from '@/lib/mini-view/mini-view-people';
import { Badge } from '../RaisedHands';
import { Bars } from '../TalkingBars';

/** A row's hand: none, raised, or let speak (the brand's microphone). */
export type MiniHand = Exclude<HandState, 'down'> | null;

/**
 * The bust: the sprite's front head (its face and the person's hair) over shoulders in their presence colour, on the
 * sprite's 16-wide grid, cropped to the head and shoulders.
 */
export function MiniBust({
  config,
  color,
  speaking,
}: {
  config: AvatarConfig;
  color: string;
  speaking: boolean;
}) {
  return (
    <span
      aria-hidden
      data-mini-bust=""
      data-speaking={speaking ? '' : undefined}
      className="relative flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100 ring-2 ring-transparent ring-offset-1 ring-offset-white transition-shadow motion-reduce:transition-none dark:bg-slate-800 dark:ring-offset-slate-900"
      style={speaking ? { ['--tw-ring-color' as string]: color } : undefined}
    >
      <svg viewBox="1 0 14 14" width={28} height={28} shapeRendering="crispEdges" className="mt-1">
        <rect x={6} y={9} width={4} height={1} fill={SKIN_DARK} />
        <rect x={3} y={10} width={10} height={4} fill={color} />
        <rect x={2} y={11} width={12} height={3} fill={color} />
        <HeadFront gender={config.gender} hair={config.hair} colour={config.hairColour} />
      </svg>
    </span>
  );
}

/** What a screen reader hears for a row: name, status, hand, speaking. */
export function miniRowLabel(person: MiniPerson, hand: MiniHand, speaking: boolean): string {
  const parts = [person.name];
  if (person.status) parts.push(avatarStatusLabel(person.status));
  if (hand === 'raised') parts.push('hand raised');
  if (hand === 'speaking') parts.push('let speak');
  if (speaking) parts.push('speaking');
  return parts.join(', ');
}

function MiniViewRowView({
  person,
  hand,
  level,
}: {
  person: MiniPerson;
  hand: MiniHand;
  // 0 while silent (or hidden by Do Not Disturb).
  level: VoiceLevel;
}) {
  const speaking = level > 0;
  return (
    <li
      aria-label={miniRowLabel(person, hand, speaking)}
      data-mini-person={person.self ? 'self' : person.id}
      onClick={focusSpace}
      className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"
    >
      <MiniBust config={person.config} color={person.color} speaking={speaking} />
      <span aria-hidden className="min-w-0 flex-1">
        <span className="block truncate text-[13px] leading-5 font-medium text-slate-900 dark:text-slate-100">
          {person.name}
        </span>
        {person.status ? (
          <span className="flex items-center gap-1 text-xs leading-4 text-slate-600 dark:text-slate-300">
            <StatusDot status={person.status} />
            <span className="truncate">{avatarStatusLabel(person.status)}</span>
          </span>
        ) : null}
      </span>
      {hand ? <Badge speaking={hand === 'speaking'} /> : null}
      {speaking ? (
        <span aria-hidden className="flex w-4 justify-center">
          <Bars level={level} color={person.color} />
        </span>
      ) : null}
    </li>
  );
}

export const MiniViewRow = memo(MiniViewRowView);
