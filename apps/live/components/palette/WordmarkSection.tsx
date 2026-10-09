'use client';

// The Wordmark section of a text element's Text flyout on a logo page (docs/specs/007-editor/
// logo-pages.md "Wordmark type"): Tracking, Weight, Case and Arc. Tiles hover-preview and commit on
// a press; the sliders preview as they move and commit once when let go, so a drag is one undo step.
import { useState, type ReactNode } from 'react';
import {
  LETTER_SPACING_MAX,
  LETTER_SPACING_MIN,
  resolvedFontWeight,
  TEXT_ARC_MAX,
  type FontWeight,
  type TextCase,
  type TextElement,
} from '@livediagram/document';
import { Glyph } from '@livediagram/ui';
import { MenuAccordionSection } from '@/components/primitives/PortalMenu';
import { MenuSliderRow } from '@/components/primitives/MenuSliderRow';
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
      <SliderRow
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
      <SliderRow
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
        reset={
          element.textArc ? { label: 'Flat', onReset: () => onSet({ textArc: null }) } : undefined
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

// A labelled slider that previews while it moves and commits the value it is let go at.
function SliderRow({
  label,
  min,
  max,
  step,
  value,
  format,
  valueText,
  onPreview,
  onCommit,
  onPreviewEnd,
  reset,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  format: (v: number) => string;
  valueText?: (v: number) => string;
  onPreview: (v: number) => void;
  onCommit: (v: number) => void;
  // Ends the preview without a change (a drag let go where it began).
  onPreviewEnd: () => void;
  reset?: { label: string; onReset: () => void };
}) {
  // The drag under way: where it started and where it is; null at rest (the element's own value
  // shows). The start is kept because the preview writes the live element as the thumb moves, so by
  // the let-go `value` already equals where the drag ended.
  const [drag, setDrag] = useState<{ from: number; at: number } | null>(null);
  const shown = drag?.at ?? value;
  const commit = () => {
    if (drag === null) return;
    setDrag(null);
    if (drag.at !== drag.from) onCommit(drag.at);
    // Back where it began: nothing to commit, but the preview it opened must close, or its stale
    // snapshot would stand in for the element's state on the next style change.
    else onPreviewEnd();
  };
  return (
    <MenuSliderRow
      label={label}
      min={min}
      max={max}
      step={step}
      value={shown}
      display={format(shown)}
      valueText={valueText ? valueText(shown) : `${label} ${format(shown)}`}
      onChange={(v) => {
        setDrag((d) => ({ from: d?.from ?? value, at: v }));
        onPreview(v);
      }}
      onRelease={commit}
      action={
        reset ? (
          <button
            type="button"
            onClick={reset.onReset}
            className="rounded px-1 text-[10px] font-semibold text-brand-600 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-500/10"
          >
            {reset.label}
          </button>
        ) : undefined
      }
    />
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
