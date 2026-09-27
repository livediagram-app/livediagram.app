'use client';

import { useId } from 'react';
import { PencilIcon, Tooltip } from '@livediagram/ui';
import { EyeIcon } from '@/components/panels/layers-panel-icons';

// Whether you are editing or viewing this diagram, in two shapes
// (docs/specs/007-editor/live-app.md#role-pill): the title bar's pill, and Minimal chrome's
// status bar icon (docs/specs/007-editor/power-user-mode.md). Both toggle the local view
// preview when `onToggle` is given, i.e. when your role allows editing.

export type Role = 'edit' | 'view';

const ROLE_WORD: Record<Role, string> = { edit: 'Editing', view: 'Viewing' };
const TOGGLE_HINT: Record<Role, string> = {
  edit: 'Switch to viewing (read-only)',
  view: 'Switch to editing',
};

// The word sits in text-optical-line + text-optical-caps (optical-alignment.md), so the pill carries no case.
const PILL = 'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold';
const PILL_TONE: Record<Role, string> = {
  edit: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200',
  view: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200',
};
const PILL_TOGGLE_TONE: Record<Role, string> = {
  edit: 'cursor-pointer ring-emerald-300 transition hover:ring-1 dark:ring-emerald-500/40',
  view: 'cursor-pointer ring-amber-300 transition hover:ring-1 dark:ring-amber-500/40',
};

export function roleOwnerLabel(ownerName: string | null, isSelf: boolean): string {
  if (isSelf) return 'Owned by you';
  return ownerName ? `Owned by ${ownerName}` : '';
}

export function RolePill({
  role,
  ownerName,
  isSelf,
  onToggle,
}: {
  role: Role;
  ownerName: string | null;
  isSelf: boolean;
  onToggle?: () => void;
}) {
  const hintId = useId();
  const owner = roleOwnerLabel(ownerName, isSelf);
  const word = ROLE_WORD[role];
  const pill = onToggle ? (
    <button
      type="button"
      onClick={onToggle}
      aria-label={owner ? `${word}. ${owner}` : word}
      aria-describedby={hintId}
      data-role-pill={role}
      className={`${PILL} ${PILL_TONE[role]} ${PILL_TOGGLE_TONE[role]}`}
    >
      <span className="text-optical-line text-optical-caps">{word}</span>
      <span id={hintId} className="sr-only">
        {TOGGLE_HINT[role]}
      </span>
    </button>
  ) : (
    // Static for a view-link visitor, and focusable so the Tooltip naming the
    // owner can be reached by keyboard too.
    <span tabIndex={0} data-role-pill={role} className={`${PILL} ${PILL_TONE[role]}`}>
      <span className="text-optical-line text-optical-caps">{word}</span>
      {owner ? <span className="sr-only">{`. ${owner}`}</span> : null}
    </span>
  );
  return owner ? <Tooltip label={owner}>{pill}</Tooltip> : pill;
}

const ICON_LABEL: Record<Role, string> = { edit: 'Editing', view: 'Viewing (read-only)' };
// The status bar control's box (chrome-button's CHROME_BTN), in the role's own
// colour rather than the bar's slate.
const ICON_BOX =
  'flex h-7 min-w-7 shrink-0 items-center justify-center rounded-md transition hover:bg-slate-100 dark:hover:bg-slate-800';
const ICON_TONE: Record<Role, string> = {
  edit: 'text-emerald-700 dark:text-emerald-300',
  view: 'text-amber-700 dark:text-amber-300',
};

// Minimal chrome's stand-in for the pill: first in the status bar.
export function RoleStatusIcon({ role, onToggle }: { role: Role; onToggle?: () => void }) {
  const label = ICON_LABEL[role];
  const glyph = role === 'edit' ? <PencilIcon size={14} /> : <EyeIcon />;
  const content = onToggle ? (
    <button
      type="button"
      onClick={onToggle}
      aria-label={label}
      data-role-icon={role}
      className={`${ICON_BOX} ${ICON_TONE[role]}`}
    >
      {glyph}
    </button>
  ) : (
    <span
      role="img"
      tabIndex={0}
      aria-label={label}
      data-role-icon={role}
      className={`${ICON_BOX} ${ICON_TONE[role]}`}
    >
      {glyph}
    </span>
  );
  return <Tooltip label={label}>{content}</Tooltip>;
}
