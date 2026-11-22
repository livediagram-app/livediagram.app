'use client';

// The page icon picker (docs/specs/030-knowledgebase/page-surface.md "The page icon"), opened from Add Icon in the
// meta row and from the icon left of the Title: a popover (a sheet on a phone) with Remove at its top right when the
// page has an icon, the Emoji and Icons tabs, a search field that takes the focus, and the grid, Recent first. A pick
// sets the icon and closes it. The emoji list is its own chunk, fetched when the picker first opens; the Icons tab
// uses the line-art catalogue's chunk (lib/icon-registry.ts), fetched when that tab is shown.
import {
  memo,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { samePageIcon, type TabIcon } from '@liveknowledge/document';
import { ResponsivePopover, SegmentedToggle, TextInput } from '@liveknowledge/ui';
import { useIconCatalogs } from '@liveworkspace/workbench/hooks/ui/useIconCatalogs';
import { getLoadedIconCatalog } from '@liveworkspace/workbench/lib/icon-registry';
import { ICON_CATEGORIES, iconsInCategory, type IconDef } from '@/lib/icons';
import { useToast } from '@/hooks/ui/useToast';
import type { EmojiEntry, EmojiGroup } from './emoji-catalogue';
import { PageIconGlyph } from './PageIconGlyph';
import { RemoveIconIcon, SearchIconIcon } from './page-icon-icons';
import { noteRecentIcon, readRecentIcons } from './page-icon-recent';
import { useSetPageIcon } from './page-icon-state';

type Kind = 'emoji' | 'icons';
/** Choices to a row: the grid's arrow keys step this far for Up and Down. */
export const PICKER_COLUMNS = 8;

type Catalogue = {
  groups: readonly EmojiGroup[];
  search: (q: string) => EmojiEntry[];
  entry: (emoji: string) => EmojiEntry | undefined;
};
let catalogue: Catalogue | null = null;
let loading: Promise<Catalogue> | null = null;
/** The emoji list, fetched once (its own chunk) and kept. */
export function loadEmojiCatalogue(): Promise<Catalogue> {
  if (catalogue) return Promise.resolve(catalogue);
  loading ??= import('./emoji-catalogue').then((m) => {
    catalogue = { groups: m.EMOJI_GROUPS, search: m.searchEmoji, entry: m.emojiEntry };
    return catalogue;
  });
  return loading;
}

/** An emoji's name from the list, when the list has been fetched (a picker opened this session); null before. */
export const loadedEmojiName = (emoji: string): string | null =>
  catalogue?.entry(emoji)?.name ?? null;

export function useEmojiCatalogue(active: boolean): Catalogue | null {
  const [loaded, setLoaded] = useState<Catalogue | null>(catalogue);
  useEffect(() => {
    if (!active || loaded) return;
    let live = true;
    void loadEmojiCatalogue().then((c) => {
      if (live) setLoaded(c);
    });
    return () => {
      live = false;
    };
  }, [active, loaded]);
  return loaded;
}

const KIND_OPTIONS = [
  { value: 'emoji', label: 'Emoji', description: 'Pick an emoji for this page.' },
  { value: 'icons', label: 'Icons', description: 'Pick a line icon, drawn in the page accent.' },
] as const;

/** One choice in the grid: what it sets and its name. */
export type Choice = { icon: TabIcon; name: string; key: string };
export type Section = { id: string; label: string; choices: Choice[] };

const emojiChoice = (e: EmojiEntry): Choice => ({
  icon: { emoji: e.emoji },
  name: e.name,
  key: `e:${e.emoji}`,
});
const iconChoice = (i: IconDef): Choice => ({
  icon: { iconId: i.id },
  name: i.label,
  key: `i:${i.id}`,
});

// The catalogue's line icons a page may take: its categories bar Animated (a page icon stands still), and never its
// legacy emoji entries (an emoji is the Emoji tab's).
const ICON_SECTIONS = ICON_CATEGORIES.filter((c) => c.id !== 'animated');
const isLineIcon = (i: IconDef) => !i.id.startsWith('emoji-');

function iconMatches(i: IconDef, words: readonly string[]): boolean {
  const hay = `${i.label} ${i.keywords} ${i.id.replace(/-/g, ' ')}`.toLowerCase();
  return words.every((w) => hay.includes(w));
}

export function emojiSections(c: Catalogue, query: string, recent: readonly TabIcon[]): Section[] {
  const q = query.trim();
  if (q) return [{ id: 'results', label: 'Results', choices: c.search(q).map(emojiChoice) }];
  const recentChoices = recent.flatMap((i) => {
    if (!('emoji' in i)) return [];
    return [{ icon: i, name: c.entry(i.emoji)?.name ?? 'Emoji', key: `e:${i.emoji}` }];
  });
  return [
    ...(recentChoices.length ? [{ id: 'recent', label: 'Recent', choices: recentChoices }] : []),
    ...c.groups.map((g) => ({ id: g.id, label: g.label, choices: g.emoji.map(emojiChoice) })),
  ];
}

export function iconSections(query: string, recent: readonly TabIcon[]): Section[] {
  const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (words.length)
    return [
      {
        id: 'results',
        label: 'Results',
        choices: getLoadedIconCatalog()
          .filter((i) => isLineIcon(i) && iconMatches(i, words))
          .map(iconChoice),
      },
    ];
  const byId = new Map(getLoadedIconCatalog().map((i) => [i.id, i]));
  const recentChoices = recent.flatMap((i) => {
    if (!('iconId' in i)) return [];
    const def = byId.get(i.iconId);
    return def ? [iconChoice(def)] : [];
  });
  return [
    ...(recentChoices.length ? [{ id: 'recent', label: 'Recent', choices: recentChoices }] : []),
    ...ICON_SECTIONS.map((c) => ({
      id: c.id,
      label: c.label,
      choices: iconsInCategory(c.id).filter(isLineIcon).map(iconChoice),
    })).filter((s) => s.choices.length > 0),
  ];
}

/** Where an arrow key moves from choice `at` of `count`, PICKER_COLUMNS to a row; null for any other key. */
export function gridStep(key: string, at: number, count: number): number | null {
  const to =
    key === 'ArrowRight'
      ? at + 1
      : key === 'ArrowLeft'
        ? at - 1
        : key === 'ArrowDown'
          ? at + PICKER_COLUMNS
          : key === 'ArrowUp'
            ? at - PICKER_COLUMNS
            : key === 'Home'
              ? 0
              : key === 'End'
                ? count - 1
                : null;
  if (to === null || count === 0) return null;
  return Math.max(0, Math.min(count - 1, to));
}

const CHOICE =
  'flex aspect-square w-full cursor-pointer items-center justify-center rounded-lg text-slate-700 transition-colors duration-micro hover:bg-slate-100 focus-visible:bg-slate-100 focus-visible:outline-2 focus-visible:outline-brand-600 motion-reduce:transition-none dark:text-slate-200 dark:hover:bg-slate-800 dark:focus-visible:bg-slate-800';

// The grid: drawn again only when its sections or the current icon change, never for the hover line under it. Page
// reactions' picker draws the same grid (components/page-reactions/PageReactionPicker.tsx).
export const PickerGrid = memo(function PickerGrid({
  sections,
  current,
  onPick,
  onPoint,
  label,
}: {
  sections: readonly Section[];
  current: string | null;
  onPick: (choice: Choice) => void;
  onPoint: (choice: Choice | null) => void;
  label: string;
}) {
  const flat = useMemo(() => sections.flatMap((s) => s.choices), [sections]);
  // Each section's first choice's place in `flat`, so a choice's place is worked out, never counted during render.
  const starts = useMemo(
    () =>
      sections.reduce<number[]>(
        (out, _s, i) => [...out, i === 0 ? 0 : out[i - 1]! + sections[i - 1]!.choices.length],
        [],
      ),
    [sections],
  );
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const at = Number(target.dataset.choiceAt);
    if (!Number.isInteger(at)) return;
    const to = gridStep(e.key, at, flat.length);
    if (to === null) return;
    e.preventDefault();
    e.currentTarget.querySelector<HTMLElement>(`[data-choice-at="${to}"]`)?.focus();
  };
  return (
    <div
      data-icon-grid=""
      role="group"
      aria-label={label}
      onKeyDown={onKeyDown}
      onPointerLeave={() => onPoint(null)}
      className="flex flex-col gap-3"
    >
      {sections.map((section, si) => (
        <section key={section.id} aria-label={section.label}>
          <h3 className="mb-1 px-0.5 text-xs font-medium text-slate-500 dark:text-slate-400">
            {section.label}
          </h3>
          <div className="grid grid-cols-8 gap-0.5">
            {section.choices.map((choice, ci) => {
              const at = starts[si]! + ci;
              const on = choice.key === current;
              return (
                <button
                  key={`${section.id}-${choice.key}`}
                  type="button"
                  data-choice-at={at}
                  data-icon-choice={choice.key}
                  // The first choice is the grid's Tab stop; the arrows move on from there.
                  tabIndex={at === 0 ? 0 : -1}
                  aria-label={choice.name}
                  aria-pressed={on}
                  onClick={() => onPick(choice)}
                  onPointerEnter={() => onPoint(choice)}
                  onFocus={() => onPoint(choice)}
                  className={`${CHOICE} ${on ? 'bg-brand-50 ring-1 ring-inset ring-brand-300 dark:bg-brand-500/15 dark:ring-brand-500/40' : ''}`}
                >
                  <PageIconGlyph icon={choice.icon} size={'emoji' in choice.icon ? 26 : 20} />
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
});

export type PageIconPickerState = {
  open: boolean;
  anchor: HTMLElement | null;
  openFrom: (el: HTMLElement) => void;
  close: () => void;
};

/** What a picker host holds: whether it is open, and the control it opens from. */
export function usePageIconPicker(): PageIconPickerState {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  return {
    open,
    anchor,
    openFrom: (el) => {
      setAnchor(el);
      setOpen(true);
      // Fetched on the press, so the list is usually there by the time the popover is.
      void loadEmojiCatalogue();
    },
    close: () => setOpen(false),
  };
}

export function PageIconPicker({
  picker,
  icon,
  align = 'start',
}: {
  picker: PageIconPickerState;
  icon: TabIcon | undefined;
  align?: 'start' | 'end';
}) {
  const titleId = useId();
  return (
    <ResponsivePopover
      open={picker.open}
      onClose={picker.close}
      anchor={picker.anchor}
      titleId={titleId}
      width={356}
      align={align}
    >
      {picker.open ? <PickerBody titleId={titleId} icon={icon} close={picker.close} /> : null}
    </ResponsivePopover>
  );
}

function PickerBody({
  titleId,
  icon,
  close,
}: {
  titleId: string;
  icon: TabIcon | undefined;
  close: () => void;
}) {
  const setIcon = useSetPageIcon();
  const toast = useToast();
  const [kind, setKind] = useState<Kind>(icon && 'iconId' in icon ? 'icons' : 'emoji');
  const [query, setQuery] = useState('');
  const [pointed, setPointed] = useState<Choice | null>(null);
  const [recent] = useState(readRecentIcons);
  const search = useRef<HTMLInputElement>(null);
  const current = icon ? ('emoji' in icon ? `e:${icon.emoji}` : `i:${icon.iconId}`) : null;

  // The search takes the focus as the picker opens and when the tab changes, after the popover's own first focus.
  useEffect(() => {
    const id = requestAnimationFrame(() => search.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [kind]);

  const onPick = useCallback(
    (choice: Choice) => {
      close();
      if (samePageIcon(icon, choice.icon)) return;
      noteRecentIcon(choice.icon);
      setIcon(choice.icon);
    },
    [close, icon, setIcon],
  );
  const onPoint = useCallback((choice: Choice | null) => setPointed(choice), []);
  const remove = () => {
    const was = icon;
    close();
    setIcon(undefined);
    toast.info('Icon removed', {
      action: {
        label: 'Undo',
        ariaLabel: 'Undo Removing the Icon',
        onSelect: () => setIcon(was),
      },
    });
  };
  const body = useRef<HTMLDivElement>(null);
  const onSearchKey = (e: KeyboardEvent<HTMLInputElement>) => {
    const first = body.current?.querySelector<HTMLElement>('[data-choice-at="0"]');
    if (e.key === 'ArrowDown' && first) {
      e.preventDefault();
      first.focus();
    }
    // Enter takes the best match of a search.
    if (e.key === 'Enter' && query.trim() && first) {
      e.preventDefault();
      first.click();
    }
  };

  return (
    <div ref={body} data-icon-picker="" className="flex flex-col gap-3">
      <div className="flex min-h-8 items-center justify-between gap-2">
        <h2 id={titleId} className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          {icon ? 'Change Icon' : 'Add Icon'}
        </h2>
        {icon ? (
          <button
            type="button"
            data-icon-remove=""
            onClick={remove}
            className="-mr-1.5 inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md px-2 text-[13px] font-medium text-slate-600 transition-colors duration-micro hover:bg-rose-50 hover:text-rose-700 focus-visible:outline-2 focus-visible:outline-brand-600 phone:h-11 dark:text-slate-300 dark:hover:bg-rose-500/15 dark:hover:text-rose-200"
          >
            <RemoveIconIcon />
            Remove
          </button>
        ) : null}
      </div>
      <SegmentedToggle
        label="Icon Kind"
        value={kind}
        options={KIND_OPTIONS}
        onChange={(next) => {
          setKind(next);
          setQuery('');
          setPointed(null);
        }}
        className="w-full [&>*]:flex-1 [&_button]:w-full"
      />
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
          placeholder={kind === 'emoji' ? 'Search Emoji' : 'Search Icons'}
          aria-label={kind === 'emoji' ? 'Search Emoji' : 'Search Icons'}
          className="pl-8"
        />
      </div>
      <div
        data-icon-scroll=""
        className="-mx-1 h-64 overflow-y-auto overscroll-contain px-1 phone:h-[min(50vh,22rem)]"
      >
        {kind === 'emoji' ? (
          <EmojiPane
            query={query}
            recent={recent}
            current={current}
            onPick={onPick}
            onPoint={onPoint}
          />
        ) : (
          <IconsPane
            query={query}
            recent={recent}
            current={current}
            onPick={onPick}
            onPoint={onPoint}
          />
        )}
      </div>
      {/* The pointed or focused choice, named: one line, so the grid needs no tooltip a tile. */}
      <div
        aria-hidden
        data-icon-preview=""
        className="-mx-4 -mb-4 flex h-11 items-center gap-2.5 border-t border-slate-100 px-4 text-[13px] text-slate-600 dark:border-slate-800 dark:text-slate-300"
      >
        {pointed ? (
          <>
            <PageIconGlyph icon={pointed.icon} size={22} />
            <span className="truncate">{pointed.name}</span>
          </>
        ) : (
          <span className="text-slate-500 dark:text-slate-400">
            {icon ? 'Pick another, or Remove.' : 'Shown above the title and in the page tree.'}
          </span>
        )}
      </div>
    </div>
  );
}

type PaneProps = {
  query: string;
  recent: readonly TabIcon[];
  current: string | null;
  onPick: (choice: Choice) => void;
  onPoint: (choice: Choice | null) => void;
};

function EmojiPane({ query, recent, ...grid }: PaneProps) {
  const c = useEmojiCatalogue(true);
  const sections = useMemo(() => (c ? emojiSections(c, query, recent) : null), [c, query, recent]);
  return <Pane sections={sections} label="Emoji" none="No emoji match" {...grid} />;
}

// Mounted only while the Icons tab is shown: that is when the line-art catalogue's chunk is fetched.
function IconsPane({ query, recent, ...grid }: PaneProps) {
  const loaded = useIconCatalogs();
  const sections = useMemo(
    () => (loaded ? iconSections(query, recent) : null),
    [loaded, query, recent],
  );
  return <Pane sections={sections} label="Icons" none="No icons match" {...grid} />;
}

function Pane({
  sections,
  label,
  none,
  current,
  onPick,
  onPoint,
}: Omit<PaneProps, 'query' | 'recent'> & {
  sections: readonly Section[] | null;
  label: string;
  none: string;
}) {
  if (sections === null)
    return (
      <div role="status" aria-label={`Loading ${label}`} className="grid grid-cols-8 gap-0.5">
        {Array.from({ length: 40 }, (_, i) => (
          <span
            key={i}
            className="aspect-square animate-pulse rounded-lg bg-slate-100 motion-reduce:animate-none dark:bg-slate-800"
          />
        ))}
      </div>
    );
  if (sections.every((s) => s.choices.length === 0))
    return <p className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">{none}</p>;
  return (
    <PickerGrid
      sections={sections}
      current={current}
      onPick={onPick}
      onPoint={onPoint}
      label={label}
    />
  );
}
