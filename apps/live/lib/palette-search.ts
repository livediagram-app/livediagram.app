// Assembles the palette catalogue (shapes + line-art icons + technology
// icons) into the flat, keyword-tagged list the global search surfaces as
// "Add to canvas" results (spec/09). Built here, not in lib/search.ts, so the
// search matcher stays catalogue-agnostic and the Explorer (which never adds
// elements) doesn't pull the icon data into its bundle.

import type { ShapeKind } from '@livediagram/diagram';
import type { PaletteSearchItem } from '@/lib/search';
import { getLoadedIconCatalog, getLoadedTechIconCatalog } from '@/lib/icon-registry';

// The shapes offered in the palette's Shapes tab, with search keywords so
// e.g. "database" finds the cylinder and "decision" finds the diamond. Kept
// inline (rather than re-derived from the palette JSX) so search stays
// decoupled from the palette's rendering.
const SHAPES: { kind: ShapeKind; name: string; keywords: string }[] = [
  { kind: 'square', name: 'Rectangle', keywords: 'square box rect node' },
  { kind: 'circle', name: 'Circle', keywords: 'oval ellipse round node' },
  { kind: 'diamond', name: 'Diamond', keywords: 'decision rhombus flowchart' },
  { kind: 'cylinder', name: 'Cylinder', keywords: 'database storage db disk' },
  { kind: 'parallelogram', name: 'Parallelogram', keywords: 'input output io flowchart' },
  { kind: 'hexagon', name: 'Hexagon', keywords: 'preparation milestone' },
  { kind: 'document', name: 'Document', keywords: 'page report file' },
  { kind: 'stadium', name: 'Stadium', keywords: 'pill terminator start end rounded' },
  { kind: 'cloud', name: 'Cloud', keywords: 'internet network external' },
  { kind: 'triangle', name: 'Triangle', keywords: 'warning delta' },
  { kind: 'trapezoid', name: 'Trapezoid', keywords: 'manual operation' },
  { kind: 'star', name: 'Star', keywords: 'favourite highlight rating' },
  { kind: 'speech-bubble', name: 'Speech bubble', keywords: 'comment callout chat note' },
  { kind: 'actor', name: 'User', keywords: 'actor person stick figure uml' },
  { kind: 'frame', name: 'Frame', keywords: 'section container group region' },
];

// A function, not a module-load constant: the icon catalogues load as an
// async chunk (lib/icon-registry.ts), so the list must be rebuilt once they
// land. The shape entries are always present; icon / tech entries appear as
// soon as the chunk does. The caller (EditorSearchPanel) subscribes via
// useIconCatalogs, so it re-renders — and rebuilds this list — on load; the
// build is a few hundred tiny objects, cheap enough to run per open-panel
// render without memoisation.
export function buildPaletteSearchItems(): PaletteSearchItem[] {
  return [
    ...SHAPES.map((s) => ({
      id: `shape:${s.kind}`,
      name: s.name,
      keywords: `shape ${s.keywords}`,
      add: { type: 'shape' as const, shapeKind: s.kind },
    })),
    ...getLoadedIconCatalog().map((i) => ({
      id: `icon:${i.id}`,
      name: i.label,
      keywords: `icon ${i.keywords}`,
      add: { type: 'icon' as const, iconId: i.id },
    })),
    ...getLoadedTechIconCatalog().map((t) => ({
      id: `tech:${t.id}`,
      name: t.label,
      keywords: `technology ${t.keywords}`,
      add: { type: 'tech' as const, iconId: t.id },
    })),
  ];
}
