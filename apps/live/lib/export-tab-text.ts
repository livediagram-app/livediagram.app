// Text serialisation of a Tab — the non-visual export formats (JSON
// snapshot + Markdown outline). Split out of export-tab.ts so the
// image-rendering concern (canvas / SVG / PDF) lives on its own; these
// two share nothing with the rasteriser beyond the Tab data model.
//
// Re-exported from export-tab.ts so existing `@/lib/export-tab` import
// paths keep resolving unchanged.

import { isBoxed, type ArrowElement, type BoxedElement, type Tab } from '@livediagram/diagram';

// ---------------------------------------------------------------------
// File (JSON)
// ---------------------------------------------------------------------

// Wraps the Tab in a small envelope with a schema-version field so
// the import path (#11) can detect the format and forward-migrate
// across future schema breaks.
//
// `schemaVersion` is intentionally numeric + monotonic — when the
// Tab shape changes incompatibly we bump it; the import path checks
// `<= CURRENT` and either accepts or refuses with a clear error.
export const TAB_SCHEMA_VERSION = 1;

export type ExportedTabEnvelope = {
  schemaVersion: number;
  kind: 'livediagram.tab';
  exportedAt: number;
  tab: Tab;
};

export function exportTabAsJson(tab: Tab): Blob {
  const envelope: ExportedTabEnvelope = {
    schemaVersion: TAB_SCHEMA_VERSION,
    kind: 'livediagram.tab',
    exportedAt: Date.now(),
    tab,
  };
  return new Blob([JSON.stringify(envelope, null, 2)], { type: 'application/json' });
}

// ---------------------------------------------------------------------
// Text serialisation of a Tab
// ---------------------------------------------------------------------

// ---------------------------------------------------------------------
// Markdown
// ---------------------------------------------------------------------

// Extracts every labelled boxed element + every labelled arrow into
// a tree-like markdown document. Reading order: top-to-bottom by y,
// then left-to-right by x. That matches how a person would scan the
// canvas and produces a usable export even for non-tree layouts.
//
// Arrows with labels render as italic edges between bullet points,
// keyed off their endpoints so the connection survives the
// flattening. Unlabelled arrows are dropped — they're structural,
// not content.
export function exportTabAsMarkdown(tab: Tab): Blob {
  const lines: string[] = [];
  lines.push(`# ${tab.name || 'Untitled tab'}`);
  lines.push('');

  // Use isBoxed instead of an inline kind list so a future
  // BoxedElement variant (FreehandElement landed via this gap)
  // doesn't silently drop out of the markdown export. The tag
  // computation below already falls back to `(<type>)` for any
  // non-shape kind.
  const boxed = tab.elements.filter(isBoxed);
  const arrows = tab.elements.filter((e): e is ArrowElement => e.type === 'arrow');
  const labelledBoxed = boxed.filter((b) => b.label && b.label.trim().length > 0);
  labelledBoxed.sort((a, b) => a.y - b.y || a.x - b.x);
  if (labelledBoxed.length > 0) {
    lines.push('## Elements');
    lines.push('');
    for (const b of labelledBoxed) {
      const tag = b.type === 'shape' ? `(${b.shape})` : `(${b.type})`;
      lines.push(`- **${b.label}** ${tag}`);
    }
    lines.push('');
  }

  const labelledArrows = arrows.filter((a) => a.label && a.label.trim().length > 0);
  if (labelledArrows.length > 0) {
    lines.push('## Connections');
    lines.push('');
    for (const a of labelledArrows) {
      const fromLabel = endpointLabel(a.from, boxed);
      const toLabel = endpointLabel(a.to, boxed);
      lines.push(`- *${a.label}*: ${fromLabel} → ${toLabel}`);
    }
    lines.push('');
  }

  if (labelledBoxed.length === 0 && labelledArrows.length === 0) {
    lines.push('_No labelled content._');
  }
  return new Blob([lines.join('\n')], { type: 'text/markdown' });
}

function endpointLabel(endpoint: ArrowElement['from'], boxed: BoxedElement[]): string {
  if (endpoint.kind === 'pinned') {
    const target = boxed.find((b) => b.id === endpoint.elementId);
    if (target && target.label) return target.label;
    return '?';
  }
  if (endpoint.kind === 'on-arrow') return '(arrow)';
  if (endpoint.kind === 'pinned-group') return '(group)';
  return `(${Math.round(endpoint.x)}, ${Math.round(endpoint.y)})`;
}
