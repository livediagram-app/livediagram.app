'use client';

// The Collaborate panel's rows (docs/specs/012-collaboration/assigned-actions.md §5), one copy for every editor:
// soft tinted rows, an action's round check that completes it in place, a comment's bubble in its
// latest author's colour. The whole body is one button that jumps to the
// element; the check is its own button beside it (buttons don't nest).

import { useState, type CSSProperties, type ReactNode } from 'react';
import { CheckIcon, CommentIcon, HoverCard, SOLID_BRAND_DARK, GlyphDisc } from '@liveworkspace/ui';
import { IDENTITY_FILL, identityVars } from '../../../lib/identity-fill';
import { formatRelativeTimeCompact } from '@liveworkspace/ui/relative-time';
import { initialsOf } from '@liveworkspace/model-core/names';
import type { ElementActionStatus } from '@liveworkspace/element-model/element-action';
import { useRelativeNow } from '../../../lib/relative-now';
import { firstName } from './collaborate-model';

// The parts of an editor's panel rows (its components/panels/CollaboratePanel.tsx) these rows draw; each editor's
// rows carry more, such as the element and action ids its clicks name.
export type CollaborateActionRow = {
  // Display label for the element the action sits on.
  label: string;
  actionName: string;
  status: ElementActionStatus;
  assigneeName: string;
  // The assignee's colour (presenceColourOf): their row avatar wears it.
  assigneeColor: string;
  // Assigned to the current user: a brand tint and "You" in place of the avatar.
  mine: boolean;
  createdAt: number;
};

export type CollaborateCommentRow = {
  label: string;
  count: number;
  latestAuthorName: string;
  latestAuthorColor: string;
  latestText: string;
  latestAt: number;
  resolved: boolean;
};

// A comment author's colour as ink: as chosen on light, lifted toward white on
// dark, where a deep blue or purple name would sink into the panel.
const AUTHOR_INK = 'text-(--author) dark:text-[color-mix(in_srgb,var(--author)_65%,white)]';
const authorVars = (color: string) => ({ '--author': color }) as CSSProperties;

// How long the check shows its fill before the action actually flips (and
// the row leaves for the other side), so the press is seen landing.
const CHECK_SETTLE_MS = 220;

function RowShell({
  index,
  lead,
  children,
  onClick,
  label,
  mine = false,
}: {
  index: number;
  // Your own action: a light brand tint so For You reads as yours at a glance.
  mine?: boolean;
  lead: ReactNode;
  children: ReactNode;
  onClick: () => void;
  label: string;
}) {
  return (
    <li
      className="animate-slide-row-in stagger-enter"
      style={{ '--stagger-i': index } as CSSProperties}
    >
      <div
        className={`flex items-start gap-3 rounded-xl px-3 py-2.5 transition-colors ${
          mine
            ? 'bg-brand-50/70 hover:bg-brand-50 dark:bg-brand-500/10 dark:hover:bg-brand-500/15'
            : 'bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/40 dark:hover:bg-slate-800/80'
        }`}
      >
        {/* One lead column width for both kinds, so the text lines up. */}
        <span className="flex w-6 shrink-0 justify-center pt-0.5">{lead}</span>
        <button
          type="button"
          onClick={onClick}
          aria-label={label}
          className="flex min-w-0 flex-1 items-start gap-2 rounded text-left outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
        >
          {children}
        </button>
      </div>
    </li>
  );
}

export function ActionRowItem({
  row,
  index,
  onClick,
  onToggleDone,
}: {
  row: CollaborateActionRow;
  index: number;
  onClick: () => void;
  // Absent for a read-only visitor: the check is then a static status disc.
  onToggleDone?: (done: boolean) => void;
}) {
  const now = useRelativeNow();
  const [pressed, setPressed] = useState(false);
  // Closed: done, or Won't Do (docs/specs/012-collaboration/assigned-actions.md), which wears slate, not green.
  const done = row.status !== 'open';
  const wontDo = row.status === 'wont-do';
  const shownDone = pressed ? !done : done;
  const check = (
    <span
      className={`flex h-5 w-5 items-center justify-center rounded-full border-2 transition-colors ${
        shownDone && wontDo && !pressed
          ? 'border-slate-400 bg-slate-400 text-white'
          : shownDone
            ? 'border-emerald-500 bg-emerald-500 text-white'
            : 'border-slate-300 text-transparent group-hover/check:border-brand-500 group-hover/check:text-brand-700 dark:border-slate-600'
      } ${pressed ? 'collab-pop' : ''}`}
    >
      <CheckIcon size={11} />
    </span>
  );
  return (
    <RowShell
      index={index}
      mine={row.mine}
      onClick={onClick}
      label={`Open the action "${row.actionName}" on ${row.label}`}
      lead={
        onToggleDone ? (
          <button
            type="button"
            aria-label={done ? `Reopen "${row.actionName}"` : `Mark "${row.actionName}" done`}
            disabled={pressed}
            onClick={() => {
              setPressed(true);
              window.setTimeout(() => onToggleDone(!done), CHECK_SETTLE_MS);
            }}
            className="group/check flex rounded-full outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
          >
            {check}
          </button>
        ) : (
          <span aria-hidden>{check}</span>
        )
      }
    >
      <span className="min-w-0 flex-1">
        <span
          className={`line-clamp-2 text-[13px] font-semibold leading-snug ${
            shownDone ? 'text-slate-400 line-through' : 'text-slate-800 dark:text-slate-100'
          }`}
        >
          {row.actionName}
        </span>
        <span className="mt-[3px] block truncate text-[11px] text-slate-500 dark:text-slate-400">
          {wontDo ? 'Won’t Do · ' : ''}
          {row.label} · {formatRelativeTimeCompact(now - row.createdAt)}
        </span>
      </span>
      {row.mine ? (
        <span
          className={`mt-px shrink-0 rounded-full bg-brand-700 px-1.5 py-0.5 text-[9px] font-semibold text-white ${SOLID_BRAND_DARK}`}
        >
          You
        </span>
      ) : (
        <HoverCard title={row.assigneeName} description="Assignee">
          <GlyphDisc
            size={20}
            className={`mt-px ${IDENTITY_FILL} text-[8px] font-semibold`}
            style={identityVars(row.assigneeColor)}
          >
            {initialsOf(row.assigneeName)}
          </GlyphDisc>
        </HoverCard>
      )}
    </RowShell>
  );
}

export function CommentRowItem({
  row,
  index,
  onClick,
  label = row.label,
}: {
  row: CollaborateCommentRow;
  index: number;
  onClick: () => void;
  // The row's name when the editor names it otherwise than its element's label (liveplanner: a Sheet cell's
  // thread by its cell, `Budget!B4`).
  label?: string;
}) {
  const now = useRelativeNow();
  const color = row.latestAuthorColor;
  return (
    <RowShell
      index={index}
      onClick={onClick}
      label={`Open the comment thread on ${label}`}
      lead={
        <HoverCard
          title={row.count === 1 ? '1 comment' : `${row.count} comments`}
          description={`Latest from ${row.latestAuthorName}`}
        >
          <span
            className={`relative flex h-6 w-6 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--author)_16%,transparent)] ${AUTHOR_INK} ${
              row.resolved ? 'opacity-60' : ''
            }`}
            style={authorVars(color)}
          >
            <CommentIcon size={12} />
            {row.count > 1 ? (
              <span
                className={`absolute -bottom-1 -right-1 flex h-3.5 min-w-[0.875rem] items-center justify-center rounded-full px-0.5 text-[8px] font-bold text-white ring-2 ring-white dark:ring-slate-900 ${IDENTITY_FILL}`}
                style={identityVars(color)}
              >
                <span className="text-optical-centre">{row.count}</span>
              </span>
            ) : null}
          </span>
        </HoverCard>
      }
    >
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span
            className={`min-w-0 flex-1 truncate text-[13px] font-semibold ${
              row.resolved ? 'text-slate-400' : 'text-slate-800 dark:text-slate-100'
            }`}
          >
            {label}
          </span>
          <span className="shrink-0 text-[11px] text-slate-500 dark:text-slate-400">
            {formatRelativeTimeCompact(now - row.latestAt)}
          </span>
        </span>
        <span className="mt-[3px] line-clamp-2 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
          <span className={`font-semibold ${AUTHOR_INK}`} style={authorVars(color)}>
            {firstName(row.latestAuthorName)}:
          </span>{' '}
          {row.latestText}
        </span>
      </span>
    </RowShell>
  );
}
