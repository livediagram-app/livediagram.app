'use client';

// The element menu's Finish category (docs/specs/008-canvas/finish.md "Where it is set"): Follow Tab plus the
// three finishes as a full-width option list, hover to preview on the selection, click to commit as one undo
// step. Shared by the single
// element menu (ElementColourBorderSections) and the multi-selection Style flyout (MultiStyleSections), so
// both read the same.

import type { ReactNode } from 'react';
import { FINISHES, isFinish, type Finish } from '@livediagram/document';
import { Glyph, LinkIcon } from '@livediagram/ui';
import { MenuAccordionSection } from '@/components/primitives/PortalMenu';
import { OptionRows, type OptionRow } from '@/components/plan/OptionRows';
import { FinishMenuGlyph } from '@/components/palette/context-menu-icons';

export const FINISH_LABELS: Record<Finish, string> = {
  flexible: 'Flexible',
  professional: 'Professional',
  sketch: 'Sketch',
};

// Each finish drawn as a small square: rounded (Flexible), crisp (Professional), wobbly (Sketch). Previews,
// so they keep their own drawing (context-menu-icons.tsx header).
const FINISH_SWATCH_PATH: Record<Finish, ReactNode> = {
  flexible: <rect x="3" y="3" width="10" height="10" rx="3" />,
  professional: <rect x="3" y="3" width="10" height="10" rx="0.5" strokeWidth="1" />,
  sketch: (
    <path d="M2.6 3.4 Q8 2.6 13.4 3.1 M13 2.6 Q13.6 8 12.8 13.4 M13.4 12.9 Q8 13.6 2.7 12.8 M3.2 13.3 Q2.5 8 3.1 2.6" />
  ),
};

export function FinishSwatch({ finish }: { finish: Finish }) {
  return (
    <Glyph size={16} units={16} aria-hidden>
      {FINISH_SWATCH_PATH[finish]}
    </Glyph>
  );
}

/** The finish an element carries itself, undefined when it follows its tab (or stores an unknown value). */
export function resolveOwnFinish(el: object | undefined): Finish | undefined {
  const own = (el as { finish?: unknown } | undefined)?.finish;
  return isFinish(own) ? own : undefined;
}

// Follow Tab's row id; a finish's row is the finish itself.
const FOLLOW_TAB = 'follow-tab';
const finishOfRow = (id: string): Finish | null => (isFinish(id) ? id : null);

/** One line on what each finish does, under its name. */
export const FINISH_DETAILS: Record<Finish, string> = {
  flexible: 'Soft corners and gentle shadows',
  professional: 'Square corners, fine lines, crisp type',
  sketch: 'Drawn by hand, with hatching',
};

// The Plan-style option list (docs/specs/026-plan/plan-board.md "Option lists"): one full-width row per choice.
const FINISH_ROWS: OptionRow[] = [
  {
    id: FOLLOW_TAB,
    label: 'Follow Tab',
    detail: 'Drawn in the tab’s finish',
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
