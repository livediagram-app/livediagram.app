'use client';

// Where the section goes (liveworkspace/docs/specs/004-index/send-to-knowledge.md "The picker", steps 2 and 3): the
// person's knowledgebases they can edit, most recent first, with a search; then the page, as two choices: an Existing
// Page from the knowledgebase's tree (with its own search, and Where: At the End or under one of its headings), or a
// New Page with its Title and Parent. Arrow keys move along each list; Enter or Space picks.
import { useId, type KeyboardEvent, type ReactNode } from 'react';
import type { Item, KnowledgeHeading } from '@liveworkspace/index-client';
import { BrandMark } from '@liveworkspace/brand';
import {
  CompactEmptyState,
  NoMatches,
  SegmentedToggle,
  Select,
  TextInput,
  lucideGlyph,
} from '@liveworkspace/ui';
import { lucideFileText } from '@liveworkspace/icons/lucide';
import { SearchInput } from '../primitives/SearchInput';
import { searchPages, type TreePage } from './knowledge-pages';

const PageGlyph = lucideGlyph(lucideFileText, 15);

export type KnowledgebaseList =
  { state: 'loading' } | { state: 'ready'; items: Item[] } | { state: 'failed' };
export type PageList =
  | { state: 'idle' }
  | { state: 'loading' }
  | { state: 'ready'; pages: TreePage[] }
  | { state: 'refused' };
export type HeadingList =
  { state: 'idle' } | { state: 'loading' } | { state: 'ready'; headings: KnowledgeHeading[] };
export type PageMode = 'existing' | 'new';

const ROW =
  'flex min-h-11 w-full min-w-0 cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 sm:min-h-9';
const ROW_IDLE = 'text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800/70';
const ROW_ON =
  'bg-brand-50 text-brand-800 ring-1 ring-brand-200 dark:bg-slate-800 dark:text-white dark:ring-brand-400/60';
const FIELD = 'flex min-w-0 flex-col gap-1.5';
const FIELD_LABEL = 'text-[13px] font-medium text-slate-700 dark:text-slate-200';
const PLACEHOLDER =
  'rounded-lg border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400';
// Each level of the tree steps in this far.
const INDENT_PX = 14;
const INDENT_MAX = 6;

// Arrow keys between a list's buttons.
function moveFocus(e: KeyboardEvent<HTMLElement>) {
  if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
  const buttons = [...e.currentTarget.querySelectorAll<HTMLButtonElement>('button[data-row]')];
  const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
  const next =
    buttons[Math.min(buttons.length - 1, Math.max(0, at + (e.key === 'ArrowDown' ? 1 : -1)))];
  if (next) {
    e.preventDefault();
    next.focus();
  }
}

function Skeleton({ label }: { label: string }) {
  return (
    <div className="flex flex-col gap-1.5 p-1" role="status" aria-busy="true" aria-label={label}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-9 animate-pulse rounded-lg bg-slate-100 motion-reduce:animate-none dark:bg-slate-800"
        />
      ))}
    </div>
  );
}

const KbMark = () => (
  <BrandMark app="liveknowledge" className="shrink-0" style={{ width: 16, height: 16 }} />
);

/** Step 2: the knowledgebases the person can edit. */
export function KnowledgebasePicker({
  list,
  query,
  onQuery,
  pickedId,
  picked,
  onPick,
}: {
  list: KnowledgebaseList;
  query: string;
  onQuery: (q: string) => void;
  pickedId: string | null;
  // The one remembered from the last send, listed first when Recent has not got it.
  picked: { id: string; title: string } | null;
  onPick: (kb: { id: string; title: string }) => void;
}) {
  const items = list.state === 'ready' ? list.items.filter((i) => i.access === 'edit') : [];
  const held =
    picked && !query && list.state === 'ready' && !items.some((i) => i.id === picked.id)
      ? picked
      : null;
  let body: ReactNode;
  if (list.state === 'loading') body = <Skeleton label="Loading your knowledgebases" />;
  else if (list.state === 'failed')
    body = (
      <CompactEmptyState
        size="small"
        icon={<KbMark />}
        title="Couldn't load your knowledgebases"
        description="Check your connection and try again."
      />
    );
  else if (items.length === 0 && !held)
    body = query ? (
      <NoMatches things="knowledgebases" query={query} onClear={() => onQuery('')} />
    ) : (
      <CompactEmptyState
        size="small"
        icon={<KbMark />}
        title="No knowledgebase you can edit"
        description="Make one in liveknowledge, or ask for Edit on your team's."
      />
    );
  else
    body = (
      <ul className="flex flex-col gap-0.5" aria-label="Your knowledgebases" onKeyDown={moveFocus}>
        {[...(held ? [held] : []), ...items].map((kb) => {
          const on = kb.id === pickedId;
          return (
            <li key={kb.id}>
              <button
                type="button"
                data-row=""
                aria-pressed={on}
                onClick={() => onPick({ id: kb.id, title: kb.title })}
                className={`${ROW} ${on ? ROW_ON : ROW_IDLE}`}
              >
                <KbMark />
                <span className="min-w-0 flex-1 truncate">
                  {kb.title || 'Untitled knowledgebase'}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    );
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex">
        <SearchInput
          value={query}
          onChange={onQuery}
          placeholder="Search your knowledgebases"
          ariaLabel="Search your knowledgebases"
          clearAriaLabel="Clear the search"
          clearDescription="Clear the knowledgebase search."
          size="row"
        />
      </div>
      <div className="max-h-56 min-h-24 overflow-y-auto">{body}</div>
    </div>
  );
}

/** Step 3: the page, existing or new. */
export function PagePicker(props: {
  mode: PageMode;
  onMode: (m: PageMode) => void;
  pages: PageList;
  pageQuery: string;
  onPageQuery: (q: string) => void;
  pageId: string | null;
  onPage: (page: { id: string; title: string }) => void;
  headings: HeadingList;
  after: string;
  onAfter: (id: string) => void;
  newTitle: string;
  onNewTitle: (t: string) => void;
  parent: string;
  onParent: (id: string) => void;
}) {
  const ids = { where: useId(), title: useId(), parent: useId() };
  const pages = props.pages.state === 'ready' ? props.pages.pages : [];
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <SegmentedToggle
        label="Page"
        value={props.mode}
        onChange={props.onMode}
        options={[
          {
            value: 'existing',
            label: 'Existing Page',
            description: 'Add the section to a page already there.',
          },
          { value: 'new', label: 'New Page', description: 'Make a page of its own for it.' },
        ]}
      />
      {props.pages.state === 'refused' ? (
        <p className={PLACEHOLDER}>
          You can&apos;t add to this knowledgebase. Pick one you can edit.
        </p>
      ) : props.mode === 'existing' ? (
        <>
          <ExistingPages {...props} pages={props.pages} tree={pages} />
          {props.pageId ? (
            <div className={FIELD}>
              <label htmlFor={ids.where} className={FIELD_LABEL}>
                Where
              </label>
              <Select
                id={ids.where}
                value={props.after}
                disabled={props.headings.state !== 'ready'}
                onChange={(e) => props.onAfter(e.target.value)}
                className="w-full"
                selectClassName="w-full"
              >
                <option value="">At the End</option>
                {props.headings.state === 'ready'
                  ? props.headings.headings.map((h) => (
                      <option key={h.id} value={h.id}>
                        {`${' '.repeat(h.level - 1)}Under “${h.text}”`}
                      </option>
                    ))
                  : null}
              </Select>
            </div>
          ) : null}
        </>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className={FIELD}>
            <label htmlFor={ids.title} className={FIELD_LABEL}>
              Title
            </label>
            <TextInput
              id={ids.title}
              value={props.newTitle}
              onChange={(e) => props.onNewTitle(e.target.value)}
              maxLength={200}
            />
          </div>
          <div className={FIELD}>
            <label htmlFor={ids.parent} className={FIELD_LABEL}>
              Parent
            </label>
            <Select
              id={ids.parent}
              value={props.parent}
              disabled={props.pages.state !== 'ready'}
              onChange={(e) => props.onParent(e.target.value)}
              className="w-full"
              selectClassName="w-full"
            >
              <option value="">Top Level</option>
              {pages.map((p) => (
                <option key={p.id} value={p.id}>
                  {`${' '.repeat(Math.min(p.depth, INDENT_MAX))}${p.name || 'Untitled page'}`}
                </option>
              ))}
            </Select>
          </div>
        </div>
      )}
    </div>
  );
}

function ExistingPages({
  pages,
  tree,
  pageQuery,
  onPageQuery,
  pageId,
  onPage,
}: {
  pages: PageList;
  tree: TreePage[];
  pageQuery: string;
  onPageQuery: (q: string) => void;
  pageId: string | null;
  onPage: (page: { id: string; title: string }) => void;
}) {
  if (pages.state === 'idle') return <p className={PLACEHOLDER}>Pick a knowledgebase first.</p>;
  if (pages.state === 'loading') return <Skeleton label="Loading its pages" />;
  const shown = searchPages(tree, pageQuery);
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex">
        <SearchInput
          value={pageQuery}
          onChange={onPageQuery}
          placeholder="Search its pages"
          ariaLabel="Search its pages"
          clearAriaLabel="Clear the page search"
          clearDescription="Clear the page search."
          size="row"
        />
      </div>
      <div className="max-h-52 min-h-20 overflow-y-auto">
        {tree.length === 0 ? (
          <p className={PLACEHOLDER}>No pages yet. Make one with New Page.</p>
        ) : shown.length === 0 ? (
          <NoMatches things="pages" query={pageQuery} onClear={() => onPageQuery('')} />
        ) : (
          <ul className="flex flex-col gap-0.5" aria-label="Its pages" onKeyDown={moveFocus}>
            {shown.map((p) => {
              const on = p.id === pageId;
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    data-row=""
                    aria-pressed={on}
                    onClick={() => onPage({ id: p.id, title: p.name })}
                    className={`${ROW} ${on ? ROW_ON : ROW_IDLE}`}
                    // The tree's depth, while no search flattens it.
                    style={
                      pageQuery
                        ? undefined
                        : { paddingLeft: 10 + Math.min(p.depth, INDENT_MAX) * INDENT_PX }
                    }
                  >
                    <PageGlyph aria-hidden className="shrink-0 opacity-60" />
                    <span className="min-w-0 flex-1 truncate">{p.name || 'Untitled page'}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
