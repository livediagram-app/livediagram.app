// An item's tabs as passages (liveworkspace/docs/specs/019-ask/ask.md "What is sent"): the walk every editor shares,
// over the same tabs its Search panel reads. An element gives a passage when it holds words: its label, a table's
// cells, and whatever other text fields the app names. Pure, and linear in the item's elements.
import { ASK_MAX_LABEL_CHARS } from '../limits';
import type { AskPassage } from '../passages';

/** A tab as the walk reads it: any editor's `Tab` fits. */
export type PassageTab = {
  id: string;
  name: string;
  elements: readonly PassageElement[];
};
// Any editor's element fits: its label, its cells and the rest are read where they are there.
export type PassageElement = { id: string; type: string };

export type TabPassageOptions = {
  /** What an element is called, Title Case ("Shape", "Sticky Note"); the type's own word, title-cased, by default. */
  kindOf?: (element: PassageElement) => string;
  /** More of an element's words than its label and cells (a note's body, a card's description), in reading order. */
  textOf?: (element: PassageElement) => readonly (string | null | undefined)[];
};

const titleCase = (type: string): string =>
  type
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((word) => word[0]!.toUpperCase() + word.slice(1))
    .join(' ');

const said = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

// A table's words: its rows, a line each, cells set apart.
function cellsText(cells: unknown): string {
  if (!Array.isArray(cells)) return '';
  const lines: string[] = [];
  for (const row of cells) {
    if (!Array.isArray(row)) continue;
    const line = row.map(said).filter(Boolean).join(' | ');
    if (line) lines.push(line);
  }
  return lines.join('\n');
}

const firstLine = (text: string): string => text.split('\n', 1)[0]!.slice(0, ASK_MAX_LABEL_CHARS);

/** The passages of `tabs`, in tab then element order. An element with no words gives none. */
export function tabPassages(
  tabs: readonly PassageTab[],
  options: TabPassageOptions = {},
): AskPassage[] {
  const out: AskPassage[] = [];
  for (const tab of tabs) {
    for (const element of tab.elements) {
      const fields = element as PassageElement & { label?: unknown; cells?: unknown };
      const label = said(fields.label);
      const pieces = [label, cellsText(fields.cells)];
      for (const more of options.textOf?.(element) ?? []) pieces.push(said(more));
      // Each piece once: an app's own field often repeats the label.
      const text = [...new Set(pieces.filter(Boolean))].join('\n');
      if (!text) continue;
      out.push({
        id: `${tab.id}:${element.id}`,
        tabId: tab.id,
        tabName: tab.name,
        elementId: element.id,
        kind: options.kindOf?.(element) ?? titleCase(element.type),
        title: firstLine(label || text),
        text,
      });
    }
  }
  return out;
}
