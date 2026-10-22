import type { Element } from '@livedocuments/document';

// One generic way for a context-menu control to write a field of its own onto the selection, so a new element's
// controls (accent edge, card slots, badge look, boundary style, concept rows) need no new setter threaded through
// the editor state, host and menu props. Each control passes a pure mapper from @livedocuments/document.
//
// - `preview` / `end`: a hover preview over the selection, reverted when the pointer leaves (useStylePreview).
// - `commit`: one history step, from the pre-hover originals, with its telemetry type.
// - `commitTab`: one history step over the whole tab, for a control whose change reaches past the selection.
// - `burst`: a debounced write for a dragged control (a colour input), one history step per gesture
//   (useColorStyleSetters' burst checkpoint), keyed by the field it writes.
export type ElementStyleOps = {
  preview: (map: (el: Element) => Element) => void;
  end: () => void;
  commit: (map: (el: Element) => Element, telemetryType: string) => void;
  burst: (field: string, map: (el: Element) => Element) => void;
  // A whole-tab write, one history step: for a control that changes elements beyond the selection (Renumber
  // Steps, Play in Order across every step).
  commitTab: (map: (elements: Element[]) => Element[], telemetryType: string) => void;
};
