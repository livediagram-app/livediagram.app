'use client';

import { useState } from 'react';

import { elementActions, type ShapeElement } from '@livediagram/document';

import { CollabPanel } from '@/components/canvas/collab/collab-chrome';
import { CollabDoneChip } from '@/components/canvas/collab/CollabDoneChip';
import { CollabAccentScope } from '@/components/canvas/collab/collab-accent';
import { CelebrationBurst } from '@/components/canvas/collab/CelebrationBurst';
import { ActionRow } from '@/components/canvas/collab/action/ActionRow';
import { ActionGlyph, PlusGlyph } from '@/components/canvas/collab/action/action-parts';
import {
  AccentBar,
  EmptyRows,
  LOUD_ACCENT,
  stopPointer,
} from '@/components/canvas/collab/qa/qa-parts';
import { usePressWithoutDrag } from '@/hooks/ui/usePressWithoutDrag';

// The face of an Action panel (docs/specs/012-collaboration/action-panel.md): a card on the board that carries a
// LIST of assigned actions (docs/specs/012-collaboration/assigned-actions.md) and shows them in place.
//
// Like the Comment panel it carries NO action machinery of its own. The Assign
// Action dialog, complete / reopen, the Collaborate panel, the Activity page
// and the assignment email all work against the element's actions, read
// through elementActions and keyed by element id plus action id. This file is
// a layout and four callbacks.
//
// Built from the modern collab parts ("The card"): the accent scope and the
// CollabPanel frame, reflowing like the Comment panel so a resize makes room
// for more actions, a round check per row, and a dashed Add Action bar.

export function ActionPanelFace({
  element,
  label = '',
  textColor,
  surface,
  selfId,
  onAdd,
  onEdit,
  onComplete,
  onReopen,
}: {
  element: ShapeElement;
  label?: string;
  textColor: string;
  /** The card's own fill, for the accent scope. Defaults to white for tests. */
  surface?: string;
  // The current user's identity (Clerk id, else the guest participant id),
  // for "You", the rule ActionPopover uses.
  selfId: string | null;
  // Absent on a surface that cannot edit (a view-role visitor, the embed, a
  // presentation), which renders the card readable but inert.
  onAdd?: () => void;
  onEdit?: (actionId: string) => void;
  onComplete?: (actionId: string) => void;
  onReopen?: (actionId: string) => void;
}) {
  const actions = elementActions(element);
  const open = actions.filter((a) => a.status !== 'done').length;
  const allDone = actions.length > 0 && open === 0;
  // Celebrate the last action being ticked off on screen, never a card that
  // loaded finished. Actions past this index arrived after the first paint.
  const [initiallyAllDone] = useState(allDone);
  const [initialCount] = useState(actions.length);

  const aside = allDone ? (
    <CollabDoneChip>All Done</CollabDoneChip>
  ) : open > 0 ? (
    `${open} open`
  ) : undefined;

  return (
    <CollabAccentScope element={element} textColor={textColor} surface={surface ?? '#ffffff'}>
      <CollabPanel
        element={element}
        reflow
        title={label.trim() || 'Actions'}
        textColor={textColor}
        aside={aside}
        footer={
          onAdd && actions.length > 0 ? (
            <AccentBar onPress={onAdd} icon={<PlusGlyph size={12} />}>
              Add Action
            </AccentBar>
          ) : undefined
        }
      >
        {allDone && !initiallyAllDone ? (
          <span className="pointer-events-none absolute left-1/2 top-10">
            <CelebrationBurst />
          </span>
        ) : null}
        {actions.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3">
            <EmptyRows
              textColor={textColor}
              title="No Actions Yet"
              rows={0}
              glyph={<ActionGlyph size={14} />}
            >
              {onAdd ? 'Give someone a clear next step, with their name on it.' : undefined}
            </EmptyRows>
            {onAdd ? <AddButton onPress={onAdd} /> : null}
          </div>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {actions.map((action, i) => {
              const done = action.status === 'done';
              const toggle = done ? onReopen : onComplete;
              return (
                <ActionRow
                  key={action.id}
                  action={action}
                  mine={selfId !== null && action.assignee.userId === selfId}
                  textColor={textColor}
                  fresh={i >= initialCount}
                  onToggle={toggle ? () => toggle(action.id) : undefined}
                  onEdit={onEdit ? () => onEdit(action.id) : undefined}
                />
              );
            })}
          </ul>
        )}
      </CollabPanel>
    </CollabAccentScope>
  );
}

function AddButton({ onPress }: { onPress: () => void }) {
  const press = usePressWithoutDrag(onPress);
  return (
    <button
      type="button"
      {...press}
      {...stopPointer}
      className="pointer-events-auto inline-flex cursor-pointer items-center gap-1.5 rounded-full px-4 py-2 text-[12px] font-semibold transition hover:scale-[1.03] active:scale-95"
      style={LOUD_ACCENT}
    >
      <PlusGlyph size={12} />
      Add Action
    </button>
  );
}
