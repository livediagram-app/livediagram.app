'use client';

// What the page toolbar's menus hold (docs/specs/007-editor/article-pages.md "The page toolbar"):
// the text styles, the lists and indent, alignment, the colours (text and highlight together),
// the less used formats under More, and the inserts. Each entry runs a command on the writing (or
// asks the host to insert) and closes its menu.
import type { ReactNode } from 'react';
import {
  lucideCode,
  lucideFileText,
  lucideIndentDecrease,
  lucideIndentIncrease,
  lucideList,
  lucideListOrdered,
  lucideListTodo,
  lucidePilcrow,
  lucideRemoveFormatting,
  lucideSeparatorHorizontal,
  lucideSquareCode,
  lucideStrikethrough,
  lucideSubscript,
  lucideSuperscript,
  lucideTextAlignCenter,
  lucideTextAlignEnd,
  lucideTextAlignJustify,
  lucideTextAlignStart,
  lucideTextQuote,
} from '@livediagram/icons/lucide';
import { lucideGlyph } from '@livediagram/ui';
import type { ArticleAlign, ArticleListKind, ArticleParagraphStyle } from '@livediagram/document';
import type { ArticleSelectionState } from '@/lib/article/article-commands';
import { MenuRow, SwatchGrid } from './page-toolbar-menus';

const I = (glyph: Parameters<typeof lucideGlyph>[0]) => lucideGlyph(glyph, 16);
export const PanelIcons = {
  bullet: I(lucideList),
  numbered: I(lucideListOrdered),
  todo: I(lucideListTodo),
  outdent: I(lucideIndentDecrease),
  indent: I(lucideIndentIncrease),
  left: I(lucideTextAlignStart),
  center: I(lucideTextAlignCenter),
  right: I(lucideTextAlignEnd),
  justify: I(lucideTextAlignJustify),
  strike: I(lucideStrikethrough),
  code: I(lucideCode),
  sup: I(lucideSuperscript),
  sub: I(lucideSubscript),
  clear: I(lucideRemoveFormatting),
  style: I(lucideFileText),
  divider: I(lucideSeparatorHorizontal),
  quote: I(lucideTextQuote),
  codeBlock: I(lucideSquareCode),
  pageBreak: I(lucidePilcrow),
};

const mac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
/** A shortcut as this computer spells it (⌘B, Ctrl+B). */
export const keyLabel = (k: string) =>
  mac
    ? k.replace('Mod-', '⌘').replace('Shift-', '⇧').replace('Alt-', '⌥')
    : k.replace('Mod-', 'Ctrl+').replace('Shift-', 'Shift+').replace('Alt-', 'Alt+');

const Keys = ({ k }: { k?: string }) =>
  k ? <span className="text-[10px] text-slate-400 dark:text-slate-400">{keyLabel(k)}</span> : null;

const Row = ({
  label,
  icon,
  keys,
  selected,
  onPick,
  children,
}: {
  label: string;
  icon?: ReactNode;
  keys?: string;
  selected?: boolean;
  onPick: () => void;
  children?: ReactNode;
}) => (
  <MenuRow label={label} selected={selected} onPick={onPick}>
    {icon}
    <span className="flex-1">{children ?? label}</span>
    <Keys k={keys} />
  </MenuRow>
);

const Rule = () => <div className="my-1 h-px bg-slate-100 dark:bg-slate-800" />;

export const STYLE_OPTIONS: {
  id: ArticleParagraphStyle | 'code';
  label: string;
  preview: string;
  keys?: string;
}[] = [
  { id: 'body', label: 'Text', preview: 'text-sm', keys: 'Mod-Alt-0' },
  { id: 'title', label: 'Title', preview: 'text-xl font-bold' },
  { id: 'subtitle', label: 'Subtitle', preview: 'text-base text-slate-500' },
  { id: 'h1', label: 'Heading 1', preview: 'text-lg font-bold', keys: 'Mod-Alt-1' },
  { id: 'h2', label: 'Heading 2', preview: 'text-base font-semibold', keys: 'Mod-Alt-2' },
  { id: 'h3', label: 'Heading 3', preview: 'text-sm font-semibold', keys: 'Mod-Alt-3' },
  { id: 'quote', label: 'Quote', preview: 'text-sm italic border-l-2 border-brand-500 pl-2' },
  { id: 'code', label: 'Code', preview: 'font-mono text-xs' },
];

export function StylePanel({
  selection,
  onStyle,
}: {
  selection: ArticleSelectionState;
  onStyle: (style: ArticleParagraphStyle | 'code') => void;
}) {
  return (
    <div role="menu" aria-label="Text style" className="flex flex-col">
      {STYLE_OPTIONS.map((s) => (
        <MenuRow
          key={s.id}
          label={s.label}
          selected={selection.style === s.id}
          onPick={() => onStyle(s.id)}
        >
          <span className={`flex-1 truncate ${s.preview}`}>{s.label}</span>
          <Keys k={s.keys} />
        </MenuRow>
      ))}
    </div>
  );
}

export const LIST_OPTIONS: { id: ArticleListKind; label: string; keys: string }[] = [
  { id: 'bullet', label: 'Bulleted list', keys: 'Mod-Shift-8' },
  { id: 'numbered', label: 'Numbered list', keys: 'Mod-Shift-7' },
  { id: 'todo', label: 'To-do list', keys: 'Mod-Shift-9' },
];

export function ListPanel({
  selection,
  onList,
  onIndent,
}: {
  selection: ArticleSelectionState;
  onList: (list: ArticleListKind) => void;
  onIndent: (by: 1 | -1) => void;
}) {
  return (
    <div role="menu" aria-label="Lists" className="flex flex-col">
      {LIST_OPTIONS.map((l) => {
        const Icon = PanelIcons[l.id];
        return (
          <Row
            key={l.id}
            label={l.label}
            icon={<Icon />}
            keys={l.keys}
            selected={selection.list === l.id}
            onPick={() => onList(l.id)}
          />
        );
      })}
      {selection.list ? (
        <>
          <Rule />
          <Row
            label="Increase indent"
            icon={<PanelIcons.indent />}
            keys="Tab"
            onPick={() => onIndent(1)}
          />
          <Row
            label="Decrease indent"
            icon={<PanelIcons.outdent />}
            keys="Shift-Tab"
            onPick={() => onIndent(-1)}
          />
        </>
      ) : null}
    </div>
  );
}

export const ALIGN_OPTIONS: { id: ArticleAlign; label: string; keys: string }[] = [
  { id: 'left', label: 'Align left', keys: 'Mod-Shift-l' },
  { id: 'center', label: 'Align centre', keys: 'Mod-Shift-e' },
  { id: 'right', label: 'Align right', keys: 'Mod-Shift-r' },
  { id: 'justify', label: 'Justify', keys: 'Mod-Shift-j' },
];

export const alignIcon = (id: ArticleAlign) =>
  id === 'center'
    ? PanelIcons.center
    : id === 'right'
      ? PanelIcons.right
      : id === 'justify'
        ? PanelIcons.justify
        : PanelIcons.left;

/** An alignment's glyph. */
export function AlignGlyph({ align }: { align: ArticleAlign }) {
  switch (align) {
    case 'center':
      return <PanelIcons.center />;
    case 'right':
      return <PanelIcons.right />;
    case 'justify':
      return <PanelIcons.justify />;
    default:
      return <PanelIcons.left />;
  }
}

/** A list kind's glyph. */
export function ListGlyph({ list }: { list: ArticleListKind }) {
  switch (list) {
    case 'numbered':
      return <PanelIcons.numbered />;
    case 'todo':
      return <PanelIcons.todo />;
    default:
      return <PanelIcons.bullet />;
  }
}

export function AlignPanel({
  selection,
  onAlign,
}: {
  selection: ArticleSelectionState;
  onAlign: (align: ArticleAlign) => void;
}) {
  return (
    <div role="menu" aria-label="Alignment" className="flex flex-col">
      {ALIGN_OPTIONS.map((a) => {
        const Icon = alignIcon(a.id);
        return (
          <Row
            key={a.id}
            label={a.label}
            icon={<Icon />}
            keys={a.keys}
            selected={(selection.align ?? 'left') === a.id}
            onPick={() => onAlign(a.id)}
          />
        );
      })}
    </div>
  );
}

/** Text colour and highlight in one place. */
export function ColourPanel({
  selection,
  accent,
  onColor,
  onHighlight,
}: {
  selection: ArticleSelectionState;
  accent: string;
  onColor: (color: string | null) => void;
  onHighlight: (color: string | null) => void;
}) {
  return (
    <div className="flex flex-col">
      <p className="px-2 pt-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-400">
        Text
      </p>
      <SwatchGrid kind="text" accent={accent} current={selection.color} onPick={onColor} />
      <p className="px-2 pt-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-400">
        Highlight
      </p>
      <SwatchGrid
        kind="highlight"
        accent={accent}
        current={selection.highlight}
        onPick={onHighlight}
      />
    </div>
  );
}

export type MoreAction = 'strike' | 'code' | 'sup' | 'sub' | 'clear' | 'style';

/** The less used formats, clearing them, and the article's style. */
export function MorePanel({
  selection,
  onAction,
}: {
  selection: ArticleSelectionState;
  onAction: (action: MoreAction) => void;
}) {
  return (
    <div role="menu" aria-label="More formatting" className="flex flex-col">
      <Row
        label="Strikethrough"
        icon={<PanelIcons.strike />}
        keys="Mod-Shift-x"
        selected={selection.marks.has('strike')}
        onPick={() => onAction('strike')}
      />
      <Row
        label="Inline code"
        icon={<PanelIcons.code />}
        keys="Mod-e"
        selected={selection.marks.has('code')}
        onPick={() => onAction('code')}
      />
      <Row
        label="Superscript"
        icon={<PanelIcons.sup />}
        selected={selection.marks.has('sup')}
        onPick={() => onAction('sup')}
      />
      <Row
        label="Subscript"
        icon={<PanelIcons.sub />}
        selected={selection.marks.has('sub')}
        onPick={() => onAction('sub')}
      />
      <Rule />
      <Row
        label="Clear formatting"
        icon={<PanelIcons.clear />}
        keys="Mod-\\"
        onPick={() => onAction('clear')}
      />
      <Row label="Article style" icon={<PanelIcons.style />} onPick={() => onAction('style')} />
    </div>
  );
}

export type BlockInsert = 'divider' | 'pageBreak' | 'quote' | 'code';
export type ObjectInsert = 'image' | 'table' | 'chart' | 'drawing';

export function InsertPanel({
  onObject,
  onBlock,
}: {
  onObject: (what: ObjectInsert) => void;
  onBlock: (what: BlockInsert) => void;
}) {
  return (
    <div role="menu" aria-label="Insert" className="flex flex-col">
      <Row label="Image" onPick={() => onObject('image')} />
      <Row label="Table" onPick={() => onObject('table')} />
      <Row label="Chart" onPick={() => onObject('chart')} />
      <Rule />
      <Row label="Divider" icon={<PanelIcons.divider />} onPick={() => onBlock('divider')} />
      <Row label="Page break" icon={<PanelIcons.pageBreak />} onPick={() => onBlock('pageBreak')} />
      <Row label="Quote" icon={<PanelIcons.quote />} onPick={() => onBlock('quote')} />
      <Row label="Code" icon={<PanelIcons.codeBlock />} onPick={() => onBlock('code')} />
    </div>
  );
}
