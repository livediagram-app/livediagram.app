// Loading a Mode Button saved while the Highlighter was a selection mode
// (docs/specs/008-canvas/highlighter.md "Not a selection mode"). The marker is a Draw tile now, so
// `mode: 'highlighter'` would fail validation and take the tab with it. The field is dropped and
// the button reads as the default mode. Runs where stored elements enter (./stored-elements). The Laser, the Spotlight
// and Isometric left livehuddle the same way (docs/specs/002-project-scope/not-in-livehuddle.md "The presenting tools,
// Isometric and Zen"), so a button saved with one of them loads with no mode too. And Avatar is the one mode a button
// hands out now (docs/specs/009-elements/mode-button.md "Only Avatar"), so a Select, Hand, Eraser or Format button
// loads with no mode as well: it becomes an Avatar button.
import type { Element } from './index';

const RETIRED_MODES: ReadonlySet<unknown> = new Set([
  'highlighter',
  'laser',
  'spotlight',
  'isometric',
  'select',
  'pan',
  'eraser',
  'format',
]);

const carriesRetiredMode = (el: Element): boolean =>
  el.type === 'shape' && RETIRED_MODES.has((el as { mode?: unknown }).mode);

export function migrateLegacyModeButtons(elements: Element[]): Element[] {
  if (!elements.some(carriesRetiredMode)) return elements;
  return elements.map((el) => {
    if (!carriesRetiredMode(el)) return el;
    const { mode: _gone, ...rest } = el as Element & { mode?: unknown };
    void _gone;
    return rest;
  });
}
