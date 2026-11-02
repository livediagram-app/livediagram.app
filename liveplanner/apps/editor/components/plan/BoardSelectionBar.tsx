'use client';

// The selection bar (docs/specs/026-plan/plan-board.md "Several cards at once"; blueprint plan-board.md): a row under
// a board's header while this person has cards selected on it. The count, then one button per action, each an icon with
// a tooltip, its name beside it once the board is wide enough. Every action is one write for every selected card (one
// undo step, one realtime batch). An Editor and a Participant change cards; Archive and Move to Trash are an Editor's.
import { useState, type ReactNode } from 'react';
import {
  groupMoves,
  isArchived,
  isFlagged,
  type Item,
  type ItemPatchOf,
  type PlanBoardSetup,
} from '@liveplanner/items';
import { CloseIcon, TrashIcon, Tooltip, lucideGlyph } from '@liveplanner/ui';
import {
  lucideFlag,
  lucideMoveRight,
  lucideSignal,
  lucideSlidersHorizontal,
  lucideTag,
  lucideUser,
} from '@liveworkspace/icons/lucide';
import { AnchoredPopover } from '@liveworkspace/workbench/components/primitives/AnchoredPopover';
import { track } from '@/lib/telemetry';
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';
import { moveStatusRefusal, cardsStayedMessage } from '@/hooks/plan/status-refusal';
import type { PlanContextValue } from './PlanContext';
import type { PlanPalette } from './plan-palette';
import { PlanBoardTileArt } from './plan-tile-art';
import { selectionCountLabel } from './board-selection';
import {
  archivePatches,
  assignPatches,
  fieldPatches,
  flagPatches,
  labelPatches,
  priorityPatches,
  sharedFields,
  someOffer,
} from './board-selection-edits';
import {
  AssignMenu,
  LabelsMenu,
  MoveToMenu,
  PriorityMenu,
  SetFieldMenu,
} from './SelectionBarMenus';

// The board width from which each action's name shows beside its icon.
export const SELECTION_BAR_LABELS_PX = 560;
const MENU_PX = 248;

const MoveIcon = lucideGlyph(lucideMoveRight, 16);
const AssignIcon = lucideGlyph(lucideUser, 16);
const PriorityIcon = lucideGlyph(lucideSignal, 16);
const LabelIcon = lucideGlyph(lucideTag, 16);
const FieldIcon = lucideGlyph(lucideSlidersHorizontal, 16);
const FlagIcon = lucideGlyph(lucideFlag, 16);

type Menu = 'move' | 'assign' | 'priority' | 'labels' | 'field';
const MENU_NAMES: Record<Menu, string> = {
  move: 'Move To',
  assign: 'Assign',
  priority: 'Priority',
  labels: 'Labels',
  field: 'Set Field',
};

export function BoardSelectionBar({
  plan,
  setup,
  ordered,
  palette,
  onClear,
}: {
  plan: PlanContextValue;
  setup: PlanBoardSetup;
  // The selected cards, in board reading order.
  ordered: readonly string[];
  palette: PlanPalette;
  onClear: () => void;
}) {
  const [open, setOpen] = useState<{ menu: Menu; at: HTMLElement } | null>(null);
  const selected = ordered.map((id) => plan.items.get(id)).filter((i): i is Item => !!i);
  const n = selected.length;
  const { types } = plan;
  const canRetire = plan.canEdit;
  const columnName = (s: string) =>
    setup.columns.find((c) => c.status === s)?.name ?? plan.statusNames.get(s) ?? s;

  // One write for the changes, announced; a change no card takes says so instead.
  const write = (patches: ItemPatchOf[], done: string) => {
    setOpen(null);
    if (patches.length === 0) {
      plan.announce('No selected card changed');
      return;
    }
    plan.patchItems?.(patches);
    track('Plan', 'Changed', 'Cards');
    plan.announce(done);
  };
  const cards = (k: number) => (k === 1 ? '1 card' : `${k} cards`);

  const moveTo = (status: string) => {
    setOpen(null);
    const landing: string[] = [];
    let stayed = 0;
    for (const it of selected) {
      if (moveStatusRefusal(types, it, { status }, columnName)) stayed += 1;
      else if (it.fields['status'] !== status || isArchived(it)) landing.push(it.id);
    }
    if (landing.length) {
      plan.moveItems?.(
        groupMoves(landing, { status, before: null }, (id) =>
          isArchived(plan.items.get(id)!) ? { clear: ['archived'] } : {},
        ),
      );
      track('Plan', 'Moved', 'Cards');
      plan.announce(`${cards(landing.length)} moved to ${columnName(status)}`);
    } else if (!stayed) plan.announce('No selected card changed');
    if (stayed) plan.announce(cardsStayedMessage(stayed, columnName(status)));
  };

  const toggle = (menu: Menu) => (e: React.MouseEvent<HTMLElement>) => {
    const at = e.currentTarget;
    setOpen((o) => (o?.menu === menu ? null : { menu, at }));
  };
  const allFlagged = n > 0 && selected.every(isFlagged);
  const allArchived = n > 0 && selected.every(isArchived);

  const button = (
    label: string,
    icon: ReactNode,
    onClick: (e: React.MouseEvent<HTMLElement>) => void,
    opts: { menu?: Menu; danger?: boolean } = {},
  ) => (
    <Tooltip label={label}>
      <button
        type="button"
        aria-label={label}
        {...(opts.menu
          ? { 'aria-haspopup': 'dialog' as const, 'aria-expanded': open?.menu === opts.menu }
          : {})}
        onClick={onClick}
        className="flex h-7 shrink-0 cursor-pointer items-center gap-1.5 rounded-md px-1.5 text-[12px] font-medium transition hover:bg-black/[0.06] focus-visible:outline-none focus-visible:ring-2 dark:hover:bg-white/10"
        style={{
          color: opts.danger ? '#dc2626' : palette.text,
          ['--tw-ring-color' as string]: palette.focus,
          ...(open?.menu && open.menu === opts.menu ? { backgroundColor: palette.column } : {}),
        }}
      >
        <span aria-hidden className="flex">
          {icon}
        </span>
        <span className="hidden @min-[35rem]:inline">{label}</span>
      </button>
    </Tooltip>
  );

  const fields = open?.menu === 'field' ? sharedFields(selected, types) : [];
  return (
    <div
      role="toolbar"
      aria-label="Selected cards"
      data-selection-bar
      className="@container mx-3 mb-2"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div
        className="flex flex-wrap items-center gap-x-1 gap-y-1 rounded-md border px-2 py-1"
        style={{ borderColor: palette.focus, backgroundColor: palette.column }}
      >
        <span
          aria-live="polite"
          className="mr-1 shrink-0 px-1 text-[12px] font-semibold"
          style={{ color: palette.focus }}
        >
          {selectionCountLabel(n)}
        </span>
        {button('Move To', <MoveIcon />, toggle('move'), { menu: 'move' })}
        {someOffer(selected, types, 'assignee')
          ? button('Assign', <AssignIcon />, toggle('assign'), { menu: 'assign' })
          : null}
        {someOffer(selected, types, 'priority')
          ? button('Priority', <PriorityIcon />, toggle('priority'), { menu: 'priority' })
          : null}
        {someOffer(selected, types, 'labels')
          ? button('Labels', <LabelIcon />, toggle('labels'), { menu: 'labels' })
          : null}
        {button('Set Field', <FieldIcon />, toggle('field'), { menu: 'field' })}
        {button(allFlagged ? 'Remove Flag' : 'Flag', <FlagIcon />, () =>
          write(flagPatches(selected), allFlagged ? 'Flags removed' : `${cards(n)} flagged`),
        )}
        {canRetire
          ? button(
              allArchived ? 'Restore' : 'Archive',
              <PlanBoardTileArt preset="archive" size={16} />,
              () =>
                write(
                  archivePatches(selected),
                  allArchived ? `${cards(n)} restored` : `${cards(n)} archived`,
                ),
            )
          : null}
        {canRetire
          ? button(
              'Move to Trash',
              <TrashIcon />,
              () => {
                const went = plan.trashItems(ordered);
                if (went) {
                  track('Plan', 'Changed', 'Cards');
                  plan.announce(`${cards(went)} moved to the Trash`);
                }
                onClear();
              },
              { danger: true },
            )
          : null}
        <span className="ml-auto" />
        <HelpArticleLink article="planSelectCards" />
        {button('Clear Selection', <CloseIcon />, onClear)}
      </div>
      {open ? (
        <AnchoredPopover
          anchor={open.at}
          name={MENU_NAMES[open.menu]}
          width={MENU_PX}
          onClose={() => setOpen(null)}
        >
          {open.menu === 'move' ? (
            <MoveToMenu columns={setup.columns} onPick={moveTo} />
          ) : open.menu === 'assign' ? (
            <AssignMenu
              people={plan.people}
              onPick={(p) =>
                write(
                  assignPatches(selected, types, p),
                  p ? `${cards(n)} assigned to ${p.name}` : `${cards(n)} unassigned`,
                )
              }
            />
          ) : open.menu === 'priority' ? (
            <PriorityMenu
              onPick={(p) =>
                write(priorityPatches(selected, types, p), `Priority set on ${cards(n)}`)
              }
            />
          ) : open.menu === 'labels' ? (
            <LabelsMenu
              planItems={plan.items.values()}
              selected={selected}
              onAdd={(l) =>
                write(labelPatches(selected, types, l, 'add'), `${l} added to ${cards(n)}`)
              }
              onRemove={(l) =>
                write(labelPatches(selected, types, l, 'remove'), `${l} taken off ${cards(n)}`)
              }
            />
          ) : (
            <SetFieldMenu
              fields={fields}
              people={plan.people}
              onPick={(id, v) => {
                const label = fields.find((f) => f.id === id)?.label ?? id;
                write(
                  fieldPatches(selected, types, id, v),
                  v === null ? `${label} cleared on ${cards(n)}` : `${label} set on ${cards(n)}`,
                );
              }}
            />
          )}
        </AnchoredPopover>
      ) : null}
    </div>
  );
}
