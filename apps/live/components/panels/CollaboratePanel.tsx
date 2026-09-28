'use client';

import { useState } from 'react';
import { elementDisplayLabel, type BoxedElement } from '@livediagram/diagram';
import { MovablePanel } from '@/components/primitives/MovablePanel';
import type { MovablePanelPlacementProps } from '@/components/primitives/MovablePanel.types';
import { SOLID_BRAND_DARK } from '@livediagram/ui';
import { KindChips, SideTabs } from '@/components/panels/collaborate/CollaborateControls';
import { CollaborateEmpty } from '@/components/panels/collaborate/CollaborateEmpty';
import { ActionRowItem, CommentRowItem } from '@/components/panels/collaborate/CollaborateRows';
import {
  kindCounts,
  rowsFor,
  sectionsFor,
  showKindChips,
  type CollaborateKind,
  type CollaborateSide,
} from '@/components/panels/collaborate/collaborate-model';

// The floating COLLABORATE panel (docs/specs/012-collaboration/assigned-actions.md §5): the Comments and Actions
// panels merged into one surface, in the refreshed Collaborate look. An Open /
// Resolved segmented control splits it; kind chips narrow it to comments or
// actions when the tab has both. Open rows assigned to you lead under For You.
// An action's round check completes it in place; clicking a row jumps to the
// element and opens its thread or action. The pure rules (which rows, which
// sections, which copy) live in collaborate/collaborate-model.ts; the rows,
// controls and empty state in their own files beside it.

export type CommentRow = {
  // Element id; click jumps to it and opens the thread.
  elementId: string;
  // Display label for the element, "Untitled" when missing so the
  // row never reads as blank.
  label: string;
  // Number of comments in the thread.
  count: number;
  // Newest comment's author identity for the leading dot. Reused
  // from Comment.authorName / authorColor (denormalised on write
  // so the panel renders without joining the participant list).
  latestAuthorName: string;
  latestAuthorColor: string;
  // Newest comment's text + ts for the row preview + timestamp.
  latestText: string;
  latestAt: number;
  // Resolved threads land in the panel's Resolved view (the thread
  // still lives on the element and reopens from its badge).
  resolved: boolean;
};

export type ActionRow = {
  // Element id; click jumps to it and opens the action popover.
  elementId: string;
  // Display label for the element (same fallbacks as comment rows).
  label: string;
  // The action's name, status, and assignee identity.
  actionName: string;
  status: 'open' | 'done';
  assigneeName: string;
  // Whether the action is assigned to the CURRENT user — sorts first
  // and renders as "You" (docs/specs/012-collaboration/assigned-actions.md §5: the panel's first job is "what's
  // mine here").
  mine: boolean;
  createdAt: number;
};

type CollaboratePanelProps = {
  // Every comment thread (unresolved AND resolved) + every action (open
  // AND done) on the tab — the panel splits Open / Resolved itself. The
  // caller doesn't mount the panel at all when both lists are empty.
  commentRows: CommentRow[];
  actionRows: ActionRow[];
  stackBelowY?: number;
  // Row clicks: the editor selects the element + opens the matching
  // popover (comment thread / action).
  onCommentRowClick: (elementId: string) => void;
  onActionRowClick: (elementId: string) => void;
  // Complete (done = true) or reopen an action from its row's check. Absent
  // for a read-only visitor, whose check is a static status disc.
  onToggleActionDone?: (elementId: string, done: boolean) => void;
  forceDockMode?: boolean;
  onMobileClose?: () => void;
} & MovablePanelPlacementProps & { onReset: () => void };

export function CollaboratePanel({
  position,
  commentRows,
  actionRows,
  stackBelowY,
  onMoveTo,
  onReset,
  onCommentRowClick,
  onActionRowClick,
  onToggleActionDone,
  dock,
  mobileOpenOverride,
  mobileDockAnchor,
  forceDockMode,
  onMobileClose,
}: CollaboratePanelProps) {
  const [kind, setKind] = useState<CollaborateKind>('all');
  const openAll = kindCounts('open', commentRows, actionRows).all;
  const resolvedAll = kindCounts('resolved', commentRows, actionRows).all;
  // Land on whichever side has content: Open normally, Resolved when
  // everything is already wrapped up (an empty default view helps no one).
  const [side, setSide] = useState<CollaborateSide>(openAll > 0 ? 'open' : 'resolved');
  const chips = showKindChips(commentRows, actionRows);
  // A chip only narrows while there are both kinds; if one kind disappears
  // the list falls back to everything rather than to a stale filter.
  const activeKind = chips ? kind : 'all';
  const counts = kindCounts(side, commentRows, actionRows);
  const shown = rowsFor(side, activeKind, commentRows, actionRows);
  const sections = sectionsFor(side, shown);
  let index = 0;
  return (
    <MovablePanel
      helpArticle="comments"
      title="Collaborate"
      titleAdornment={
        openAll > 0 ? (
          <span
            className={`inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-brand-500 px-1 text-[10px] font-semibold text-white ${SOLID_BRAND_DARK}`}
          >
            <span className="text-optical-centre">{openAll}</span>
          </span>
        ) : undefined
      }
      position={position}
      defaultCorner="top-right-stacked"
      // A phone keeps even 16px gutters (the corner stack only insets the right).
      width="w-[calc(100vw-2rem)] sm:w-64"
      stackBelowY={stackBelowY}
      onReset={onReset}
      onMoveTo={onMoveTo}
      {...dock}
      mobileOpenOverride={mobileOpenOverride}
      mobileDockAnchor={mobileDockAnchor}
      forceDockMode={forceDockMode}
      onMobileClose={onMobileClose}
      collapsible
      // Default collapsed: an open panel would compete with the Palette
      // right above it. Users open it deliberately when they want to
      // scan the discussion; until then it banner-collapses to its title
      // row so the canvas stays as roomy as possible.
      defaultCollapsed
    >
      <div className="flex flex-col gap-2 px-2 pb-2">
        <SideTabs
          value={side}
          counts={{ open: openAll, resolved: resolvedAll }}
          onChange={setSide}
        />
        {chips ? <KindChips value={activeKind} counts={counts} onChange={setKind} /> : null}
        {shown.length === 0 ? (
          <CollaborateEmpty side={side} kind={activeKind} />
        ) : (
          // Keyed on the view so switching side or kind replays the entrance.
          <div key={`${side}-${activeKind}`} className="flex flex-col gap-1">
            {sections.map((section) => (
              <section key={section.key} aria-label={section.label ?? undefined}>
                {section.label ? (
                  <h3 className="px-2 pb-0.5 pt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    {section.label}
                  </h3>
                ) : null}
                <ul className="flex flex-col gap-1">
                  {section.rows.map((row) =>
                    row.kind === 'action' ? (
                      <ActionRowItem
                        key={`a-${row.action.elementId}`}
                        index={index++}
                        row={row.action}
                        onClick={() => onActionRowClick(row.action.elementId)}
                        onToggleDone={
                          onToggleActionDone
                            ? (done) => onToggleActionDone(row.action.elementId, done)
                            : undefined
                        }
                      />
                    ) : (
                      <CommentRowItem
                        key={`c-${row.comment.elementId}`}
                        index={index++}
                        row={row.comment}
                        onClick={() => onCommentRowClick(row.comment.elementId)}
                      />
                    ),
                  )}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </MovablePanel>
  );
}

// Derive comment rows from the active tab's boxed elements. Resolved
// threads are INCLUDED (flagged) so the panel's Resolved view can list
// them; the caller short-circuits the panel mount when the list (plus
// the action list) is empty. Sorted newest-first on latestAt.
export function commentRowsFromElements(elements: BoxedElement[]): CommentRow[] {
  const rows: CommentRow[] = [];
  for (const el of elements) {
    const thread = (el as { commentThread?: { comments: unknown[]; resolved: boolean } })
      .commentThread;
    if (!thread || thread.comments.length === 0) continue;
    const comments = thread.comments as {
      text: string;
      createdAt: number;
      authorName: string;
      authorColor: string;
    }[];
    const latest = comments[comments.length - 1]!;
    rows.push({
      elementId: el.id,
      label: elementDisplayLabel(el),
      count: comments.length,
      latestAuthorName: latest.authorName,
      latestAuthorColor: latest.authorColor,
      latestText: latest.text,
      latestAt: latest.createdAt,
      resolved: thread.resolved,
    });
  }
  rows.sort((a, b) => b.latestAt - a.latestAt);
  return rows;
}

// Derive action rows — every action, open and done (the panel filters
// between them). Rows assigned to `selfUserId` sort first, then
// newest-first.
export function actionRowsFromElements(
  elements: BoxedElement[],
  selfUserId: string | null,
): ActionRow[] {
  const rows: ActionRow[] = [];
  for (const el of elements) {
    const action = el.action;
    if (!action) continue;
    rows.push({
      elementId: el.id,
      label: elementDisplayLabel(el),
      actionName: action.name,
      status: action.status,
      assigneeName: action.assignee.name?.trim() || 'Teammate',
      mine: selfUserId !== null && action.assignee.userId === selfUserId,
      createdAt: action.createdAt,
    });
  }
  rows.sort((a, b) => (a.mine === b.mine ? b.createdAt - a.createdAt : a.mine ? -1 : 1));
  return rows;
}
