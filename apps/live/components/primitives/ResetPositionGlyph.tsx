// A diagonal arrow tucking back into a corner — the "snap back to the
// default corner" glyph shared by the panel settings popovers (Palette,
// Map). Extracted so the two reset-position actions can't drift.
export function ResetPositionGlyph() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 12 12"
      aria-hidden
      fill="none"
      className="shrink-0 text-slate-500 dark:text-slate-400"
    >
      <path
        d="M6.5 3H9v2.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M9 3L5 7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path
        d="M3 7v2h6"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
