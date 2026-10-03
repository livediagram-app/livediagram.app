// The colours the page toolbar offers for text and highlights (docs/specs/007-editor/document-pages.md
// "The page toolbar"): the document's accent first, then a fixed set chosen to read on white paper;
// highlights are their pale tints. "Default" (no colour) is always first.

export type DocSwatch = { label: string; value: string };

export const DOC_TEXT_SWATCHES: readonly DocSwatch[] = [
  { label: 'Gray', value: '#64748b' },
  { label: 'Red', value: '#dc2626' },
  { label: 'Orange', value: '#ea580c' },
  { label: 'Amber', value: '#b45309' },
  { label: 'Green', value: '#16a34a' },
  { label: 'Teal', value: '#0d9488' },
  { label: 'Blue', value: '#2563eb' },
  { label: 'Purple', value: '#7c3aed' },
  { label: 'Pink', value: '#db2777' },
];

export const DOC_HIGHLIGHT_SWATCHES: readonly DocSwatch[] = [
  { label: 'Yellow', value: '#fef08a' },
  { label: 'Orange', value: '#fed7aa' },
  { label: 'Red', value: '#fecaca' },
  { label: 'Green', value: '#bbf7d0' },
  { label: 'Teal', value: '#99f6e4' },
  { label: 'Blue', value: '#bfdbfe' },
  { label: 'Purple', value: '#ddd6fe' },
  { label: 'Pink', value: '#fbcfe8' },
  { label: 'Gray', value: '#e2e8f0' },
];
