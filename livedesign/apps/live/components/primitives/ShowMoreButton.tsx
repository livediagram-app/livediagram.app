// The standard "Show more X" footer button used everywhere the
// `useShowMoreList` hook gates an extras section. Same look across
// the template picker, the theme grids, and the canvas-pattern grid
// so the affordance is recognisable wherever it appears.
export function ShowMoreButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-brand-700 hover:text-brand-800 dark:text-brand-400 dark:hover:text-brand-300"
    >
      {label}
      <span aria-hidden>↓</span>
    </button>
  );
}
