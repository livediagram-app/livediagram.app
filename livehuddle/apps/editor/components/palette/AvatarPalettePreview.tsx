'use client';

import { useState } from 'react';
import { AvatarSprite } from '@livehuddle/avatar/components/avatar-sprite';
import { StatusDot } from '@livehuddle/avatar/components/AvatarWalker';
import type { AvatarConfig } from '@livehuddle/avatar/config';
import { avatarStatusLabel, type AvatarStatus } from '@livehuddle/avatar/status';
import { prefersReducedMotion } from '@livehuddle/ui';
import { ReactionBurst } from '@/components/canvas/ReactionBurst';
import { behaviourStill } from '@/lib/avatar-palette';
import { previewView, useAvatarPreview } from '@/lib/avatar-preview';
import { FigurePortrait, PortraitPlayer } from './FigurePortrait';

// The avatar palette's preview card (docs/specs/008-canvas/avatar-mode.md "The preview, beside the flyout"): your
// character large, wearing whatever option the pointer or the focus is on, playing the move or throwing the burst
// it names, and a caption saying what is shown. The card's surface and place are the host's (AvatarPalette); this is
// its body. Hidden from assistive tech: every option already says what it is.

// The sprite's scale, drawn only when the 3D character cannot be (no WebGL): the flyout's portrait made large.
const SCALE = 2;
// The 3D character's picture, CSS px: the card's stage less its margins, with headroom for raised arms and a hop.
const FIGURE_W = 184;
const FIGURE_H = 240;
// The footprint a preview burst is scaled to. A burst flies out about twice its footprint each side (ReactionBurst's
// overscan), so in a card this small a small footprint keeps the particles inside the stage.
const BURST_PX = 56;

export function AvatarPalettePreview({
  config,
  shirt,
  status,
}: {
  config: AvatarConfig;
  shirt?: string | undefined;
  status: AvatarStatus | null;
}) {
  const preview = useAvatarPreview();
  const view = previewView(preview, config, status);
  // Read once, as the card opens: the in-app setting or the system's. Reduced motion shows a
  // Behaviour's still; otherwise it plays on a loop.
  const [still] = useState(prefersReducedMotion);
  // A new seed when a burst ends, so it is thrown again for as long as it is previewed.
  const [seed, setSeed] = useState(1);
  const look = { ...view.config, shirt };
  const sprite = (
    <AvatarSprite
      facing={view.behaviour ? (behaviourStill(view.behaviour).facing ?? 'down') : 'down'}
      config={view.config}
      walking={false}
      stepFrame={0}
      lift={0}
      wave={null}
      shirt={shirt}
      scale={SCALE}
      pose={view.behaviour ? behaviourStill(view.behaviour) : null}
      status={view.status}
      portrait
    />
  );
  return (
    <div aria-hidden data-avatar-preview-body="" className="flex flex-col">
      <div className="relative m-3 mb-0 flex h-[288px] items-end justify-center overflow-hidden rounded-xl bg-slate-50 pb-6 dark:bg-slate-800/60">
        {/* The ground the character stands on. */}
        <span className="absolute bottom-8 left-1/2 h-2.5 w-20 -translate-x-1/2 rounded-[50%] bg-slate-900/10 dark:bg-black/30" />
        <span className="relative flex items-end">
          {/* The Space's own 3D character (docs/specs/008-canvas/3d-engine.md "Palette portraits"). */}
          {view.behaviour && !still ? (
            <PortraitPlayer
              look={look}
              move={view.behaviour}
              status={view.status}
              width={FIGURE_W}
              height={FIGURE_H}
              fallback={sprite}
            />
          ) : (
            <FigurePortrait
              look={look}
              crop="stage"
              move={view.behaviour}
              status={view.status}
              width={FIGURE_W}
              height={FIGURE_H}
              fallback={sprite}
            />
          )}
        </span>
        {view.status === 'away' ? (
          // Away's slow Zz over the head, as the canvas draws it (a CSS loop, still under reduced motion).
          <span className="animate-avatar-zz pointer-events-none absolute top-6 left-1/2 ml-6 text-[15px] font-bold italic text-slate-500 dark:text-slate-400">
            Zz
          </span>
        ) : null}
        {view.status ? (
          <span className="absolute bottom-2 left-1/2 inline-flex max-w-[calc(100%-1rem)] -translate-x-1/2 items-center gap-1.5 truncate rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-slate-700 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-700">
            <StatusDot status={view.status} />
            <span className="text-optical-line min-w-0 truncate">
              {avatarStatusLabel(view.status)}
            </span>
          </span>
        ) : null}
        {view.burst ? (
          <ReactionBurst
            key={view.burst}
            reaction={view.burst}
            seed={seed}
            width={BURST_PX}
            height={BURST_PX}
            onDone={() => setSeed((s) => s + 1)}
          />
        ) : null}
      </div>
      <div className="flex flex-col px-3.5 pb-3 pt-2.5">
        <span className="truncate text-[13px] font-semibold leading-tight text-slate-900 dark:text-slate-50">
          {view.title}
        </span>
        <span className="text-[12px] leading-snug text-slate-500 dark:text-slate-400">
          {view.line}
        </span>
      </div>
    </div>
  );
}
