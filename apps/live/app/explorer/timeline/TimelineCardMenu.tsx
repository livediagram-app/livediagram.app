'use client';

// The ⋯ menu on a Timeline card (spec/138 §2.8, §2.9).
//
// Three shapes behind one trigger. A card about a diagram the Explorer
// has loaded gets the same `DiagramActionsMenu` a Recent card uses, and
// a card about a folder the Explorer has loaded gets the same
// `FolderActionsMenu` a folder card uses — so whatever the Explorer
// offers the thing, Timeline offers it too — each with "Remove from
// Timeline" added. Every other card (a team, a token, a tombstone for
// something that no longer exists, a stack) gets a menu holding just
// that one verb, because removing a card from your own feed is the one
// thing every card can do.
//
// Controlled, not self-owned: the card's right-click has to open the
// same menu, and that handler lives on the card root rather than on
// this trigger, so the slot hooks hold "which card's menu is open" and
// both paths flip it.

import { useRef } from 'react';
import { EllipsisTriggerButton } from '@/components/primitives/EllipsisTriggerButton';
import { MenuActionRow, MenuHeader, PortalMenu } from '@/components/primitives/PortalMenu';
import { DiagramActionsMenu } from '../diagram-row-shared';
import { FolderActionsMenu } from '../folder-actions-menu';
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

// The folder verbs, built against the menu's own trigger: Change
// Folder anchors its picker to whatever opened the menu.
export type TimelineFolderMenuHandlers = (anchor: HTMLElement | null) => {
  onRename: () => void;
  onNewSubfolder: () => void;
  onMove: () => void;
  onDelete: () => void;
};

type Shared = {
  /** What the menu is about: the card's subject, for the header. */
  subject: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Take this card off the reader's feed (spec/138 §2.9). */
  onRemove: () => void;
};

type Shape =
  | { diagram: PaneDiagram; handlers: TimelineDiagramMenuHandlers; folder?: undefined }
  | {
      folder: { id: string; name: string };
      folderHandlers: TimelineFolderMenuHandlers;
      diagram?: undefined;
    }
  | { diagram?: undefined; folder?: undefined };

export function TimelineCardMenu(props: Shared & Shape) {
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
      ) : props.folder ? (
        <FolderActionsMenu
          folder={props.folder}
          anchor={ref.current}
          onClose={close}
          onRemoveFromTimeline={onRemove}
          {...props.folderHandlers(ref.current)}
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
