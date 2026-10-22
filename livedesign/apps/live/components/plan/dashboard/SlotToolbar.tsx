'use client';

// A Dashboard slot's toolbar (docs/specs/026-plan/plan-tabs.md "Editing"): a row of icon buttons across the top of the
// item's cog, above its sections: **Open Tab** (a slot showing a tab, anyone), then an Editor's **Move Up** and **Move
// Down** (stacked on a phone, where no grip carries a slot), **Duplicate**, **Clear Slot** and **Remove Slot**. Clearing or removing a slot that showed a tab or held a Sheet asks first, under the
// toolbar, what goes with it (the tab, the Sheet's cells).
import { useState, type ReactNode } from 'react';
import { Button, Tooltip, lucideGlyph } from '@livepages/ui';
import {
  lucideArrowDown,
  lucideArrowUp,
  lucideCopy,
  lucideEraser,
  lucideExternalLink,
  lucideTrash2,
} from '@livepages/icons/lucide';
import {
  dashboardReadingNeighbour,
  moveDashboardSlot,
  type DashboardLayout,
  type DashboardSlot,
} from '@livepages/document';
import { useDashboard } from './dashboard-context';
import { swapSlotsWithMotion } from './slot-swap-motion';

const OpenGlyph = lucideGlyph(lucideExternalLink, 16);
const UpGlyph = lucideGlyph(lucideArrowUp, 16);
const DownGlyph = lucideGlyph(lucideArrowDown, 16);
const DuplicateGlyph = lucideGlyph(lucideCopy, 16);
const ClearGlyph = lucideGlyph(lucideEraser, 16);
const RemoveGlyph = lucideGlyph(lucideTrash2, 16);

function ToolButton({
  label,
  icon,
  onClick,
  disabled = false,
  why,
}: {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  // Why it is dimmed, in its tooltip.
  why?: string;
}) {
  return (
    <Tooltip label={disabled && why ? why : label}>
      <button
        type="button"
        aria-label={label}
        aria-disabled={disabled || undefined}
        onClick={() => {
          if (!disabled) onClick();
        }}
        // A finger's tap height on a touch screen (touch-targets.md); the row's buttons sit too close for a full pad.
        className={`touch-target-y relative flex h-8 w-8 items-center justify-center rounded-md transition ${
          disabled
            ? 'cursor-default text-slate-300 dark:text-slate-600'
            : 'cursor-pointer text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
        }`}
      >
        {icon}
      </button>
    </Tooltip>
  );
}

export function SlotToolbar({
  rowId,
  slot,
  stacked = false,
  onClose,
}: {
  rowId: string;
  slot: DashboardSlot;
  // Drawn in a phone's stack (condense.ts): Move Up and Move Down are offered.
  stacked?: boolean;
  // Closes the cog's popover.
  onClose: () => void;
}) {
  const { canEdit, actions, openTab, elements, tabs, deleteTab, releaseSheets, layout, fit } =
    useDashboard();
  const [pending, setPending] = useState<'clear' | 'remove' | null>(null);
  const content = slot.content;
  const tabId = content?.type === 'tab' ? content.tabId : null;
  const el =
    content?.type === 'element'
      ? (elements.get(content.elementId) as
          { shape?: string; planSheet?: { sheetId?: string } } | undefined)
      : undefined;
  const sheetId = el?.shape === 'plan-sheet' ? el.planSheet?.sheetId : undefined;
  const shownTab = tabId ? tabs.find((t) => t.id === tabId) : undefined;
  if (!tabId && !canEdit) return null;
  const also =
    shownTab && deleteTab
      ? {
          question: `Delete the ${shownTab.name} tab too? Kept, it stays in the tab bar.`,
          keep: 'Keep the Tab',
          remove: 'Delete the Tab Too',
        }
      : sheetId && releaseSheets
        ? {
            question: 'Delete this sheet’s cells too? Kept, they stay in this document.',
            keep: 'Keep Its Cells',
            remove: 'Delete the Sheet Too',
          }
        : null;
  const act = (which: 'clear' | 'remove') =>
    which === 'clear'
      ? actions.setSlotContent(slot.id, undefined)
      : actions.removeSlot(rowId, slot.id);
  const start = (which: 'clear' | 'remove') => {
    if (also && content) {
      setPending(which);
      return;
    }
    onClose();
    act(which);
  };
  const finish = (andMore: boolean) => {
    const which = pending;
    setPending(null);
    onClose();
    if (!which) return;
    act(which);
    if (!andMore) return;
    if (shownTab) deleteTab?.(shownTab.id);
    else if (sheetId) releaseSheets?.([sheetId]);
  };
  // Duplicate: nothing to copy in an empty slot, and a Sheet element would share its sheet with the copy.
  const duplicateWhy = !content
    ? 'Nothing to duplicate in an empty slot'
    : sheetId
      ? 'A Sheet can’t be duplicated into a slot; show its tab again instead'
      : null;
  // Up or down the stack: the slot swaps what it holds with the one before or after it in reading order, as the grip's
  // drop on a slot does (spans stay). Not offered past either end, nor where the swap would squeeze either slot. The two
  // cards glide past each other (slot-swap-motion.ts).
  const swapWith = (dir: 'previous' | 'next') => {
    const to = layout ? dashboardReadingNeighbour(layout, slot.id, dir) : null;
    if (!to) return null;
    const swap = (l: DashboardLayout) =>
      moveDashboardSlot(l, slot.id, { kind: 'slot', slotId: to }, newId);
    return fit && !fit.keeps(swap) ? null : { to, swap };
  };
  const move = (target: { to: string; swap: (l: DashboardLayout) => DashboardLayout }) => {
    // What it held moves away from this cog: the cog closes, as after a Duplicate.
    onClose();
    swapSlotsWithMotion(slot.id, target.to, () =>
      actions.changeDashboard(target.swap, 'DashboardSlot'),
    );
  };
  const up = stacked && canEdit ? swapWith('previous') : null;
  const down = stacked && canEdit ? swapWith('next') : null;
  return (
    <div className="border-b border-slate-100 dark:border-slate-800">
      <div role="toolbar" aria-label="Slot" className="flex items-center gap-0.5 px-2 py-1">
        {tabId ? (
          <ToolButton
            label="Open Tab"
            icon={<OpenGlyph />}
            onClick={() => {
              onClose();
              openTab(tabId);
            }}
          />
        ) : null}
        {canEdit && stacked ? (
          <>
            <ToolButton
              label="Move Up"
              icon={<UpGlyph />}
              disabled={!up}
              why="Nothing above to swap with"
              onClick={() => up && move(up)}
            />
            <ToolButton
              label="Move Down"
              icon={<DownGlyph />}
              disabled={!down}
              why="Nothing below to swap with"
              onClick={() => down && move(down)}
            />
            {/* Moving is set apart from the slot's own verbs. */}
            <span
              aria-hidden
              data-toolbar-separator
              className="mx-1 h-5 w-px bg-slate-200 dark:bg-slate-700"
            />
          </>
        ) : null}
        {canEdit ? (
          <>
            <ToolButton
              label="Duplicate Slot"
              icon={<DuplicateGlyph />}
              disabled={!!duplicateWhy}
              {...(duplicateWhy ? { why: duplicateWhy } : {})}
              onClick={() => {
                onClose();
                actions.duplicateSlot(rowId, slot.id);
              }}
            />
            <ToolButton
              label="Clear Slot"
              icon={<ClearGlyph />}
              disabled={!content}
              why="The slot is empty already"
              onClick={() => start('clear')}
            />
            <ToolButton
              label="Remove Slot"
              icon={<RemoveGlyph />}
              onClick={() => start('remove')}
            />
          </>
        ) : null}
      </div>
      {pending && also ? (
        // What goes with the slot (plan-tabs.md "Clearing a slot"): the tab it showed, or its Sheet's cells.
        <div
          role="group"
          aria-label={pending === 'clear' ? 'Clear Slot' : 'Remove Slot'}
          className="px-3 pb-3 pt-1"
        >
          <p className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">
            {pending === 'clear' ? 'Clear Slot' : 'Remove Slot'}
          </p>
          <p className="mt-1 text-[12px] leading-snug text-slate-500 dark:text-slate-400">
            {also.question}
          </p>
          <div className="mt-3 flex flex-col gap-1.5">
            <Button variant="secondary" size="sm" onClick={() => finish(false)}>
              {also.keep}
            </Button>
            <Button size="sm" onClick={() => finish(true)}>
              {also.remove}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setPending(null)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const newId = () => crypto.randomUUID();
