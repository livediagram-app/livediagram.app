// Text serialisation of a Tab: the non-visual export formats (JSON snapshot and Markdown outline), shared by the
// editor's Export dialog and the CLI's export. They share nothing with a rasteriser beyond the Tab data model.

import type { Item, ItemTypeCatalogue } from '@livediagram/items';
import { isBoxed, type ArrowElement, type BoxedElement, type Tab } from './index';
import { tabExportItems, tabPlanMarkdown, type TabPlanData } from './export-tab-plan';

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
// 2: freehand points are packed (docs/specs/006-document/stroke-points.md); a version 1 file
// imports through the stored-tab migration, and an older editor refuses a version 2 file.
export const TAB_SCHEMA_VERSION = 2;

export type ExportedTabEnvelope = {
  schemaVersion: number;
  kind: 'livediagram.tab';
  exportedAt: number;
  tab: Tab;
  // The items the tab shows and the document's stored type catalogue (docs/specs/026-plan/items.md "Copies and
  // exports"). Additive: absent when the tab shows no items, so the schema version holds.
  items?: Item[];
  itemTypes?: ItemTypeCatalogue;
};

// The JSON envelope as a string — shared by the Blob download and the
// export dialog's view/copy panel (docs/specs/020-import-export/mermaid.md), which shows the same text
// in an editable box.
// `plan`: the document's items, so a tab with Plan boards or cards carries them.
export function tabToJsonText(tab: Tab, plan?: TabPlanData): string {
  const items = plan ? tabExportItems(tab, plan.items) : [];
  const envelope: ExportedTabEnvelope = {
    schemaVersion: TAB_SCHEMA_VERSION,
    kind: 'livediagram.tab',
    exportedAt: Date.now(),
    tab,
    ...(items.length ? { items } : {}),
    ...(items.length && plan?.catalogue ? { itemTypes: plan.catalogue } : {}),
  };
  return JSON.stringify(envelope, null, 2);
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
// The markdown outline as a string — shared by the Blob download and the
// export dialog's view/copy panel (docs/specs/020-import-export/mermaid.md).
// `plan`: the document's items, so Plan boards and cards list their cards.
export function tabToMarkdownText(tab: Tab, plan?: TabPlanData): string {
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

  const planLines = plan ? tabPlanMarkdown(tab, plan) : [];
  lines.push(...planLines);

  if (labelledBoxed.length === 0 && labelledArrows.length === 0 && planLines.length === 0) {
    lines.push('_No labelled content._');
  }
  return lines.join('\n');
}

function endpointLabel(endpoint: ArrowElement['from'], boxed: BoxedElement[]): string {
  if (endpoint.kind === 'pinned') {
    const target = boxed.find((b) => b.id === endpoint.elementId);
    if (target && target.label) return target.label;
    return '?';
  }
  if (endpoint.kind === 'on-arrow') return '(arrow)';
  return `(${Math.round(endpoint.x)}, ${Math.round(endpoint.y)})`;
}
