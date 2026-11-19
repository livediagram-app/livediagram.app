'use client';

import { PrivateDotIcon, SharedDotIcon } from '@liveworkspace/ui';
import { COMMUNITY_PUBLIC_LABEL } from '@liveworkspace/community-ui/badge';
import { VISIBILITY_TONE } from '@liveworkspace/explorer/visibility-tones';
import {
  THIS_BROWSER_DESCRIPTION,
  THIS_BROWSER_LABEL,
  ThisBrowserIcon,
} from '../primitives/ThisBrowserPill';

// An item's visibility states, the same in every editor (each editor's docs/specs/006-<kind>/offline-mode.md,
// docs/specs/025-community/community.md): their words and tones (the tones from @liveworkspace/explorer/visibility-tones), shared by the pill beside the title (SharedBadge) and its legend (VisibilityLegend).

export type ShareState = 'private' | 'shared' | 'team' | 'community' | 'offline';

/** The audiences from narrowest to widest: not even your other devices, just you, a link, your team, everyone. The
 *  legend's scale, the order a combination is listed in, and the way its hues sweep. */
export const SHARE_LADDER: readonly ShareState[] = [
  'offline',
  'private',
  'shared',
  'team',
  'community',
];

/** What decides an item's visibility, besides a share link. */
export type ItemVisibility = { team?: boolean; offline?: boolean; community?: boolean };

/** Every state that applies, in ladder order (docs/specs/007-editor/editor-app.md "Header actions", owner
 *  2026-11-19): an item can be Shared, Team and Public at once, while Offline (it reaches no one) and Private (nothing
 *  else applies) stand alone. Never empty. */
export function shareStatesOf(shareable: boolean, v: ItemVisibility): ShareState[] {
  if (v.offline) return ['offline'];
  const states: ShareState[] = [];
  if (shareable) states.push('shared');
  if (v.team) states.push('team');
  if (v.community) states.push('community');
  return states.length ? states : ['private'];
}

/** The one state that leads where a single value is needed: Offline, then Public, Shared, Team, Private. */
export function shareStateOf(shareable: boolean, v: ItemVisibility): ShareState {
  return v.offline
    ? 'offline'
    : v.community
      ? 'community'
      : shareable
        ? 'shared'
        : v.team
          ? 'team'
          : 'private';
}

/** The states' words for reading: "Shared", "Shared and Team", "Shared, Team and Public". */
export function shareStatesLabel(states: readonly ShareState[]): string {
  const words = states.map((s) => SHARE_STATE_META[s].label);
  return words.length < 2
    ? (words[0] ?? '')
    : `${words.slice(0, -1).join(', ')} and ${words.at(-1)}`;
}

/** The widest of the states (the last on the ladder): how far the item reaches. */
export function widestShareState(states: readonly ShareState[]): ShareState {
  return states.reduce<ShareState>(
    (wide, s) => (SHARE_LADDER.indexOf(s) > SHARE_LADDER.indexOf(wide) ? s : wide),
    states[0] ?? 'private',
  );
}

/** What pressing a stop on the visibility legend does, per audience (owner 2026-11-19): Offline takes the item offline,
 *  Private syncs an offline one, Shared opens Share, Team moves it into a team's space, Everyone opens Share on its
 *  Community tab. An absent action leaves its stop for reading only. */
export type VisibilityActions = Partial<Record<ShareState, () => void>>;

// Per-state pill styling, keyed by the resolved share state so the label /
// description / badge + dot colours stay in one table rather than four
// parallel `state === ...` ternaries. Also drives the legend rows.
export const SHARE_STATE_META: Record<
  ShareState,
  { label: string; description: string; badge: string; dot: string }
> = {
  private: {
    label: 'Private',
    description: 'Only visible to you, but synced to our servers.',
    badge: `px-2 text-[10px] font-semibold ring-1 ${VISIBILITY_TONE.private.chip}`,
    dot: VISIBILITY_TONE.private.dot,
  },
  shared: {
    label: 'Shared',
    description: 'Anyone with a link can open it.',
    badge: `px-2 text-[10px] font-semibold ring-1 ${VISIBILITY_TONE.shared.chip}`,
    dot: VISIBILITY_TONE.shared.dot,
  },
  team: {
    label: 'Team',
    description: 'In a team library: every member of the team can open it.',
    badge: `px-2 text-[10px] font-semibold ring-1 ${VISIBILITY_TONE.team.chip}`,
    dot: VISIBILITY_TONE.team.dot,
  },
  community: {
    label: COMMUNITY_PUBLIC_LABEL,
    description: 'In the public Community: anyone can find it, view it and make their own copy.',
    badge: `px-2 text-[10px] font-semibold ring-1 ${VISIBILITY_TONE.public.chip}`,
    dot: VISIBILITY_TONE.public.dot,
  },
  // Offline Mode (docs/specs/006-<kind>/offline-mode.md): saved only in this browser, never on the
  // server. The Offline pill's words, sentence and teal tone (text 4.5:1 on its fill, ring 3:1):
  // teal is no app's accent and no status colour.
  offline: {
    label: THIS_BROWSER_LABEL,
    description: THIS_BROWSER_DESCRIPTION,
    badge: `px-2 text-[10px] font-semibold ring-1 ${VISIBILITY_TONE.browser.chip}`,
    dot: '',
  },
};

// The pill's rendered height, pinned: its caps label is trimmed to cap height, so padding alone would
// shrink it (docs/specs/004-interface-design/optical-alignment.md).
export const STATE_CHIP_HEIGHT_PX = 19;

// The icon carries its colour itself: a wrapper would hide the svg from the chip's edge compensation.
export function StateDot({ state, className }: { state: ShareState; className: string }) {
  // The Offline pill's own glyph: a browser window.
  if (state === 'offline') return <ThisBrowserIcon size={10} />;
  return state === 'private' ? (
    <PrivateDotIcon className={className} />
  ) : (
    <SharedDotIcon className={className} />
  );
}
