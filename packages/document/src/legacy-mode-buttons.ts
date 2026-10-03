// Loading a Mode Button saved while the Highlighter was a selection mode
// (docs/specs/008-canvas/highlighter.md "Not a selection mode"). The marker is a Draw tile now, so
// `mode: 'highlighter'` would fail validation and take the tab with it. The field is dropped and
// the button reads as the default mode. Runs where stored elements enter (./stored-elements).
import type { Element } from './index';

const RETIRED_MODES: ReadonlySet<unknown> = new Set(['highlighter']);

const carriesRetiredMode = (el: Element): boolean =>
  el.type === 'shape' && RETIRED_MODES.has((el as { mode?: unknown }).mode);

export function migrateLegacyModeButtons(elements: Element[]): Element[] {
  if (!elements.some(carriesRetiredMode)) return elements;
  return elements.map((el) => {
    if (!carriesRetiredMode(el)) return el;
    const { mode: _gone, ...rest } = el as Element & { mode?: unknown };
    void _gone;
    return rest as Element;
  });
}
