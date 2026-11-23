'use client';

// The element menu's Finish category (docs/specs/008-canvas/finish.md "Where it is set"): Follow Tab plus the
// four finishes as a full-width option list, hover to preview on the selection, click to commit as one undo
// step. Shared by the single
// element menu (ElementColourBorderSections) and the multi-selection Style flyout (MultiStyleSections), so
// both read the same.

import { FINISHES, isFinish, type Finish } from '@liveknowledge/document';
import { LinkIcon } from '@liveknowledge/ui';
import { MenuAccordionSection } from '@liveworkspace/workbench/components/primitives/PortalMenu';
import {
  OptionRows,
  type OptionRow,
} from '@liveworkspace/workbench/components/primitives/OptionRows';
import { FinishMenuGlyph } from '@liveworkspace/workbench/components/palette/context-menu-icons';
import {
  FINISH_LABELS,
  FinishSwatch,
} from '@liveworkspace/workbench/components/palette/FinishSection';

// Follow Tab's row id; a finish's row is the finish itself.
const FOLLOW_TAB = 'follow-tab';
const finishOfRow = (id: string): Finish | null => (isFinish(id) ? id : null);

/** One line on what each finish does, under its name. */
const FINISH_DETAILS: Record<Finish, string> = {
  flexible: 'Soft and rounded',
  professional: 'Square and fine',
  sketch: 'Drawn by hand',
  marker: 'Bold felt-tip',
};

// An option list (OptionRows): one full-width row per choice.
const FINISH_ROWS: OptionRow[] = [
  {
    id: FOLLOW_TAB,
    label: 'Follow Page',
    detail: 'As the page is',
    icon: <LinkIcon />,
  },
  ...FINISHES.map((f) => ({
    id: f,
    label: FINISH_LABELS[f],
    detail: FINISH_DETAILS[f],
    icon: <FinishSwatch finish={f} />,
  })),
];

export function FinishSection({
  finish,
  section,
  onCommit,
  onPreview,
  onPreviewEnd,
}: {
  // The (first) selected element's own finish; undefined = it follows its tab.
  finish: Finish | undefined;
  // The host scaffold's accordion state, spread into MenuAccordionSection.
  section: { open: boolean; onToggle: () => void; flush?: boolean };
  // `null` is Follow Tab: the element's own finish is cleared.
  onCommit: (finish: Finish | null) => void;
  onPreview: (finish: Finish | null) => void;
  onPreviewEnd: () => void;
}) {
  return (
    <MenuAccordionSection title="Finish" icon={<FinishMenuGlyph />} {...section}>
      <div className="px-2 py-1">
        <OptionRows
          kind="single"
          label="Drawn As"
          selected={finish ?? FOLLOW_TAB}
          rows={FINISH_ROWS}
          onPick={(id) => onCommit(finishOfRow(id))}
          onPreview={(id) => onPreview(finishOfRow(id))}
          onPreviewEnd={onPreviewEnd}
        />
      </div>
    </MenuAccordionSection>
  );
}
