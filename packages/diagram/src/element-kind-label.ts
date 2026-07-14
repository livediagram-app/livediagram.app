import type { Element, ShapeKind } from './index';

// Human-readable name for a shape kind, e.g. 'square' -> 'Square',
// 'speech-bubble' -> 'Speech Bubble'. Used in selection labels and any
// surface that wants to name the kind of element a user has selected.
const SHAPE_LABELS: Partial<Record<ShapeKind, string>> = {
  'speech-bubble': 'Speech Bubble',
  icon: 'Icon',
  'progress-bar': 'Progress Bar',
  'progress-ring': 'Progress Ring',
};

function titleCase(s: string): string {
  return s
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// A short, human-readable name for what an element IS, e.g. 'Square',
// 'Table', 'Icon', 'Text', 'Sticky', 'Arrow'. Title-cased so callers that
// uppercase (e.g. a selection caption) read naturally.
export function elementKindLabel(el: Element): string {
  switch (el.type) {
    case 'shape':
      return SHAPE_LABELS[el.shape] ?? titleCase(el.shape);
    case 'text':
      return 'Text';
    case 'table':
      return 'Table';
    case 'sticky':
      return 'Sticky';
    case 'image':
      return 'Image';
    case 'freehand':
      // The marker pen (spec/81) and polygon tool (spec/84) both commit
      // freehands; name them by what the user drew (matching the live
      // app's kindLabel in element-names.ts).
      if (el.pen === 'highlighter') return 'Highlight';
      if (el.straightEdges) return el.closed ? 'Polygon' : 'Polyline';
      return 'Sketch';
    case 'annotation':
      return 'Annotation';
    case 'link-card':
      return 'Link';
    case 'arrow':
      return 'Arrow';
  }
}
