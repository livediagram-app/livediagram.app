'use client';

// The page toolbar (docs/specs/007-editor/document-pages.md "The page toolbar"): formatting for the
// document being written in, centred above the top of the page holding the caret, over the page's
// title bar, at one screen size. When that spot is above the canvas it pins under the canvas's top
// edge while the page is in view. Its buttons never take focus: the caret stays in the writing.
// Kept short: the formats used all the time are buttons; lists, alignment, colours, inserts and
// the less used formats are menus (page-toolbar-panels.tsx). It follows the page by measuring the
// sheet each frame while it is shown (a pan or a zoom moves it with no render).
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import {
  lucideBaseline,
  lucideBold,
  lucideChevronDown,
  lucideEllipsis,
  lucideItalic,
  lucideLink,
  lucideList,
  lucidePlus,
  lucideUnderline,
} from '@livediagram/icons/lucide';
import { lucideGlyph, Tooltip } from '@livediagram/ui';
import { Portal } from '@/components/primitives/Portal';
import { requestStylePanel, useActiveDoc, useDocLinkRequest } from '@/lib/doc/doc-editor-store';
import {
  clearFormatting,
  setAlign,
  setBlockStyle,
  setHighlight,
  setLink,
  setTextColor,
  shiftLevel,
  toggleBold,
  toggleCode,
  toggleItalic,
  toggleList,
  toggleStrike,
  toggleSub,
  toggleSup,
  toggleUnderline,
} from '@/lib/doc/doc-commands';
import { docSchema } from '@/lib/doc/doc-schema';
import { track } from '@/lib/telemetry';
import { LinkField, ToolbarPopover } from './page-toolbar-menus';
import {
  AlignGlyph,
  AlignPanel,
  ColourPanel,
  InsertPanel,
  keyLabel,
  LIST_OPTIONS,
  ListGlyph,
  ListPanel,
  MorePanel,
  STYLE_OPTIONS,
  StylePanel,
  type BlockInsert,
  type MoreAction,
  type ObjectInsert,
} from './page-toolbar-panels';

const I = (glyph: Parameters<typeof lucideGlyph>[0]) => lucideGlyph(glyph, 16);
const Bold = I(lucideBold);
const Italic = I(lucideItalic);
const Underline = I(lucideUnderline);
const LinkIcon = I(lucideLink);
const Colour = I(lucideBaseline);
const ListIcon = I(lucideList);
const Plus = I(lucidePlus);
const More = I(lucideEllipsis);
const Chevron = lucideGlyph(lucideChevronDown, 12);

// Screen px: the room the page's title bar takes above the sheet, and the gap above it.
const TITLE_BAR = 28;
const GAP = 8;

// The page toolbar's telemetry (docs/specs/007-editor/document-pages.md "Telemetry").
const FORMAT_EVENT = { format: 'DocFormat', block: 'DocBlockStyle', link: 'DocLink' } as const;
const INSERT_EVENT = {
  divider: 'DocDivider',
  pageBreak: 'DocPageBreak',
  quote: 'DocQuote',
  code: 'DocCode',
} as const;

type Open = 'style' | 'list' | 'align' | 'colour' | 'link' | 'insert' | 'more' | null;

export function PageToolbar({
  accent,
  onInsert,
}: {
  // The document's accent (the theme's when it has none of its own).
  accent: string;
  // An insert the writing alone cannot make (an object or a drawing): handled by the host.
  onInsert?: (what: ObjectInsert) => void;
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
  // A menu goes with the document.
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
  const choose = (fn: () => void) => {
    fn();
    setOpen(null);
  };
  const styleLabel =
    selection.style === 'list'
      ? (LIST_OPTIONS.find((l) => l.id === selection.list)?.label ?? 'List')
      : (STYLE_OPTIONS.find((s) => s.id === selection.style)?.label ?? 'Text');
  const words = handle.words();
  const S = docSchema;
  const insertBlock = (what: BlockInsert) => {
    handle.insert(
      what === 'divider'
        ? [S.nodes.divider!.create()]
        : what === 'pageBreak'
          ? [S.nodes.page_break!.create(), S.nodes.paragraph!.create()]
          : what === 'quote'
            ? [S.nodes.paragraph!.create({ style: 'quote' })]
            : [S.nodes.code_block!.create()],
    );
    track('Element', 'Added', INSERT_EVENT[what]);
  };
  const more = (action: MoreAction) => {
    if (action === 'style') {
      handle.flush();
      if (active.pageId) requestStylePanel(active.pageId);
      return;
    }
    run(
      action === 'strike'
        ? toggleStrike
        : action === 'code'
          ? toggleCode
          : action === 'sup'
            ? toggleSup
            : action === 'sub'
              ? toggleSub
              : clearFormatting,
      action === 'clear' ? undefined : 'format',
    );
  };

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
        <button
          data-anchor="style"
          type="button"
          aria-label={`Style: ${styleLabel}`}
          aria-haspopup="menu"
          aria-expanded={open === 'style'}
          onClick={() => toggleOpen('style')}
          className="flex h-8 min-w-[112px] items-center justify-between gap-2 rounded-md px-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          {styleLabel}
          <Chevron />
        </button>
        <Divider />
        <Button
          label="Bold"
          keys="Mod-b"
          pressed={selection.marks.has('bold')}
          onPress={() => run(toggleBold, 'format')}
        >
          <Bold />
        </Button>
        <Button
          label="Italic"
          keys="Mod-i"
          pressed={selection.marks.has('italic')}
          onPress={() => run(toggleItalic, 'format')}
        >
          <Italic />
        </Button>
        <Button
          label="Underline"
          keys="Mod-u"
          pressed={selection.marks.has('underline')}
          onPress={() => run(toggleUnderline, 'format')}
        >
          <Underline />
        </Button>
        <Button
          label="Colour"
          anchor="colour"
          menu
          expanded={open === 'colour'}
          onPress={() => toggleOpen('colour')}
        >
          <span className="relative flex flex-col items-center">
            <Colour />
            <span
              className="absolute -bottom-1 h-[3px] w-4 rounded-full"
              style={{ background: selection.highlight ?? selection.color ?? 'currentColor' }}
            />
          </span>
        </Button>
        <Button
          label="Link"
          keys="Mod-k"
          anchor="link"
          pressed={open === 'link' || selection.marks.has('link')}
          onPress={() => toggleOpen('link')}
        >
          <LinkIcon />
        </Button>
        <Divider />
        <Button
          label="Lists"
          anchor="list"
          menu
          expanded={open === 'list'}
          pressed={selection.list !== null}
          onPress={() => toggleOpen('list')}
        >
          {selection.list ? <ListGlyph list={selection.list} /> : <ListIcon />}
        </Button>
        <Button
          label="Alignment"
          anchor="align"
          menu
          expanded={open === 'align'}
          onPress={() => toggleOpen('align')}
        >
          <AlignGlyph align={selection.align ?? 'left'} />
        </Button>
        <Divider />
        <Button
          label="Insert"
          anchor="insert"
          menu
          expanded={open === 'insert'}
          onPress={() => toggleOpen('insert')}
        >
          <Plus />
        </Button>
        <Button
          label="More formatting"
          anchor="more"
          menu
          expanded={open === 'more'}
          onPress={() => toggleOpen('more')}
        >
          <More />
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
        <ToolbarPopover anchor="style" onClose={close} label="Text style" width={210}>
          <StylePanel
            selection={selection}
            onStyle={(style) => choose(() => run(setBlockStyle(style), 'block'))}
          />
        </ToolbarPopover>
      ) : null}
      {open === 'list' ? (
        <ToolbarPopover anchor="list" onClose={close} label="Lists" width={230}>
          <ListPanel
            selection={selection}
            onList={(list) => choose(() => run(toggleList(list), 'block'))}
            onIndent={(by) => choose(() => run(shiftLevel(by)))}
          />
        </ToolbarPopover>
      ) : null}
      {open === 'align' ? (
        <ToolbarPopover anchor="align" onClose={close} label="Alignment" width={210}>
          <AlignPanel
            selection={selection}
            onAlign={(align) => choose(() => run(setAlign(align)))}
          />
        </ToolbarPopover>
      ) : null}
      {open === 'colour' ? (
        <ToolbarPopover anchor="colour" onClose={close} label="Colour">
          <ColourPanel
            selection={selection}
            accent={accent}
            onColor={(c) => choose(() => run(setTextColor(c), 'format'))}
            onHighlight={(c) => choose(() => run(setHighlight(c), 'format'))}
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
          <InsertPanel
            onObject={(what) => choose(() => onInsert?.(what))}
            onBlock={(what) => choose(() => insertBlock(what))}
          />
        </ToolbarPopover>
      ) : null}
      {open === 'more' ? (
        <ToolbarPopover anchor="more" onClose={close} label="More formatting" width={220}>
          <MorePanel selection={selection} onAction={(a) => choose(() => more(a))} />
        </ToolbarPopover>
      ) : null}
    </Portal>
  );
}

function Divider() {
  return <span aria-hidden className="mx-0.5 h-5 w-px shrink-0 bg-slate-200 dark:bg-slate-700" />;
}

function Button({
  label,
  keys,
  pressed,
  menu,
  expanded,
  onPress,
  anchor,
  children,
}: {
  label: string;
  keys?: string;
  pressed?: boolean;
  // Opens a menu (a small chevron says so), open while `expanded`.
  menu?: boolean;
  expanded?: boolean;
  onPress: () => void;
  // The name a popover finds this button by, to hang under it.
  anchor?: string;
  children: ReactNode;
}) {
  const name = keys ? `${label} (${keyLabel(keys)})` : label;
  return (
    <Tooltip label={name}>
      <button
        data-anchor={anchor}
        type="button"
        aria-label={name}
        aria-pressed={menu ? undefined : pressed}
        aria-haspopup={menu ? 'menu' : undefined}
        aria-expanded={menu ? (expanded ?? false) : undefined}
        onClick={onPress}
        className={`flex h-8 shrink-0 items-center justify-center gap-0.5 rounded-md transition focus-visible:outline-2 focus-visible:outline-brand-600 disabled:opacity-35 ${
          menu ? 'pl-1.5 pr-1' : 'w-8'
        } ${
          pressed || expanded
            ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100'
        }`}
      >
        {children}
        {menu ? (
          <span className="text-slate-400 dark:text-slate-500">
            <Chevron />
          </span>
        ) : null}
      </button>
    </Tooltip>
  );
}
