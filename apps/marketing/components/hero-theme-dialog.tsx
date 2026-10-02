// The Tab Look & Feel dialog mock (docs/specs/011-theme/canvas-and-theme-dialog.md) the hero's
// flowchart window opens for its theme beat: title, the Theme / Canvas / Font tabs,
// and a grid of theme cards; a pointer picks one, the ring moves, and it closes.

// The theme cards the Look & Feel dialog mock offers, each its scheme's canvas ringed
// in its stroke (packages/document themes-data.ts). Default is what the flowchart
// wears until the pick. In light the pick is Forest; in dark the dialog shows the
// Dark category (darkCategorySchemes in apps/live), the Default scheme's dark half
// first, and the pick is Pine.
type ThemeCard = {
  name: string;
  canvas: string;
  stroke: string;
  current?: boolean;
  picked?: boolean;
};
const THEME_CARDS: ThemeCard[] = [
  { name: 'Default', canvas: '#fbfaf7', stroke: '#0ea5e9', current: true },
  { name: 'Forest', canvas: '#f0fdf4', stroke: '#15803d', picked: true },
  { name: 'Ocean', canvas: '#ecfeff', stroke: '#0e7490' },
  { name: 'Sunset', canvas: '#fff7ed', stroke: '#c2410c' },
  { name: 'Lavender', canvas: '#faf5ff', stroke: '#7e22ce' },
  { name: 'Rose', canvas: '#fff1f2', stroke: '#be123c' },
];
const DARK_THEME_CARDS: ThemeCard[] = [
  { name: 'Default', canvas: '#0d121a', stroke: '#64748b', current: true },
  { name: 'Midnight', canvas: '#0f172a', stroke: '#94a3b8' },
  { name: 'Pine', canvas: '#14532d', stroke: '#86efac', picked: true },
  { name: 'Plum', canvas: '#241436', stroke: '#c4b5fd' },
  { name: 'Abyss', canvas: '#042f2e', stroke: '#5eead4' },
  { name: 'Espresso', canvas: '#231a12', stroke: '#d6b78f' },
];

// A theme card; the current one starts ringed, the picked one takes the ring.
function ThemeCardView({ card }: { card: ThemeCard }) {
  return (
    <span
      className={`flex flex-col items-center gap-1 rounded-lg border py-1.5 text-[8px] font-medium text-slate-600 dark:text-slate-300 ${
        card.picked
          ? 'hero-dialog-pick border-slate-200 dark:border-slate-700'
          : card.current
            ? 'hero-dialog-was border-brand-400 ring-1 ring-brand-300'
            : 'border-slate-200 dark:border-slate-700'
      }`}
    >
      <span
        className="h-4 w-4 rounded-full"
        style={{ backgroundColor: card.canvas, boxShadow: `inset 0 0 0 2px ${card.stroke}` }}
      />
      {card.name}
    </span>
  );
}

export function HeroThemeDialog() {
  return (
    <div className="hero-dialog absolute left-1/2 top-1/2 z-10 hidden w-64 -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl border border-slate-200 bg-white shadow-2xl sm:flex dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-[11px] font-semibold text-slate-800 dark:text-slate-100">
          Tab Look &amp; Feel
        </span>
        <span className="flex items-center gap-2 text-[10px] text-slate-400">
          <span>?</span>
          <span>✕</span>
        </span>
      </div>
      <div className="mx-3 flex rounded-md bg-slate-100 p-0.5 text-[9px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
        <span className="flex-1 rounded bg-white py-0.5 text-center text-slate-800 shadow-sm dark:bg-slate-900 dark:text-slate-100">
          Theme
        </span>
        <span className="flex-1 py-0.5 text-center">Canvas</span>
        <span className="flex-1 py-0.5 text-center">Font</span>
      </div>
      <div className="grid grid-cols-3 gap-1.5 p-3 dark:hidden">
        {THEME_CARDS.map((t) => (
          <ThemeCardView key={t.name} card={t} />
        ))}
      </div>
      <div className="hidden grid-cols-3 gap-1.5 p-3 dark:grid">
        {DARK_THEME_CARDS.map((t) => (
          <ThemeCardView key={t.name} card={t} />
        ))}
      </div>
      <span className="hero-dialog-cursor pointer-events-none absolute" aria-hidden>
        <svg
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="#0f172a"
          stroke="white"
          strokeWidth="1"
        >
          <path d="M2 1 L14 8 L8 9 L11 14 L9 15 L6 10 L2 14 Z" />
        </svg>
      </span>
    </div>
  );
}
