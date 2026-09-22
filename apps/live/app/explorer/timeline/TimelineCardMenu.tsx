'use client';

// The ⋯ menu on a Timeline card (spec/138 §2.8, §2.9).
//
// Two shapes behind one trigger. A card about a diagram the Explorer
// has loaded gets the same `DiagramActionsMenu` a Recent card uses, so
// whatever Recent offers a diagram, Timeline offers it too, plus
// "Remove from Timeline". Every other card — a team, a folder, a token,
// a tombstone for a diagram that no longer exists — gets a menu holding
// just that one verb, because removing a card from your own feed is
// the one thing every card can do.
//
// Controlled, not self-owned: the card's right-click has to open the
// same menu, and that handler lives on the card root rather than on
// this trigger, so useTimelineCardSlots holds "which card's menu is
// open" and both paths flip it.

import { useRef } from 'react';
import { EllipsisTriggerButton } from '@/components/primitives/EllipsisTriggerButton';
import { MenuActionRow, MenuHeader, PortalMenu } from '@/components/primitives/PortalMenu';
import { DiagramActionsMenu } from '../diagram-row-shared';
import { CloseIcon } from '../icons';
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

type Shared = {
  /** What the menu is about: the card's subject, for the header. */
  subject: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Take this card off the reader's feed (spec/138 §2.9). */
  onRemove: () => void;
};

export function TimelineCardMenu(
  props: Shared &
    (
      | { diagram: PaneDiagram; handlers: TimelineDiagramMenuHandlers }
      | { diagram?: undefined; handlers?: undefined }
    ),
) {
  const { subject, open, onOpenChange, onRemove } = props;
  const ref = useRef<HTMLButtonElement>(null);
  const close = () => onOpenChange(false);
  return (
    <>
      <EllipsisTriggerButton
        ref={ref}
        tuck
        label={`Menu for ${subject}`}
        expanded={open}
        onClick={() => onOpenChange(!open)}
      />
      {!open ? null : props.diagram ? (
        <DiagramActionsMenu
          diagram={props.diagram}
          anchor={ref.current}
          onClose={close}
          onRemoveFromTimeline={onRemove}
          {...props.handlers}
        />
      ) : (
        <PortalMenu anchor={ref.current} placement="below" onClose={close}>
          <MenuHeader title={subject} />
          <MenuActionRow
            plain
            icon={<CloseIcon />}
            label="Remove from Timeline"
            onClick={() => {
              onRemove();
              close();
            }}
          />
        </PortalMenu>
      )}
    </>
  );
}
