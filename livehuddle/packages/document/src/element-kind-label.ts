import type { Element, ShapeKind } from './index';
import { isRetiredElement, retiredElementName } from './retired-kinds';

// Human-readable name for a shape kind, e.g. 'square' -> 'Square',
// 'speech-bubble' -> 'Speech Bubble'. Used in selection labels and any
// surface that wants to name the kind of element a user has selected.
const SHAPE_LABELS: Partial<Record<ShapeKind, string>> = {
  'speech-bubble': 'Speech Bubble',
  icon: 'Icon',
  // Named for what it does, not its internal kind — titleCase would say
  // 'Mode Button' (docs/specs/009-elements/mode-button.md).
  'mode-button': 'Selection Mode',
};

function titleCase(s: string): string {
  return s
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// A short, human-readable name for what an element IS, e.g. 'Square',
// 'Icon', 'Text', 'Sticky'. Title-cased so callers that
// uppercase (e.g. a selection caption) read naturally.
export function elementKindLabel(el: Element): string {
  switch (el.type) {
    case 'shape': {
      // A retired element goes by its placeholder's name (docs/specs/002-project-scope/not-in-livehuddle.md).
      if (isRetiredElement(el)) return retiredElementName(el);
      return SHAPE_LABELS[el.shape] ?? titleCase(el.shape);
    }
    case 'text':
      return 'Text';
    case 'sticky':
      return 'Sticky';
    case 'image':
      return 'Image';
    case 'link-card':
      return 'Link';
    case 'video':
    case 'table':
    case 'freehand':
    case 'path':
    case 'annotation':
    case 'arrow':
      // A retired element type (docs/specs/002-project-scope/not-in-livehuddle.md "The element engine").
      return retiredElementName(el);
  }
}
