'use client';

// The Wordmark section of a text element's Text flyout on a logo page (docs/specs/007-editor/
// logo-pages.md "Wordmark type"): Tracking, Weight, Case and Arc. Tiles hover-preview and commit on
// a press; the sliders preview as they move and commit once when let go, so a drag is one undo step.
import type { ReactNode } from 'react';
import {
  LETTER_SPACING_MAX,
  LETTER_SPACING_MIN,
  resolvedFontWeight,
  TEXT_ARC_MAX,
  type FontWeight,
  type TextCase,
  type TextElement,
} from '@livepages/document';
import { Glyph } from '@livepages/ui';
import { MenuAccordionSection } from '@/components/primitives/PortalMenu';
import { PreviewSliderRow, SliderRowAction } from '@/components/primitives/PreviewSliderRow';
import { MenuTile, MenuTileGrid } from '@/components/primitives/MenuTiles';
import { onMouseHover } from '@/components/primitives/hover-preview';
import type { WordmarkPatch } from '@/lib/style-presets';

const WEIGHTS: { value: FontWeight; label: string }[] = [
  { value: 400, label: 'Regular' },
  { value: 500, label: 'Medium' },
  { value: 700, label: 'Bold' },
];

const CASES: { value: TextCase | null; label: string; sample: string }[] = [
  { value: null, label: 'As Typed', sample: 'Aa' },
  { value: 'upper', label: 'Capitals', sample: 'AA' },
  { value: 'lower', label: 'Lower Case', sample: 'aa' },
];

// The arc slider moves in whole steps of this many degrees.
const ARC_STEP = 5;

export function WordmarkSection({
  element,
  section,
  onSet,
  onPreview,
  onPreviewEnd,
}: {
  element: TextElement;
  section: { open: boolean; onToggle: () => void; flush?: boolean };
  onSet: (patch: WordmarkPatch) => void;
  onPreview: (patch: WordmarkPatch) => void;
  onPreviewEnd: () => void;
}) {
  const hover = (patch: WordmarkPatch) => ({
    onPointerEnter: onMouseHover(() => onPreview(patch)),
    onPointerLeave: onMouseHover(onPreviewEnd),
  });
  const weight = resolvedFontWeight(element);
  return (
    <MenuAccordionSection title="Wordmark" icon={<WordmarkGlyph />} {...section}>
      <PreviewSliderRow
        label="Tracking"
        min={LETTER_SPACING_MIN * 100}
        max={LETTER_SPACING_MAX * 100}
        step={1}
        value={Math.round((element.letterSpacing ?? 0) * 100)}
        format={(v) => `${v}`}
        onPreview={(v) => onPreview({ letterSpacing: v / 100 })}
        onCommit={(v) => onSet({ letterSpacing: v === 0 ? null : v / 100 })}
        onPreviewEnd={onPreviewEnd}
      />
      <Caption>Weight</Caption>
      <MenuTileGrid cols={3}>
        {WEIGHTS.map((w) => (
          <MenuTile
            key={w.value}
            active={weight === w.value}
            label={w.label}
            labelStyle={{ fontWeight: w.value }}
            {...hover({ fontWeight: w.value })}
            onClick={() => onSet({ fontWeight: w.value })}
          />
        ))}
      </MenuTileGrid>
      <Caption>Case</Caption>
      <MenuTileGrid cols={3}>
        {CASES.map((c) => (
          <MenuTile
            key={c.label}
            active={(element.textCase ?? null) === c.value}
            label={c.label}
            icon={<span className="text-sm font-semibold">{c.sample}</span>}
            {...hover({ textCase: c.value })}
            onClick={() => onSet({ textCase: c.value })}
          />
        ))}
      </MenuTileGrid>
      <PreviewSliderRow
        label="Arc"
        min={-TEXT_ARC_MAX}
        max={TEXT_ARC_MAX}
        step={ARC_STEP}
        value={element.textArc ?? 0}
        format={(v) => `${v}°`}
        valueText={(v) => `${v} degrees`}
        onPreview={(v) => onPreview({ textArc: v })}
        onCommit={(v) => onSet({ textArc: v === 0 ? null : v })}
        onPreviewEnd={onPreviewEnd}
        action={
          element.textArc ? (
            <SliderRowAction label="Flat" onClick={() => onSet({ textArc: null })} />
          ) : undefined
        }
      />
    </MenuAccordionSection>
  );
}

function Caption({ children }: { children: ReactNode }) {
  return (
    <p className="px-3 pt-2 text-[10px] font-medium text-slate-500 dark:text-slate-400">
      {children}
    </p>
  );
}

// Spaced letters over a gentle arc: tracking and bend, the section's two sliders.
function WordmarkGlyph() {
  return (
    <Glyph size={16} units={16}>
      <path d="M2.5 6.5 Q8 2 13.5 6.5" />
      <path d="M3 13.5 4.6 9h.8l1.6 4.5M3.6 12h2.8M9 9h2.2a1.1 1.1 0 0 1 0 2.2H9V9Zm0 2.2h2.5a1.15 1.15 0 0 1 0 2.3H9v-2.3Z" />
    </Glyph>
  );
}
