'use client';

// Where keyboard focus goes when the row it was on leaves the list (liveworkspace/docs/specs/004-index/one-explorer.md
// "Focus when a row leaves"): a delete, a move to another folder or team, a restore or a permanent delete from the
// Trash, a Dismiss. The menu or dialog hands focus back to the row's ⋯ (or its Restore), and then the row unmounts,
// which left focus on the page's body: a keyboard user had to Tab from the top again. Instead focus goes to the same
// control on the row that took its place (the next one, or the one before at the end), the way a mail list moves on.
//
// Only a row that left the list counts: one the windowing took off screen is still in `keys`, and focus is never
// pulled back to it. Cost: a focusin listener on the list, and on a render whose keys no longer hold the last focused
// row, one indexOf over the keys and one querySelector.

import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';

const ITEM_ATTRS = ['data-item-row', 'data-item-card', 'data-trash-row'] as const;
const FOLDER_ATTRS = ['data-folder-row', 'data-folder-card'] as const;
const ROW = [...ITEM_ATTRS, ...FOLDER_ATTRS].map((a) => `[${a}]`).join(',');
const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),[tabindex]:not([tabindex="-1"])';

/** A row's key in a list's `keys`: `i:<id>` for an item, `f:<id>` for a folder. */
export function rowKeyOf(row: Element): string | null {
  for (const a of ITEM_ATTRS) {
    const id = row.getAttribute(a);
    if (id !== null) return `i:${id}`;
  }
  for (const a of FOLDER_ATTRS) {
    const id = row.getAttribute(a);
    if (id !== null) return `f:${id}`;
  }
  return null;
}

/** A list's keys in the order its rows are drawn: its folders, then its items. */
export function rowKeys(
  folders: readonly { id: string }[],
  items: readonly { id: string }[],
): string[] {
  const keys: string[] = [];
  for (const f of folders) keys.push(`f:${f.id}`);
  for (const i of items) keys.push(`i:${i.id}`);
  return keys;
}

function rowFor(list: HTMLElement, key: string): Element | null {
  const id = CSS.escape(key.slice(2));
  const attrs = key.startsWith('f:') ? FOLDER_ATTRS : ITEM_ATTRS;
  return list.querySelector(attrs.map((a) => `[${a}="${id}"]`).join(','));
}

const focusLost = () => {
  const active = document.activeElement;
  return !active || active === document.body || !active.isConnected;
};

export function useFocusAfterRemoval(
  list: RefObject<HTMLElement | null>,
  keys: readonly string[],
): void {
  // The row focus was last in, and which of its controls (by order), so the next row's same control takes it.
  const last = useRef<{ key: string; slot: number } | null>(null);
  const previous = useRef(keys);

  useEffect(() => {
    const el = list.current;
    if (!el) return;
    const onFocusIn = (e: FocusEvent) => {
      const target = e.target as Element;
      const row = target.closest(ROW);
      const key = row && el.contains(row) ? rowKeyOf(row) : null;
      if (!row || !key) return;
      last.current = { key, slot: [...row.querySelectorAll(FOCUSABLE)].indexOf(target) };
    };
    el.addEventListener('focusin', onFocusIn);
    return () => el.removeEventListener('focusin', onFocusIn);
  }, [list]);

  useLayoutEffect(() => {
    const before = previous.current;
    previous.current = keys;
    const seen = last.current;
    const el = list.current;
    if (!seen || !el || before === keys || keys.includes(seen.key)) return;
    last.current = null;
    const at = before.indexOf(seen.key);
    if (at < 0 || keys.length === 0) return;
    const nextKey = keys[Math.min(at, keys.length - 1)]!;
    const move = () => {
      if (!focusLost()) return;
      const row = rowFor(el, nextKey);
      if (!row) return;
      const controls = row.querySelectorAll<HTMLElement>(FOCUSABLE);
      (controls[seen.slot] ?? controls[0])?.focus();
    };
    move();
    // A menu or dialog closing in the same turn may hand focus to the row that just went: look again after it. Not
    // cancelled by the next render, which may well come first.
    requestAnimationFrame(move);
  }, [list, keys]);
}
