'use client';

// The reaction picker (docs/specs/030-knowledgebase/page-reactions.md "Where they show"), opened from Add Reaction or
// +N: a popover over the page's corner (a sheet on a phone). Its top lists every emoji On This Page, then the Quick
// Picks, then the search and every emoji: the page icon picker's own list and grid, fetched as its own chunk when the
// picker first opens. A pick toggles yours and closes it.
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { ResponsivePopover, TextInput, Tooltip } from '@liveknowledge/ui';
import {
  emojiSections,
  PickerGrid,
  useEmojiCatalogue,
  type Choice,
} from '@/components/page-icon/PageIconPicker';
import { SearchIconIcon } from '@/components/page-icon/page-icon-icons';
import { PageIconGlyph } from '@/components/page-icon/PageIconGlyph';
import { QUICK_PAGE_REACTIONS, type PageReactionGroup } from '@/lib/page-reactions/reaction-groups';
import { ReactionSegment } from './ReactionSegment';

const HEADING = 'mb-1.5 px-0.5 text-xs font-medium text-slate-500 dark:text-slate-400';

export type ReactionPickerState = {
  open: boolean;
  anchor: HTMLElement | null;
  openFrom: (el: HTMLElement) => void;
  close: () => void;
};

export function useReactionPicker(): ReactionPickerState {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  return {
    open,
    anchor,
    openFrom: (el) => {
      setAnchor(el);
      setOpen(true);
    },
    close: () => setOpen(false),
  };
}

export function PageReactionPicker({
  picker,
  groups,
  canReact,
  selfName,
  onToggle,
}: {
  picker: ReactionPickerState;
  groups: readonly PageReactionGroup[];
  canReact: boolean;
  selfName: string;
  onToggle: (emoji: string) => void;
}) {
  const titleId = useId();
  return (
    <ResponsivePopover
      open={picker.open}
      onClose={picker.close}
      anchor={picker.anchor}
      titleId={titleId}
      width={356}
      align="end"
    >
      {picker.open ? (
        <PickerBody
          titleId={titleId}
          groups={groups}
          canReact={canReact}
          selfName={selfName}
          onPick={(emoji) => {
            picker.close();
            onToggle(emoji);
          }}
        />
      ) : null}
    </ResponsivePopover>
  );
}

function PickerBody({
  titleId,
  groups,
  canReact,
  selfName,
  onPick,
}: {
  titleId: string;
  groups: readonly PageReactionGroup[];
  canReact: boolean;
  selfName: string;
  onPick: (emoji: string) => void;
}) {
  const mine = useMemo(() => new Set(groups.filter((g) => g.mine).map((g) => g.emoji)), [groups]);
  return (
    <div data-reaction-picker="" className="flex flex-col gap-3">
      <h2 id={titleId} className="text-sm font-semibold text-slate-900 dark:text-slate-100">
        {canReact ? 'Add Reaction' : 'Reactions'}
      </h2>
      {groups.length > 0 ? (
        <section aria-label="On This Page">
          <h3 className={HEADING}>On This Page</h3>
          <div className="flex flex-wrap gap-1">
            {groups.map((g) => (
              <ReactionSegment
                key={g.emoji}
                group={g}
                selfName={selfName}
                canReact={canReact}
                onPress={() => onPick(g.emoji)}
                framed
              />
            ))}
          </div>
        </section>
      ) : null}
      {canReact ? (
        <>
          <section aria-label="Quick Picks">
            <h3 className={HEADING}>Quick Picks</h3>
            <div data-reaction-quick="" className="flex gap-1">
              {QUICK_PAGE_REACTIONS.map((q) => {
                const on = mine.has(q.emoji);
                return (
                  <Tooltip key={q.emoji} label={q.name}>
                    <button
                      type="button"
                      aria-label={q.name}
                      aria-pressed={on}
                      onClick={() => onPick(q.emoji)}
                      className={`flex h-11 flex-1 cursor-pointer items-center justify-center rounded-xl text-[22px] leading-none transition duration-micro hover:scale-110 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-brand-600 active:scale-95 motion-reduce:transition-none motion-reduce:hover:scale-100 dark:hover:bg-slate-800 ${
                        on
                          ? 'bg-brand-50 ring-1 ring-inset ring-brand-300 dark:bg-brand-500/20 dark:ring-brand-400/50'
                          : ''
                      }`}
                    >
                      <span aria-hidden className="text-optical-centre">
                        {q.emoji}
                      </span>
                    </button>
                  </Tooltip>
                );
              })}
            </div>
          </section>
          <AllEmoji mine={mine} onPick={onPick} />
        </>
      ) : (
        <p className="text-[13px] text-slate-600 dark:text-slate-300">
          Sign in to react to a page.
        </p>
      )}
    </div>
  );
}

// The search and every emoji, the page icon picker's list and grid. Quick picks are left out of the grid's top: they
// are the row above.
function AllEmoji({
  mine,
  onPick,
}: {
  mine: ReadonlySet<string>;
  onPick: (emoji: string) => void;
}) {
  const c = useEmojiCatalogue(true);
  const [query, setQuery] = useState('');
  const [pointed, setPointed] = useState<Choice | null>(null);
  const body = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);
  // On a desktop the search takes the focus as the picker opens; a phone keeps its keyboard down until asked.
  useEffect(() => {
    if (window.matchMedia?.('(pointer: coarse)').matches) return;
    const id = requestAnimationFrame(() => search.current?.focus());
    return () => cancelAnimationFrame(id);
  }, []);
  const sections = useMemo(() => (c ? emojiSections(c, query, []) : null), [c, query]);
  const pick = useCallback(
    (choice: Choice) => {
      if ('emoji' in choice.icon) onPick(choice.icon.emoji);
    },
    [onPick],
  );
  const onPoint = useCallback((choice: Choice | null) => setPointed(choice), []);
  const onSearchKey = (e: KeyboardEvent<HTMLInputElement>) => {
    const first = body.current?.querySelector<HTMLElement>('[data-choice-at="0"]');
    if (e.key === 'ArrowDown' && first) {
      e.preventDefault();
      first.focus();
    }
    if (e.key === 'Enter' && query.trim() && first) {
      e.preventDefault();
      first.click();
    }
  };
  return (
    <section aria-label="All Emoji" className="flex flex-col gap-2">
      <div className="relative">
        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400">
          <SearchIconIcon />
        </span>
        <TextInput
          ref={search}
          compact
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onSearchKey}
          placeholder="Search Emoji"
          aria-label="Search Emoji"
          className="pl-8"
        />
      </div>
      <div
        ref={body}
        data-reaction-grid=""
        className="-mx-1 h-52 overflow-y-auto overscroll-contain px-1 phone:h-[min(38vh,18rem)]"
      >
        {sections === null ? (
          <div role="status" aria-label="Loading Emoji" className="grid grid-cols-8 gap-0.5">
            {Array.from({ length: 32 }, (_, i) => (
              <span
                key={i}
                className="aspect-square animate-pulse rounded-lg bg-slate-100 motion-reduce:animate-none dark:bg-slate-800"
              />
            ))}
          </div>
        ) : sections.every((s) => s.choices.length === 0) ? (
          <p className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
            No emoji match
          </p>
        ) : (
          <PickerGrid
            sections={sections}
            current={null}
            onPick={pick}
            onPoint={onPoint}
            label="Emoji"
          />
        )}
      </div>
      {/* The pointed or focused emoji, named, and whether a pick adds or takes back yours. */}
      <div
        aria-hidden
        data-reaction-preview=""
        className="-mx-4 -mb-4 flex h-11 items-center gap-2.5 border-t border-slate-100 px-4 text-[13px] text-slate-600 dark:border-slate-800 dark:text-slate-300"
      >
        {pointed && 'emoji' in pointed.icon ? (
          <>
            <PageIconGlyph icon={pointed.icon} size={22} />
            <span className="truncate">{pointed.name}</span>
            {mine.has(pointed.icon.emoji) ? (
              <span className="ml-auto shrink-0 text-xs text-slate-500 dark:text-slate-400">
                Yours: a pick takes it back
              </span>
            ) : null}
          </>
        ) : (
          <span className="text-slate-500 dark:text-slate-400">
            {mine.size > 0
              ? 'Pick one to add it, or one of yours to take it back.'
              : 'Shown on the page. Nobody is notified.'}
          </span>
        )}
      </div>
    </section>
  );
}
