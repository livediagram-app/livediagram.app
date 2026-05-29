export type PlusPlacement = 'right' | 'below' | 'left' | 'above';

type PlusButtonProps = {
  x: number;
  y: number;
  placement: PlusPlacement;
  zoom: number;
  onClick: () => void;
};

const SIZE = 24;
const GAP = 12;

const LABELS: Record<PlusPlacement, string> = {
  right: 'Duplicate to the right',
  below: 'Duplicate below',
  left: 'Duplicate to the left',
  above: 'Duplicate above',
};

// Each placement maps to a translate that anchors the button to the element
// edge, and a transform-origin that keeps the button hugging that edge when
// counter-scaled. (x, y) is the middle of that edge in canvas-coords.
const VARIANTS: Record<PlusPlacement, { translate: string; origin: string; offset: (gap: number) => { dx: number; dy: number } }> = {
  right: {
    translate: '0%, -50%',
    origin: 'left center',
    offset: (gap) => ({ dx: gap, dy: 0 }),
  },
  below: {
    translate: '-50%, 0%',
    origin: 'top center',
    offset: (gap) => ({ dx: 0, dy: gap }),
  },
  left: {
    translate: '-100%, -50%',
    origin: 'right center',
    offset: (gap) => ({ dx: -gap, dy: 0 }),
  },
  above: {
    translate: '-50%, -100%',
    origin: 'center bottom',
    offset: (gap) => ({ dx: 0, dy: -gap }),
  },
};

export function PlusButton({ x, y, placement, zoom, onClick }: PlusButtonProps) {
  const variant = VARIANTS[placement];
  const { dx, dy } = variant.offset(GAP / zoom);
  return (
    <button
      type="button"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={onClick}
      aria-label={LABELS[placement]}
      className="pointer-events-auto absolute z-20 flex items-center justify-center rounded-full border border-brand-200 bg-white text-brand-600 shadow-md transition hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700"
      style={{
        left: x + dx,
        top: y + dy,
        width: SIZE,
        height: SIZE,
        transform: `translate(${variant.translate}) scale(${1 / zoom})`,
        transformOrigin: variant.origin,
      }}
    >
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M8 3v10M3 8h10" />
      </svg>
    </button>
  );
}
