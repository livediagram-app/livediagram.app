'use client';

// The page toolbar (docs/specs/007-editor/article-pages.md "The page toolbar"): formatting for the
// article being worked on (or the article page under the pointer), a card fixed at the top of its
// page, inside it, centred in the top margin, at one screen size, dressed as the Toolbar layout's
// strip (toolbar-surface.ts). It never leaves the page: it narrows to the page's width on screen,
// and goes from view with the page's top. Its buttons never take focus: the caret stays in the writing.
// Kept short: the formats used all the time are buttons; lists, alignment, colours, inserts and
// the less used formats are menus (page-toolbar-panels.tsx). Where it sits is
// page-toolbar-placement.ts; which article it is for, page-toolbar-presence.ts. While the palette's
// kind is Article it docks in the Toolbar strip instead (lib/article/article-dock.ts).
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  lucideBaseline,
  lucideBold,
  lucideCircleCheck,
  lucideEllipsis,
  lucideItalic,
  lucideLink,
  lucideList,
  lucideMessageSquare,
  lucideTable,
  lucideType,
  lucideUnderline,
} from '@liveworkspace/icons/lucide';
import { ChevronDownIcon, lucideGlyph, Portal } from '@liveknowledge/ui';
import { TOOLBAR_TRIGGER_TONE } from '@liveworkspace/workbench/components/palette/PaletteDropdown';
import {
  TOOLBAR_CARD,
  TOOLBAR_CONTROL_PRESSED,
} from '@liveworkspace/workbench/components/chrome/toolbar-surface';
import { useCanvasGesture } from '@liveworkspace/workbench/lib/canvas-gesture';
import { useIsMobileViewport } from '@liveworkspace/workbench/hooks/ui/useIsMobileViewport';
import {
  useArticleLinkRequest,
  useArticleCommentRequest,
} from '@/lib/article/article-editor-store';
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
} from '@/lib/article/article-commands';
import { articleCountsOf } from '@/lib/article/article-word-count';
import { selectNextLongSentence } from '@/lib/article/article-long-sentences';
import { track } from '@/lib/telemetry';
import {
  tableCommand,
  tableCommandBlock,
  type TableCommandName,
} from '@/lib/article/article-table-commands';
import { Button, Divider, LinkField, ToolbarPopover } from './page-toolbar-menus';
import { TablePanel } from './page-toolbar-table';
import { usePageToolbarPlacement } from '@liveworkspace/workbench/components/canvas/article/page-toolbar-placement';
import { useShownArticle } from './page-toolbar-presence';
import {
  AlignGlyph,
  AlignPanel,
  ColourPanel,
  LIST_OPTIONS,
  ListGlyph,
  ListPanel,
  MorePanel,
  STYLE_OPTIONS,
  StylePanel,
  type MoreAction,
} from './page-toolbar-panels';

const I = (glyph: Parameters<typeof lucideGlyph>[0]) => lucideGlyph(glyph, 16);
const Bold = I(lucideBold);
const Italic = I(lucideItalic);
const Underline = I(lucideUnderline);
const LinkIcon = I(lucideLink);
const Colour = I(lucideBaseline);
const ListIcon = I(lucideList);
const More = I(lucideEllipsis);
const CommentIcon = I(lucideMessageSquare);
const ActionIcon = I(lucideCircleCheck);
const TableIcon = I(lucideTable);
const TypeIcon = lucideGlyph(lucideType, 14);

// The page toolbar's telemetry (docs/specs/007-editor/article-pages.md "Telemetry").
const FORMAT_EVENT = {
  format: 'ArticleFormat',
  block: 'ArticleBlockStyle',
  link: 'ArticleLink',
} as const;

// Why the formatting controls rest in the Title.
const IN_TITLE_WHY = 'The Title keeps its own style.';

type Open = 'style' | 'list' | 'align' | 'colour' | 'link' | 'table' | 'more' | null;

export function PageToolbar({
  accent,
  topRoomOf,
  articlePages,
  onNote,
}: {
  // A comment or an action on the selected text (a margin note): handled by the host.
  onNote?: (flow: string, kind: 'comment' | 'action') => void;
  // The article pages on the tab that may be written on, each with its article: what a hover or a
  // press is measured on. An article with a locked page is left out (it is read-only), so the
  // toolbar never shows for it, hovered or worked on.
  articlePages: readonly { id: string; flow: string }[];
  // The screen px of a page's top margin at the current zoom: the room the band sits in.
  topRoomOf: (pageId: string) => number;
  // The article's accent (the theme's when it has none of its own).
  accent: string;
}) {
  // Which article it is for, worked on, hovered or kept docked (page-toolbar-presence.ts).
  const { active, dock, shown, letGo } = useShownArticle(articlePages);
  const [open, setOpen] = useState<Open>(null);
  const linkRequest = useArticleLinkRequest();
  // ⌘K in the writing opens the link field.
  const [seenLink, setSeenLink] = useState(linkRequest);
  if (linkRequest !== seenLink) {
    setSeenLink(linkRequest);
    if (active) setOpen('link');
  }
  // ⌘⌥M in the writing puts a comment on the selected text.
  const commentRequest = useArticleCommentRequest();
  const seenComment = useRef(commentRequest);
  const noteNow = useRef({ active, onNote, articlePages });
  useLayoutEffect(() => {
    noteNow.current = { active, onNote, articlePages };
  });
  useEffect(() => {
    if (commentRequest === seenComment.current) return;
    seenComment.current = commentRequest;
    const { active: a, onNote: note } = noteNow.current;
    // Text in a table's cell takes no margin note (a note marks a block's own runs).
    if (a?.selection.hasText && !a.selection.inTable) note?.(a.handle.flow, 'comment');
  }, [commentRequest]);
  // A menu hangs where it opened: the view panning or zooming away from it closes it.
  const gesture = useCanvasGesture();
  // Docked, the menus hang from the strip, which a pan or a zoom does not move.
  if (!dock && (gesture === 'pan' || gesture === 'zoom') && open) setOpen(null);
  // A menu goes with the article.
  if (!shown && open) setOpen(null);
  // The Table menu goes with the caret leaving the table.
  if (open === 'table' && !shown?.selection.inTable) setOpen(null);

  const phone = useIsMobileViewport();
  // On a phone the bar is up while the caret is in the writing, or while one of its own menus is
  // open (a menu's field takes the caret): with the caret gone it gives the top row back (its menu
  // button, Pages and Share), as there is nowhere off the page to press on a phone.
  const phoneIdle = phone && !dock && letGo && open === null;
  const bar = usePageToolbarPlacement({
    pageId: dock || phoneIdle ? null : (shown?.pageId ?? null),
    phone,
    topRoomOf,
  });

  if (!shown || phoneIdle) return null;
  const { handle, selection } = shown;
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
  const styleOption =
    selection.style === 'list'
      ? LIST_OPTIONS.find((l) => l.id === selection.list)
      : STYLE_OPTIONS.find((s) => s.id === selection.style);
  const styleLabel = styleOption?.label ?? (selection.style === 'list' ? 'List' : 'Text');
  // On a phone the button shows the short name (H1, Bullets) and is only as wide as it, so no room
  // is spent on the longest style's width; its accessible name stays the full one.
  const styleShown = phone ? (styleOption?.short ?? styleLabel) : styleLabel;
  const reshapeTable = (name: TableCommandName) => {
    if (handle.run(tableCommand(name))) track('Element', 'Changed', 'ArticleTableShape');
  };
  const more = (action: MoreAction) => {
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

  // The Title keeps its own style: no formatting applies to it (owner 2026-11-21), so every control rests while the
  // caret or selection is in it.
  const inTitle = selection.style === 'title';
  const controls = (
    <div
      ref={dock ? undefined : bar}
      role="toolbar"
      aria-label="Article Formatting"
      data-page-toolbar=""
      data-article-keep-active=""
      onMouseDown={(e) => e.preventDefault()}
      onPointerDown={(e) => e.stopPropagation()}
      className={
        dock
          ? 'flex min-w-0 items-center gap-0.5'
          : `fixed left-0 top-0 z-[var(--z-toolbar)] overflow-x-auto [scrollbar-width:none] ${TOOLBAR_CARD}`
      }
      style={dock ? undefined : { visibility: 'hidden' }}
    >
      <button
        data-anchor="style"
        type="button"
        aria-label={`Style: ${styleLabel}`}
        aria-haspopup="menu"
        aria-expanded={open === 'style'}
        disabled={inTitle}
        onClick={() => toggleOpen('style')}
        // As wide as its style's name needs ("Text" stays short): no fixed width leaving space after a short name.
        className={`flex h-9 shrink-0 cursor-pointer items-center gap-1.5 disabled:cursor-default disabled:opacity-40 rounded-md px-2 text-xs font-medium transition focus-visible:outline-2 focus-visible:outline-brand-600 ${
          open === 'style' ? TOOLBAR_CONTROL_PRESSED : TOOLBAR_TRIGGER_TONE
        }`}
      >
        <TypeIcon />
        <span className="flex-1 truncate text-left">{styleShown}</span>
        <ChevronDownIcon className="shrink-0" />
      </button>
      <Divider />
      <Button
        disabled={inTitle}
        why={inTitle ? IN_TITLE_WHY : undefined}
        label="Bold"
        description="Make the selected words bold."
        keys="Mod-b"
        pressed={selection.marks.has('bold')}
        onPress={() => run(toggleBold, 'format')}
      >
        <Bold />
      </Button>
      <Button
        disabled={inTitle}
        why={inTitle ? IN_TITLE_WHY : undefined}
        label="Italic"
        description="Set the selected words in italics."
        keys="Mod-i"
        pressed={selection.marks.has('italic')}
        onPress={() => run(toggleItalic, 'format')}
      >
        <Italic />
      </Button>
      <Button
        disabled={inTitle}
        why={inTitle ? IN_TITLE_WHY : undefined}
        label="Underline"
        description="Underline the selected words."
        keys="Mod-u"
        pressed={selection.marks.has('underline')}
        onPress={() => run(toggleUnderline, 'format')}
      >
        <Underline />
      </Button>
      <Button
        disabled={inTitle}
        why={inTitle ? IN_TITLE_WHY : undefined}
        label="Colour"
        description="Colour the selected words, or highlight them."
        anchor="colour"
        menu
        popup="dialog"
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
        disabled={inTitle}
        why={inTitle ? IN_TITLE_WHY : undefined}
        label="Link"
        description="Link the selected words to a web address."
        keys="Mod-k"
        anchor="link"
        pressed={open === 'link' || selection.marks.has('link')}
        onPress={() => toggleOpen('link')}
      >
        <LinkIcon />
      </Button>
      <Divider />
      <Button
        disabled={inTitle}
        why={inTitle ? IN_TITLE_WHY : undefined}
        label="Lists"
        description="Bullets, numbers or a checklist, and their indent."
        anchor="list"
        menu
        expanded={open === 'list'}
        pressed={selection.list !== null}
        onPress={() => toggleOpen('list')}
      >
        {selection.list ? <ListGlyph list={selection.list} /> : <ListIcon />}
      </Button>
      <Button
        disabled={inTitle}
        why={inTitle ? IN_TITLE_WHY : undefined}
        label="Alignment"
        description="Line the paragraph up left, centred, right or justified."
        anchor="align"
        menu
        expanded={open === 'align'}
        onPress={() => toggleOpen('align')}
      >
        <AlignGlyph align={selection.align ?? 'left'} />
      </Button>
      <Button
        disabled={inTitle}
        why={inTitle ? IN_TITLE_WHY : undefined}
        label="More Formatting"
        description="Strikethrough, code, superscript, subscript and the word count."
        anchor="more"
        menu
        expanded={open === 'more'}
        onPress={() => toggleOpen('more')}
      >
        <More />
      </Button>
      {selection.inTable ? (
        <Button
          disabled={inTitle}
          why={inTitle ? IN_TITLE_WHY : undefined}
          label="Table"
          description="Add and remove rows and columns, and set the header."
          anchor="table"
          menu
          expanded={open === 'table'}
          onPress={() => toggleOpen('table')}
        >
          <TableIcon />
        </Button>
      ) : null}
      <Divider />
      <Button
        label="Comment"
        description="Start a comment on the selected words."
        keys="Mod-Alt-m"
        disabled={inTitle || !selection.hasText || selection.inTable || !onNote}
        why={inTitle ? IN_TITLE_WHY : selection.inTable ? NO_NOTE_IN_TABLE : undefined}
        onPress={() => onNote?.(handle.flow, 'comment')}
      >
        <CommentIcon />
      </Button>
      <Button
        label="Assign Action"
        description="Give someone an action on the selected words."
        disabled={inTitle || !selection.hasText || selection.inTable || !onNote}
        why={inTitle ? IN_TITLE_WHY : selection.inTable ? NO_NOTE_IN_TABLE : undefined}
        onPress={() => onNote?.(handle.flow, 'action')}
      >
        <ActionIcon />
      </Button>
    </div>
  );

  return (
    <>
      {dock ? createPortal(controls, dock) : <Portal>{controls}</Portal>}
      {open === 'style' ? (
        <ToolbarPopover anchor="style" menu onClose={close} label="Text Style" width={210}>
          <StylePanel
            selection={selection}
            onStyle={(style) => choose(() => run(setBlockStyle(style), 'block'))}
          />
        </ToolbarPopover>
      ) : null}
      {open === 'list' ? (
        <ToolbarPopover anchor="list" menu onClose={close} label="Lists" width={230}>
          <ListPanel
            selection={selection}
            onList={(list) => choose(() => run(toggleList(list), 'block'))}
            onIndent={(by) => choose(() => run(shiftLevel(by)))}
          />
        </ToolbarPopover>
      ) : null}
      {open === 'align' ? (
        <ToolbarPopover anchor="align" menu onClose={close} label="Alignment" width={210}>
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
      {open === 'table' ? (
        <ToolbarPopover anchor="table" menu onClose={close} label="Table" width={236}>
          <TablePanel
            header={selection.tableHeader}
            blockedOf={(name) => tableCommandBlock(handle.state(), name)}
            onCommand={(name) => choose(() => reshapeTable(name))}
          />
        </ToolbarPopover>
      ) : null}
      {open === 'more' ? (
        <ToolbarPopover anchor="more" menu onClose={close} label="More Formatting" width={272}>
          <MorePanel
            selection={selection}
            // Read only while the menu is open, from the writing as typed: never on the typing path.
            counts={articleCountsOf(handle.state())}
            onAction={(a) => choose(() => more(a))}
            // The next long sentence selected, the menu shut and the writing in focus, so it can be split.
            onNextLong={() => {
              if (handle.run(selectNextLongSentence)) track('UI', 'Used', 'LongSentenceSelected');
              close();
            }}
          />
        </ToolbarPopover>
      ) : null}
    </>
  );
}

// A margin note sits beside a line of the writing, never in a table's cell.
const NO_NOTE_IN_TABLE = 'Not available in a table';
