// The floating WYSIWYG toolbar shown above an element while its label is
// being edited (spec/09). Per-range bold / italic / underline /
// strikethrough + list controls as plain icon buttons, whole-element
// alignment as a dropdown, and the selection colour swatch. Everything
// else the old ⋯ overflow menu carried (Font / Size / Padding) lives in
// the element context menu's Text flyout now, so the toolbar holds only
// the live-selection verbs. Rendered by RichTextEditor (which owns the
// selection + apply handlers); this component is presentation + the
// focus-preservation detail.

import { AlignmentGrid } from '@/components/palette/palette-controls';
import { AlignIcon as AlignLinesIcon } from '@/components/canvas/table-icons';
import {
  BoldIcon,
  ItalicIcon,
  StrikethroughIcon,
  UnderlineIcon,
} from '@/components/palette/palette-icons';
import { Tooltip } from '@/components/primitives/Tooltip';
import { BlockTypePicker } from '@/components/rich-text/BlockTypePicker';
import { noFocusSteal, ToolbarDropdown } from '@/components/rich-text/ToolbarDropdown';
import type { ActiveFormat } from '@/components/rich-text/rich-text-format';
import type {
  ListStyle,
  RunBoolKey,
  RunHeading,
  TextAlignX,
  TextAlignY,
} from '@livediagram/diagram';

// Matches the element toolbar's PopoverButton (h-8 w-8 rounded-md, same
// active + hover tones) so the two toolbars read as one system.
function btnClass(active: boolean): string {
  return `flex h-8 w-8 items-center justify-center rounded-md transition ${
    active
      ? 'bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-100'
      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
  }`;
}

export function RichTextToolbar({
  active,
  alignX,
  alignY,
  onToggle,
  onApplyList,
  onApplyHeading,
  listStyle,
  onColor,
  onSetAlign,
}: {
  active: ActiveFormat;
  alignX: TextAlignX;
  alignY: TextAlignY;
  onToggle: (key: RunBoolKey) => void;
  onApplyList: (style: ListStyle) => void;
  onApplyHeading: (level: RunHeading | null) => void;
  // What the current lines already are, so the picker can show it.
  listStyle: ListStyle;
  onColor: (color: string) => void;
  onSetAlign: (x: TextAlignX, y: TextAlignY) => void;
}) {
  const toggles: { key: RunBoolKey; label: string; description: string; icon: React.ReactNode }[] =
    [
      { key: 'bold', label: 'Bold', description: 'Bold the selected text.', icon: <BoldIcon /> },
      {
        key: 'italic',
        label: 'Italic',
        description: 'Italicise the selected text.',
        icon: <ItalicIcon />,
      },
      {
        key: 'underline',
        label: 'Underline',
        description: 'Underline the selected text.',
        icon: <UnderlineIcon />,
      },
      {
        key: 'strikethrough',
        label: 'Strikethrough',
        description: 'Strike through the selected text.',
        icon: <StrikethroughIcon />,
      },
    ];
  // Same spacer the element toolbar's Divider uses, so both read alike.
  const divider = (
    <span className="mx-0.5 h-6 w-px shrink-0 bg-slate-200 dark:bg-slate-700" aria-hidden />
  );

  return (
    <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1 shadow-lg shadow-slate-900/10 dark:border-slate-800 dark:bg-slate-900 dark:shadow-slate-950/40">
      {toggles.map((t) => (
        <Tooltip key={t.key} title={t.label} description={t.description}>
          <button
            type="button"
            aria-label={t.label}
            aria-pressed={active[t.key]}
            onMouseDown={noFocusSteal}
            onClick={() => onToggle(t.key)}
            className={btnClass(active[t.key])}
          >
            {t.icon}
          </button>
        </Tooltip>
      ))}
      {divider}
      {/* Block type (spec/102): heading level and list style are one choice
          to a writer, so they are one control. Applies to the selected lines,
          or to the whole label when nothing is selected (the session's
          collapsedScope). */}
      <BlockTypePicker
        heading={active.heading}
        listStyle={listStyle}
        onApplyHeading={onApplyHeading}
        onApplyList={onApplyList}
      />
      {divider}
      {/* Alignment — the shared 3×3 grid, reused. The trigger is the
          familiar word-processor glyph (stacked lines whose ends follow the
          horizontal alignment), not the positional box-dot the grid cells
          use, so the control reads as "alignment" at a glance. */}
      <ToolbarDropdown
        label="Alignment"
        description="Align the label inside the element."
        menuClassName="w-28 p-1.5"
        trigger={<AlignLinesIcon dir={alignX} />}
      >
        <AlignmentGrid alignX={alignX} alignY={alignY} onChange={onSetAlign} />
      </ToolbarDropdown>
      {divider}
      <Tooltip title="Text colour" description="Colour the selected text.">
        <label
          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
          aria-label="Text color"
        >
          <span
            className="h-4 w-4 rounded border border-slate-300 dark:border-slate-600"
            style={{ backgroundColor: active.color ?? '#0f172a' }}
            aria-hidden
          />
          <input
            type="color"
            value={active.color ?? '#0f172a'}
            onChange={(e) => onColor(e.target.value)}
            aria-label="Text color"
            className="absolute h-0 w-0 opacity-0"
          />
        </label>
      </Tooltip>
    </div>
  );
}
