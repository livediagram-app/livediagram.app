'use client';

// Edit Outline's row editor (docs/specs/009-elements/mind-node.md "Edit Outline"): the map as rows,
// one per node, a level each instead of typed spaces. A coloured bullet and indent guides show the
// tree; each row edits its text in place (OutlineRowEditor) with bold / italic / underline; the
// structure keys and the toolbar act on the row being edited through the pure row model
// (lib/outline-rows.ts), and the caret is put back where the edit leaves it.
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type KeyboardEvent,
} from 'react';
import {
  lucideBold,
  lucideItalic,
  lucidePilcrow,
  lucideUnderline,
} from '@livediagram/icons/lucide';
import { toggleFormatInRange, type RunBoolKey, type TextRun } from '@livediagram/document';
import { ArrowDownIcon, ArrowUpIcon, IndentIcon, OutdentIcon, lucideGlyph } from '@livediagram/ui';
import {
  domSelectionToOffsets,
  insertTextAtCaret,
  offsetsToDomRange,
  selectRange,
} from '@/components/rich-text/rich-text-dom';
import {
  computeActiveFormat,
  PLAIN_RUN_DEFAULTS,
  wordRangeAt,
} from '@/components/rich-text/rich-text-format';
import {
  indentRow,
  joinDown,
  joinUp,
  moveRow,
  outdentRow,
  pasteRows,
  rowText,
  splitRow,
  type OutlineRow,
} from '@/lib/outline-rows';
import { MindOutlineToolButton, MindOutlineToolDivider } from './MindOutlineToolButton';
import { OutlineRowEditor, outlineMarks } from './OutlineRowEditor';
import { levelLook } from './outline-levels';

const BoldIcon = lucideGlyph(lucideBold, 16);
const ItalicIcon = lucideGlyph(lucideItalic, 16);
const UnderlineIcon = lucideGlyph(lucideUnderline, 16);
const LineBreakIcon = lucideGlyph(lucidePilcrow, 16);

// One level's step in, and the bullet's column (its centre is where a child's guide runs).
const INDENT_PX = 20;
const BULLET_PX = 20;
// A row's line height (leading-6), for telling a caret on a row's first or last line.
const LINE_PX = 24;

type Sel = { start: number; end: number };
type Caret = { id: string } & Sel;
const FORMAT_KEYS: Record<string, RunBoolKey> = { b: 'bold', i: 'italic', u: 'underline' };

/** Whether the caret sits on the row's first (or last) visual line, so ↑ (↓) leaves the row. */
function atEdge(el: HTMLElement, up: boolean): boolean {
  const sel = window.getSelection();
  const rect = sel && sel.rangeCount ? sel.getRangeAt(0).getClientRects()[0] : undefined;
  if (!rect) return true;
  const box = el.getBoundingClientRect();
  return up ? rect.top < box.top + LINE_PX * 0.75 : rect.bottom > box.bottom - LINE_PX * 0.75;
}

export function MindOutlineRows({
  rows,
  onRows,
  onSave,
}: {
  rows: OutlineRow[];
  onRows: (rows: OutlineRow[]) => void;
  onSave: () => void;
}) {
  const els = useRef(new Map<string, HTMLDivElement>());
  // The latest rows and save, for the key and paste handlers (stable, so rows don't re-render).
  const rowsRef = useRef(rows);
  const onSaveRef = useRef(onSave);
  useLayoutEffect(() => {
    rowsRef.current = rows;
    onSaveRef.current = onSave;
  });
  // Where to put the caret once the rows an edit made have rendered: at first, the root's end.
  const pending = useRef<Caret | null>({
    id: rows[0]!.id,
    start: rowText(rows[0]!).length,
    end: rowText(rows[0]!).length,
  });
  const [activeId, setActiveId] = useState<string | null>(null);
  const [format, setFormat] = useState({ bold: false, italic: false, underline: false });

  useLayoutEffect(() => {
    const at = pending.current;
    const el = at && els.current.get(at.id);
    if (!at || !el) return;
    pending.current = null;
    el.focus();
    selectRange(offsetsToDomRange(el, at.start, at.end));
  }, [rows]);

  const selOf = (id: string): Sel => {
    const el = els.current.get(id);
    const len = rowText(rowsRef.current.find((r) => r.id === id)!).length;
    return (el && domSelectionToOffsets(el)) ?? { start: len, end: len };
  };

  // Bold / Italic / Underline lit for the selection in the row being edited.
  useEffect(() => {
    const onChange = () => {
      const id = document.activeElement
        ?.closest('[data-outline-row]')
        ?.getAttribute('data-outline-row');
      const row = id ? rowsRef.current.find((r) => r.id === id) : undefined;
      if (!row) return;
      const active = computeActiveFormat(row.marks, selOf(row.id), PLAIN_RUN_DEFAULTS);
      setFormat({ bold: active.bold, italic: active.italic, underline: active.underline });
    };
    document.addEventListener('selectionchange', onChange);
    return () => document.removeEventListener('selectionchange', onChange);
  }, []);

  const commit = (next: OutlineRow[], caret: Caret) => {
    pending.current = caret;
    onRows(next);
  };

  const register = useCallback((id: string, el: HTMLDivElement | null) => {
    if (el) els.current.set(id, el);
    else els.current.delete(id);
  }, []);

  const onMarks = useCallback(
    (id: string, marks: TextRun[]) =>
      onRows(rowsRef.current.map((r) => (r.id === id ? { ...r, marks } : r))),
    [onRows],
  );

  // Typing that went straight into the DOM (a line break, a plain paste) is read back as input.
  const typed = (id: string, text: string) => {
    insertTextAtCaret(text);
    els.current.get(id)?.dispatchEvent(new Event('input', { bubbles: true }));
  };

  const toggle = (id: string, key: RunBoolKey) => {
    const row = rowsRef.current.find((r) => r.id === id);
    if (!row) return;
    const sel = selOf(id);
    const range = sel.start === sel.end ? wordRangeAt(rowText(row), sel.start) : sel;
    if (!range) return;
    const marks = outlineMarks(toggleFormatInRange(row.marks, range.start, range.end, key, false));
    commit(
      rowsRef.current.map((r) => (r.id === id ? { ...r, marks } : r)),
      { id, ...sel },
    );
  };

  // A structure edit on row `id` that keeps the caret where it is.
  const restructure = (
    id: string,
    edit: (rows: OutlineRow[], i: number) => OutlineRow[] | null,
  ) => {
    const all = rowsRef.current;
    const next = edit(
      all,
      all.findIndex((r) => r.id === id),
    );
    if (!next) return false;
    commit(next, { id, ...selOf(id) });
    return true;
  };

  const onKeyDown = useCallback((id: string, e: KeyboardEvent<HTMLDivElement>) => {
    if (e.nativeEvent.isComposing) return;
    const all = rowsRef.current;
    const i = all.findIndex((r) => r.id === id);
    const el = e.currentTarget;
    const sel = selOf(id);
    const collapsed = sel.start === sel.end;
    const mod = e.metaKey || e.ctrlKey;
    const go = (to: OutlineRow | undefined, at: 'start' | 'end') => {
      if (!to) return;
      e.preventDefault();
      const offset = at === 'end' ? rowText(to).length : 0;
      commit(all, { id: to.id, start: offset, end: offset });
    };
    if (e.key === 'Enter' && mod) {
      e.preventDefault();
      onSaveRef.current();
    } else if (mod && !e.altKey && !e.shiftKey && FORMAT_KEYS[e.key.toLowerCase()]) {
      e.preventDefault();
      toggle(id, FORMAT_KEYS[e.key.toLowerCase()]!);
    } else if (e.key === 'Enter' && e.shiftKey) {
      e.preventDefault();
      typed(id, '\n');
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const split = splitRow(all, i, sel.start, sel.end);
      commit(split.rows, {
        id: split.caret.id,
        start: split.caret.offset,
        end: split.caret.offset,
      });
    } else if (e.key === 'Tab') {
      e.preventDefault();
      restructure(id, e.shiftKey ? outdentRow : indentRow);
    } else if (e.key === 'Backspace' && collapsed && sel.start === 0) {
      const joined = joinUp(all, i);
      if (joined) {
        e.preventDefault();
        const { id: to, offset } = joined.caret;
        commit(joined.rows, { id: to, start: offset, end: offset });
      }
    } else if (e.key === 'Delete' && collapsed && sel.start === rowText(all[i]!).length) {
      const joined = joinDown(all, i);
      if (joined) {
        e.preventDefault();
        const { id: to, offset } = joined.caret;
        commit(joined.rows, { id: to, start: offset, end: offset });
      }
    } else if (e.altKey && !mod && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      if (restructure(id, (r, k) => moveRow(r, k, e.key === 'ArrowUp'))) e.preventDefault();
    } else if (!mod && !e.altKey && !e.shiftKey && collapsed) {
      if (e.key === 'ArrowUp' && atEdge(el, true)) go(all[i - 1], 'end');
      if (e.key === 'ArrowDown' && atEdge(el, false)) go(all[i + 1], 'start');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reads the latest rows through rowsRef
  }, []);

  const onPaste = useCallback((id: string, e: ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain').replace(/\r\n?/g, '\n');
    const all = rowsRef.current;
    const pasted = pasteRows(
      all,
      all.findIndex((r) => r.id === id),
      text,
    );
    if (!pasted) return typed(id, text);
    const { id: to, offset } = pasted.caret;
    commit(pasted.rows, { id: to, start: offset, end: offset });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reads the latest rows through rowsRef
  }, []);

  const active = activeId ? rows.findIndex((r) => r.id === activeId) : -1;
  const can = (edit: (rows: OutlineRow[], i: number) => unknown) =>
    active >= 0 && !!edit(rows, active);
  const act = (edit: (rows: OutlineRow[], i: number) => OutlineRow[] | null) => () => {
    if (activeId) restructure(activeId, edit);
  };

  return (
    <>
      <div role="toolbar" aria-label="Outline" className="flex flex-wrap items-center gap-0.5">
        <MindOutlineToolButton
          label="Bold"
          shortcut="⌘B"
          pressed={format.bold}
          disabled={active < 0}
          onClick={() => activeId && toggle(activeId, 'bold')}
        >
          <BoldIcon />
        </MindOutlineToolButton>
        <MindOutlineToolButton
          label="Italic"
          shortcut="⌘I"
          pressed={format.italic}
          disabled={active < 0}
          onClick={() => activeId && toggle(activeId, 'italic')}
        >
          <ItalicIcon />
        </MindOutlineToolButton>
        <MindOutlineToolButton
          label="Underline"
          shortcut="⌘U"
          pressed={format.underline}
          disabled={active < 0}
          onClick={() => activeId && toggle(activeId, 'underline')}
        >
          <UnderlineIcon />
        </MindOutlineToolButton>
        <MindOutlineToolDivider />
        <MindOutlineToolButton
          label="Outdent"
          shortcut="Shift+Tab"
          disabled={!can(outdentRow)}
          onClick={act(outdentRow)}
        >
          <OutdentIcon size={16} />
        </MindOutlineToolButton>
        <MindOutlineToolButton
          label="Indent"
          shortcut="Tab"
          disabled={!can(indentRow)}
          onClick={act(indentRow)}
        >
          <IndentIcon size={16} />
        </MindOutlineToolButton>
        <MindOutlineToolButton
          label="Move Up"
          shortcut="Alt+↑"
          disabled={!can((r, k) => moveRow(r, k, true))}
          onClick={act((r, k) => moveRow(r, k, true))}
        >
          <ArrowUpIcon size={16} />
        </MindOutlineToolButton>
        <MindOutlineToolButton
          label="Move Down"
          shortcut="Alt+↓"
          disabled={!can((r, k) => moveRow(r, k, false))}
          onClick={act((r, k) => moveRow(r, k, false))}
        >
          <ArrowDownIcon size={16} />
        </MindOutlineToolButton>
        <MindOutlineToolDivider />
        <MindOutlineToolButton
          label="Line Break"
          shortcut="Shift+Enter"
          disabled={active < 0}
          onClick={() => activeId && typed(activeId, '\n')}
        >
          <LineBreakIcon />
        </MindOutlineToolButton>
      </div>
      <div className="max-h-[50vh] min-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-white px-2 py-1.5 max-sm:max-h-[40dvh] dark:border-slate-700 dark:bg-slate-900">
        {rows.map((row) => {
          const look = levelLook(row.level);
          return (
            <div
              key={row.id}
              data-outline-row={row.id}
              className="relative flex"
              style={{ paddingLeft: Math.max(0, row.level - 1) * INDENT_PX }}
            >
              {/* The guides of the branches this row sits in, each in its parent's colour. */}
              {Array.from({ length: Math.max(0, row.level - 1) }, (_, k) => (
                <span
                  key={k}
                  aria-hidden
                  className={`absolute inset-y-0 border-l ${levelLook(k + 1).guide}`}
                  style={{ left: k * INDENT_PX + BULLET_PX / 2 }}
                />
              ))}
              {row.level > 0 ? (
                <span
                  aria-hidden
                  className="flex h-7 shrink-0 items-center justify-center"
                  style={{ width: BULLET_PX }}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${look.bullet}`} />
                </span>
              ) : null}
              <OutlineRowEditor
                id={row.id}
                marks={row.marks}
                label={row.level === 0 ? 'Root' : `Level ${row.level}`}
                placeholder={row.level === 0 ? 'Main idea' : 'Idea'}
                className={`min-h-7 min-w-0 flex-1 whitespace-pre-wrap break-words rounded px-1 py-0.5 leading-6 outline-none focus:bg-slate-50 dark:focus:bg-slate-800/60 ${look.text} ${
                  row.level === 0 ? 'text-base font-medium' : 'text-sm'
                }`}
                register={register}
                onMarks={onMarks}
                onKeyDown={onKeyDown}
                onPaste={onPaste}
                onFocus={setActiveId}
              />
            </div>
          );
        })}
      </div>
    </>
  );
}
