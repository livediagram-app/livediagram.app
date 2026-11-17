'use client';

import { useId, useMemo, useState, useSyncExternalStore } from 'react';
import { lucidePause } from '@liveworkspace/icons/lucide';
import { Button, ChevronDownIcon, Portal, lucideGlyph } from '@liveworkspace/ui';
import { useToast } from '@/hooks/ui/useToast';
import {
  confirmHeldChanges,
  heldCardCount,
  heldGroups,
  keepHeldCards,
  subscribeWaitingChanges,
} from '@/lib/offline-queue/plan-queue';
import {
  heldGroupHeading,
  heldMoreLabel,
  heldReason,
  heldRows,
  heldTitle,
  heldToggleLabel,
  keepLabel,
  keptToast,
  removeLabel,
  removedToast,
  type HeldGroup,
} from '@/lib/offline-queue/removal-held';

const noneHeld = () => 0;
const PauseIcon = /* @__PURE__ */ lucideGlyph(lucidePause, 16);

// The Needs Review banner (docs/specs/007-editor/offline-changes.md "Held for review"): card removals the server held
// because they would take many cards off a board at once wait here, still shown as made, until the person keeps the
// cards or removes them. A pause, never an error (docs/specs/004-interface-design/destructive-actions.md): nothing went
// wrong and nothing is gone, so the mark is the brand's soft tint, the safe Keep Cards is the primary button and the
// removal names exactly what it does. Only an Editor removes cards, so a read-only session never sees it.
export function HeldRemovalsBanner({ readOnly }: { readOnly: boolean }) {
  const held = useSyncExternalStore(subscribeWaitingChanges, heldCardCount, noneHeld);
  if (readOnly || held === 0) return null;
  return <HeldCard held={held} />;
}

function HeldCard({ held }: { held: number }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const listId = useId();
  // Read again only when the count changes (a hold, a keep, a confirm): O(queue), never on the write path.
  const groups = useMemo(() => (held > 0 ? heldGroups() : []), [held]);
  return (
    <Portal>
      {/* A modal in the middle of the screen over a dim scrim, so the board never moves for it (owner, 2026-11-16); on
          a phone it spans the screen less its gutters. It waits for Keep or Remove: the scrim does not close it. */}
      <div
        aria-hidden
        className="fixed inset-0 z-[var(--z-toast)] bg-slate-900/40 backdrop-blur-sm motion-safe:animate-fade-in dark:bg-slate-950/60"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-held-removals=""
        className="fixed left-1/2 top-1/2 z-[var(--z-toast)] w-[34rem] -translate-x-1/2 -translate-y-1/2 max-w-[calc(100vw-1.5rem)] rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xl dark:border-slate-700 dark:bg-slate-900"
      >
        <section
          aria-labelledby={titleId}
          className="flex w-full animate-dialog-in flex-col gap-2.5"
        >
          <div className="flex gap-3">
            <span
              aria-hidden
              className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-200"
            >
              <PauseIcon />
            </span>
            <div role="status" className="min-w-0 flex-1 pt-0.5">
              <p id={titleId} className="text-sm font-semibold text-slate-900 dark:text-white">
                {heldTitle(held)}
              </p>
              <p className="mt-0.5 text-xs leading-snug text-slate-600 dark:text-slate-300">
                {heldReason(groups)}
              </p>
            </div>
          </div>
          {open ? <HeldList id={listId} groups={groups} /> : null}
          {/* The disclosure at the left and the buttons at the right on a wide canvas; on a phone the disclosure sits
              under the line and the buttons take the full width as two halves. */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="ghost"
              size="xs"
              className="ml-10 sm:mr-auto"
              aria-expanded={open}
              aria-controls={listId}
              onClick={() => setOpen((o) => !o)}
            >
              {heldToggleLabel(held, open)}
              <ChevronDownIcon
                className={`transition-transform motion-reduce:transition-none ${open ? 'rotate-180' : ''}`}
              />
            </Button>
            <div className="flex w-full gap-2 sm:w-auto">
              <Button
                variant="secondary"
                size="sm"
                className="min-h-10 flex-1 sm:min-h-0 sm:flex-none"
                title="Send the held removals now"
                onClick={() => {
                  confirmHeldChanges();
                  toast.success(removedToast(held));
                }}
              >
                {removeLabel(held)}
              </Button>
              <Button
                variant="primary"
                size="sm"
                className="min-h-10 flex-1 sm:min-h-0 sm:flex-none"
                title="Drop the held removals and bring the cards back"
                onClick={() => {
                  keepHeldCards();
                  toast.success(keptToast(held));
                }}
              >
                {keepLabel(held)}
              </Button>
            </div>
          </div>
        </section>
      </div>
    </Portal>
  );
}

// The held cards' titles, under a heading per board when there are several, in a list that scrolls past ~10 rows.
function HeldList({ id, groups }: { id: string; groups: readonly HeldGroup[] }) {
  const headed = groups.length > 1;
  return (
    <div
      id={id}
      className="ml-12 max-h-48 overflow-y-auto rounded-xl bg-slate-50 px-3 py-2 text-xs dark:bg-slate-800/70"
    >
      {groups.map((g, i) => {
        const { titles, more } = heldRows(g);
        const moreLabel = heldMoreLabel(titles.length, more);
        return (
          <div key={`${g.reason ?? ''}:${g.board ?? ''}`} className={i > 0 ? 'mt-2' : ''}>
            {headed ? (
              <p className="pb-1 font-semibold text-slate-500 dark:text-slate-400">
                {heldGroupHeading(g)}
              </p>
            ) : null}
            <ul className="space-y-1">
              {titles.map((t, k) => (
                <li key={k} className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
                  <span
                    aria-hidden
                    className="h-3 w-1 shrink-0 rounded-full bg-brand-200 dark:bg-brand-500/50"
                  />
                  <span className="truncate">{t}</span>
                </li>
              ))}
              {moreLabel ? (
                <li className="pl-3 text-slate-500 dark:text-slate-400">{moreLabel}</li>
              ) : null}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
