'use client';

import { isTrashed } from '@liveplanner/items';
import { useState, type SyntheticEvent } from 'react';
import { EllipsisIcon, PlanCardsIcon, TrashIcon } from '@liveplanner/ui';
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

const stopPress = (e: SyntheticEvent) => e.stopPropagation();

// Plan mode's buttons in the bottom-right cluster, one strip as Undo and Redo are, where Layers sits in the other
// modes: the **Trash** on its left (docs/specs/026-plan/items.md "Trash"; given only off a phone, to an editor),
// then **Card Types** (docs/specs/026-plan/item-types.md "The Card Types panel"). Each opens its own panel above it.
// While a card is dragged the Trash steps out of the strip as a wide drop target beside it. With no card types
// (item-types.md "The type catalogue") the Trash shows only while it holds cards (deleting the last type sends its
// cards there, to restore once a type exists). Finding a card is the editor's Search (owner, 2026-11-16: the Find a
// Card panel is gone). On a wide desktop each is named beside its icon (useDockNames), in one short word (Trash,
// Types); the accessible names and hover cards keep the fuller labels. Card Types, like the Trash, is an editor's
// (item-types.md "The Card Types panel", Share roles): a Participant's or Viewer's strip is not drawn.
export function PlanCardsClusterStrip({
  types,
  trash,
  folded = false,
}: {
  // On a phone beside the Session strip (docs/specs/012-collaboration/session-tools.md "The Session strip"): the
  // strip folds into one More Card Tools button, whose menu holds Card Types and the Trash.
  folded?: boolean;
  // The Card Types button: its panel's state and toggle. Absent (anyone but an editor), the strip has none.
  types?: { open: boolean; onToggle: (button: HTMLElement) => void } | undefined;
  // The Trash button: its panel's state and toggle. Absent, the strip has none.
  trash?: { open: boolean; onToggle: (button: HTMLElement) => void } | undefined;
}) {
  const dragging = usePlanCardDragging();
  const plan = usePlan();
  const hasTypes = (plan?.types.length ?? 1) > 0;
  const showsTrash = !!trash && (hasTypes || hasTrashed(plan?.items.values()));
  const trashInStrip = showsTrash && !dragging;
  // Nothing to show: no Card Types (a non-editor) and no Trash.
  if (!types && !showsTrash) return null;
  // The fold makes room for both buttons.
  if (folded && types)
    return (
      <FoldedPlanStrip
        rows={[
          {
            label: 'Card Types',
            icon: <PlanCardsIcon size={18} />,
            open: types.open,
            onPick: types.onToggle,
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
      />
    );
  return (
    <>
      {trash && showsTrash && dragging ? <TrashDropTarget /> : null}
      <ClusterStrip>
        {trash && trashInStrip ? (
          <TrashSegment popoverOpen={trash.open} onTogglePopover={trash.onToggle} />
        ) : null}
        {types ? (
          <ClusterPopoverSegment
            divided={trashInStrip}
            label="Open Card Types"
            hoverTitle="Card Types"
            hoverDescription="The kinds of card this plan's boards hold, and the fields each one has."
            icon={<PlanCardsIcon size={18} />}
            name="Types"
            dataTourId="card-types"
            popoverOpen={types.open}
            onTogglePopover={types.onToggle}
          />
        ) : null}
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
function FoldedPlanStrip({ rows }: { rows: FoldedRow[] }) {
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
          hoverDescription="Card Types and the Trash."
          icon={<EllipsisIcon size={18} />}
          dataTourId="card-types"
          popoverOpen={menuOpen || !!panelOpen}
          // Pressed while one of its panels is open, it closes that panel, as a panel's own button does.
          onTogglePopover={(el) =>
            panelOpen ? panelOpen.onPick(el) : setAnchor(menuOpen ? null : el)
          }
        />
      </ClusterStrip>
      {menuOpen ? (
        // A portal's events still bubble up the React tree, to the canvas under the cluster: a press on a row
        // reached it, the canvas took the focus, and the menu shut before the row's click could open its panel.
        // display: contents, so it lays out nothing; it only stops what bubbles out of the menu.
        <div className="contents" onPointerDown={stopPress}>
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
        </div>
      ) : null}
    </>
  );
}

function hasTrashed(items: Iterable<Parameters<typeof isTrashed>[0]> | undefined): boolean {
  for (const it of items ?? []) if (isTrashed(it)) return true;
  return false;
}
