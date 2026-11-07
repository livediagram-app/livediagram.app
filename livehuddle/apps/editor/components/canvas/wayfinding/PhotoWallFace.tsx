'use client';

import { memo } from 'react';
import { AvatarSprite } from '@liveworkspace/avatar/components/avatar-sprite';
import { DEFAULT_AVATAR_CONFIG } from '@liveworkspace/avatar/config';
import {
  OFFICE_ART,
  PHOTO_FRAME_RECTS,
  PHOTO_FRAMES,
  type ShapeElement,
} from '@livehuddle/document';
import { Tooltip } from '@livehuddle/ui';
import { Overlay } from '@/components/canvas/collab/SocialFaces';
import { listNames, photoName, photoWallFrames, photoWallLabel } from '@/lib/photo-wall';
import type { WayPerson } from '@/lib/wayfinding';
import { useWayfindingSelect, type Wayfinding } from './wayfinding-store';

// The Team Photo Wall's face (docs/specs/009-elements/team-pieces.md "Team Photo Wall"): the people in the Space now,
// from the presence this screen already holds (the wayfinding store's people: you, this tab, the other tabs), each a
// front-on portrait of their character on a wash of their colour in one of the wall's eight frames. The empty frames
// are the drawing's own (office-team.ts), so a wall with few people reads as a wall with room. The store publishes its
// people only when who, where or how they look changes, so a walk re-renders no portrait.

const art = OFFICE_ART['photo-wall'].front;
const pct = (v: number, of: number) => `${(v / of) * 100}%`;

export function PhotoWallFace({
  element,
  wayfinding,
}: {
  element: ShapeElement;
  wayfinding?: Wayfinding;
}) {
  if (!wayfinding) return null;
  return <PhotoWallFrames element={element} wayfinding={wayfinding} />;
}

function PhotoWallFrames({
  element,
  wayfinding,
}: {
  element: ShapeElement;
  wayfinding: Wayfinding;
}) {
  const people = useWayfindingSelect(wayfinding.store, (s) => s.people);
  const { shown, rest } = photoWallFrames(people, PHOTO_FRAMES);
  const last = PHOTO_FRAME_RECTS[shown.length];
  return (
    <Overlay element={element}>
      <div role="img" aria-label={photoWallLabel(people)} className="absolute inset-0">
        {shown.map((person, i) => (
          <Portrait key={person.id} person={person} index={i} />
        ))}
        {rest.length > 0 && last ? (
          <Tooltip label={listNames(rest.map(photoName))}>
            <span
              data-photo-more=""
              className="pointer-events-auto absolute flex items-center justify-center bg-slate-700 text-[9px] font-bold text-white"
              style={{
                left: pct(last.mat.x, art.width),
                top: pct(last.mat.y, art.height),
                width: pct(last.mat.w, art.width),
                height: pct(last.mat.h, art.height),
              }}
            >
              +{rest.length}
            </span>
          </Tooltip>
        ) : null}
      </div>
    </Overlay>
  );
}

const Portrait = memo(function Portrait({ person, index }: { person: WayPerson; index: number }) {
  const mat = PHOTO_FRAME_RECTS[index]!.mat;
  return (
    <Tooltip label={photoName(person)}>
      <span
        data-photo-frame=""
        className="pointer-events-auto absolute flex items-end justify-center overflow-hidden [&>svg]:h-[92%] [&>svg]:w-auto"
        style={{
          left: pct(mat.x, art.width),
          top: pct(mat.y, art.height),
          width: pct(mat.w, art.width),
          height: pct(mat.h, art.height),
          // A wash of their colour behind them: the photo's backdrop.
          background: `linear-gradient(to bottom, color-mix(in srgb, ${person.color} 38%, white), color-mix(in srgb, ${person.color} 18%, white))`,
        }}
      >
        <AvatarSprite
          facing="down"
          config={person.config ?? DEFAULT_AVATAR_CONFIG}
          walking={false}
          stepFrame={0}
          lift={0}
          wave={null}
          shirt={person.color}
          portrait
        />
      </span>
    </Tooltip>
  );
});
