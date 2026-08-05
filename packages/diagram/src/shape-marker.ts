// Shape markers (spec/49): a small status glyph rendered inside a shape, just
// to the left of its label (or centred when the shape has no label). Three
// traffic-light status dots plus a checkbox in its unchecked / checked state.
// The kind is stored on ShapeElement.marker; its size on ShapeElement.markerSize
// (a TextSize, where 'scale' tracks the element's text size).
export type ShapeMarker =
  'green-circle' | 'orange-circle' | 'red-circle' | 'checkbox-unchecked' | 'checkbox-checked';

// Offer order for the Markers context-menu category (after the None option).
export const SHAPE_MARKERS: readonly ShapeMarker[] = [
  'green-circle',
  'orange-circle',
  'red-circle',
  'checkbox-unchecked',
  'checkbox-checked',
];
