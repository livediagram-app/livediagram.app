'use client';

// The keys of a cell being edited, in place or in the formula bar (docs/specs/029-sheets/sheet.md "Editing",
// "Writing formulas"): Enter, Tab and their Shift forms save and move, Alt+Enter breaks the line, Ctrl/⌘+Enter
// fills the selection, Escape throws the edit away, F4 cycles a reference's $ parts, and the function list takes
// the arrows, Tab and Enter while it is open. Typing over a cell, an arrow key ends the edit and moves (or, at a
// place a reference can go in a formula, points at a cell).
import { useCallback, useState } from 'react';
import {
  formatA1,
  formatRange,
  moveSelection,
  normaliseRange,
  single,
  type Dir,
} from '@livediagram/sheets';
import {
  acceptFunction,
  cycleAbsolute,
  functionMatches,
  insertReference,
  referenceSlot,
} from './formula-assist';
import { useSheetController } from './sheet-controller';
import type { SheetActions } from './useSheetActions';

const ARROWS: Record<string, Dir> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
};

export type FormulaInput = {
  error: { message: string; at: number } | null;
  pick: number;
  setPick: (i: number) => void;
  matches: ReturnType<typeof functionMatches>;
  caret: number;
  setCaret: (n: number) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  accept: (name: string, el: HTMLTextAreaElement | null) => void;
};

export function useFormulaInput(actions: SheetActions): FormulaInput {
  const c = useSheetController();
  const [error, setError] = useState<{ message: string; at: number } | null>(null);
  const [caret, setCaret] = useState(0);
  const [pick, setPick] = useState(0);
  // Where the arrow keys are pointing while a formula is typed over a cell (point mode), with the slot it fills.
  const [point, setPoint] = useState<{
    r: number;
    c: number;
    slot: { start: number; end: number };
  } | null>(null);
  const editing = c.editing;
  const draft = editing?.draft ?? '';
  const rangeNames = (c.sheet.layout.names ?? []).map((x) => x.name);
  const matches = editing ? functionMatches(draft, caret, 8, rangeNames) : null;

  const setDraft = useCallback(
    (next: string, nextCaret: number, el?: HTMLTextAreaElement | null) => {
      if (!c.editing) return;
      c.setEditing({ ...c.editing, draft: next });
      setCaret(nextCaret);
      setError(null);
      if (el) requestAnimationFrame(() => el.setSelectionRange(nextCaret, nextCaret));
    },
    [c],
  );

  const commit = (move: Dir | 'none', all = false) => {
    const r = actions.commitEdit(move, all);
    if (!r.ok) setError({ message: r.message, at: r.at });
    else {
      setPoint(null);
      setError(null);
    }
  };

  const accept = (name: string, el: HTMLTextAreaElement | null) => {
    if (!matches) return;
    const next = acceptFunction(draft, matches, caret, name);
    setDraft(next.draft, next.caret, el);
    setPick(0);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    e.stopPropagation();
    if (!editing) return;
    const el = e.currentTarget;
    const at = el.selectionStart ?? draft.length;
    if (matches && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault();
      setPick(
        (p) => (p + (e.key === 'ArrowDown' ? 1 : matches.names.length - 1)) % matches.names.length,
      );
      return;
    }
    if (
      matches &&
      (e.key === 'Tab' ||
        (e.key === 'Enter' && !e.shiftKey && !e.altKey && !e.metaKey && !e.ctrlKey))
    ) {
      e.preventDefault();
      accept(matches.names[Math.min(pick, matches.names.length - 1)]!, el);
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      setPoint(null);
      setError(null);
      actions.cancelEdit();
      return;
    }
    if (e.key === 'Enter' && e.altKey) {
      e.preventDefault();
      setDraft(`${draft.slice(0, at)}\n${draft.slice(el.selectionEnd ?? at)}`, at + 1, el);
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      commit(e.ctrlKey || e.metaKey ? 'none' : e.shiftKey ? 'up' : 'down', e.ctrlKey || e.metaKey);
      return;
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      commit(e.shiftKey ? 'left' : 'right');
      return;
    }
    if (e.key === 'F4') {
      e.preventDefault();
      const next = cycleAbsolute(draft, at);
      if (next) setDraft(next.draft, next.caret, el);
      return;
    }
    const dir = ARROWS[e.key];
    if (dir && editing.origin === 'type') {
      const slot = point?.slot ?? referenceSlot(draft, at);
      if (draft.startsWith('=') && slot) {
        // Point mode: the arrows move a reference through the grid (Shift grows it into a range).
        e.preventDefault();
        const from = point ?? { r: editing.r, c: editing.c };
        const moved = moveSelection(single({ r: from.r, c: from.c }), dir, c.grid).active;
        const text =
          e.shiftKey && point
            ? formatRange(normaliseRange({ r: from.r, c: from.c }, moved))
            : formatA1(moved.r, moved.c);
        const next = insertReference(draft, slot, text);
        setPoint({ r: moved.r, c: moved.c, slot: next.slot });
        setDraft(next.draft, next.caret, el);
        return;
      }
      if (!draft.startsWith('=')) {
        e.preventDefault();
        commit(dir);
      }
    }
  };

  const onChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (!c.editing) return;
    c.setEditing({ ...c.editing, draft: e.target.value });
    setCaret(e.target.selectionStart ?? e.target.value.length);
    setPoint(null);
    setPick(0);
    setError(null);
  };

  return { error, pick, setPick, matches, caret, setCaret, onKeyDown, onChange, accept };
}
