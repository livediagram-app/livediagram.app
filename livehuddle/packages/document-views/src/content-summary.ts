// What a content kind holds, briefly (docs/specs/024-agents/blueprints/document-views.md "Content
// summaries", VW18 to VW21).
import type { Element } from '@livehuddle/document';
import { arrayField, isObject, listOf, stringField } from '@liveworkspace/document-views/fields';
import { cellText } from '@liveworkspace/document-views/text';
import { shapeKindOf } from '@liveworkspace/document-views/view-attribute';

// Columns are the longest row's length (E26); the first row's missing cells print empty.
function tableSummary(el: Element): string {
  const rows = arrayField(el, 'cells').map(listOf);
  const cols = rows.reduce((max, row) => Math.max(max, row.length), 0);
  if (rows.length === 0 || cols === 0) return `${rows.length}x${cols}`;
  const header = Array.from({ length: cols }, (_, i) => {
    const cell: unknown = rows[0]![i];
    return cellText(typeof cell === 'string' ? cell : '');
  });
  return `${rows.length}x${cols} ${header.join(' | ')}`;
}

// A Timeline (docs/specs/009-elements/timeline.md): its milestones in order.
function conceptSummary(el: Element): string {
  const rows = arrayField(el, 'conceptRows').filter(isObject);
  return `rows=${rows.map((r) => cellText(stringField(r, 'label') ?? '?')).join('|')}`;
}

export function contentSummaryOf(el: Element): string | null {
  switch (shapeKindOf(el)) {
    case 'table':
      return tableSummary(el);
    case 'timeline-rail':
      return conceptSummary(el);
    case 'stack':
      return `direction=${cellText(stringField(el, 'stackDirection') ?? 'row')}`;
    default:
      return null;
  }
}
