// The selection reference (docs/specs/013-workspace/workbench-embeds.md "The selection reference",
// blueprint "The selection reference"): the text a workbench attaches to the person's message, so their
// agent reads exactly what was selected then. Built on the view model, so refs, kind words and labels
// are the outline's own; labels are JSON-quoted, so a label is data and can never forge a line.
import { WORKBENCH_SELECTION_MAX_REFS } from '@livediagram/api-schema';
import type { Element, Tab } from '@livediagram/document';
import { LABEL_CUT_CHARS } from './constants';
import { textField } from './fields';
import { buildViewModel, type ViewModel } from './model';
import { jsonString } from './text';

export type SelectionReferenceInput = {
  documentId: string;
  documentName: string;
  tab: Tab;
  // The document's tab ids in order, so the tab ref is the one the CLI prints.
  tabIds: readonly string[];
  // The last revision the editor knows for the tab.
  rev: number;
  selectedIds: readonly string[];
};

export type SelectionReference = { text: string; count: number };

function item(model: ViewModel, el: Element): string {
  const label = textField(el, 'label');
  return [
    model.kindOf(el),
    model.refs.refOf(el.id),
    ...(label === null ? [] : [jsonString(label, LABEL_CUT_CHARS)]),
  ].join(' ');
}

export function selectionReference(input: SelectionReferenceInput): SelectionReference {
  const { documentId, documentName, tab, tabIds, rev, selectedIds } = input;
  const model = buildViewModel(tab, { rev, tabIds });
  const tabRef = model.tabRefOf(tab.id);
  const header =
    `[livediagram] ${jsonString(documentName)} › tab ${jsonString(tab.name)} ` +
    `(doc ${documentId}, tab ${tabRef}, rev ${rev})`;
  const wanted = new Set(selectedIds);
  // The tab's element order (WB20), so the text never depends on the order of clicks.
  const selected = tab.elements.filter((el) => wanted.has(el.id));
  if (selected.length === 0) return { text: `${header}\nwhole tab`, count: 0 };

  const view = `livediagram tab view ${documentId} --tab ${tabRef} --view show --ref`;
  const shown = selected.slice(0, WORKBENCH_SELECTION_MAX_REFS).map((el) => item(model, el));
  const more = selected.length - shown.length;
  const tail = more > 0 ? ` … and ${more} more: ${view} selected` : '';
  const firstRef = model.refs.refOf(selected[0]!.id);
  return {
    text: [header, `selected: ${shown.join(', ')}${tail}`, `read: ${view} ${firstRef}`].join('\n'),
    count: selected.length,
  };
}
