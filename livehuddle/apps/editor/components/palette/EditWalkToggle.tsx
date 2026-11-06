'use client';

// The Edit | Walk toggle (docs/specs/008-canvas/avatar-mode.md "The Edit | Walk toggle"): an Editor's one switch
// between building the board and walking it as a character, first on whichever strip shows (the building strip with
// Edit on, the avatar palette with Walk on, or alone on a locked tab). Two segments on the segmented track, the brand
// pill sliding to the side that is on; named beside their glyphs on a desktop, glyphs alone on a phone.
// `walkBlockedReason` greys Walk while something in front of the canvas holds the walk ("Not over a start"): it stays
// put, says why in its tooltip, and a press does nothing. Edit is never greyed, so leaving the walk always works.
import type { ReactNode } from 'react';
import { ACTIVE_SEGMENT, HoverCard, SEGMENT_REST, SEGMENT_TRACK } from '@livehuddle/ui';
import { SegmentSlider } from '@liveworkspace/workbench/components/primitives/SegmentSlider';
import { useIsMobileViewport } from '@liveworkspace/workbench/hooks/ui/useIsMobileViewport';
import { useUiScale } from '@liveworkspace/workbench/components/providers/ui-scale';
import { AvatarModeIcon, SelectIcon } from './palette-icons';
import { CARD_CLASS, stripRootLayout } from './ToolbarPalette';

export type EditWalkSide = 'edit' | 'walk';

// What each side's tooltip says, and its key (left out on a phone, which has no keyboard to speak of).
export function editWalkHint(side: EditWalkSide, mobile: boolean): string {
  const what =
    side === 'edit' ? 'Select and build the board.' : 'Walk round the board as your character.';
  return mobile ? what : `${what} Shortcut: ${side === 'edit' ? 'E' : 'W'}.`;
}

const SEGMENT =
  'relative z-10 flex h-8 touch-target-y items-center justify-center gap-1.5 rounded-md text-[13px] font-medium leading-none transition-colors duration-micro focus-visible:outline-2 focus-visible:outline-brand-600';
const BLOCKED = 'cursor-not-allowed text-slate-300 dark:text-slate-600';

export function EditWalkToggle({
  walking,
  onEdit,
  onWalk,
  walkBlockedReason,
}: {
  walking: boolean;
  onEdit: () => void;
  onWalk: () => void;
  walkBlockedReason?: string | undefined;
}) {
  const mobile = useIsMobileViewport();
  const named = !mobile;
  const blocked = !walking && !!walkBlockedReason;
  const side = (
    id: EditWalkSide,
    label: string,
    icon: ReactNode,
    on: boolean,
    run: () => void,
    blockedHere = false,
  ) => (
    <HoverCard title={label} description={blockedHere ? walkBlockedReason : editWalkHint(id, mobile)}>
      <button
        type="button"
        data-edit-walk={id}
        aria-label={label}
        aria-pressed={on}
        // aria-disabled, not disabled, so the pointer still reaches the tooltip that says why.
        aria-disabled={blockedHere || undefined}
        aria-keyshortcuts={mobile ? undefined : id === 'edit' ? 'E' : 'W'}
        onClick={() => {
          if (on || blockedHere) return;
          run();
        }}
        className={`${SEGMENT} ${named ? 'pl-2 pr-2.5' : 'w-9 phone:w-11'} ${
          on ? 'cursor-default text-white' : blockedHere ? BLOCKED : `cursor-pointer ${SEGMENT_REST}`
        }`}
      >
        <span aria-hidden className="flex h-4 w-4 items-center justify-center">
          {icon}
        </span>
        {named ? <span aria-hidden>{label}</span> : null}
      </button>
    </HoverCard>
  );
  return (
    <div
      role="group"
      aria-label="Edit or Walk"
      data-edit-walk-toggle=""
      data-tour-id="edit-walk"
      className={`relative grid shrink-0 grid-cols-2 rounded-lg p-0.5 ${SEGMENT_TRACK}`}
    >
      <SegmentSlider count={2} index={walking ? 1 : 0} className={ACTIVE_SEGMENT} />
      {side('edit', 'Edit', <SelectIcon size={16} />, !walking, onEdit)}
      {side('walk', 'Walk', <AvatarModeIcon size={16} />, walking, onWalk, blocked)}
    </div>
  );
}

// The toggle alone in the strip's card, where an Editor has no strip (a locked tab): same place, same card, so walking
// is one press away there too. Measured as the strip by what clears it (`data-toolbar-palette`).
export function EditWalkStrip({ children }: { children: ReactNode }) {
  const scale = useUiScale('toolbar');
  return (
    <div
      data-toolbar-palette=""
      data-region="palette"
      {...stripRootLayout({ scale, crowded: false, popoverOpen: false })}
      onPointerDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <div data-tour-id="palette" data-floating-panel="" data-split-chrome="" className={CARD_CLASS}>
        {children}
      </div>
    </div>
  );
}
