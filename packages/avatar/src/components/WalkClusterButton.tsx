'use client';

import type { ReactNode } from 'react';
import { HoverCard } from '@liveworkspace/ui';
import {
  CLUSTER_CONTROL_REST,
  CLUSTER_STRIP,
} from '@liveworkspace/workbench/components/canvas/cluster-strip';
import { useDockNames } from '@liveworkspace/workbench/hooks/ui/useDockNames';

// Walk in the bottom-right cluster (docs/specs/008-canvas/avatar-mode.md "The Walk button"): a Viewer's way in to Avatar
// mode and back out, since a Viewer has no palette strip and so no picker. A toggle, pressed while walking. Named
// beside its icon on a wide desktop (useDockNames), its icon alone narrower, like the cluster's other buttons. The
// icon is the product's own Avatar mode glyph, the one its picker shows.
export function WalkClusterButton({
  walking,
  onToggle,
  icon,
}: {
  walking: boolean;
  onToggle: () => void;
  icon: ReactNode;
}) {
  const named = useDockNames();
  return (
    <HoverCard
      title={walking ? 'Stop Walking' : 'Walk'}
      description={
        walking
          ? 'Leave Avatar mode and look round the board.'
          : 'Walk round the board as your character.'
      }
    >
      <div
        // The cluster's frame, its context menu kept shut like its neighbours'.
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        className={CLUSTER_STRIP}
      >
        <button
          type="button"
          data-tour-id="walk-button"
          // Keeps the press off the canvas, which would otherwise take it as a walk or a pan.
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onToggle}
          aria-label="Walk"
          aria-pressed={walking}
          className={`flex h-11 cursor-pointer items-center justify-center transition ${
            named ? 'gap-2 px-3.5 text-sm font-medium' : 'w-11'
          } ${
            walking
              ? 'bg-brand-100 text-brand-700 hover:bg-brand-200/70 dark:bg-brand-500/20 dark:text-brand-100 dark:hover:bg-brand-500/30'
              : CLUSTER_CONTROL_REST
          }`}
        >
          {icon}
          {named ? <span aria-hidden>Walk</span> : null}
        </button>
      </div>
    </HoverCard>
  );
}
