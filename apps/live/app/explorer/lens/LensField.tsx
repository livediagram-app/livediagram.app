'use client';

import {
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from 'react';
import {
  acceptSuggestion,
  lensPills,
  parseLens,
  suggestTokens,
  type LensSubject,
  type LensSuggestion,
} from '@livediagram/explorer-lens';
import { CloseIcon, HoverCard, SearchIcon } from '@livediagram/ui';
import type { ExplorerLens } from './useExplorerLens';
import { composeField, removePill, settleField, splitField, writeDraft } from './field-model';

// The Explorer's top-bar search, the lens field (docs/specs/013-workspace/explorer-filters.md
// "The field"): the lens string's tokens as removable pills, then the draft in a WAI-ARIA combobox
// with a listbox of suggestions. One line high; pills and text scroll sideways inside it.

export const FIELD_PLACEHOLDER = 'Search or filter documents';

export function LensField({
  lens,
  subjects,
}: {
  lens: ExplorerLens;
  /** The rows the current view's lens reads, for marking a suggestion that matches nothing. */
  subjects: readonly LensSubject[];
}) {
  const { input, caret, context, now, setField, setInput, blur } = lens;
  const id = useId();
  const listId = `${id}-suggestions`;
  const field = useRef<HTMLInputElement>(null);
  const parts = splitField(input, context, caret);
  const offset = composeField(parts.tokens, '', 0).caret;
  const pills = useMemo(
    () => lensPills(parseLens(parts.tokens, context), context),
    [parts.tokens, context],
  );
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  // Backspace at the start selects the last pill first; a second press removes it.
  const [selectedPill, setSelectedPill] = useState(false);

  const suggestions = useMemo<LensSuggestion[]>(
    () => (caret === null ? [] : suggestTokens(input, caret, { ...context, subjects, now })),
    [input, caret, context, subjects, now],
  );
  const listOpen = open && suggestions.length > 0;
  const activeSuggestion = listOpen && active >= 0 ? suggestions[active] : undefined;
  const optionId = (s: LensSuggestion) => `${id}-${s.id}`;

  // An edit may move the caret (a token joining the pills): after one, put the DOM caret where the
  // model says. Only after an edit, so a selection the reader made is never collapsed.
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
        if (!activeSuggestion) return;
        accept(activeSuggestion);
        break;
      case 'Tab':
        if (!activeSuggestion) return;
        accept(activeSuggestion);
        break;
      case 'Escape':
        if (!listOpen) return;
        setOpen(false);
        setActive(-1);
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
    <div className="relative w-full sm:w-64 lg:w-[22rem]">
      <div
        className="flex h-9 items-center gap-1.5 overflow-x-auto rounded-lg border border-slate-300 bg-white pl-2.5 pr-1 text-sm focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/40 dark:border-slate-600 dark:bg-slate-900"
        onMouseDown={(e) => {
          // A press on the box's padding puts the caret in the field.
          if (e.target === e.currentTarget) {
            e.preventDefault();
            field.current?.focus();
          }
        }}
      >
        <span aria-hidden className="shrink-0 text-slate-500 dark:text-slate-400">
          <SearchIcon size={14} />
        </span>
        {pills.map((pill, index) => {
          const muted = pill.state === 'inert';
          const picked = selectedPill && index === pills.length - 1;
          return (
            <span
              key={pill.dimension}
              data-lens-pill={pill.dimension}
              className={`inline-flex h-6 shrink-0 items-center gap-0.5 whitespace-nowrap rounded-full pl-2 text-[11px] font-medium ${
                muted
                  ? 'border border-dashed border-slate-400 bg-slate-50 text-slate-600 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-300'
                  : 'bg-brand-50 text-brand-800 ring-1 ring-brand-300 dark:bg-brand-500/15 dark:text-brand-100 dark:ring-brand-400/50'
              } ${picked ? 'outline-2 outline-offset-1 outline-brand-500' : ''}`}
            >
              {pill.note ? (
                // A muted pill says why on hover and focus, and to a screen reader.
                <HoverCard title="Not applied" description={pill.note}>
                  <span className="text-optical-centre">
                    <span className="sr-only">Filter </span>
                    {pill.label}
                    <span className="sr-only">, not applied: {pill.note}</span>
                  </span>
                </HoverCard>
              ) : (
                <span className="text-optical-centre">
                  <span className="sr-only">Filter </span>
                  {pill.label}
                </span>
              )}
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
          aria-label="Filter documents"
          aria-autocomplete="list"
          aria-expanded={listOpen}
          aria-controls={listId}
          aria-activedescendant={activeSuggestion ? optionId(activeSuggestion) : undefined}
          autoComplete="off"
          spellCheck={false}
          placeholder={pills.length === 0 ? FIELD_PLACEHOLDER : undefined}
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
          className="h-full min-w-[8rem] flex-1 bg-transparent text-sm text-slate-900 placeholder:text-slate-500 focus:outline-none dark:text-slate-100 dark:placeholder:text-slate-400"
        />
      </div>
      <div
        id={listId}
        role="listbox"
        aria-label="Suggestions"
        hidden={!listOpen}
        className="absolute left-0 right-0 top-full z-[var(--z-popover)] mt-1 max-h-72 overflow-y-auto rounded-md border border-slate-200 bg-white py-1 text-sm shadow-lg dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-950/40"
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
