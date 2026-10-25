'use client';

// What the page toolbar's menus hold (docs/specs/007-editor/article-pages.md "The page toolbar"):
// the text styles, the lists and indent, alignment, the colours (text and highlight together),
// the less used formats under More, and the inserts. Each entry runs a command on the writing (or
// asks the host to insert) and closes its menu.
import { keyLabel } from '@/lib/key-label';
import type { ReactNode } from 'react';
import {
  lucideChartColumn,
  lucideCode,
  lucideFileText,
  lucideImage,
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
  lucideTable,
  lucideTextAlignCenter,
  lucideTextAlignEnd,
  lucideTextAlignJustify,
  lucideTextAlignStart,
  lucideTextQuote,
} from '@liveworkspace/icons/lucide';
import { lucideGlyph } from '@livedocuments/ui';
import type { ArticleAlign, ArticleListKind, ArticleParagraphStyle } from '@livedocuments/document';
import type { ArticleSelectionState } from '@/lib/article/article-commands';
import { MenuRow } from './page-toolbar-menus';
import { ColourPicker } from '@/components/colour/ColourPicker';
import { noColour, standardGroup } from '@/components/colour/colour-options';
import { useDocumentColours } from '@/hooks/ui/useDocumentColours';

const I = (glyph: Parameters<typeof lucideGlyph>[0]) => lucideGlyph(glyph, 16);
const PanelIcons = {
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
  image: I(lucideImage),
  table: I(lucideTable),
  chart: I(lucideChartColumn),
};

const Keys = ({ k }: { k?: string }) =>
  k ? <span className="text-[10px] text-slate-500 dark:text-slate-400">{keyLabel(k)}</span> : null;

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
  // The Style button's label on a phone, where the toolbar has no room to spare.
  short?: string;
  preview: string;
  keys?: string;
}[] = [
  { id: 'body', label: 'Text', preview: 'text-sm', keys: 'Mod-Alt-0' },
  { id: 'title', label: 'Title', preview: 'text-xl font-bold' },
  { id: 'subtitle', label: 'Subtitle', preview: 'text-base text-slate-500' },
  { id: 'h1', label: 'Heading 1', short: 'H1', preview: 'text-lg font-bold', keys: 'Mod-Alt-1' },
  {
    id: 'h2',
    label: 'Heading 2',
    short: 'H2',
    preview: 'text-base font-semibold',
    keys: 'Mod-Alt-2',
  },
  {
    id: 'h3',
    label: 'Heading 3',
    short: 'H3',
    preview: 'text-sm font-semibold',
    keys: 'Mod-Alt-3',
  },
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
    <div role="menu" aria-label="Text Style" className="flex flex-col">
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

export const LIST_OPTIONS: { id: ArticleListKind; label: string; short: string; keys: string }[] = [
  { id: 'bullet', label: 'Bulleted list', short: 'Bullets', keys: 'Mod-Shift-8' },
  { id: 'numbered', label: 'Numbered list', short: 'Numbers', keys: 'Mod-Shift-7' },
  { id: 'todo', label: 'To-do list', short: 'To-do', keys: 'Mod-Shift-9' },
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

const ALIGN_OPTIONS: { id: ArticleAlign; label: string; keys: string }[] = [
  { id: 'left', label: 'Align Left', keys: 'Mod-Shift-l' },
  { id: 'center', label: 'Align Centre', keys: 'Mod-Shift-e' },
  { id: 'right', label: 'Align Right', keys: 'Mod-Shift-r' },
  { id: 'justify', label: 'Justify', keys: 'Mod-Shift-j' },
];

const alignIcon = (id: ArticleAlign) =>
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

// The colour pickers' own ids for the article's choices that are not a colour of their own.
const DEFAULT_COLOUR = 'default';
const ACCENT = 'accent';
const NO_HIGHLIGHT = 'none';

/**
 * Text colour and highlight in one place: two of the one colour picker
 * (docs/specs/004-interface-design/colour-picker.md). Text leads with Default and the article's
 * Accent before the strong standard colours; Highlight leads with No highlight before the soft
 * ones. Colours are for light paper, the page an article is written on.
 */
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
  const yours = useDocumentColours();
  const color = selection.color;
  const textValue =
    color === null ? DEFAULT_COLOUR : color.toLowerCase() === accent.toLowerCase() ? ACCENT : color;
  return (
    <div className="flex flex-col gap-3 p-1.5">
      <PickerTitle>Text Colour</PickerTitle>
      <ColourPicker
        label="Text colour"
        value={textValue}
        leading={[
          noColour(DEFAULT_COLOUR, 'Default colour'),
          { id: ACCENT, colour: accent, label: 'Accent' },
        ]}
        standard={[standardGroup('strong', 'light', 'hex')]}
        yours={yours}
        onPick={(id) => onColor(id === DEFAULT_COLOUR ? null : id === ACCENT ? accent : id)}
      />
      <PickerTitle divided>Highlight</PickerTitle>
      <ColourPicker
        label="Highlight"
        value={selection.highlight ?? NO_HIGHLIGHT}
        leading={[noColour(NO_HIGHLIGHT, 'No highlight')]}
        standard={[
          { heading: 'Highlights', options: standardGroup('soft', 'light', 'hex').options },
        ]}
        yours={yours}
        onPick={(id) => onHighlight(id === NO_HIGHLIGHT ? null : id)}
      />
    </div>
  );
}

// A picker's visible name, so the two pickers (each with its own Theme Palette) read apart at a glance; the
// picker's group already carries the name for assistive technology, so this one is not announced twice.
function PickerTitle({ children, divided = false }: { children: ReactNode; divided?: boolean }) {
  return (
    <p
      aria-hidden
      data-picker-title=""
      className={`-mb-1 text-[12px] font-semibold text-slate-700 dark:text-slate-200 ${
        divided ? 'border-t border-slate-200 pt-3 dark:border-slate-700' : ''
      }`}
    >
      {children}
    </p>
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
    <div role="menu" aria-label="More Formatting" className="flex flex-col">
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

// The Insert menu, dressed as the palette's rows (a glyph chip, the name, a line on what it is,
// the slash menu's own: lib/article/article-slash-items.ts): the objects, then the blocks.
const INSERT_OBJECTS: readonly {
  id: ObjectInsert;
  label: string;
  blurb: string;
  icon: ReactNode;
}[] = [
  { id: 'image', label: 'Image', blurb: 'A picture in the text', icon: <PanelIcons.image /> },
  { id: 'table', label: 'Table', blurb: 'Rows and columns', icon: <PanelIcons.table /> },
  {
    id: 'chart',
    label: 'Bar Chart',
    blurb: 'Compare values',
    icon: <PanelIcons.chart />,
  },
];
const INSERT_BLOCKS: readonly { id: BlockInsert; label: string; blurb: string; icon: ReactNode }[] =
  [
    {
      id: 'divider',
      label: 'Divider',
      blurb: 'A line across',
      icon: <PanelIcons.divider />,
    },
    {
      id: 'pageBreak',
      label: 'Page Break',
      blurb: 'Start the next page',
      icon: <PanelIcons.pageBreak />,
    },
    { id: 'quote', label: 'Quote', blurb: 'A quotation', icon: <PanelIcons.quote /> },
    {
      id: 'code',
      label: 'Code',
      blurb: 'Code, as typed',
      icon: <PanelIcons.codeBlock />,
    },
  ];

function InsertRow({
  label,
  blurb,
  icon,
  onPick,
}: {
  label: string;
  blurb: string;
  icon: ReactNode;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onPick}
      className="group flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-brand-600 dark:hover:bg-slate-800"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-600 transition group-hover:bg-white group-hover:text-brand-700 group-hover:shadow-sm dark:bg-slate-800 dark:text-slate-300 dark:group-hover:bg-slate-700 dark:group-hover:text-brand-100">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-semibold text-slate-900 dark:text-slate-100">
          {label}
        </span>
        <span className="block truncate text-[11px] leading-snug text-slate-500 dark:text-slate-400">
          {blurb}
        </span>
      </span>
    </button>
  );
}

const InsertHeading = ({ children }: { children: ReactNode }) => (
  <p className="px-2 pb-0.5 pt-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 first:pt-0.5 dark:text-slate-400">
    {children}
  </p>
);

export function InsertPanel({
  onObject,
  onBlock,
}: {
  onObject: (what: ObjectInsert) => void;
  onBlock: (what: BlockInsert) => void;
}) {
  return (
    <div role="menu" aria-label="Insert" className="flex flex-col">
      <InsertHeading>Objects</InsertHeading>
      {INSERT_OBJECTS.map((o) => (
        <InsertRow key={o.id} {...o} onPick={() => onObject(o.id)} />
      ))}
      <InsertHeading>Blocks</InsertHeading>
      {INSERT_BLOCKS.map((b) => (
        <InsertRow key={b.id} {...b} onPick={() => onBlock(b.id)} />
      ))}
    </div>
  );
}
