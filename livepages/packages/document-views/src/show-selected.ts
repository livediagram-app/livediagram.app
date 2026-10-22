// `show selected` (docs/specs/024-agents/blueprints/document-views.md "show selected", VW65 to VW68): the
// owner's live selection, each element as `show` prints it, in tab order, under one header and one budget.
import type { ShowSelectedView, ViewDoor } from '@livediagram/api-schema';
import type { Element } from '@livediagram/document';
import { fitLines, fitOf, type ViewLine, type ViewResult } from './budget';
import { headerLine, viewHeader } from './header';
import type { ViewModel } from './model';
import { showElement } from './show';

// The printed elements of the tab the selection names, each once, in the tab's order (VW66).
export function selectedElements(model: ViewModel, selected: readonly string[]): Element[] {
  const wanted = new Set(selected);
  const printed = new Set(model.printed);
  return model.tab.elements.filter((el) => wanted.has(el.id) && printed.has(el));
}

export function showSelectedView(
  model: ViewModel,
  elements: readonly Element[],
  options: { budget?: number; door?: ViewDoor } = {},
): ViewResult<ShowSelectedView> {
  const shown = elements.map((el) => showElement(model, el));
  // A blank line between two elements: a separator, never counted as a line left out.
  const lines: ViewLine[] = shown.flatMap((s, i) => [...(i > 0 ? [{ text: '' }] : []), ...s.lines]);
  const fitted = fitLines({
    header: headerLine(model.facts),
    lines,
    budget: options.budget,
    door: options.door ?? 'cli',
  });
  return {
    text: fitted.text,
    fit: fitOf(fitted),
    json: { header: viewHeader('show', model.facts), selected: shown.map((s) => s.json) },
  };
}
