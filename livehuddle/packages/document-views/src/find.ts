// The find view (docs/specs/024-agents/blueprints/document-views.md "find", VW35): elements whose text
// holds the query, each on its outline line. Substring only, so no pattern reaches a regex engine.
import { FIND_FIELDS, type FindField, type FindView, type ViewDoor } from '@livehuddle/api-schema';
import type { Element } from '@livehuddle/document';
import {
  fitLines,
  fitOf,
  type ViewLine,
  type ViewResult,
} from '@liveworkspace/document-views/budget';
import {
  arrayField,
  isObject,
  listOf,
  stringField,
  textField,
  threadOf,
} from '@liveworkspace/document-views/fields';
import { headerLine, viewHeader } from './header';
import type { ViewModel } from './model';
import { outlineLine } from './outline';
import { plural } from '@liveworkspace/document-views/text';
import { nodesOf, type ViewNode } from './tree';

export type FindOptions = { budget?: number; door?: ViewDoor };

const LINE = { one: 'line', many: 'lines' };

function normaliseFind(text: string): string {
  return text.normalize('NFKC').toLowerCase();
}

// The texts of each field `find` searches on one element.
function searchedTexts(el: Element): [FindField, string[]][] {
  const strings = (values: readonly unknown[]) =>
    values.filter((v): v is string => typeof v === 'string');
  const rows = arrayField(el, 'cells').flatMap(listOf);
  const thread = threadOf(el);
  return [
    ['label', strings([textField(el, 'label')])],
    ['note', strings([textField(el, 'note')])],
    ['cell', strings(rows)],
    [
      'item',
      strings(
        arrayField(el, 'checklistItems')
          .filter(isObject)
          .map((i) => stringField(i, 'text')),
      ),
    ],
    ['code', strings([stringField(el, 'code')])],
    ['comment', strings((thread?.comments ?? []).map((c) => stringField(c, 'text')))],
  ];
}

function matchedFields(el: Element, q: string): FindField[] {
  return searchedTexts(el).flatMap(([field, texts]) =>
    texts.some((text) => normaliseFind(text).includes(q)) ? [field] : [],
  );
}

// `q` is non-empty; the caller bounds its length.
export function findView(
  model: ViewModel,
  q: string,
  options: FindOptions = {},
): ViewResult<FindView> {
  const wanted = normaliseFind(q);
  const lines: ViewLine[] = [];
  const matches: FindView['matches'] = [];
  const counts = new Map<FindField, number>();
  const refOf = (node: ViewNode) => model.refs.refOf(node.el.id);
  // `path` stays on the wire, empty: nothing holds an element since part 3 of the element engine.
  const record = (ref: string, el: Element, field: FindField) => {
    matches.push({ ref, kind: model.kindOf(el), label: textField(el, 'label'), field, path: [] });
    counts.set(field, (counts.get(field) ?? 0) + 1);
  };
  for (const node of nodesOf(model.tree.roots)) {
    const fields = matchedFields(node.el, wanted);
    if (fields.length > 0) {
      lines.push({ text: outlineLine(model, node), noun: LINE });
      for (const field of fields) record(refOf(node), node.el, field);
    }
  }

  const summary = FIND_FIELDS.flatMap((field) => {
    const count = counts.get(field) ?? 0;
    return count > 0 ? [plural(count, field, `${field}s`)] : [];
  });
  // The totals close the view whatever the budget: dropping them left a cut answer with no elision line.
  const closing =
    matches.length === 0
      ? '0 matches'
      : `${plural(matches.length, 'match', 'matches')}: ${summary.join(', ')}`;
  const fitted = fitLines({
    header: headerLine(model.facts),
    lines,
    closing,
    budget: options.budget,
    door: options.door ?? 'cli',
  });
  return {
    text: fitted.text,
    fit: fitOf(fitted),
    json: { header: viewHeader('find', model.facts), q, matches, elision: fitted.elision },
  };
}
