'use client';

import { useId } from 'react';
import { Tooltip } from '@livedesign/ui';
import type { AccessLevel } from '@livedesign/api-schema';

// Whether you are editing, participating in or viewing this design
// (docs/specs/013-workspace/share-roles.md): the title bar's pill (docs/specs/007-editor/live-app.md#role-pill). It
// steps the local preview (Editing, Participating, Viewing, back to Editing) when `onToggle` is given, i.e. when your
// role allows editing. A Participant's pill is static, as a Viewer's.

export type Role = AccessLevel;

const ROLE_WORD: Record<Role, string> = {
  edit: 'Editing',
  participate: 'Participating',
  view: 'Viewing',
};
// What a press does, for someone whose role allows editing: the next step of Editing, Participating, Viewing.
const TOGGLE_HINT: Record<Role, string> = {
  edit: 'Switch to participating (as a Participant sees it)',
  participate: 'Switch to viewing (read-only)',
  view: 'Switch to editing',
};

// The word sits in text-optical-line + text-optical-caps (optical-alignment.md), so the pill carries no case. Pinned to
// the visibility badge's height with a resting ring like it, so the two pills beside the title read as a pair.
// h-[19px] is STATE_CHIP_HEIGHT_PX, written out so Tailwind sees the class.
const PILL = 'inline-flex h-[19px] items-center rounded-full px-2 text-[10px] font-semibold ring-1';
const PILL_TONE: Record<Role, string> = {
  edit: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30',
  participate:
    'bg-teal-50 text-teal-700 ring-teal-200 dark:bg-teal-500/10 dark:text-teal-300 dark:ring-teal-500/30',
  view: 'bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-500/30',
};
const PILL_TOGGLE_TONE: Record<Role, string> = {
  edit: 'cursor-pointer transition hover:ring-emerald-400 dark:hover:ring-emerald-400/60',
  participate: 'cursor-pointer transition hover:ring-teal-400 dark:hover:ring-teal-400/60',
  view: 'cursor-pointer transition hover:ring-amber-400 dark:hover:ring-amber-400/60',
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
      className={`${PILL} ${PILL_TONE[role]} ${PILL_TOGGLE_TONE[role]} relative touch-target-y`}
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
