// What a content kind holds, briefly (docs/specs/024-agents/blueprints/document-views.md "Content
// summaries", VW18 to VW21).
import type { Element } from '@livedocuments/document';
import { arrayField, flagField, isObject, listOf, stringField } from './fields';
import { cellText } from './text';
import { shapeKindOf } from './view-attribute';

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

function codeSummary(el: Element): string {
  const code = stringField(el, 'code') ?? '';
  const lines = code === '' ? 0 : code.split('\n').length;
  return `lang=${stringField(el, 'codeLanguage') ?? 'plain'} lines=${lines}`;
}

function checklistSummary(el: Element): string {
  const items = arrayField(el, 'checklistItems').filter(isObject);
  return `done=${items.filter((item) => flagField(item, 'done')).length}/${items.length}`;
}

// A Sankey's size (docs/specs/009-elements/sankey.md): its flows, and the distinct node names they join.
function sankeySummary(el: Element): string {
  const flows = arrayField(el, 'sankeyFlows').filter(isObject);
  // Matched as the diagram matches them: spaces trimmed and collapsed.
  const names = new Set(
    flows
      .flatMap((f) => [stringField(f, 'from'), stringField(f, 'to')])
      .map((n) => (n ?? '').replace(/\s+/g, ' ').trim())
      .filter((n) => n !== ''),
  );
  return `flows=${flows.length} nodes=${names.size}`;
}

// A concept graphic (docs/specs/009-elements/concept-graphics.md): its rows in order, and a pyramid's variant when set.
function conceptSummary(el: Element): string {
  const rows = arrayField(el, 'conceptRows').filter(isObject);
  const labels = rows.map((r) => cellText(stringField(r, 'label') ?? '?')).join('|');
  const variant = stringField(el, 'pyramidVariant');
  return `rows=${labels}${variant ? ` variant=${cellText(variant)}` : ''}`;
}

export function contentSummaryOf(el: Element): string | null {
  switch (shapeKindOf(el)) {
    case 'table':
      return tableSummary(el);
    case 'code-block':
      return codeSummary(el);
    case 'pie-chart':
    case 'bar-chart':
      return `slices=${arrayField(el, 'pieSlices').length}`;
    case 'line-chart':
      return `series=${arrayField(el, 'lineSeries').length} x=${arrayField(el, 'lineCategories').length}`;
    case 'checklist':
      return checklistSummary(el);
    case 'sankey':
      return sankeySummary(el);
    case 'layer-stack':
    case 'pyramid':
    case 'cycle':
    case 'hub':
    case 'onion':
    case 'chevrons':
    case 'timeline-rail':
      return conceptSummary(el);
    case 'stack':
      return `direction=${cellText(stringField(el, 'stackDirection') ?? 'row')}`;
    default:
      return null;
  }
}
