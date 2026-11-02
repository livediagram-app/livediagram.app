'use client';

// The empty-canvas card's picture (docs/specs/007-editor/new-document-route.md "The empty-canvas hint"): a small scene
// of a Workshop board, stickies with a vote, in the brand's tints. Decorative.

const BRAND = 'var(--color-brand-500)';
const SOFT = 'color-mix(in srgb, var(--color-brand-500) 14%, transparent)';

export function EmptyCanvasArt() {
  return (
    <svg aria-hidden viewBox="0 0 120 72" className="h-[72px] w-[120px]" fill="none">
      <rect x="1" y="1" width="118" height="70" rx="12" fill={SOFT} />
      <WorkshopScene />
    </svg>
  );
}

function WorkshopScene() {
  const sticky = (x: number, y: number, fill: string, rot: number) => (
    <g transform={`rotate(${rot} ${x + 11} ${y + 11})`}>
      <rect x={x} y={y} width="22" height="22" rx="2.5" fill={fill} />
      <path
        d={`M${x + 5} ${y + 9}h12M${x + 5} ${y + 14}h8`}
        stroke="rgba(15,23,42,0.35)"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </g>
  );
  return (
    <g>
      {sticky(14, 14, '#fde68a', -4)}
      {sticky(42, 18, '#bbf7d0', 3)}
      {sticky(70, 12, '#fbcfe8', -2)}
      {sticky(28, 40, '#bfdbfe', 2)}
      {sticky(58, 42, '#fde68a', -3)}
      {/* A vote dot on one. */}
      <circle
        cx="80"
        cy="16"
        r="4.5"
        fill={BRAND}
        className="stroke-white dark:stroke-slate-900"
        strokeWidth="1.5"
      />
      <rect
        x="92"
        y="40"
        width="16"
        height="18"
        rx="3"
        className="fill-white dark:fill-slate-900"
        stroke={BRAND}
        strokeWidth="1.6"
      />
      <path d="M100 44v5l3 2" stroke={BRAND} strokeWidth="1.6" strokeLinecap="round" />
    </g>
  );
}
