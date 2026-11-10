// A stored tab window on the canvas (docs/specs/009-elements/tab-window.md "A stored window"): the element is retired,
// so a window a design was saved with is a still frame named for the tab it showed, as an export draws it. It shows
// no live tab, fetches nothing and holds no controls: it moves, resizes, copies and deletes like any box.
import {
  TAB_WINDOW_EMPTY,
  TAB_WINDOW_HAIRLINE,
  TAB_WINDOW_RADIUS,
  type CanvasSurface,
  type ShapeElement,
} from '@livedesign/design';

/** The frame's words: the tab it showed, by name, or "Tab Window" when that tab is gone or was never chosen. */
export function retiredTabWindowName(
  windowTabId: string | undefined,
  tabs: readonly { id: string; name: string }[],
): string {
  const tab = windowTabId ? tabs.find((t) => t.id === windowTabId) : undefined;
  return tab ? tab.name || 'Untitled tab' : 'Tab Window';
}

export function RetiredTabWindowFace({
  element,
  surface,
  tabs,
}: {
  element: ShapeElement;
  surface: CanvasSurface;
  tabs: readonly { id: string; name: string }[];
}) {
  const empty = TAB_WINDOW_EMPTY[surface];
  const radius = Math.min(TAB_WINDOW_RADIUS, element.width / 2, element.height / 2);
  // The export's size for the name (svgTabWindow): a sixth of the height, 10 to 16 canvas units.
  const fontSize = Math.max(10, Math.min(16, element.height / 6));
  return (
    <div
      data-tab-window="retired"
      className="absolute inset-0 flex items-center justify-center overflow-hidden px-4 text-center font-semibold"
      style={{
        borderRadius: radius,
        background: empty.fill,
        color: empty.ink,
        fontSize,
        boxShadow: `inset 0 0 0 1px ${element.strokeColor ?? TAB_WINDOW_HAIRLINE}`,
      }}
    >
      {retiredTabWindowName(element.windowTabId, tabs)}
    </div>
  );
}
