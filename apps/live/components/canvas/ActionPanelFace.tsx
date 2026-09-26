'use client';

import type { ReactNode } from 'react';

import type { ShapeElement } from '@livediagram/diagram';

import { ActionMenuIcon } from '@/components/palette/context-menu-icons';
import { initialsOf } from '@/lib/identity';
import { relativeSince } from '@/lib/relative-time';

// The face of an Action panel (docs/specs/012-collaboration/action-panel.md): a card on the board that carries ONE
// assigned action (docs/specs/012-collaboration/assigned-actions.md) and shows it in place.
//
// Like the Comment panel it carries NO action machinery of its own. Every boxed
// element can already hold an `action`, and the Assign Action dialog, complete
// / reopen, the Collaborate panel, the Activity page and the assignment email
// all work against that field, keyed by element id. A panel is an element
// whose only job is to hold one and show it, so this file is a layout and
// three callbacks.

export function ActionPanelFace({
  element,
  textColor,
  selfId,
  onConfigure,
  onComplete,
  onReopen,
}: {
  element: ShapeElement;
  textColor: string;
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

  return (
    <div
      className={`absolute inset-0 flex flex-col overflow-hidden rounded-[inherit] ${
        done ? 'opacity-60' : ''
      }`}
      style={{ color: textColor }}
    >
      {/* Right padding keeps the header clear of the shared `…` settings
          button every Behaviours card carries in its top-right corner. */}
      <span className="flex w-full shrink-0 items-center gap-1.5 py-2 pl-2.5 pr-8">
        <span className="opacity-60">
          <ActionMenuIcon />
        </span>
        <span className="text-[11px] font-semibold">Action</span>
        {done ? (
          <span className="rounded bg-emerald-500/15 px-1.5 py-[1px] text-[9px] font-semibold text-emerald-700 dark:text-emerald-300">
            Done
          </span>
        ) : null}
      </span>

      {!action ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-3 pb-3 text-center">
          <span className="text-[10px] italic opacity-50">No action yet.</span>
          {onConfigure ? (
            <FaceButton onPress={onConfigure} primary>
              Set Up Action
            </FaceButton>
          ) : null}
        </div>
      ) : (
        <>
          <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-2.5 pb-1">
            <span
              className={`break-words text-[13px] font-semibold leading-snug ${
                done ? 'line-through' : ''
              }`}
            >
              {action.name}
            </span>
            {action.description ? (
              <span className="whitespace-pre-wrap break-words text-[11px] leading-snug opacity-70">
                {action.description}
              </span>
            ) : null}
          </div>
          <AssigneeRow
            name={action.assignee.name?.trim() || 'Teammate'}
            mine={selfId !== null && action.assignee.userId === selfId}
            assignerName={action.assignerName?.trim() || null}
            createdAt={action.createdAt}
          />
          {onConfigure || onComplete || onReopen ? (
            <div className="flex shrink-0 items-center gap-1.5 px-2.5 pb-2">
              {done
                ? onReopen && <FaceButton onPress={onReopen}>Reopen</FaceButton>
                : onComplete && (
                    <FaceButton onPress={onComplete} primary>
                      Complete
                    </FaceButton>
                  )}
              {onConfigure ? <FaceButton onPress={onConfigure}>Edit</FaceButton> : null}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

function AssigneeRow({
  name,
  mine,
  assignerName,
  createdAt,
}: {
  name: string;
  mine: boolean;
  assignerName: string | null;
  createdAt: number;
}) {
  return (
    <span className="mx-2.5 mb-1.5 flex shrink-0 items-center gap-2 rounded-md bg-black/[0.04] px-2 py-1.5 dark:bg-white/[0.06]">
      <span
        aria-hidden
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-500 text-[9px] font-semibold text-white"
      >
        {initialsOf(name)}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-[11px] font-medium">
          {mine ? 'Assigned to you' : `Assigned to ${name}`}
        </span>
        <span className="truncate text-[9px] opacity-55">
          {assignerName ? `by ${assignerName} · ` : ''}
          {relativeSince(createdAt)}
        </span>
      </span>
    </span>
  );
}

// A button on the card. Stops the pointer-down so pressing it never starts a
// drag of the card underneath, the Comment panel's rule for its own controls.
function FaceButton({
  onPress,
  primary = false,
  children,
}: {
  onPress: () => void;
  primary?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onPointerDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        onPress();
      }}
      className={`pointer-events-auto cursor-pointer rounded-md px-2 py-1 text-[10px] font-medium transition ${
        primary
          ? 'bg-slate-900/85 text-white hover:bg-slate-900 dark:bg-white/85 dark:text-slate-900 dark:hover:bg-white'
          : 'bg-black/[0.06] hover:bg-black/[0.1] dark:bg-white/10 dark:hover:bg-white/15'
      }`}
    >
      {children}
    </button>
  );
}
