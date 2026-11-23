'use client';

import type { ReactNode } from 'react';
import { Switch, Tooltip } from '@liveworkspace/ui';
import {
  BoldIcon,
  ItalicIcon,
  StrikethroughIcon,
  UnderlineIcon,
} from '../palette/text-style-icons';

// The Table dialog's controls (each editor's docs/specs/008-canvas/canvas-and-palette.md "The Table dialog"): how
// the table reads (a header row, a header column, zebra striping) and its cells' words (bold, italic, underline,
// strikethrough, size and colour, for every cell at once). They were two categories of the element menu, Table and
// Text; the menu's Table row opens them here instead. Each change is made at once, on the selected table. The
// editor hands in the table's look, what each control does, and its own colour picker and Text Size control (both
// read the editor's model), from its components/dialogs/ElementRowsDialogs.tsx.
export type TableLook = {
  headerRow?: boolean;
  headerColumn?: boolean;
  zebra?: boolean;
  textBold?: boolean;
  textItalic?: boolean;
  textUnderline?: boolean;
  textStrikethrough?: boolean;
};

/** The text styles the Text group toggles, named as the element stores them. */
export type TableTextStyle = 'textBold' | 'textItalic' | 'textUnderline' | 'textStrikethrough';

function Group({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {title}
        </h3>
        {note ? <span className="text-xs text-slate-500 dark:text-slate-400">{note}</span> : null}
      </div>
      <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
        {children}
      </div>
    </section>
  );
}

function SwitchLine({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3 border-t border-slate-100 px-4 py-3 first:border-t-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50">
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-slate-900 dark:text-slate-100">
          {label}
        </span>
        <span className="block text-xs text-slate-500 dark:text-slate-400">{description}</span>
      </span>
      <Switch checked={checked} onChange={onChange} label={label} />
    </label>
  );
}

function StyleToggle({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Tooltip label={label}>
      <button
        type="button"
        aria-label={label}
        aria-pressed={active}
        onClick={onClick}
        className={`flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
          active
            ? 'border-brand-300 bg-brand-50 text-brand-700 dark:border-brand-500/50 dark:bg-brand-500/15 dark:text-brand-200'
            : 'border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
        }`}
      >
        {children}
      </button>
    </Tooltip>
  );
}

export function TableSettings({
  look,
  onHeaderRow,
  onHeaderColumn,
  onZebra,
  onToggleStyle,
  colour,
  size,
}: {
  look: TableLook;
  onHeaderRow: (next: boolean) => void;
  onHeaderColumn: (next: boolean) => void;
  onZebra: (next: boolean) => void;
  onToggleStyle: (style: TableTextStyle) => void;
  /** The editor's text colour picker, a swatch button. */
  colour: ReactNode;
  /** The editor's Text Size control. */
  size: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-5">
      <Group title="Table">
        <SwitchLine
          label="Header Row"
          description="Style the first row as a header."
          checked={look.headerRow ?? false}
          onChange={onHeaderRow}
        />
        <SwitchLine
          label="Header Column"
          description="Style the first column as a header."
          checked={look.headerColumn ?? false}
          onChange={onHeaderColumn}
        />
        <SwitchLine
          label="Zebra Striping"
          description="Tint alternate body rows."
          checked={look.zebra ?? false}
          onChange={onZebra}
        />
      </Group>
      <Group title="Text" note="Applies to every cell.">
        <div className="flex flex-wrap items-center gap-2 px-4 py-3">
          <StyleToggle
            label="Bold"
            active={!!look.textBold}
            onClick={() => onToggleStyle('textBold')}
          >
            <BoldIcon />
          </StyleToggle>
          <StyleToggle
            label="Italic"
            active={!!look.textItalic}
            onClick={() => onToggleStyle('textItalic')}
          >
            <ItalicIcon />
          </StyleToggle>
          <StyleToggle
            label="Underline"
            active={!!look.textUnderline}
            onClick={() => onToggleStyle('textUnderline')}
          >
            <UnderlineIcon />
          </StyleToggle>
          <StyleToggle
            label="Strikethrough"
            active={!!look.textStrikethrough}
            onClick={() => onToggleStyle('textStrikethrough')}
          >
            <StrikethroughIcon />
          </StyleToggle>
          <span className="ml-auto flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            Colour
            {colour}
          </span>
        </div>
        <div className="border-t border-slate-100 py-1 dark:border-slate-800">{size}</div>
      </Group>
    </div>
  );
}
