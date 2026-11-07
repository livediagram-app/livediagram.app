// What a content kind holds, briefly (docs/specs/024-agents/blueprints/document-views.md "Content
// summaries", VW18 to VW21).
import type { Element } from '@livehuddle/document';
import { arrayField, isObject, stringField } from '@liveworkspace/document-views/fields';
import { cellText } from '@liveworkspace/document-views/text';
import { shapeKindOf } from '@liveworkspace/document-views/view-attribute';

// A Timeline (docs/specs/009-elements/timeline.md): its milestones in order.
function conceptSummary(el: Element): string {
  const rows = arrayField(el, 'conceptRows').filter(isObject);
  return `rows=${rows.map((r) => cellText(stringField(r, 'label') ?? '?')).join('|')}`;
}

export function contentSummaryOf(el: Element): string | null {
  switch (shapeKindOf(el)) {
    case 'timeline-rail':
      return conceptSummary(el);
    case 'stack':
      return `direction=${cellText(stringField(el, 'stackDirection') ?? 'row')}`;
    default:
      return null;
  }
}
