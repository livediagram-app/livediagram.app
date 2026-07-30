import type { ListStyle, RunHeading } from '@livediagram/diagram';

// The block type of the current lines, as one closed vocabulary (spec/102).
//
// Heading level and list style are two independent run attributes, but to a
// writer they are one choice: a line is a heading, or a paragraph, or a
// bullet. Exposing them as separate controls (two heading buttons beside
// three list buttons) made five toggles out of one decision, and left the
// user to work out that "Heading" and "Bullet list" were mutually exclusive
// in practice even though nothing said so.
export type BlockType = 'paragraph' | 'h1' | 'h2' | 'h3' | 'bullet' | 'numbered';

export const BLOCK_TYPES: { id: BlockType; label: string; description: string }[] = [
  { id: 'paragraph', label: 'Paragraph', description: 'Plain body text.' },
  { id: 'h1', label: 'Heading 1', description: 'The largest heading.' },
  { id: 'h2', label: 'Heading 2', description: 'A section heading.' },
  { id: 'h3', label: 'Heading 3', description: 'A sub-section heading.' },
  { id: 'bullet', label: 'Bullet point', description: 'An unordered list item.' },
  { id: 'numbered', label: 'Numbered point', description: 'An ordered list item.' },
];

/**
 * Which block type the current selection reads as.
 *
 * A list wins over a heading when both are somehow set: the bullet is the
 * thing you can see at the start of the line, so reporting "Heading 2" for a
 * line rendering a bullet would be the picker lying about what is on screen.
 */
export function blockTypeOf(heading: RunHeading | null, list: ListStyle): BlockType {
  if (list === 'bullet') return 'bullet';
  if (list === 'numbered') return 'numbered';
  if (heading === 1) return 'h1';
  if (heading === 2) return 'h2';
  if (heading === 3) return 'h3';
  return 'paragraph';
}

/**
 * The two applies that produce a block type.
 *
 * Both always run, and that is the point: picking Heading 1 on a bullet has
 * to clear the bullet, and picking Bullet on a heading has to clear the
 * heading, or the vocabulary above stops being a closed set and lines drift
 * into states the picker can't describe.
 */
export function blockTypeApplies(type: BlockType): {
  heading: RunHeading | null;
  list: ListStyle;
} {
  switch (type) {
    case 'h1':
      return { heading: 1, list: 'none' };
    case 'h2':
      return { heading: 2, list: 'none' };
    case 'h3':
      return { heading: 3, list: 'none' };
    case 'bullet':
      return { heading: null, list: 'bullet' };
    case 'numbered':
      return { heading: null, list: 'numbered' };
    case 'paragraph':
      return { heading: null, list: 'none' };
  }
}

/**
 * The list style the FIRST line of `text` is in.
 *
 * A list is literal line-prefix text ("• " / "1. ") rather than a block node
 * (spec/92), so detecting one means reading the prefix — there is no node to
 * ask. First line only: the picker shows one value, and a selection spanning
 * a bullet and a paragraph has no single honest answer, so it reports where
 * the selection starts.
 */
export function listStyleOfText(text: string): ListStyle {
  const first = text.split('\n')[0] ?? '';
  if (first.startsWith('• ')) return 'bullet';
  if (/^\d+\. /.test(first)) return 'numbered';
  return 'none';
}

export const blockTypeLabel = (type: BlockType): string =>
  BLOCK_TYPES.find((b) => b.id === type)?.label ?? 'Paragraph';
