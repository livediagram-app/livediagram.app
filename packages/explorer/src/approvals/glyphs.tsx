// The approval marks (heroicons' outline paths on their 24-unit grid), shared by the editor's badge and banner and
// the History's events. Its own module with its own small svg, so the editor's first load carries these and nothing
// of the Explorer's icon set.

// Approvals: asked (sent), approved (a checked page), changes asked for (a flag), cancelled (no symbol).
export const PAPER_PLANE =
  'M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5';
export const DOCUMENT_CHECK =
  'M10.125 2.25h-4.5c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125v-9M10.125 2.25h.375a9 9 0 019 9v.375M10.125 2.25A3.375 3.375 0 0113.5 5.625v1.5c0 .621.504 1.125 1.125 1.125h1.5a3.375 3.375 0 013.375 3.375M9 15l2.25 2.25L15 12';
export const FLAG =
  'M3 3v1.5M3 21v-6m0 0l2.77-.693a9 9 0 016.208.682l.108.054a9 9 0 006.086.71l3.114-.732a48.524 48.524 0 01-.005-10.499l-3.11.732a9 9 0 01-6.085-.711l-.108-.054a9 9 0 00-6.208-.682L3 4.5M3 15V4.5';
const CLOCK = 'M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z';
const PENCIL =
  'M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z';

/** The badge's mark for each status tone. */
export const STATUS_GLYPH = {
  awaiting: CLOCK,
  changes: FLAG,
  approved: DOCUMENT_CHECK,
  changed: PENCIL,
} as const;

/** One outline path at `size` px, drawn in the text's colour. */
export function ApprovalGlyph({ d, size }: { d: string; size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth={(24 / size) * 1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={d} />
    </svg>
  );
}
