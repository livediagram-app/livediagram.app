// The element union (docs/specs/006-document/document-structure.md): every boxed kind, the article
// note among them, plus the arrow, the cross-tab link any element carries, and the guards that ask
// what an element is or can hold. Re-exported from the package root (./index).
// Value import from the data-shapes LEAF module (it imports only types from
// the package root, so no cycle at runtime): elementSupportsText excludes the
// self-drawing data shapes the same way the inline editor does.
import { isSelfDrawingShape } from './data-shapes';
import type { ArrowElement } from './arrow-types';
import type { TabId, ElementId } from '@liveworkspace/model-core/basics';
import type {
  ShapeElement,
  TextElement,
  TableElement,
  StickyElement,
  ImageElement,
  FreehandElement,
  ArticleNoteElement,
  LinkCardElement,
  VideoElement,
} from './element-types';

// Cross-tab link on any element. `tab` jumps to another tab on the same
// document; `document` navigates to a different document entirely (with
// the document's name cached on the element so the picker / badge can
// show it without a round-trip). Element-specific linking
// (jump-and-focus a specific element) is in the spec but not in the
// UI yet.
export type ElementLink =
  | { kind: 'tab'; tabId: TabId }
  | { kind: 'element'; tabId: TabId; elementId: ElementId }
  | { kind: 'document'; documentId: string; name: string }
  // An external web address. Followed by opening in a new tab; stored
  // verbatim (the UI normalises a bare host to https:// on entry). Used
  // by both element links and per-cell table links (docs/specs/008-canvas/canvas-and-palette.md).
  | { kind: 'url'; url: string };

// --- Element union ---------------------------------------------------------

export type BoxedElement =
  | ShapeElement
  | TextElement
  | StickyElement
  | ImageElement
  | FreehandElement
  | TableElement
  | ArticleNoteElement
  | LinkCardElement
  | VideoElement;
export type Element = BoxedElement | ArrowElement;

export function isBoxed(element: Element): element is BoxedElement {
  return (
    element.type === 'shape' ||
    element.type === 'text' ||
    element.type === 'sticky' ||
    element.type === 'image' ||
    element.type === 'freehand' ||
    element.type === 'table' ||
    element.type === 'article-note' ||
    element.type === 'link-card' ||
    element.type === 'video'
  );
}

// True when the element carries a non-empty text label: the plain-text
// `label` every labelable kind mirrors (shape / text / sticky / freehand /
// link-card and arrows). Drives the selection toolbar's "Edit Text" button,
// which only appears once an element actually has text to edit. Tables
// (per-cell `cells`), images (`alt`), and margin notes carry no
// single `label`, so this reads false for them: matching the inline label
// editor, which targets `label`-bearing elements only.
export function elementHasText(element: Element): boolean {
  const label = (element as { label?: string }).label;
  return typeof label === 'string' && label.trim().length > 0;
}

// True when the element KIND can carry the plain-text `label`: whether or
// not one is set yet. Shapes qualify except the self-drawing data shapes
// (progress / rail / rating / charts), which the inline editor refuses;
// text / sticky / freehand / arrows all edit `label` too. A link-card is
// deliberately OUT: its view renders link metadata, never `label`, and its
// double-click opens the link picker (docs/specs/009-elements/link-cards.md): an Add-text button there
// entered an edit state with no editor on screen.
// Drives the selection toolbar's "Edit Text" / "Add Text" button, which
// shows on every text-capable element (an empty one included, so the
// affordance teaches that text can be added).
export function elementSupportsText(element: Element): boolean {
  if (element.type === 'shape') return !isSelfDrawingShape(element.shape);
  return (
    element.type === 'text' ||
    element.type === 'sticky' ||
    element.type === 'freehand' ||
    element.type === 'arrow'
  );
}
