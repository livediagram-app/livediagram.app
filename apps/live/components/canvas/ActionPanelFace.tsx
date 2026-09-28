'use client';

import { useState } from 'react';

import type { ShapeElement } from '@livediagram/diagram';

import { CollabPanel } from '@/components/canvas/collab/collab-chrome';
import { CollabAccentScope } from '@/components/canvas/collab/collab-accent';
import { CelebrationBurst } from '@/components/canvas/collab/CelebrationBurst';
import { ActionAssignee } from '@/components/canvas/collab/action/ActionAssignee';
import {
  ActionGlyph,
  CompleteButton,
  EditButton,
  StatusChip,
} from '@/components/canvas/collab/action/action-parts';
import {
  EmptyRows,
  QA_ACCENT,
  QA_ON_ACCENT,
  stopPointer,
} from '@/components/canvas/collab/qa/qa-parts';
import { usePressWithoutDrag } from '@/hooks/ui/usePressWithoutDrag';

// The face of an Action panel (docs/specs/012-collaboration/action-panel.md): a card on the board that carries ONE
// assigned action (docs/specs/012-collaboration/assigned-actions.md) and shows it in place.
//
// Like the Comment panel it carries NO action machinery of its own. Every boxed
// element can already hold an `action`, and the Assign Action dialog, complete
// / reopen, the Collaborate panel, the Activity page and the assignment email
// all work against that field, keyed by element id. A panel is an element
// whose only job is to hold one and show it, so this file is a layout and
// three callbacks.
//
// Built from the modern collab parts ("The card"): the accent scope and the
// CollabPanel frame, the action's name as the title (the Decision record's
// treatment), and one loud act in the footer.

export function ActionPanelFace({
  element,
  textColor,
  surface,
  selfId,
  onConfigure,
  onComplete,
  onReopen,
}: {
  element: ShapeElement;
  textColor: string;
  /** The card's own fill, for the accent scope. Defaults to white for tests. */
  surface?: string;
  // The current user's identity (Clerk id, else the guest participant id),
  // for "Assigned to you", the rule ActionPopover uses.
  selfId: string | null;
  // Absent on a surface that cannot edit (a view-role visitor, the embed, a
  // presentation), which renders the card readable but inert.
  onConfigure?: () => void;
  onComplete?: () => void;
  onReopen?: () => void;
}) {
  const action = element.action;
  const done = action?.status === 'done';
  // Celebrate a completion seen on screen, never a card that loaded done.
  const [initiallyDone] = useState(done);

  if (!action) {
    return (
      <CollabAccentScope element={element} textColor={textColor} surface={surface ?? '#ffffff'}>
        <CollabPanel element={element} title="Action" textColor={textColor}>
          <div className="flex flex-1 flex-col items-center justify-center gap-3">
            <EmptyRows
              textColor={textColor}
              title="No Action Yet"
              rows={0}
              glyph={<ActionGlyph size={14} />}
            >
              {onConfigure ? 'Give someone a clear next step, with their name on it.' : undefined}
            </EmptyRows>
            {onConfigure ? <SetUpButton onPress={onConfigure} /> : null}
          </div>
        </CollabPanel>
      </CollabAccentScope>
    );
  }

  const canAct = done ? onReopen : onComplete;
  return (
    <CollabAccentScope element={element} textColor={textColor} surface={surface ?? '#ffffff'}>
      <CollabPanel
        element={element}
        title={action.name}
        titleLines={2}
        titleSize={15}
        textColor={textColor}
        aside={<StatusChip done={done} />}
        titleStruck={done}
        footer={
          canAct || onConfigure ? (
            <div className="relative flex w-full items-center gap-2">
              {canAct ? (
                <CompleteButton done={done} onPress={canAct} textColor={textColor} />
              ) : null}
              {onConfigure ? <EditButton onPress={onConfigure} textColor={textColor} /> : null}
              {done && !initiallyDone ? <CelebrationBurst /> : null}
            </div>
          ) : undefined
        }
      >
        {action.description ? (
          <p
            className="whitespace-pre-wrap break-words text-[11.5px] leading-snug"
            style={{ color: textColor, opacity: done ? 0.45 : 0.7 }}
          >
            {action.description}
          </p>
        ) : null}
        <div className="mt-auto">
          <ActionAssignee
            name={action.assignee.name?.trim() || 'Teammate'}
            mine={selfId !== null && action.assignee.userId === selfId}
            assignerName={action.assignerName?.trim() || null}
            createdAt={action.createdAt}
            textColor={textColor}
            done={done}
          />
        </div>
      </CollabPanel>
    </CollabAccentScope>
  );
}

function SetUpButton({ onPress }: { onPress: () => void }) {
  const press = usePressWithoutDrag(onPress);
  return (
    <button
      type="button"
      {...press}
      {...stopPointer}
      className="pointer-events-auto cursor-pointer rounded-full px-4 py-2 text-[12px] font-semibold transition hover:scale-[1.03] active:scale-95"
      style={{
        color: QA_ON_ACCENT,
        backgroundColor: QA_ACCENT,
        boxShadow: `0 8px 16px -10px ${QA_ACCENT}`,
      }}
    >
      Set Up Action
    </button>
  );
}
