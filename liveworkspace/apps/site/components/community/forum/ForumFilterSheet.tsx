'use client';

import { useId, useState } from 'react';
import {
  COMMUNITY_APPS,
  FORUM_CATEGORIES,
  FORUM_SORTS,
  forumAppLabel,
  type CommunityApp,
  type ForumCategory,
  type ForumSort,
} from '@liveworkspace/community';
import { Button, ChevronDownIcon, Dialog } from '@liveworkspace/ui';
import { FiltersIcon } from '../shared/icons';
import { filterChipClass } from './ForumBits';
import { ForumAppLogo } from './ForumAppLogo';

// The Forum list's filters on a phone (liveworkspace/docs/specs/007-community/community.md "The Forum", "On the
// page"): one control in place of the category chips, the App menu and Sort. It says what the list shows (the category
// and app, or All Posts, and the sort) and opens a drawer with all three, each a set of chips. A choice applies at once,
// so the list behind is already right when the drawer closes.

type Choice = { category?: ForumCategory | null; app?: CommunityApp | null; sort?: ForumSort };

export function ForumFilterSheet({
  category,
  app,
  sort,
  onChoose,
}: {
  category: ForumCategory | null;
  app: CommunityApp | null;
  sort: ForumSort;
  onChoose: (next: Choice) => void;
}) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const categoryLabel = FORUM_CATEGORIES.find((c) => c.id === category)?.label;
  const showing =
    [categoryLabel, app ? forumAppLabel(app) : null].filter(Boolean).join(', ') || 'All Posts';
  const sortLabel = FORUM_SORTS.find((s) => s.id === sort)?.label ?? '';
  const filtered = (category ? 1 : 0) + (app ? 1 : 0);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={`Filters: ${showing}, sorted by ${sortLabel}`}
        className="flex h-11 w-full cursor-pointer items-center gap-2.5 rounded-xl bg-white px-3.5 text-left text-sm ring-1 ring-inset ring-slate-200 transition-colors duration-micro hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:bg-slate-900 dark:ring-slate-700 dark:hover:bg-slate-800"
      >
        <FiltersIcon aria-hidden className="shrink-0 text-slate-500 dark:text-slate-400" />
        <span className="min-w-0 flex-1 truncate font-medium text-slate-900 dark:text-white">
          {showing}
        </span>
        {filtered ? (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-700 px-1.5 text-xs font-semibold tabular-nums text-white">
            <span className="text-optical-centre">{filtered}</span>
          </span>
        ) : null}
        <span className="shrink-0 text-slate-500 dark:text-slate-400">{sortLabel}</span>
        <ChevronDownIcon aria-hidden size={14} className="shrink-0 text-slate-400" />
      </button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        titleId={titleId}
        size="lg"
        phoneSheet
        closeOnBack
      >
        <div className="flex flex-col gap-5 px-4 pb-4 pt-1">
          <h2 id={titleId} className="text-base font-semibold text-slate-900 dark:text-white">
            Filter Posts
          </h2>
          <ChipGroup label="Category">
            {[{ id: null, label: 'All Categories' }, ...FORUM_CATEGORIES].map((c) => (
              <button
                key={c.id ?? 'all'}
                type="button"
                aria-pressed={category === c.id}
                onClick={() => onChoose({ category: c.id })}
                className={filterChipClass(category === c.id)}
              >
                {c.label}
              </button>
            ))}
          </ChipGroup>
          <ChipGroup label="App">
            {[null, ...COMMUNITY_APPS].map((a) => (
              <button
                key={a ?? 'all'}
                type="button"
                aria-pressed={app === a}
                aria-label={a ? forumAppLabel(a) : 'All Apps'}
                onClick={() => onChoose({ app: a })}
                className={filterChipClass(app === a, 'inline-flex items-center', 'soft')}
              >
                {a ? <ForumAppLogo app={a} /> : 'All Apps'}
              </button>
            ))}
          </ChipGroup>
          <ChipGroup label="Sort">
            {FORUM_SORTS.map((s) => (
              <button
                key={s.id}
                type="button"
                aria-pressed={sort === s.id}
                onClick={() => onChoose({ sort: s.id })}
                className={filterChipClass(sort === s.id)}
              >
                {s.label}
              </button>
            ))}
          </ChipGroup>
          <div className="flex justify-end gap-2 pt-1">
            {filtered ? (
              <Button
                variant="secondary"
                size="md"
                onClick={() => onChoose({ category: null, app: null })}
              >
                Clear Filters
              </Button>
            ) : null}
            <Button size="md" onClick={() => setOpen(false)}>
              Show Posts
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}

function ChipGroup({ label, children }: { label: string; children: React.ReactNode }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      <span id={id} className="text-sm font-medium text-slate-700 dark:text-slate-200">
        {label}
      </span>
      <div role="group" aria-labelledby={id} className="flex flex-wrap gap-1.5">
        {children}
      </div>
    </div>
  );
}
