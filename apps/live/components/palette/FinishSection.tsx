'use client';

// The element menu's Finish category (docs/specs/008-canvas/finish.md "Where it is set"): Follow Tab plus the
// three finishes, hover to preview on the selection, click to commit as one undo step. Shared by the single
// element menu (ElementColourBorderSections) and the multi-selection Style flyout (MultiStyleSections), so
// both read the same.

import type { ReactNode } from 'react';
import { FINISHES, isFinish, type Finish } from '@livediagram/document';
import { Glyph, LinkIcon } from '@livediagram/ui';
import { onMouseHover } from '@/components/primitives/hover-preview';
import { MenuAccordionSection } from '@/components/primitives/PortalMenu';
import { SizeButton } from '@/components/palette/palette-controls';
import { BorderGrid } from '@/components/palette/context-menu-rows';
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

function FinishTile({
  active,
  label,
  glyph,
  onClick,
  onPreview,
  onPreviewEnd,
}: {
  active: boolean;
  label: string;
  glyph: ReactNode;
  onClick: () => void;
  onPreview: () => void;
  onPreviewEnd: () => void;
}) {
  return (
    <SizeButton
      active={active}
      onClick={onClick}
      onPointerEnter={onMouseHover(onPreview)}
      onPointerLeave={onMouseHover(onPreviewEnd)}
    >
      <span className="flex w-full items-center gap-1.5 py-0.5">
        <span className="flex h-4 w-4 shrink-0 items-center justify-center">{glyph}</span>
        <span className="truncate">{label}</span>
      </span>
    </SizeButton>
  );
}

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
        <BorderGrid label="Drawn As" cols={2}>
          <FinishTile
            active={finish === undefined}
            label="Follow Tab"
            glyph={<LinkIcon />}
            onClick={() => onCommit(null)}
            onPreview={() => onPreview(null)}
            onPreviewEnd={onPreviewEnd}
          />
          {FINISHES.map((f) => (
            <FinishTile
              key={f}
              active={finish === f}
              label={FINISH_LABELS[f]}
              glyph={<FinishSwatch finish={f} />}
              onClick={() => onCommit(f)}
              onPreview={() => onPreview(f)}
              onPreviewEnd={onPreviewEnd}
            />
          ))}
        </BorderGrid>
      </div>
    </MenuAccordionSection>
  );
}
