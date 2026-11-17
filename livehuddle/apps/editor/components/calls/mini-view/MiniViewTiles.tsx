'use client';

// The mini view's camera tiles (docs/specs/008-canvas/avatar-mode.md "The mini view", "Camera tiles"; blueprint:
// space-mini-view.md "Camera tiles", Work Tracker 984): the received cameras of the people you hear, in Near You's
// order, at most MAX_MINI_VIEW_VIDEOS, two to a row. Each tile is the canvas bubble's own video, ringed and tinted in
// the person's colour, their name on a chip at its foot. A press brings the Space's tab to the front.
import { memo, type CSSProperties } from 'react';
import type { VoiceLevel } from '@livehuddle/api-schema';
import { MAX_MINI_VIEW_VIDEOS } from '@/lib/calls/bubbles';
import type { CallMediaStreams } from '@/lib/calls/calls-store';
import type { MiniGroup, MiniPerson } from '@/lib/mini-view/mini-view-people';
import { focusSpace } from '@/lib/mini-view/mini-view-window';
import { MediaVideo, mediaTitle } from '../MediaBubble';
import { Bars } from '../TalkingBars';

/** A heard person's received camera, as the window shows it. */
export type MiniTile = { person: MiniPerson; stream: MediaStream };

export const TILES_LABEL = 'Cameras';

const NO_TILES: readonly MiniTile[] = [];

/** The tiles: Near You's people in order, not you, each with a received camera, capped. */
export function miniTiles(
  groups: readonly MiniGroup[],
  media: ReadonlyMap<string, CallMediaStreams>,
): readonly MiniTile[] {
  const near = groups.find((g) => g.id === 'near');
  if (!near) return NO_TILES;
  const tiles: MiniTile[] = [];
  for (const person of near.people) {
    if (person.self) continue;
    const stream = media.get(person.id)?.video;
    if (!stream) continue;
    tiles.push({ person, stream });
    if (tiles.length === MAX_MINI_VIEW_VIDEOS) break;
  }
  return tiles.length === 0 ? NO_TILES : tiles;
}

// A lone tile fills the row; an odd last one sits centred at one column's width.
function spanOf(index: number, count: number): string {
  if (count === 1) return 'col-span-2';
  if (count % 2 === 1 && index === count - 1)
    return 'col-span-2 w-[calc(50%-3px)] justify-self-center';
  return '';
}

function MiniViewTileView({
  person,
  stream,
  level,
  className,
}: {
  person: MiniPerson;
  stream: MediaStream;
  // 0 while silent (or hidden by Do Not Disturb).
  level: VoiceLevel;
  className: string;
}) {
  const title = mediaTitle(person.name, 'video');
  const style = {
    '--mini-tile-ring': person.color,
    // The person's colour tints the tile until the first frame arrives, as the canvas bubble does.
    background: `color-mix(in srgb, ${person.color} 22%, rgb(15 23 42))`,
  } as CSSProperties;
  return (
    <li data-mini-tile={person.id} className={className}>
      <button
        type="button"
        aria-label={level > 0 ? `${title}, speaking` : title}
        onClick={focusSpace}
        style={style}
        className="relative block aspect-video w-full cursor-pointer overflow-hidden rounded-lg shadow-[0_0_0_2px_var(--mini-tile-ring)] transition-[box-shadow,scale] duration-150 hover:shadow-[0_0_0_3px_var(--mini-tile-ring)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100"
      >
        <MediaVideo stream={stream} fit="cover" />
        <span
          aria-hidden
          className="absolute bottom-1 left-1 flex max-w-[calc(100%-8px)] items-center gap-1 rounded-md bg-slate-950/70 px-1.5 py-0.5 text-[11px] leading-4 font-medium text-white"
        >
          <span className="truncate">{person.name}</span>
          {level > 0 ? <Bars level={level} color="#fff" /> : null}
        </span>
      </button>
    </li>
  );
}

/** Memoised: a level tick re-renders only the speaker's chip, never the video. */
export const MiniViewTile = memo(MiniViewTileView);

/** The tiles' grid, or nothing with no camera to show. */
export function MiniViewTiles({
  tiles,
  levelOf,
}: {
  tiles: readonly MiniTile[];
  levelOf: (person: MiniPerson) => VoiceLevel;
}) {
  if (tiles.length === 0) return null;
  return (
    <ul aria-label={TILES_LABEL} className="grid shrink-0 grid-cols-2 gap-1.5 px-2 pt-2">
      {tiles.map((tile, i) => (
        <MiniViewTile
          key={tile.person.id}
          person={tile.person}
          stream={tile.stream}
          level={levelOf(tile.person)}
          className={spanOf(i, tiles.length)}
        />
      ))}
    </ul>
  );
}
