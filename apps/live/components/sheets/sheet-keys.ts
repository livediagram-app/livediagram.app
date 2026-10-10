// The grid's keys when no cell is being edited (docs/specs/029-sheets/sheet.md "Keyboard"), as a pure map from a key
// to a command, so every row of the spec's table is tested without a DOM. Undo and redo are left to the canvas.
import type { Dir } from '@livediagram/sheets';

export type KeyLike = {
  key: string;
  code?: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
};

export type SheetKeyCommand =
  | { kind: 'move'; dir: Dir; jump: boolean; extend: boolean }
  | { kind: 'tab'; back: boolean }
  | { kind: 'enter'; back: boolean }
  | { kind: 'edit' }
  | { kind: 'type'; text: string }
  | { kind: 'home'; toSheet: boolean }
  | { kind: 'end'; toSheet: boolean }
  | { kind: 'page'; up: boolean }
  | { kind: 'selectAll' }
  | { kind: 'selectRow' }
  | { kind: 'selectCol' }
  | { kind: 'clear' }
  | { kind: 'toggle'; flag: 'b' | 'i' | 'u' | 'st' }
  | { kind: 'now'; what: 'date' | 'time' }
  | { kind: 'find'; replace: boolean }
  | { kind: 'fill'; dir: 'down' | 'right' }
  | { kind: 'numberFormat'; nf: 'number' | 'currency' | 'percent' }
  | { kind: 'escape' }
  | { kind: 'menu' };

const ARROWS: Record<string, Dir> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
};

export function sheetKey(e: KeyLike): SheetKeyCommand | null {
  const mod = e.ctrlKey || e.metaKey;
  const dir = ARROWS[e.key];
  if (dir && !e.altKey) return { kind: 'move', dir, jump: mod, extend: e.shiftKey };
  if (e.key === 'Tab') return { kind: 'tab', back: e.shiftKey };
  if (e.key === 'Enter' && !mod && !e.altKey) return { kind: 'enter', back: e.shiftKey };
  if (e.key === 'F2') return { kind: 'edit' };
  if (e.key === 'Home') return { kind: 'home', toSheet: mod };
  if (e.key === 'End') return { kind: 'end', toSheet: mod };
  if (e.key === 'PageUp' || e.key === 'PageDown') return { kind: 'page', up: e.key === 'PageUp' };
  if (e.key === 'Delete' || e.key === 'Backspace') return mod ? null : { kind: 'clear' };
  if (e.key === 'Escape') return { kind: 'escape' };
  if (e.key === 'ContextMenu' || (e.key === 'F10' && e.shiftKey)) return { kind: 'menu' };
  if (e.key === ' ' && e.shiftKey && !mod) return { kind: 'selectRow' };
  if (e.key === ' ' && e.ctrlKey && !e.shiftKey) return { kind: 'selectCol' };
  if (mod && !e.altKey) {
    const k = e.key.toLowerCase();
    const digit = e.code?.startsWith('Digit') ? e.code.slice(5) : null;
    if (e.shiftKey && (digit === '1' || e.key === '!'))
      return { kind: 'numberFormat', nf: 'number' };
    if (e.shiftKey && (digit === '4' || e.key === '$'))
      return { kind: 'numberFormat', nf: 'currency' };
    if (e.shiftKey && (digit === '5' || e.key === '%'))
      return { kind: 'numberFormat', nf: 'percent' };
    if (k === 'a' && !e.shiftKey) return { kind: 'selectAll' };
    if (k === 'b' && !e.shiftKey) return { kind: 'toggle', flag: 'b' };
    if (k === 'i' && !e.shiftKey) return { kind: 'toggle', flag: 'i' };
    if (k === 'u' && !e.shiftKey) return { kind: 'toggle', flag: 'u' };
    if (k === 'x' && e.shiftKey) return { kind: 'toggle', flag: 'st' };
    if (e.key === ';' || e.key === ':' || e.code === 'Semicolon')
      return { kind: 'now', what: e.shiftKey ? 'time' : 'date' };
    if (k === 'f' && !e.shiftKey) return { kind: 'find', replace: false };
    // ⌘H hides the browser on a Mac before the page hears it: there, as in Sheets, ⌘⇧H (either works anywhere).
    if (k === 'h') return { kind: 'find', replace: true };
    if (k === 'd' && !e.shiftKey) return { kind: 'fill', dir: 'down' };
    if (k === 'r' && !e.shiftKey) return { kind: 'fill', dir: 'right' };
    return null;
  }
  // A printable character starts typing over the cell.
  if (e.key.length === 1 && !e.altKey) return { kind: 'type', text: e.key };
  return null;
}
