type PlusButtonProps = {
  x: number;
  y: number;
  placement: 'right' | 'below';
  onClick: () => void;
};

const SIZE = 24;
const GAP = 12;

export function PlusButton({ x, y, placement, onClick }: PlusButtonProps) {
  // (x, y) is the anchor on the element's bounding box edge:
  //   'right' → middle of the right edge; button sits to its right.
  //   'below' → middle of the bottom edge; button sits below it.
  const left = placement === 'right' ? x + GAP : x - SIZE / 2;
  const top = placement === 'right' ? y - SIZE / 2 : y + GAP;
  const label = placement === 'right' ? 'Duplicate to the right' : 'Duplicate below';
  return (
    <button
      type="button"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={onClick}
      aria-label={label}
      className="pointer-events-auto absolute z-20 flex items-center justify-center rounded-full border border-brand-200 bg-white text-brand-600 shadow-md transition hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700"
      style={{ left, top, width: SIZE, height: SIZE }}
    >
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M8 3v10M3 8h10" />
      </svg>
    </button>
  );
}
