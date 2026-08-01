// The small "N articles" / "N guides" tally in the bottom-right corner of a
// card. CategoryCard and FeatureArticleCard each carried their own copy: the
// same wrapper, the same pill classes, and the same fourteen lines of inline
// document SVG, differing only in the noun. A second copy of an icon is how
// two cards drift apart, so it lives here once.
//
// Renders nothing at zero, which is what both callers wanted and both
// expressed as their own `> 0` guard.
//
// It stays in apps/help rather than packages/: only the help centre draws it.
// The packages/ rule is for what two APPS share, and moving a single app's
// card decoration into a shared package would export a private detail.
export function CountPill({ count, noun }: { count: number; noun: string }) {
  if (count <= 0) return null;
  return (
    <div className="mt-4 flex justify-end">
      <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-500">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
        {`${count} ${noun}${count === 1 ? '' : 's'}`}
      </span>
    </div>
  );
}
