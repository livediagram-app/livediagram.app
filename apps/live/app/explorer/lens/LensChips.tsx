'use client';

import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import type { LensChip, LensDimension, LensIssue } from '@livediagram/explorer-lens';
import { CheckIcon, ChevronDownIcon } from '@livediagram/ui';
import { SparkleIcon } from '@/components/primitives/explorer-icons';
import { Portal } from '@/components/primitives/Portal';
import { useReposition } from '@/hooks/canvas/useReposition';
import { LensIssues } from './LensStates';

// The chip row (docs/specs/013-workspace/explorer-filters.md "The chip row"): one chip per
// dimension, each writing its token into the one lens string. A chip with several values opens a
// multi-select listbox; Made by AI, a dimension of one value, is a toggle. Clear empties the lens.

const CHIP =
  'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-medium ring-1 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500';
const CHIP_UNSET =
  'bg-white text-slate-700 ring-slate-300 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-600 dark:hover:bg-slate-800';
const CHIP_SET =
  'bg-brand-50 text-brand-800 ring-brand-400 hover:bg-brand-100 dark:bg-brand-500/15 dark:text-brand-100 dark:ring-brand-400/60 dark:hover:bg-brand-500/25';

export function LensChips({
  chips,
  issues,
  active,
  onChoose,
  onClear,
}: {
  chips: readonly LensChip[];
  issues: readonly LensIssue[];
  /** The lens holds a word or a value: Clear has something to clear. */
  active: boolean;
  onChoose: (dimension: LensDimension, value: string | null) => void;
  onClear: () => void;
}) {
  return (
    <div className="mb-3">
      <div
        role="group"
        aria-label="Filters"
        className="-mx-1 flex items-center gap-1.5 overflow-x-auto px-1 py-1"
      >
        {chips.map((chip) =>
          chip.control === 'toggle' ? (
            <ToggleChip key={chip.dimension} chip={chip} onChoose={onChoose} />
          ) : (
            <MultipleChip key={chip.dimension} chip={chip} onChoose={onChoose} />
          ),
        )}
        <button
          type="button"
          onClick={onClear}
          // Always laid out, so showing it moves nothing (D85).
          className={`${active ? '' : 'invisible '}ml-1 inline-flex h-8 shrink-0 items-center rounded-md px-2 text-xs font-medium text-slate-600 underline-offset-2 hover:text-slate-900 hover:underline focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-slate-300 dark:hover:text-white`}
          aria-hidden={!active}
          tabIndex={active ? undefined : -1}
        >
          Clear
        </button>
      </div>
      <LensIssues issues={issues} />
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
  const button = useRef<HTMLButtonElement>(null);
  const set = chip.values.length > 0;
  const close = useCallback((refocus: boolean) => {
    setOpen(false);
    if (refocus) button.current?.focus();
  }, []);
  return (
    <>
      <button
        ref={button}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={chip.name}
        onClick={() => setOpen((o) => !o)}
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
          anchor={button.current}
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

  const measure = useCallback(() => {
    if (!anchor) return;
    const r = anchor.getBoundingClientRect();
    setPos({ left: Math.max(8, Math.min(r.left, window.innerWidth - 232)), top: r.bottom + 4 });
  }, [anchor]);
  useReposition(measure);

  // Opened from the chip: the listbox takes focus, its active option the first chosen one.
  useEffect(() => {
    if (pos) list.current?.focus();
  }, [pos]);

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
        onClose(true);
        break;
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
        className="fixed z-[var(--z-popover)] w-56 rounded-md border border-slate-200 bg-white py-1 text-sm shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-950/40"
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
            <span className="flex h-4 w-4 shrink-0 items-center justify-center text-brand-600 dark:text-brand-300">
              {option.selected ? <CheckIcon size={12} /> : null}
            </span>
            <span className="truncate">{option.label}</span>
          </div>
        ))}
      </div>
    </Portal>
  );
}
