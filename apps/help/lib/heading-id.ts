import { isValidElement, type ReactNode } from 'react';

// A heading's anchor (an article's `## Section` and `### Sub-section`): its words lower-cased, every run of anything
// else one `-`. One rule for the id the page renders and the Contents link to it, so a link written from either
// (another article's `/help/<path>/#the-colour-picker`, the Contents list) lands, on a first load as on a click.
export function slugOf(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// The text a heading's children read as, through any formatting inside it (a code span, a link, bold).
export function textOf(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (isValidElement<{ children?: ReactNode }>(node)) return textOf(node.props.children);
  return '';
}

export const headingId = (children: ReactNode): string => slugOf(textOf(children));
