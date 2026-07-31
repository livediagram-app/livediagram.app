'use client';

// The block-type control (spec/102): Paragraph / Heading 1-3 / Bullet point /
// Numbered point as one closed vocabulary.
//
// Heading level and list style are two independent run attributes, but to a
// writer they are one decision — a line is a heading, or a paragraph, or a
// bullet. Both toolbars host this same control so the label editor and the
// note editor describe a line the same way; only their apply SCOPE differs
// (the label's collapsed caret means the whole text, the note's means the
// line — spec/92), and that lives in each editor's session, not here.

import type { ListStyle, RunHeading } from '@livediagram/diagram';
import {
  BLOCK_TYPES,
  blockTypeApplies,
  blockTypeLabel,
  blockTypeOf,
  type BlockType,
} from './block-type';
import { noFocusSteal, ToolbarDropdown } from './ToolbarDropdown';

export function BlockTypePicker({
  heading,
  listStyle,
  onApplyHeading,
  onApplyList,
}: {
  heading: RunHeading | null;
  listStyle: ListStyle;
  onApplyHeading: (level: RunHeading | null) => void;
  onApplyList: (style: ListStyle) => void;
}) {
  const blockType = blockTypeOf(heading, listStyle);
  const apply = (next: BlockType) => {
    const applies = blockTypeApplies(next);
    // Both always run: picking a heading has to clear a bullet, and picking a
    // bullet has to clear a heading, or a line lands in a state the picker
    // cannot describe.
    onApplyList(applies.list);
    onApplyHeading(applies.heading);
  };
  return (
    <ToolbarDropdown
      label="Block type"
      description="Heading level, paragraph, or a list — applied to the selected lines."
      menuClassName="min-w-[10rem]"
      trigger={<span className="px-1 text-xs font-medium">{blockTypeLabel(blockType)}</span>}
    >
      {BLOCK_TYPES.map((b) => (
        <button
          key={b.id}
          type="button"
          role="option"
          aria-selected={blockType === b.id}
          onMouseDown={noFocusSteal}
          onClick={() => apply(b.id)}
          className={`flex w-full items-center justify-between gap-3 px-2.5 py-1.5 text-left text-xs transition ${
            blockType === b.id
              ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/20 dark:text-brand-100'
              : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
          }`}
        >
          {b.label}
        </button>
      ))}
    </ToolbarDropdown>
  );
}
