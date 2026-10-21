// What a content kind holds, briefly (docs/specs/024-agents/blueprints/document-views.md "Content
// summaries", VW18 to VW21).
import { ENTITY_KEY_LABELS, type Element } from '@liveplanner/document';
import { ENTITY_FIELDS_SHOWN } from './constants';
import { arrayField, flagField, isObject, listOf, stringField } from './fields';
import { cellText } from './text';
import { shapeKindOf } from './view-attribute';

function entitySummary(el: Element): string {
  const fields = arrayField(el, 'entityFields').filter(isObject);
  const shown = fields.slice(0, ENTITY_FIELDS_SHOWN).map((field) => {
    const name = cellText(stringField(field, 'name') ?? '', true);
    const type = stringField(field, 'type');
    const key = stringField(field, 'key');
    const typed = type ? `${name} ${cellText(type, true)}` : name;
    return key && key in ENTITY_KEY_LABELS
      ? `${typed} ${ENTITY_KEY_LABELS[key as keyof typeof ENTITY_KEY_LABELS]}`
      : typed;
  });
  if (fields.length > ENTITY_FIELDS_SHOWN) shown.push(`+${fields.length - ENTITY_FIELDS_SHOWN}`);
  return `{${shown.join('; ')}}`;
}

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

// A Plan board (docs/specs/026-plan/plan-board.md): its columns by name; its cards are items.
function planBoardSummary(el: Element): string {
  const setup = (el as { planBoard?: { columns?: unknown } }).planBoard;
  const columns = Array.isArray(setup?.columns) ? setup.columns.filter(isObject) : [];
  // Each name escaped as a table cell: a newline or `|` in a name never forges a line or a column.
  return `columns=${columns.map((c) => cellText(stringField(c, 'name') ?? '?')).join('|')}`;
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

// A sequence diagram (docs/specs/009-elements/sequence-diagram.md): its participants in order and its message count.
function sequenceSummary(el: Element): string {
  const people = arrayField(el, 'sequenceParticipants')
    .filter(isObject)
    .map((p) => cellText(stringField(p, 'label') ?? '?'))
    .join('|');
  return `participants=${people} messages=${arrayField(el, 'sequenceMessages').length}`;
}

export function contentSummaryOf(el: Element): string | null {
  switch (shapeKindOf(el)) {
    case 'entity':
      return entitySummary(el);
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
    case 'sequence':
      return sequenceSummary(el);
    case 'stack':
      return `direction=${cellText(stringField(el, 'stackDirection') ?? 'row')}`;
    case 'plan-board':
      return planBoardSummary(el);
    case 'plan-card': {
      const card = (el as { planCard?: { itemId?: unknown } }).planCard;
      return `item=${typeof card?.itemId === 'string' && card.itemId ? cellText(card.itemId) : 'none'}`;
    }
    case 'plan-view': {
      const view = (el as { planView?: { view?: unknown } }).planView?.view;
      return `view=${typeof view === 'string' ? cellText(view) : 'none'}`;
    }
    case 'plan-sheet': {
      const sheet = (el as { planSheet?: { sheetId?: unknown } }).planSheet;
      return `sheet=${typeof sheet?.sheetId === 'string' && sheet.sheetId ? cellText(sheet.sheetId) : 'none'}`;
    }
    default:
      return null;
  }
}
