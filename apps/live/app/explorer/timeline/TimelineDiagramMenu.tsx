'use client';

// The ⋯ menu on a Timeline diagram card (spec/138 §2.8): the same
// trigger and the same `DiagramActionsMenu` a Recent card uses, so
// whatever Recent offers a diagram, Timeline offers it too.
//
// Controlled, not self-owned: the card's right-click has to open the
// same menu, and that handler lives on the card root rather than on
// this trigger, so useTimelineCardSlots holds "which card's menu is
// open" and both paths flip it.

import { useRef } from 'react';
import { EllipsisTriggerButton } from '@/components/primitives/EllipsisTriggerButton';
import { DiagramActionsMenu } from '../diagram-row-shared';
import type { PaneDiagram } from '../views';

export type TimelineDiagramMenuHandlers = {
  ownerId: string | null;
  onStartRename: () => void;
  onDuplicate: () => void;
  onMove: (anchor: HTMLElement | null) => void;
  onDelete: () => void;
  onDismiss?: () => void;
  favourite?: boolean;
  onToggleFavourite?: () => void;
  recentExcluded?: boolean;
  onToggleRecentExclusion?: () => void;
  onShowHistory?: () => void;
};

export function TimelineDiagramMenu({
  diagram,
  open,
  onOpenChange,
  ...handlers
}: {
  diagram: PaneDiagram;
  open: boolean;
  onOpenChange: (open: boolean) => void;
} & TimelineDiagramMenuHandlers) {
  const ref = useRef<HTMLButtonElement>(null);
  return (
    <>
      <EllipsisTriggerButton
        ref={ref}
        tuck
        label={`Menu for ${diagram.name}`}
        expanded={open}
        onClick={() => onOpenChange(!open)}
      />
      {open ? (
        <DiagramActionsMenu
          diagram={diagram}
          anchor={ref.current}
          onClose={() => onOpenChange(false)}
          {...handlers}
        />
      ) : null}
    </>
  );
}
