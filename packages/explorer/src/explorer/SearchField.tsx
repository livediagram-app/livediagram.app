'use client';

// The Explorer's search field, the filter lens's field (liveplanner/docs/specs/013-workspace/explorer-filters.md
// "The field"): the lens string's tokens as removable pills, then the words being typed, in a WAI-ARIA combobox
// with a listbox of suggestions (`made-by:ai`, `edited:7d`, …). On a list it narrows that list, through its
// `?q=`; on a view that lists nothing of its own (Home, the Inbox, the Timeline, the Trash) the first word opens
// Search results. The address follows the field at most every 250 ms (a trailing write) and at once when it loses
// focus, replacing the history entry rather than adding one per keystroke. Two sizes, as livediagram draws its
// field: the header's bar, and Home's hero, drawn large with New inside its end. Typing in the hero leaves Home,
// so the hero folds away and the header's bar takes the focus, the caret at the end of what was typed.

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import {
  acceptSuggestion,
  composeField,
  lensPills,
  normaliseInput,
  parseLens,
  removePill,
  selectedFacets,
  settleField,
  splitField,
  suggestTokens,
  writeDraft,
  type LensContext,
  type LensSuggestion,
} from '../lens';
import { APP_KINDS } from '@liveworkspace/index-client';
import { CloseIcon, SearchIcon } from '../ui/icons';
import { lensViewOf, viewLens, withLens } from '../views';
import { useExplorer } from './context';

// How often, at most, typing rewrites the address (a trailing write; leaving the field writes at once). A write
// per keystroke ran a held key past Safari's limit of 100 history writes in 10 seconds, which throws.
export const SEARCH_DEBOUNCE_MS = 250;

const SIZES = {
  bar: {
    wrap: 'relative w-full sm:w-64 lg:w-[22rem]',
    box: 'h-9 gap-1.5 rounded-lg border border-slate-300 bg-white pl-2.5 pr-1 text-sm focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/40 dark:border-slate-600 dark:bg-slate-900',
    glyph: 14,
    input: 'text-sm',
  },
  hero: {
    wrap: 'relative w-full',
    box: 'h-[60px] gap-3 rounded-[18px] border-2 border-brand-200 bg-white pl-[18px] pr-2 text-base shadow-[0_0_0_6px_color-mix(in_oklab,var(--color-brand-300)_22%,transparent),0_18px_40px_-20px_color-mix(in_oklab,var(--color-brand-600)_45%,transparent)] focus-within:border-brand-400 dark:border-brand-400/40 dark:bg-slate-800 dark:shadow-[0_0_0_6px_color-mix(in_oklab,var(--color-brand-400)_12%,transparent)] dark:focus-within:border-brand-400',
    glyph: 18,
    input: 'text-base',
  },
} as const;

export type SearchFieldSize = keyof typeof SIZES;

// Set by the hero's field as it hands the typing over; the bar that mounts next takes the focus.
let barFocusRequested = false;

/** The lens's parsing context for the view on screen. */
export function useLensContext(): LensContext {
  const { view, teams, lensTemplates, app, filter } = useExplorer();
  const kind = lensViewOf(view.kind) ?? 'aggregate';
  // Held to the host's own app, a list offers no Opens in chip.
  const oneApp = filter === 'app' ? APP_KINDS[app] : null;
  return useMemo(
    () => ({
      view: kind,
      teams: teams.map((t) => ({ id: t.id, name: t.name })),
      templates: lensTemplates,
      oneApp,
    }),
    [kind, teams, lensTemplates, oneApp],
  );
}

type Sync = { seen: string; pending: string[] };

/**
 * The field's lens: the string, the caret while focused, and the address kept in step. The string is the state;
 * `q` follows it, and a `q` that changes from outside (a chip, a link, Back) is adopted. Writes this field made
 * itself are remembered until the address shows them, so a fast typist is never overwritten by an echo of an
 * older keystroke.
 */
function useFieldLens() {
  const { view, navigate, onLensSelected } = useExplorer();
  const context = useLensContext();
  const lensKind = lensViewOf(view.kind);
  const urlLens = viewLens(view);
  const [input, setInputState] = useState(urlLens);
  const [caret, setCaret] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [sync, setSync] = useState<Sync>({ seen: urlLens, pending: [] });
  const viewRef = useRef(view);
  viewRef.current = view;
  // Search results is being opened from a view with no lens: later keystrokes replace that entry.
  const opening = useRef(false);
  if (lensKind !== null) opening.current = false;
  const write = useRef<{ timer: ReturnType<typeof setTimeout> | null; q: string | null }>({
    timer: null,
    q: null,
  });
  const flush = useCallback(() => {
    const pending = write.current;
    if (pending.timer !== null) clearTimeout(pending.timer);
    pending.timer = null;
    if (pending.q === null) return;
    const q = pending.q;
    pending.q = null;
    navigate(withLens(viewRef.current, q), { replace: true });
  }, [navigate]);
  // Leaving the view drops a write still waiting: it would land on the next page's address.
  useEffect(
    () => () => {
      const pending = write.current;
      if (pending.timer !== null) clearTimeout(pending.timer);
      pending.timer = null;
      pending.q = null;
    },
    [],
  );

  // The address moved. Our own write arriving is only bookkeeping; anything else is adopted.
  if (urlLens !== sync.seen) {
    const at = sync.pending.indexOf(urlLens);
    if (at !== -1) {
      setSync({ seen: urlLens, pending: sync.pending.slice(at + 1) });
    } else {
      setSync({ seen: urlLens, pending: [] });
      if (urlLens !== normaliseInput(input)) {
        setInputState(urlLens);
        setCaret(null);
      }
    }
  }

  const parsed = useMemo(
    () => parseLens(input, context, caret ?? undefined),
    [input, context, caret],
  );

  const commit = (next: string, nextCaret: number | null) => {
    const nextParsed = parseLens(next, context, nextCaret ?? undefined);
    for (const facet of selectedFacets(parsed.lens, nextParsed.lens)) onLensSelected?.(facet);
    setInputState(next);
    setCaret(nextCaret);
    setNow(Date.now());
    const written = normaliseInput(next);
    const latest = sync.pending.at(-1) ?? sync.seen;
    if (written === latest) {
      // Nothing new to write, but leaving the field sends a write still waiting.
      if (nextCaret === null) flush();
      return;
    }
    setSync((s) => ({ ...s, pending: [...s.pending, written] }));
    if (lensKind === null) {
      if (written === '') return;
      navigate({ kind: 'search', q: written }, opening.current ? { replace: true } : undefined);
      opening.current = true;
      return;
    }
    write.current.q = written;
    if (nextCaret === null) flush();
    else if (write.current.timer === null)
      write.current.timer = setTimeout(flush, SEARCH_DEBOUNCE_MS);
  };

  return {
    lensKind,
    context,
    input,
    caret,
    parsed,
    now,
    setField: (next: string, at: number) => commit(next, at),
    setInput: (next: string) => commit(next, caret),
    blur: () => commit(input, null),
  };
}

export function SearchField({
  size = 'bar',
  trailing,
  className,
}: {
  size?: SearchFieldSize;
  /** A control inside the field's end (the hero's New). */
  trailing?: ReactNode;
  className?: string;
}) {
  const { kind, words, lensSubjects } = useExplorer();
  const lens = useFieldLens();
  const { input, caret, context, now, setField, setInput, blur } = lens;
  const id = useId();
  const listId = `${id}-suggestions`;
  const field = useRef<HTMLInputElement>(null);
  const parts = splitField(input, context, caret);
  const offset = composeField(parts.tokens, '', 0).caret;
  const pills = useMemo(
    () => lensPills(parseLens(parts.tokens, context), context, kind),
    [parts.tokens, context, kind],
  );
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  // Backspace at the start selects the last pill first; a second press removes it.
  const [selectedPill, setSelectedPill] = useState(false);
  const look = SIZES[size];
  const placeholder = `Search or filter ${words.lowerMany}`;

  // The header field mounting after typing in the hero takes the focus, caret at the end. A layout effect: it runs
  // in the commit that removes the hero's field, so no keystroke lands on the page between.
  useLayoutEffect(() => {
    if (size !== 'bar' || !barFocusRequested) return;
    barFocusRequested = false;
    const el = field.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, [size]);

  const suggestions = useMemo<LensSuggestion[]>(
    () =>
      caret === null
        ? []
        : suggestTokens(input, caret, { ...context, subjects: lensSubjects.current, now }),
    [input, caret, context, lensSubjects, now],
  );
  const listOpen = open && suggestions.length > 0;
  const activeSuggestion = listOpen && active >= 0 ? suggestions[active] : undefined;
  const optionId = (s: LensSuggestion) => `${id}-${s.id.replace(/[^\w-]/g, '_')}`;

  // An edit may move the caret (a token joining the pills): after one, put the DOM caret where the model says.
  // Only after an edit, so a selection the reader made is never collapsed.
  const moveCaret = useRef(false);
  useLayoutEffect(() => {
    const el = field.current;
    if (!moveCaret.current || !el || document.activeElement !== el) return;
    moveCaret.current = false;
    if (el.selectionStart !== parts.draftCaret || el.selectionEnd !== parts.draftCaret) {
      el.setSelectionRange(parts.draftCaret, parts.draftCaret);
    }
  }, [input, parts.draftCaret]);

  const caretOf = (el: HTMLInputElement) => el.selectionStart ?? el.value.length;

  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    const next = writeDraft(parts.tokens, e.target.value, caretOf(e.target), context);
    moveCaret.current = true;
    // From the hero, a first word opens Search results: the header's field there carries the typing on.
    if (size === 'hero' && next.input.trim() !== '') barFocusRequested = true;
    setField(next.input, next.caret);
    setOpen(true);
    setActive(-1);
    setSelectedPill(false);
  };

  // A caret moved by the arrows or the mouse decides which word is still being typed.
  const onSelect = () => {
    const el = field.current;
    if (!el || caret === null) return;
    const at = offset + caretOf(el);
    if (at !== caret) setField(input, at);
  };

  const accept = (suggestion: LensSuggestion) => {
    const accepted = acceptSuggestion(input, suggestion);
    const settled = settleField(accepted.input, accepted.caret, context);
    moveCaret.current = true;
    setField(settled.input, settled.caret);
    setActive(-1);
    setOpen(suggestion.kind === 'dimension');
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const el = e.currentTarget;
    if (e.key !== 'Backspace') setSelectedPill(false);
    switch (e.key) {
      case 'ArrowDown':
        if (suggestions.length === 0) return;
        setOpen(true);
        setActive((i) => (i + 1) % suggestions.length);
        break;
      case 'ArrowUp':
        if (suggestions.length === 0) return;
        setOpen(true);
        setActive((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
        break;
      case 'Enter':
      case 'Tab':
        if (!activeSuggestion) return;
        accept(activeSuggestion);
        break;
      case 'Escape':
        if (listOpen) {
          setOpen(false);
          setActive(-1);
          break;
        }
        // With the list closed, Escape clears the words (the pills stay).
        if (parts.draft === '') return;
        setInput(composeField(parts.tokens, '', 0).input);
        break;
      case 'Backspace': {
        const atStart = el.selectionStart === 0 && el.selectionEnd === 0;
        const last = pills.at(-1);
        if (!atStart || !last) return;
        if (selectedPill) {
          setInput(removePill(parts.tokens, parts.draft, last.dimension, context));
          setSelectedPill(false);
        } else {
          setSelectedPill(true);
        }
        break;
      }
      default:
        return;
    }
    e.preventDefault();
  };

  return (
    <div className={`${look.wrap}${className ? ` ${className}` : ''}`}>
      <div
        className={`flex items-center overflow-x-auto [scrollbar-width:none] ${look.box}`}
        onMouseDown={(e) => {
          // A press on the box's padding or glyph puts the caret in the field.
          if (e.target === field.current || (e.target as HTMLElement).closest('button')) return;
          e.preventDefault();
          field.current?.focus();
        }}
      >
        <span aria-hidden className="shrink-0 text-slate-500 dark:text-slate-400">
          <SearchIcon size={look.glyph} />
        </span>
        {pills.map((pill, index) => {
          const muted = pill.state === 'inert';
          const picked = selectedPill && index === pills.length - 1;
          return (
            <span
              key={pill.dimension}
              data-lens-pill={pill.dimension}
              title={pill.note ?? undefined}
              className={`inline-flex h-6 shrink-0 items-center gap-0.5 whitespace-nowrap rounded-full pl-2 text-[11px] font-medium ${
                muted
                  ? 'border border-dashed border-slate-400 bg-slate-50 text-slate-600 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-300'
                  : 'bg-brand-50 text-brand-800 ring-1 ring-brand-300 dark:bg-brand-500/15 dark:text-brand-100 dark:ring-brand-400/50'
              } ${picked ? 'outline-2 outline-offset-1 outline-brand-500' : ''}`}
            >
              <span>
                <span className="sr-only">Filter </span>
                {pill.label}
                {pill.note ? <span className="sr-only">, not applied: {pill.note}</span> : null}
              </span>
              <button
                type="button"
                aria-label={pill.removeName}
                onClick={() => {
                  setInput(removePill(parts.tokens, parts.draft, pill.dimension, context));
                  // Back to the words once the pill is gone: focusing now would read the old string.
                  requestAnimationFrame(() => field.current?.focus());
                }}
                className="ml-0.5 flex h-6 w-6 items-center justify-center rounded-full text-current opacity-70 hover:opacity-100 focus-visible:outline-2 focus-visible:outline-brand-500"
              >
                <CloseIcon size={10} />
              </button>
            </span>
          );
        })}
        <input
          ref={field}
          type="text"
          role="combobox"
          aria-label={`Filter ${words.lowerMany}`}
          aria-autocomplete="list"
          aria-expanded={listOpen}
          aria-controls={listId}
          aria-activedescendant={activeSuggestion ? optionId(activeSuggestion) : undefined}
          autoComplete="off"
          spellCheck={false}
          placeholder={pills.length === 0 ? placeholder : undefined}
          value={parts.draft}
          onChange={onChange}
          onSelect={onSelect}
          onKeyDown={onKeyDown}
          onFocus={(e) => setField(input, offset + caretOf(e.currentTarget))}
          onBlur={() => {
            setOpen(false);
            setActive(-1);
            setSelectedPill(false);
            blur();
          }}
          data-search-field={size}
          className={`h-full min-w-[8rem] flex-1 bg-transparent ${look.input} text-slate-900 placeholder:text-slate-500 focus:outline-none dark:text-slate-100 dark:placeholder:text-slate-400`}
        />
        {trailing}
      </div>
      <div
        id={listId}
        role="listbox"
        aria-label="Suggestions"
        hidden={!listOpen}
        className="absolute left-0 right-0 top-full z-50 mt-1 max-h-72 overflow-y-auto rounded-md border border-slate-200 bg-white py-1 text-sm shadow-lg dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-950/40"
      >
        {listOpen
          ? suggestions.map((s, index) => (
              <div
                key={s.id}
                id={optionId(s)}
                role="option"
                aria-selected={index === active}
                aria-label={s.name}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => accept(s)}
                onMouseEnter={() => setActive(index)}
                className={`flex min-h-8 cursor-pointer items-center gap-2 px-3 py-1.5 ${
                  index === active ? 'bg-slate-100 dark:bg-slate-800' : ''
                }`}
              >
                <span className="truncate text-slate-900 dark:text-slate-100">{s.label}</span>
                {s.kind === 'value' ? (
                  <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">
                    {s.dimensionLabel}
                  </span>
                ) : null}
                {s.matchesNothing ? (
                  <span className="ml-auto shrink-0 text-xs text-amber-800 dark:text-amber-200">
                    No matches
                  </span>
                ) : null}
              </div>
            ))
          : null}
      </div>
    </div>
  );
}
