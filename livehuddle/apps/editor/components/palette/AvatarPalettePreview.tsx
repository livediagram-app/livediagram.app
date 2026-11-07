'use client';

import { useEffect, useState } from 'react';
import { AvatarSprite } from '@liveworkspace/avatar/components/avatar-sprite';
import { StatusDot } from '@liveworkspace/avatar/components/AvatarWalker';
import type { AvatarConfig } from '@liveworkspace/avatar/config';
import {
  reactionDuration,
  reactionPose,
  type AvatarReactionKind,
  type ReactionPose,
} from '@liveworkspace/avatar/reactions';
import { avatarStatusLabel, type AvatarStatus } from '@liveworkspace/avatar/status';
import { prefersReducedMotion } from '@livehuddle/ui';
import { ReactionBurst } from '@/components/canvas/ReactionBurst';
import { behaviourStill } from '@/lib/avatar-palette';
import { previewView, useAvatarPreview } from '@/lib/avatar-preview';

// The avatar palette's preview card (docs/specs/008-canvas/avatar-mode.md "The preview, beside the flyout"): your
// character large, wearing whatever option the pointer or the focus is on, playing the move or throwing the burst
// it names, and a caption saying what is shown. The card's surface and place are the host's (AvatarPalette); this is
// its body. Hidden from assistive tech: every option already says what it is.

// The figure's scale: the flyout's portrait (1.4) made large.
const SCALE = 2;
// The pause between two plays of a Behaviour, so the loop reads as the move done again rather than one long dance.
const LOOP_REST_MS = 500;
// The footprint a preview burst is scaled to. A burst flies out about twice its footprint each side (ReactionBurst's
// overscan), so in a card this small a small footprint keeps the particles inside the stage.
const BURST_PX = 56;

/** A Behaviour's pose, played on a loop while it is previewed: its still pose under reduced motion. */
function useLoopingPose(kind: AvatarReactionKind | null): ReactionPose | null {
  const [pose, setPose] = useState<ReactionPose | null>(null);
  useEffect(() => {
    if (!kind) return;
    // Read when the preview starts, outside render: the in-app setting or the system's. Reduced motion holds the
    // still pose from the first frame on; otherwise the move plays on a loop.
    const still = prefersReducedMotion();
    const period = reactionDuration(kind) + LOOP_REST_MS;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      if (still) {
        setPose(behaviourStill(kind));
        return;
      }
      const p = reactionPose(kind, (now - start) % period);
      setPose(p.done ? null : p);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      setPose(null);
    };
  }, [kind]);
  return kind ? pose : null;
}

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
  const pose = useLoopingPose(view.behaviour);
  // A new seed when a burst ends, so it is thrown again for as long as it is previewed.
  const [seed, setSeed] = useState(1);
  return (
    <div aria-hidden data-avatar-preview-body="" className="flex flex-col">
      <div className="relative m-3 mb-0 flex h-56 items-end justify-center overflow-hidden rounded-xl bg-slate-50 pb-9 dark:bg-slate-800/60">
        {/* The ground the character stands on. */}
        <span className="absolute bottom-8 left-1/2 h-2.5 w-20 -translate-x-1/2 rounded-[50%] bg-slate-900/10 dark:bg-black/30" />
        <span
          className="relative flex items-end"
          style={{
            ...(pose?.lift ? { transform: `translateY(${-pose.lift * SCALE * 0.5}px)` } : {}),
            // Away fades the character to half, as on the canvas (AvatarWalker).
            ...(view.status === 'away' ? { opacity: 0.5 } : {}),
          }}
        >
          <AvatarSprite
            facing={pose?.facing ?? 'down'}
            config={view.config}
            walking={false}
            stepFrame={0}
            lift={0}
            wave={null}
            shirt={shirt}
            scale={SCALE}
            pose={pose}
            headphones={view.status === 'focus'}
            status={view.status}
            portrait
          />
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
            {avatarStatusLabel(view.status)}
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
