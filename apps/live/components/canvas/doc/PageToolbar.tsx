'use client';

// The page toolbar (docs/specs/007-editor/document-pages.md "The page toolbar"): formatting for the
// document being written in, centred above the top of the page holding the caret, over the page's
// title bar, at one screen size. When that spot is above the canvas it pins under the canvas's top
// edge while the page is in view. Its buttons never take focus: the caret stays in the writing.
// It follows the page by measuring the sheet each frame while it is shown (a pan or a zoom moves
// it with no render).
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import {
  lucideBold,
  lucideChevronDown,
  lucideSquareCode,
  lucideHighlighter,
  lucideIndentDecrease,
  lucideIndentIncrease,
  lucideItalic,
  lucideLink,
  lucideList,
  lucideListOrdered,
  lucideListTodo,
  lucidePlus,
  lucideRedo2,
  lucideRemoveFormatting,
  lucideSeparatorHorizontal,
  lucideStrikethrough,
  lucideTextAlignCenter,
  lucideTextAlignEnd,
  lucideTextAlignJustify,
  lucideTextAlignStart,
  lucideTextQuote,
  lucideUnderline,
  lucideUndo2,
  lucideBaseline,
  lucideFileText,
  lucidePilcrow,
} from '@livediagram/icons/lucide';
import { lucideGlyph, Tooltip } from '@livediagram/ui';
import type { DocAlign, DocParagraphStyle } from '@livediagram/document';
import { Portal } from '@/components/primitives/Portal';
import {
  requestStylePanel,
  useActiveDoc,
  useDocLinkRequest,
  type ActiveDoc,
} from '@/lib/doc/doc-editor-store';
import {
  clearFormatting,
  setAlign,
  setBlockStyle,
  setHighlight,
  setLink,
  setTextColor,
  shiftLevel,
  toggleBold,
  toggleItalic,
  toggleList,
  toggleStrike,
  toggleUnderline,
} from '@/lib/doc/doc-commands';
import { docSchema } from '@/lib/doc/doc-schema';
import { track } from '@/lib/telemetry';
import { LinkField, MenuRow, SwatchGrid, ToolbarPopover } from './page-toolbar-menus';

const I = (glyph: Parameters<typeof lucideGlyph>[0]) => lucideGlyph(glyph, 16);
const Icons = {
  bold: I(lucideBold),
  italic: I(lucideItalic),
  underline: I(lucideUnderline),
  strike: I(lucideStrikethrough),
  link: I(lucideLink),
  color: I(lucideBaseline),
  highlight: I(lucideHighlighter),
  bullet: I(lucideList),
  numbered: I(lucideListOrdered),
  todo: I(lucideListTodo),
  outdent: I(lucideIndentDecrease),
  indent: I(lucideIndentIncrease),
  undo: I(lucideUndo2),
  redo: I(lucideRedo2),
  clear: I(lucideRemoveFormatting),
  insert: I(lucidePlus),
  chevron: lucideGlyph(lucideChevronDown, 12),
  style: I(lucideFileText),
  left: I(lucideTextAlignStart),
  center: I(lucideTextAlignCenter),
  right: I(lucideTextAlignEnd),
  justify: I(lucideTextAlignJustify),
  divider: I(lucideSeparatorHorizontal),
  quote: I(lucideTextQuote),
  code: I(lucideSquareCode),
  pageBreak: I(lucidePilcrow),
};

// Screen px: the room the page's title bar takes above the sheet, and the gap above it.
const TITLE_BAR = 28;
const GAP = 8;

const mac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
const key = (k: string) =>
  mac
    ? k.replace('Mod-', '⌘').replace('Shift-', '⇧').replace('Alt-', '⌥')
    : k.replace('Mod-', 'Ctrl+').replace('Shift-', 'Shift+').replace('Alt-', 'Alt+');

const STYLES: { id: DocParagraphStyle | 'code'; label: string; preview: string; keys?: string }[] =
  [
    { id: 'body', label: 'Text', preview: 'text-sm', keys: 'Mod-Alt-0' },
    { id: 'title', label: 'Title', preview: 'text-xl font-bold' },
    { id: 'subtitle', label: 'Subtitle', preview: 'text-base text-slate-500' },
    { id: 'h1', label: 'Heading 1', preview: 'text-lg font-bold', keys: 'Mod-Alt-1' },
    { id: 'h2', label: 'Heading 2', preview: 'text-base font-semibold', keys: 'Mod-Alt-2' },
    { id: 'h3', label: 'Heading 3', preview: 'text-sm font-semibold', keys: 'Mod-Alt-3' },
    { id: 'quote', label: 'Quote', preview: 'text-sm italic border-l-2 border-brand-500 pl-2' },
    { id: 'code', label: 'Code', preview: 'font-mono text-xs' },
  ];

const ALIGNS: { id: DocAlign; label: string; icon: ReactNode; keys: string }[] = [
  { id: 'left', label: 'Align left', icon: <Icons.left />, keys: 'Mod-Shift-l' },
  { id: 'center', label: 'Align centre', icon: <Icons.center />, keys: 'Mod-Shift-e' },
  { id: 'right', label: 'Align right', icon: <Icons.right />, keys: 'Mod-Shift-r' },
  { id: 'justify', label: 'Justify', icon: <Icons.justify />, keys: 'Mod-Shift-j' },
];

// The page toolbar's telemetry (docs/specs/007-editor/document-pages.md "Telemetry").
const FORMAT_EVENT = { format: 'DocFormat', block: 'DocBlockStyle', link: 'DocLink' } as const;
const INSERT_EVENT = {
  Divider: 'DocDivider',
  'Page break': 'DocPageBreak',
  Quote: 'DocQuote',
  Code: 'DocCode',
} as const;

type Open = 'style' | 'align' | 'color' | 'highlight' | 'link' | 'insert' | null;

export function PageToolbar({
  accent,
  onInsert,
}: {
  // The document's accent (the theme's when it has none of its own).
  accent: string;
  // An insert the writing alone cannot make (a zone): handled by the host.
  onInsert?: (what: 'image' | 'table' | 'chart' | 'drawing') => void;
}) {
  const active = useActiveDoc();
  const bar = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState<Open>(null);
  const linkRequest = useDocLinkRequest();
  // ⌘K in the writing opens the link field.
  const [seenLink, setSeenLink] = useState(linkRequest);
  if (linkRequest !== seenLink) {
    setSeenLink(linkRequest);
    if (active) setOpen('link');
  }
  // A popover goes with the document.
  if (!active && open) setOpen(null);

  const pageId = active?.pageId ?? null;
  useLayoutEffect(() => {
    if (!pageId) return;
    let raf = 0;
    const follow = () => {
      raf = requestAnimationFrame(follow);
      const el = bar.current;
      const sheet = document.querySelector(`[data-illustrate-page-id="${CSS.escape(pageId)}"]`);
      const canvas = document.querySelector('[data-canvas-a11y-root]');
      if (!el || !sheet || !canvas) return;
      const r = sheet.getBoundingClientRect();
      const c = canvas.getBoundingClientRect();
      const strip = document
        .querySelector('[data-toolbar-palette]:not(.hidden)')
        ?.getBoundingClientRect();
      const floor =
        c.top +
        8 +
        (strip && strip.bottom > c.top && strip.top < c.top + 80 ? strip.bottom - c.top : 0);
      const h = el.offsetHeight;
      const w = el.offsetWidth;
      const visible = r.bottom > floor + h && r.top < c.bottom;
      const top = Math.max(floor, r.top - TITLE_BAR - GAP - h);
      const left = Math.max(c.left + 8, Math.min(r.left + r.width / 2 - w / 2, c.right - w - 8));
      el.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
      el.style.visibility = visible ? 'visible' : 'hidden';
    };
    follow();
    return () => cancelAnimationFrame(raf);
  }, [pageId]);

  if (!active) return null;
  const { handle, selection } = active;
  const run = (command: Parameters<typeof handle.run>[0], event?: keyof typeof FORMAT_EVENT) => {
    handle.run(command);
    if (event) track('Element', 'Changed', FORMAT_EVENT[event]);
  };
  const toggleOpen = (id: Open) => setOpen((o) => (o === id ? null : id));
  const close = () => {
    setOpen(null);
    handle.focus();
  };
  const styleLabel =
    selection.style === 'list'
      ? 'List'
      : (STYLES.find((s) => s.id === selection.style)?.label ?? 'Text');
  const words = handle.words();
  const alignNow = ALIGNS.find((a) => a.id === (selection.align ?? 'left')) ?? ALIGNS[0]!;

  return (
    <Portal>
      <div
        ref={bar}
        role="toolbar"
        aria-label="Document formatting"
        data-page-toolbar=""
        data-doc-keep-active=""
        onMouseDown={(e) => e.preventDefault()}
        onPointerDown={(e) => e.stopPropagation()}
        className="fixed left-0 top-0 z-[var(--z-overlay)] flex max-w-[calc(100vw-16px)] items-center gap-0.5 overflow-x-auto rounded-xl border border-slate-200 bg-white/95 p-1 shadow-lg shadow-slate-900/10 backdrop-blur [scrollbar-width:none] dark:border-slate-700 dark:bg-slate-900/95"
        style={{ visibility: 'hidden' }}
      >
        <Button label="Undo" keys="Mod-z" onPress={() => handle.undo()}>
          <Icons.undo />
        </Button>
        <Button label="Redo" keys="Mod-Shift-z" onPress={() => handle.redo()}>
          <Icons.redo />
        </Button>
        <Divider />
        <button
          data-anchor="style"
          type="button"
          aria-label={`Style: ${styleLabel}`}
          aria-haspopup="menu"
          aria-expanded={open === 'style'}
          onClick={() => toggleOpen('style')}
          className="flex h-8 min-w-[104px] items-center justify-between gap-2 rounded-md px-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          {styleLabel}
          <Icons.chevron />
        </button>
        <Divider />
        <Button
          label="Bold"
          keys="Mod-b"
          pressed={selection.marks.has('bold')}
          onPress={() => run(toggleBold, 'format')}
        >
          <Icons.bold />
        </Button>
        <Button
          label="Italic"
          keys="Mod-i"
          pressed={selection.marks.has('italic')}
          onPress={() => run(toggleItalic, 'format')}
        >
          <Icons.italic />
        </Button>
        <Button
          label="Underline"
          keys="Mod-u"
          pressed={selection.marks.has('underline')}
          onPress={() => run(toggleUnderline, 'format')}
        >
          <Icons.underline />
        </Button>
        <Button
          label="Strikethrough"
          keys="Mod-Shift-x"
          pressed={selection.marks.has('strike')}
          onPress={() => run(toggleStrike, 'format')}
        >
          <Icons.strike />
        </Button>
        <Button
          label="Text colour"
          anchor="color"
          pressed={open === 'color'}
          onPress={() => toggleOpen('color')}
        >
          <span className="relative flex flex-col items-center">
            <Icons.color />
            <span
              className="absolute -bottom-1 h-[3px] w-4 rounded-full"
              style={{ background: selection.color ?? 'currentColor' }}
            />
          </span>
        </Button>
        <Button
          label="Highlight"
          anchor="highlight"
          pressed={open === 'highlight'}
          onPress={() => toggleOpen('highlight')}
        >
          <span className="relative flex flex-col items-center">
            <Icons.highlight />
            {selection.highlight ? (
              <span
                className="absolute -bottom-1 h-[3px] w-4 rounded-full"
                style={{ background: selection.highlight }}
              />
            ) : null}
          </span>
        </Button>
        <Button
          label="Link"
          keys="Mod-k"
          anchor="link"
          pressed={open === 'link' || selection.marks.has('link')}
          onPress={() => toggleOpen('link')}
        >
          <Icons.link />
        </Button>
        <Divider />
        <Button
          label={alignNow.label}
          anchor="align"
          pressed={open === 'align'}
          onPress={() => toggleOpen('align')}
        >
          {alignNow.icon}
        </Button>
        <Button
          label="Bulleted list"
          keys="Mod-Shift-8"
          pressed={selection.list === 'bullet'}
          onPress={() => run(toggleList('bullet'), 'block')}
        >
          <Icons.bullet />
        </Button>
        <Button
          label="Numbered list"
          keys="Mod-Shift-7"
          pressed={selection.list === 'numbered'}
          onPress={() => run(toggleList('numbered'), 'block')}
        >
          <Icons.numbered />
        </Button>
        <Button
          label="To-do list"
          keys="Mod-Shift-9"
          pressed={selection.list === 'todo'}
          onPress={() => run(toggleList('todo'), 'block')}
        >
          <Icons.todo />
        </Button>
        <Button
          label="Decrease indent"
          keys="Shift-Tab"
          disabled={selection.list === null}
          onPress={() => run(shiftLevel(-1))}
        >
          <Icons.outdent />
        </Button>
        <Button
          label="Increase indent"
          keys="Tab"
          disabled={selection.list === null}
          onPress={() => run(shiftLevel(1))}
        >
          <Icons.indent />
        </Button>
        <Divider />
        <Button
          label="Insert"
          anchor="insert"
          pressed={open === 'insert'}
          onPress={() => toggleOpen('insert')}
        >
          <Icons.insert />
        </Button>
        <Button label="Clear formatting" keys="Mod-\\" onPress={() => run(clearFormatting)}>
          <Icons.clear />
        </Button>
        <Button
          label="Document style"
          onPress={() => {
            handle.flush();
            if (active.pageId) requestStylePanel(active.pageId);
          }}
        >
          <Icons.style />
        </Button>
        <span
          className="whitespace-nowrap px-2 text-[11px] tabular-nums text-slate-500 dark:text-slate-400"
          aria-live="polite"
        >
          {words.selected > 0
            ? `${words.selected.toLocaleString()} of ${words.total.toLocaleString()} words`
            : `${words.total.toLocaleString()} ${words.total === 1 ? 'word' : 'words'}`}
        </span>
      </div>
      {open === 'style' ? (
        <ToolbarPopover anchor="style" onClose={close} label="Text style" width={200}>
          <div role="menu" aria-label="Text style" className="flex flex-col">
            {STYLES.map((s) => (
              <MenuRow
                key={s.id}
                label={s.label}
                selected={selection.style === s.id}
                onPick={() => {
                  run(setBlockStyle(s.id), 'block');
                  setOpen(null);
                }}
              >
                <span className={`flex-1 truncate ${s.preview}`}>{s.label}</span>
                {s.keys ? <span className="text-[10px] text-slate-400">{key(s.keys)}</span> : null}
              </MenuRow>
            ))}
          </div>
        </ToolbarPopover>
      ) : null}
      {open === 'align' ? (
        <ToolbarPopover anchor="align" onClose={close} label="Alignment" width={190}>
          <div role="menu" aria-label="Alignment" className="flex flex-col">
            {ALIGNS.map((a) => (
              <MenuRow
                key={a.id}
                label={a.label}
                selected={(selection.align ?? 'left') === a.id}
                onPick={() => {
                  run(setAlign(a.id));
                  setOpen(null);
                }}
              >
                {a.icon}
                <span className="flex-1">{a.label}</span>
                <span className="text-[10px] text-slate-400">{key(a.keys)}</span>
              </MenuRow>
            ))}
          </div>
        </ToolbarPopover>
      ) : null}
      {open === 'color' || open === 'highlight' ? (
        <ToolbarPopover
          anchor={open}
          onClose={close}
          label={open === 'color' ? 'Text colour' : 'Highlight'}
        >
          <SwatchGrid
            kind={open === 'color' ? 'text' : 'highlight'}
            accent={accent}
            current={open === 'color' ? selection.color : selection.highlight}
            onPick={(c) => {
              run(open === 'color' ? setTextColor(c) : setHighlight(c), 'format');
              setOpen(null);
            }}
          />
        </ToolbarPopover>
      ) : null}
      {open === 'link' ? (
        <ToolbarPopover anchor="link" onClose={close} label="Link">
          <LinkField
            initial={selection.link ?? ''}
            onApply={(href) => {
              run(setLink(href), 'link');
              close();
            }}
            onRemove={
              selection.link
                ? () => {
                    run(setLink(null));
                    close();
                  }
                : null
            }
            onCancel={close}
          />
        </ToolbarPopover>
      ) : null}
      {open === 'insert' ? (
        <ToolbarPopover anchor="insert" onClose={close} label="Insert" width={200}>
          <InsertMenu
            active={active}
            onInsert={(what) => {
              setOpen(null);
              onInsert?.(what);
            }}
            onDone={() => setOpen(null)}
          />
        </ToolbarPopover>
      ) : null}
    </Portal>
  );
}

function InsertMenu({
  active,
  onInsert,
  onDone,
}: {
  active: ActiveDoc;
  onInsert: (what: 'image' | 'table' | 'chart' | 'drawing') => void;
  onDone: () => void;
}) {
  const S = docSchema;
  const blocks: { label: keyof typeof INSERT_EVENT; icon: ReactNode; make: () => void }[] = [
    {
      label: 'Divider',
      icon: <Icons.divider />,
      make: () => active.handle.insert([S.nodes.divider!.create()]),
    },
    {
      label: 'Page break',
      icon: <Icons.pageBreak />,
      make: () => active.handle.insert([S.nodes.page_break!.create(), S.nodes.paragraph!.create()]),
    },
    {
      label: 'Quote',
      icon: <Icons.quote />,
      make: () => active.handle.insert([S.nodes.paragraph!.create({ style: 'quote' })]),
    },
    {
      label: 'Code',
      icon: <Icons.code />,
      make: () => active.handle.insert([S.nodes.code_block!.create()]),
    },
  ];
  const zones: { id: 'image' | 'table' | 'chart' | 'drawing'; label: string }[] = [
    { id: 'image', label: 'Image' },
    { id: 'table', label: 'Table' },
    { id: 'chart', label: 'Chart' },
    { id: 'drawing', label: 'Drawing' },
  ];
  return (
    <div role="menu" aria-label="Insert" className="flex flex-col">
      {zones.map((z) => (
        <MenuRow key={z.id} label={z.label} onPick={() => onInsert(z.id)}>
          <span className="flex-1">{z.label}</span>
        </MenuRow>
      ))}
      <div className="my-1 h-px bg-slate-100 dark:bg-slate-800" />
      {blocks.map((b) => (
        <MenuRow
          key={b.label}
          label={b.label}
          onPick={() => {
            b.make();
            track('Element', 'Added', INSERT_EVENT[b.label]);
            onDone();
          }}
        >
          {b.icon}
          <span className="flex-1">{b.label}</span>
        </MenuRow>
      ))}
    </div>
  );
}

function Divider() {
  return <span aria-hidden className="mx-0.5 h-5 w-px shrink-0 bg-slate-200 dark:bg-slate-700" />;
}

function Button({
  label,
  keys,
  pressed,
  disabled,
  onPress,
  onClick,
  anchor,
  children,
}: {
  label: string;
  keys?: string;
  pressed?: boolean;
  disabled?: boolean;
  onPress: () => void;
  onClick?: () => void;
  // The name a popover finds this button by, to hang under it.
  anchor?: string;
  children: ReactNode;
}) {
  const name = keys ? `${label} (${key(keys)})` : label;
  return (
    <Tooltip label={name}>
      <button
        data-anchor={anchor}
        type="button"
        aria-label={name}
        aria-pressed={pressed}
        disabled={disabled}
        onClick={() => {
          onClick?.();
          onPress();
        }}
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition focus-visible:outline-2 focus-visible:outline-brand-600 disabled:opacity-35 ${
          pressed
            ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100'
        }`}
      >
        {children}
      </button>
    </Tooltip>
  );
}
