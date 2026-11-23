'use client';

// Where the picker draws (liveworkspace/docs/specs/004-index/send-to-diagram.md "The picker"): a New Diagram, a New Tab
// in a diagram the person may edit (their most recent, searched), or, for a place sent before, Update its newest
// diagram's tab. Cards as a radio group; New Tab opens its list under them.
import { useEffect, useState, type ReactNode } from 'react';
import type { DiagramSend, Item } from '@liveworkspace/index-client';
import { CompactEmptyState, NoMatches, lucideGlyph } from '@liveworkspace/ui';
import { lucideCopyPlus, lucideFilePlus, lucideRefreshCw } from '@liveworkspace/icons/lucide';
import { BrandMark } from '@liveworkspace/brand';
import { useSettled } from '../../hooks/ui/useSettled';
import { indexClient } from '../../lib/index-client';
import { SearchInput } from '../primitives/SearchInput';

export type DiagramWhereChoice =
  { mode: 'new' } | { mode: 'tab'; item: Item | null } | { mode: 'update'; send: DiagramSend };

type Lister = Pick<typeof indexClient, 'listItems'>;
type Listed = { state: 'loading' } | { state: 'ready'; items: Item[] } | { state: 'failed' };

const LIST_LIMIT = 20;
const LABEL = 'text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400';

const CARD =
  'group flex min-h-11 min-w-0 cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-default disabled:opacity-60';
const CARD_ON =
  'border-brand-500 bg-brand-50 shadow-[0_0_0_1px_var(--color-brand-500)] dark:border-brand-400 dark:bg-brand-500/10 dark:shadow-[0_0_0_1px_var(--color-brand-400)]';
const CARD_OFF =
  'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600 dark:hover:bg-slate-800';
const ICON_ON = 'bg-brand-700 text-white dark:bg-brand-600';
const ICON_OFF =
  'bg-slate-100 text-slate-500 group-hover:text-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:group-hover:text-slate-200';

const NewGlyph = lucideGlyph(lucideFilePlus, 17);
const TabGlyph = lucideGlyph(lucideCopyPlus, 17);
const UpdateGlyph = lucideGlyph(lucideRefreshCw, 17);

function Card({
  on,
  icon,
  title,
  line,
  onPick,
  mode,
}: {
  on: boolean;
  icon: ReactNode;
  title: string;
  line: string;
  onPick: () => void;
  mode: DiagramWhereChoice['mode'];
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      data-where={mode}
      onClick={onPick}
      className={`${CARD} ${on ? CARD_ON : CARD_OFF}`}
    >
      <span
        className={`flex size-8 shrink-0 items-center justify-center rounded-lg transition ${on ? ICON_ON : ICON_OFF}`}
      >
        {icon}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
          {title}
        </span>
        <span className="truncate text-xs leading-snug text-slate-500 dark:text-slate-400">
          {line}
        </span>
      </span>
    </button>
  );
}

/** The person's diagrams they may edit, most recent first, searched; while New Tab is chosen. */
function DiagramList({
  picked,
  onPick,
  client,
}: {
  picked: Item | null;
  onPick: (item: Item) => void;
  client: Lister;
}) {
  const [query, setQuery] = useState('');
  const settled = useSettled(query.trim(), 250);
  const [listed, setListed] = useState<{ key: string; list: Listed } | null>(null);

  useEffect(() => {
    const abort = new AbortController();
    client
      .listItems(
        {
          app: 'livediagram',
          view: 'recent',
          limit: LIST_LIMIT,
          ...(settled ? { q: settled } : {}),
        },
        { signal: abort.signal },
      )
      .then((page) =>
        setListed({
          key: settled,
          list: {
            state: 'ready',
            items: page.items.filter((i) => i.access === 'edit' && !i.archivedAt),
          },
        }),
      )
      .catch(() => {
        if (!abort.signal.aborted) setListed({ key: settled, list: { state: 'failed' } });
      });
    return () => abort.abort();
  }, [client, settled]);

  const list: Listed = listed?.key === settled ? listed.list : { state: 'loading' };
  return (
    <div className="flex flex-col gap-2" data-diagram-list="">
      <SearchInput
        value={query}
        onChange={setQuery}
        placeholder="Search your diagrams"
        ariaLabel="Search your diagrams"
        clearAriaLabel="Clear the search"
        clearDescription="Clear the diagram search."
      />
      <div
        role="listbox"
        aria-label="Your diagrams"
        className="flex max-h-44 min-h-11 flex-col gap-0.5 overflow-y-auto rounded-xl border border-slate-200 p-1 dark:border-slate-700"
      >
        {list.state === 'loading' ? (
          <div role="status" className="flex flex-col gap-1 p-1" aria-label="Loading your diagrams">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-8 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800"
              />
            ))}
          </div>
        ) : list.state === 'failed' ? (
          <CompactEmptyState
            size="small"
            icon={<BrandMark app="livediagram" className="size-5" />}
            title="Couldn't load your diagrams"
            description="Check your connection and try again."
          />
        ) : list.items.length === 0 ? (
          settled ? (
            <NoMatches things="diagrams" query={settled} />
          ) : (
            <CompactEmptyState
              size="small"
              icon={<BrandMark app="livediagram" className="size-5" />}
              title="No diagrams to add to"
              description="Diagrams you can edit show here. Make a New Diagram instead."
            />
          )
        ) : (
          list.items.map((item) => {
            const on = picked?.id === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="option"
                aria-selected={on}
                data-diagram-row=""
                onClick={() => onPick(item)}
                className={`flex min-h-11 w-full min-w-0 cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 sm:min-h-9 ${
                  on
                    ? 'bg-brand-50 text-brand-800 ring-1 ring-brand-200 dark:bg-slate-800 dark:text-white dark:ring-brand-400/60'
                    : 'text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800/70'
                }`}
              >
                <BrandMark app="livediagram" className="size-4 shrink-0" />
                <span className="min-w-0 truncate">{item.title || 'Untitled diagram'}</span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

export function DiagramWhere({
  choice,
  onChoice,
  earlier,
  disabled,
  client = indexClient,
}: {
  choice: DiagramWhereChoice;
  onChoice: (next: DiagramWhereChoice) => void;
  // The newest earlier send of this place the person can open, offered as Update.
  earlier: DiagramSend | null;
  disabled: boolean;
  client?: Lister;
}) {
  return (
    <fieldset className="flex flex-col gap-2" disabled={disabled}>
      <legend className={`${LABEL} mb-2`}>Where</legend>
      <div
        role="radiogroup"
        aria-label="Where to draw it"
        className={`grid grid-cols-1 gap-2 ${earlier ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}
      >
        {earlier ? (
          <Card
            mode="update"
            on={choice.mode === 'update'}
            icon={<UpdateGlyph />}
            title="Update"
            line={earlier.diagram.title || 'Untitled diagram'}
            onPick={() => onChoice({ mode: 'update', send: earlier })}
          />
        ) : null}
        <Card
          mode="new"
          on={choice.mode === 'new'}
          icon={<NewGlyph />}
          title="New Diagram"
          line="One of your own"
          onPick={() => onChoice({ mode: 'new' })}
        />
        <Card
          mode="tab"
          on={choice.mode === 'tab'}
          icon={<TabGlyph />}
          title="New Tab"
          line={
            choice.mode === 'tab' && choice.item
              ? choice.item.title || 'Untitled diagram'
              : 'In a diagram you edit'
          }
          onPick={() => onChoice({ mode: 'tab', item: choice.mode === 'tab' ? choice.item : null })}
        />
      </div>
      {choice.mode === 'tab' ? (
        <DiagramList
          picked={choice.item}
          onPick={(item) => onChoice({ mode: 'tab', item })}
          client={client}
        />
      ) : null}
    </fieldset>
  );
}
