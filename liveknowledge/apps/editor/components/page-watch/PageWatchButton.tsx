'use client';

// The rail's Watchers row (docs/specs/030-knowledgebase/watching.md "Where it shows"), last in Page Health's list,
// beside Approval: how many watch the page (a number, nothing at 0) and a small Watch / Watching button. On a
// page alone a press watches or stops; on a section, or a page watched through one, it opens the menu of the same rows
// as the tree's (PageWatchRows). Hidden for a guest and a knowledgebase kept Offline.
import { useState } from 'react';
import type { PageWatchResponse, PageWatchScope } from '@liveknowledge/api-schema';
import { HoverCard } from '@liveknowledge/ui';
import { MenuHeader, PortalMenu } from '@liveworkspace/workbench/components/primitives/PortalMenu';
import { useEditorChrome } from '@/app/document/[id]/EditorContext';
import { HealthRow } from '@/components/knowledge/PageHealthCard';
import { PageWatchRows } from './PageWatchRows';
import { usePageWatch } from './usePageWatch';
import { ChevronIcon, SmallEyeIcon } from './watch-icons';

const BUTTON =
  'inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium ring-1 ring-inset transition focus-visible:outline-2 focus-visible:outline-brand-600 disabled:cursor-default disabled:opacity-60 phone:h-9 phone:px-3';
const QUIET =
  'bg-white text-slate-700 ring-slate-200 hover:bg-slate-50 hover:ring-slate-300 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-700 dark:hover:bg-slate-800';
const ON =
  'bg-brand-50 text-brand-700 ring-brand-200 hover:bg-brand-100 dark:bg-brand-500/15 dark:text-brand-100 dark:ring-brand-400/40 dark:hover:bg-brand-500/25';

const people = (n: number) => (n === 1 ? '1 person gets' : `${n.toLocaleString('en')} people get`);

/** The control itself, for its tests: the watch, whether it may change, and the change. */
export function PageWatchControl({
  watch,
  ready,
  pageName,
  onSet,
}: {
  watch: PageWatchResponse;
  ready: boolean;
  pageName: string;
  onSet: (scope: PageWatchScope | null) => void;
}) {
  // The button, while its menu is open.
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const open = anchor !== null;
  const close = () => setAnchor(null);
  const watching = watch.watching !== null || watch.through !== null;
  const menu = watch.section || watch.through !== null;
  const name = pageName.trim() || 'Untitled Page';
  return (
    <HealthRow icon={<SmallEyeIcon />} label="Watchers" whole>
      <span data-page-watch="" className="inline-flex items-center gap-2">
        {watch.watchers > 0 ? (
          <HoverCard
            title={`${watch.watchers.toLocaleString('en')} watching`}
            description={`${people(watch.watchers)} updates about this page.`}
          >
            {/* The number alone, so the row keeps one line in the docked rail; the hover card says what it counts. */}
            <span
              tabIndex={0}
              aria-label={`${watch.watchers.toLocaleString('en')} watching`}
              data-watchers=""
              className="flex h-6 min-w-6 cursor-default items-center justify-center rounded-full bg-slate-100 px-1.5 text-xs font-semibold tabular-nums text-slate-600 focus-visible:outline-2 focus-visible:outline-brand-600 dark:bg-slate-800 dark:text-slate-300"
            >
              {watch.watchers.toLocaleString('en')}
            </span>
          </HoverCard>
        ) : null}
        <HoverCard
          title={watching ? 'Watching' : 'Watch'}
          description={
            watch.through && !watch.watching
              ? `You get updates about every page in ${watch.through.name.trim() || 'Untitled Page'}.`
              : watching
                ? 'You get updates when this page changes.'
                : 'Get updates when this page changes.'
          }
        >
          <button
            type="button"
            disabled={!ready}
            aria-label={`${watching ? 'Watching' : 'Watch'} ${name}`}
            aria-haspopup={menu ? 'menu' : undefined}
            aria-expanded={menu ? open : undefined}
            aria-pressed={menu ? undefined : watching}
            className={`${BUTTON} ${watching ? ON : QUIET}`}
            onClick={(e) => {
              if (!menu) return onSet(watching ? null : 'page');
              const at = e.currentTarget;
              setAnchor((held) => (held ? null : at));
            }}
          >
            <SmallEyeIcon />
            {watching ? 'Watching' : 'Watch'}
            {menu ? <ChevronIcon /> : null}
          </button>
        </HoverCard>
        {open ? (
          <PortalMenu anchor={anchor} placement="below" onClose={close} label="Watch">
            <MenuHeader title="Get Updates" />
            <PageWatchRows
              watch={watch}
              ready={ready}
              onSet={(scope) => {
                close();
                onSet(scope);
              }}
            />
          </PortalMenu>
        ) : null}
      </span>
    </HealthRow>
  );
}

/** The open page's, for the rail. */
export function PageWatchButton() {
  const { entry, canWatch, set, hidden } = usePageWatch();
  const pageName = useEditorChrome((s) => s.activeTab.name);
  if (hidden || entry.status === 'failed') return null;
  return <PageWatchControl watch={entry.watch} ready={canWatch} pageName={pageName} onSet={set} />;
}
