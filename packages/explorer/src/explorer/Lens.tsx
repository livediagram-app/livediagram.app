'use client';

// The lens under a list's header (liveplanner/docs/specs/013-workspace/explorer-filters.md "The chip row",
// "States"): one chip per dimension, each writing its token into the one lens string; Clear; the reported words;
// what a filtered list says when nothing matches; and the live region that says how many are left.

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import {
  announceResults,
  chooseChipValue,
  issueMessage,
  LENS_SETTLE_MS,
  LENS_TELEMETRY_TYPES,
  lensChips,
  type LensChip,
  type LensDimension,
  type LensIssue,
  type ParsedLens,
} from '../lens';
import { Button } from '@liveworkspace/ui';
import { EmptyState } from '@liveworkspace/ui';
import { CheckIcon, ChevronDownIcon, SearchIcon, SparkleIcon } from '../ui/icons';
import { Portal } from '@liveworkspace/ui';
import { withLens } from '../views';
import type { Words } from '../words';
import { useExplorer } from './context';
import { useLensContext } from './SearchField';

const CHIP =
  'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-medium ring-1 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500';
const CHIP_UNSET =
  'bg-white text-slate-700 ring-slate-300 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-600 dark:hover:bg-slate-800';
const CHIP_SET =
  'bg-brand-50 text-brand-800 ring-brand-400 hover:bg-brand-100 dark:bg-brand-500/15 dark:text-brand-100 dark:ring-brand-400/60 dark:hover:bg-brand-500/25';

/** The chip row for the list on screen, reading and writing its `?q=`. */
export function LensBar({ parsed, showIssues }: { parsed: ParsedLens; showIssues: boolean }) {
  const { view, navigate, onLensSelected, kind } = useExplorer();
  const context = useLensContext();
  const q = 'q' in view ? (view.q ?? '') : '';
  const chips = lensChips(parsed, context);
  const active = q.trim() !== '';
  const write = (next: string) => navigate(withLens(view, next), { replace: true });
  return (
    <div className="mb-3">
      <div
        role="group"
        aria-label="Filters"
        className="-mx-1 flex items-center gap-1.5 overflow-x-auto px-1 py-1"
      >
        {chips.map((chip) => {
          const choose = (dimension: LensDimension, value: string | null) => {
            if (value !== null && !chip.values.includes(value)) {
              onLensSelected?.(LENS_TELEMETRY_TYPES[dimension]);
            }
            write(chooseChipValue(q, dimension, value, context));
          };
          return chip.control === 'toggle' ? (
            <ToggleChip key={chip.dimension} chip={chip} onChoose={choose} />
          ) : (
            <MultipleChip key={chip.dimension} chip={chip} onChoose={choose} />
          );
        })}
        <button
          type="button"
          onClick={() => write('')}
          // Always laid out, so showing it moves nothing.
          className={`${active ? '' : 'invisible '}ml-1 inline-flex h-8 shrink-0 items-center rounded-md px-2 text-xs font-medium text-slate-600 underline-offset-2 hover:text-slate-900 hover:underline focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-slate-300 dark:hover:text-white`}
          aria-hidden={!active}
          tabIndex={active ? undefined : -1}
        >
          Clear
        </button>
      </div>
      {showIssues ? <LensIssues issues={parsed.issues} words={kind} /> : null}
    </div>
  );
}

function ToggleChip({
  chip,
  onChoose,
}: {
  chip: LensChip;
  onChoose: (dimension: LensDimension, value: string | null) => void;
}) {
  const on = chip.values.length > 0;
  const value = chip.options.find((option) => option.value !== null)?.value ?? null;
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => onChoose(chip.dimension, on ? null : value)}
      className={`${CHIP} ${on ? CHIP_SET : CHIP_UNSET}`}
    >
      {on ? <CheckIcon size={12} /> : <SparkleIcon size={12} />}
      {chip.label}
    </button>
  );
}

function MultipleChip({
  chip,
  onChoose,
}: {
  chip: LensChip;
  onChoose: (dimension: LensDimension, value: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  // In state, so the listbox anchors to the chip on the render that opens it.
  const [button, setButton] = useState<HTMLButtonElement | null>(null);
  const set = chip.values.length > 0;
  const close = useCallback(
    (refocus: boolean) => {
      setOpen(false);
      if (refocus) button?.focus();
    },
    [button],
  );
  return (
    <>
      <button
        ref={setButton}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={chip.name}
        onClick={() => setOpen((o) => !o)}
        data-lens-chip={chip.dimension}
        className={`${CHIP} ${set ? CHIP_SET : CHIP_UNSET}`}
      >
        <span>{chip.label}</span>
        {set ? (
          <span className="max-w-[12rem] truncate font-semibold">
            {chip.valueLabels.join(', ')}
          </span>
        ) : null}
        <ChevronDownIcon size={10} />
      </button>
      {open ? (
        <ChipListbox
          chip={chip}
          anchor={button}
          onChoose={(value) => onChoose(chip.dimension, value)}
          onClose={close}
        />
      ) : null}
    </>
  );
}

function ChipListbox({
  chip,
  anchor,
  onChoose,
  onClose,
}: {
  chip: LensChip;
  anchor: HTMLElement | null;
  onChoose: (value: string | null) => void;
  onClose: (refocus: boolean) => void;
}) {
  const id = useId();
  const list = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const firstSelected = chip.options.findIndex((option) => option.selected);
  const [active, setActive] = useState(Math.max(0, firstSelected));

  // Under the chip, kept there as the page scrolls or resizes.
  useLayoutEffect(() => {
    if (!anchor) return;
    const measure = () => {
      const r = anchor.getBoundingClientRect();
      setPos({ left: Math.max(8, Math.min(r.left, window.innerWidth - 232)), top: r.bottom + 4 });
    };
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [anchor]);

  // Opened from the chip: the listbox takes focus, its active option the first chosen one.
  const placed = pos !== null;
  useEffect(() => {
    if (placed) list.current?.focus();
  }, [placed]);

  // A press outside, the chip included, closes it; the chip's own click then does not reopen it.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!(e.target instanceof Node)) return;
      if (list.current?.contains(e.target)) return;
      if (anchor?.contains(e.target)) {
        e.preventDefault();
        return;
      }
      onClose(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [anchor, onClose]);

  const count = chip.options.length;
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    switch (e.key) {
      case 'ArrowDown':
        setActive((i) => (i + 1) % count);
        break;
      case 'ArrowUp':
        setActive((i) => (i - 1 + count) % count);
        break;
      case 'Home':
        setActive(0);
        break;
      case 'End':
        setActive(count - 1);
        break;
      case 'Enter':
      case ' ':
        onChoose(chip.options[active]!.value);
        break;
      case 'Escape':
      case 'Tab':
        onClose(true);
        break;
      default:
        return;
    }
    e.preventDefault();
  };

  if (!pos) return null;
  const optionId = (index: number) => `${id}-option-${index}`;
  return (
    <Portal>
      <div
        ref={list}
        role="listbox"
        aria-label={chip.label}
        aria-multiselectable="true"
        aria-activedescendant={optionId(active)}
        tabIndex={0}
        onKeyDown={onKeyDown}
        className="fixed z-50 w-56 rounded-md border border-slate-200 bg-white py-1 text-sm shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-950/40"
        style={{ left: pos.left, top: pos.top }}
      >
        {chip.options.map((option, index) => (
          <div
            key={option.value ?? 'any'}
            id={optionId(index)}
            role="option"
            aria-selected={option.selected}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setActive(index);
              onChoose(option.value);
            }}
            onMouseEnter={() => setActive(index)}
            className={`flex min-h-8 cursor-pointer items-center gap-2 px-3 py-1.5 text-slate-700 dark:text-slate-200 ${
              index === active ? 'bg-slate-100 dark:bg-slate-800' : ''
            } ${index === 0 ? 'border-b border-slate-100 dark:border-slate-800' : ''}`}
          >
            <span className="flex h-4 w-4 shrink-0 items-center justify-center text-brand-700 dark:text-brand-300">
              {option.selected ? <CheckIcon size={12} /> : null}
            </span>
            <span className="truncate">{option.label}</span>
          </div>
        ))}
      </div>
    </Portal>
  );
}

/** Each reported word, as one line: never silent, never dropped. */
export function LensIssues({ issues, words }: { issues: readonly LensIssue[]; words: Words }) {
  if (issues.length === 0) return null;
  return (
    <ul
      data-lens-issues=""
      className="mt-2 flex flex-col gap-0.5 text-xs text-amber-800 dark:text-amber-200"
    >
      {issues.map((issue) => (
        <li key={`${issue.reason}:${issue.start}`}>{issueMessage(issue, words)}</li>
      ))}
    </ul>
  );
}

/** The lens matched nothing in a list that holds items. */
export function FilteredEmpty({
  issues,
  words,
  onClear,
}: {
  issues: readonly LensIssue[];
  words: Words;
  onClear: () => void;
}) {
  return (
    <EmptyState
      icon={<SearchIcon size={20} />}
      title={`No ${words.lowerMany} match these filters`}
      description="Change or clear the filters to see more."
    >
      <div className="flex flex-col items-center gap-3">
        <LensIssues issues={issues} words={words} />
        <Button size="sm" variant="secondary" onClick={onClear}>
          Clear Filters
        </Button>
      </div>
    </EmptyState>
  );
}

/**
 * The polite live region that says how many items the lens left, once the list for a changed lens has loaded and
 * LENS_SETTLE_MS has passed. Silent on arrival: opening a view is not a change.
 */
export function LensAnnouncer({
  lens,
  loading,
  shown,
  more,
  words,
}: {
  lens: string;
  loading: boolean;
  shown: number;
  more: boolean;
  words: Words;
}) {
  const [message, setMessage] = useState('');
  // The lens the view arrived with; null once it has changed, so changing back speaks too.
  const arrived = useRef<string | null>(lens);
  const counts = useRef({ shown, more, words });
  counts.current = { shown, more, words };
  useEffect(() => {
    if (lens === arrived.current || loading) return;
    arrived.current = null;
    const timer = setTimeout(() => {
      const { shown, more, words } = counts.current;
      setMessage(announceResults(shown, more, words));
    }, LENS_SETTLE_MS);
    return () => clearTimeout(timer);
  }, [lens, loading]);
  return (
    <div role="status" aria-live="polite" className="sr-only">
      {message}
    </div>
  );
}
