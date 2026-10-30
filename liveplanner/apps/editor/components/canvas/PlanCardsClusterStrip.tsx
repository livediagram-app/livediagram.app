'use client';

import { isTrashed } from '@liveplanner/items';
import { useState } from 'react';
import { EllipsisIcon, PlanCardsIcon, SearchIcon, TrashIcon } from '@liveplanner/ui';
import {
  MenuActionRow,
  PortalMenu,
} from '@liveworkspace/workbench/components/primitives/PortalMenu';
import {
  ClusterPopoverSegment,
  ClusterStrip,
} from '@liveworkspace/workbench/components/canvas/ClusterPopoverButton';
import { TrashDropTarget, TrashSegment, usePlanCardDragging } from './TrashClusterButton';
import { usePlan } from '@/components/plan/PlanContext';

// Plan mode's buttons in the bottom-right cluster, one strip as Undo and Redo are, where Layers sits in the other
// modes: the **Trash** on its left (docs/specs/026-plan/items.md "Trash"; given only off a phone, to an editor),
// then **Find a Card** (items.md "Finding a card"), the search over every card in the project, then **Card
// Types** (docs/specs/026-plan/item-types.md "The Card Types panel"). Each opens its own panel above it. While a
// card is dragged the Trash steps out of the strip as a wide drop target beside it. With no card types
// (item-types.md "The type catalogue") Find a Card would surface nothing, so only Card Types shows, and
// the Trash while it holds cards (deleting the last type sends its cards there, to restore once a type exists).
// On a wide desktop each is named beside its icon (useDockNames), as the other strips' buttons are, in one short
// word (Trash, Find, Types); the accessible names and hover cards keep the fuller labels, which contain them.
export function PlanCardsClusterStrip({
  finderOpen,
  onToggleFinder,
  typesOpen,
  onToggleTypes,
  typesButtonRef,
  trash,
  folded = false,
}: {
  // On a phone beside the Session strip (docs/specs/012-collaboration/session-tools.md "The Session strip"): the
  // strip folds into one More Card Tools button, whose menu holds Find a Card, Card Types and the Trash.
  folded?: boolean;
  finderOpen: boolean;
  onToggleFinder: (button: HTMLElement) => void;
  typesOpen: boolean;
  onToggleTypes: (button: HTMLElement) => void;
  // The Card Types button, for a caller that opens its panel from elsewhere.
  typesButtonRef?: React.Ref<HTMLButtonElement>;
  // The Trash button: its panel's state and toggle. Absent, the strip has none.
  trash?: { open: boolean; onToggle: (button: HTMLElement) => void } | undefined;
}) {
  const dragging = usePlanCardDragging();
  const plan = usePlan();
  const hasTypes = (plan?.types.length ?? 1) > 0;
  const showsTrash = !!trash && (hasTypes || hasTrashed(plan?.items.values()));
  const trashInStrip = showsTrash && !dragging;
  if (folded)
    return (
      <FoldedPlanStrip
        rows={[
          ...(hasTypes
            ? [
                {
                  label: 'Find a Card',
                  icon: <SearchIcon size={18} />,
                  open: finderOpen,
                  onPick: onToggleFinder,
                },
              ]
            : []),
          {
            label: 'Card Types',
            icon: <PlanCardsIcon size={18} />,
            open: typesOpen,
            onPick: onToggleTypes,
          },
          ...(trash && showsTrash
            ? [
                {
                  label: 'Trash',
                  icon: <TrashIcon size={18} />,
                  open: trash.open,
                  onPick: trash.onToggle,
                },
              ]
            : []),
        ]}
        buttonRef={typesButtonRef}
      />
    );
  return (
    <>
      {trash && showsTrash && dragging ? <TrashDropTarget /> : null}
      <ClusterStrip>
        {trash && trashInStrip ? (
          <TrashSegment popoverOpen={trash.open} onTogglePopover={trash.onToggle} />
        ) : null}
        {hasTypes ? (
          <ClusterPopoverSegment
            // A divider when the Trash sits to its left.
            divided={trashInStrip}
            label="Find a Card"
            hoverTitle="Cards"
            hoverDescription="Every card in this plan: search them, find the ones on no board, and open any of them."
            icon={<SearchIcon size={18} />}
            name="Find"
            popoverOpen={finderOpen}
            onTogglePopover={onToggleFinder}
          />
        ) : null}
        <ClusterPopoverSegment
          divided={hasTypes || trashInStrip}
          label="Open Card Types"
          hoverTitle="Card Types"
          hoverDescription="The kinds of card this plan's boards hold, and the fields each one has."
          icon={<PlanCardsIcon size={18} />}
          name="Types"
          dataTourId="card-types"
          popoverOpen={typesOpen}
          onTogglePopover={onToggleTypes}
          {...(typesButtonRef ? { buttonRef: typesButtonRef } : {})}
        />
      </ClusterStrip>
    </>
  );
}

type FoldedRow = {
  label: string;
  icon: React.ReactNode;
  open: boolean;
  onPick: (button: HTMLElement) => void;
};

// The Plan strip folded into one button, for a phone whose cluster row has no room for its three (the strip's
// panels open above that button, as they would above their own). Lit while its menu or any of its panels is open.
function FoldedPlanStrip({
  rows,
  buttonRef,
}: {
  rows: FoldedRow[];
  buttonRef?: React.Ref<HTMLButtonElement> | undefined;
}) {
  // The button the menu hangs from, taken from its press; null while the menu is shut.
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const menuOpen = anchor !== null;
  const panelOpen = rows.find((r) => r.open);
  return (
    <>
      <ClusterStrip>
        <ClusterPopoverSegment
          label="More card tools"
          hoverTitle="Cards"
          hoverDescription="Find a Card, Card Types and the Trash."
          icon={<EllipsisIcon size={18} />}
          dataTourId="card-types"
          popoverOpen={menuOpen || !!panelOpen}
          // Pressed while one of its panels is open, it closes that panel, as a panel's own button does.
          onTogglePopover={(el) =>
            panelOpen ? panelOpen.onPick(el) : setAnchor(menuOpen ? null : el)
          }
          {...(buttonRef ? { buttonRef } : {})}
        />
      </ClusterStrip>
      {menuOpen ? (
        <PortalMenu
          anchor={anchor}
          placement="above"
          onClose={() => setAnchor(null)}
          initialFocus="first"
        >
          {rows.map((row) => (
            <MenuActionRow
              key={row.label}
              plain
              label={row.label}
              icon={row.icon}
              onClick={() => {
                setAnchor(null);
                row.onPick(anchor);
              }}
            />
          ))}
        </PortalMenu>
      ) : null}
    </>
  );
}

function hasTrashed(items: Iterable<Parameters<typeof isTrashed>[0]> | undefined): boolean {
  for (const it of items ?? []) if (isTrashed(it)) return true;
  return false;
}
