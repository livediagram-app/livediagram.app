'use client';

// The custom-theme builder's per-shape colour section (spec/44, the
// UML-style per-kind overrides), split out of CustomThemeBuilder: the
// kinds on offer, the base-colour fallbacks + resolver, and the dense
// rows of preview + fill / outline / text dots. The builder mounts it
// under its Per-shape colours ExpandRow slot.

import type { CSSProperties } from 'react';
import { elementKindLabel, type ShapeKind } from '@livediagram/diagram';
import type { CustomThemeDefinition } from '@livediagram/api-schema';
import {
  ColorDot,
  ExpandRow,
  ResetGlyph,
  type Painter,
} from '@/components/palette/custom-theme-builder-parts';
import { ShapeIcon } from '@/components/primitives/shape-icon';
import { Tooltip } from '@/components/primitives/Tooltip';

// The shape kinds offered in the per-shape editor: the flowchart /
// diagram vocabulary where a per-kind colour is meaningful. Device
// frames, the icon glyph, the frame container and the actor figure are
// left out (their colour is intrinsic or not a fill/stroke box).
const PER_SHAPE_KINDS: ShapeKind[] = [
  'square',
  'circle',
  'diamond',
  'stadium',
  'parallelogram',
  'hexagon',
  'document',
  'triangle',
  'trapezoid',
  'cylinder',
  'cloud',
  'star',
];

// Base-colour fallbacks shared with the builder's ColorTiles.
export const FALLBACK_FILL = '#dbeafe';
export const FALLBACK_STROKE = '#2563eb';
export const FALLBACK_TEXT = '#0f172a';

function resolved(
  def: CustomThemeDefinition,
  kind: ShapeKind,
): { fill: string; stroke: string; text: string } {
  const o = def.shapeColors?.[kind];
  return {
    fill: o?.fill ?? def.elementFill ?? FALLBACK_FILL,
    stroke: o?.stroke ?? def.elementStroke ?? FALLBACK_STROKE,
    text: o?.text ?? def.elementText ?? FALLBACK_TEXT,
  };
}

export function PerShapeColoursSection({
  def,
  painter,
  open,
  onToggle,
  setShapeColour,
  clearShape,
}: {
  def: CustomThemeDefinition;
  painter: Painter;
  open: boolean;
  onToggle: () => void;
  setShapeColour: (kind: ShapeKind, channel: 'fill' | 'stroke' | 'text', value: string) => void;
  clearShape: (kind: ShapeKind) => void;
}) {
  const customCount = def.shapeColors ? Object.keys(def.shapeColors).length : 0;
  return (
    <ExpandRow
      label="Per-shape colours"
      badge={customCount > 0 ? String(customCount) : undefined}
      open={open}
      onToggle={onToggle}
    >
      <p className="mb-2 text-[11px] leading-snug text-slate-500 dark:text-slate-300">
        Give a shape kind its own colours (like UML). Leave a kind unset to use the base colours.
      </p>
      {/* Compact two-column rows: a shape preview + name, then its
            three colour dots (fill / outline / text, tooltip'd). Dense
            and scannable rather than a wall of big swatch blocks. */}
      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {PER_SHAPE_KINDS.map((kind) => {
          const o = def.shapeColors?.[kind];
          const r = resolved(def, kind);
          return (
            <div
              key={kind}
              className="group flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5 dark:border-slate-700 dark:bg-slate-800"
            >
              {/* Preview the shape on the THEME background; only the
                    shape's interior takes the fill (stroke = currentColor).
                    The CSS var overrides the icon paths' fill="none". */}
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-200 dark:border-slate-700 [&_svg]:h-5 [&_svg]:w-5 [&_svg_*]:[fill:var(--shape-fill)]"
                style={
                  {
                    backgroundColor: def.backgroundColor,
                    color: r.stroke,
                    '--shape-fill': r.fill,
                  } as CSSProperties
                }
              >
                <ShapeIcon kind={kind} />
              </span>
              <span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-700 dark:text-slate-200">
                {elementKindLabel({ type: 'shape', shape: kind } as Parameters<
                  typeof elementKindLabel
                >[0])}
              </span>
              <div className="flex shrink-0 items-center gap-1">
                <Tooltip title="Fill" description="The shape's interior colour.">
                  <ColorDot
                    label={`${kind} fill`}
                    value={r.fill}
                    onChange={(v) => setShapeColour(kind, 'fill', v)}
                    painter={painter}
                  />
                </Tooltip>
                <Tooltip title="Outline" description="The shape's border colour.">
                  <ColorDot
                    label={`${kind} outline`}
                    value={r.stroke}
                    onChange={(v) => setShapeColour(kind, 'stroke', v)}
                    painter={painter}
                  />
                </Tooltip>
                <Tooltip title="Text" description="The shape's label colour.">
                  <ColorDot
                    label={`${kind} text`}
                    value={r.text}
                    onChange={(v) => setShapeColour(kind, 'text', v)}
                    painter={painter}
                  />
                </Tooltip>
                <Tooltip title="Reset" description="Use the base colours for this shape.">
                  <button
                    type="button"
                    onClick={() => clearShape(kind)}
                    disabled={!o}
                    aria-label={`Reset ${kind} colours`}
                    className="flex h-5 w-5 items-center justify-center rounded text-slate-400 opacity-0 transition hover:text-slate-600 group-hover:opacity-100 disabled:!opacity-0 dark:text-slate-500 dark:hover:text-slate-300"
                  >
                    <ResetGlyph />
                  </button>
                </Tooltip>
              </div>
            </div>
          );
        })}
      </div>
    </ExpandRow>
  );
}
