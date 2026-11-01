'use client';

// The empty-canvas card's picture (docs/specs/007-editor/new-document-route.md "The empty-canvas hint"): a small scene
// of what the tab's mode makes, in the brand's tints. Diagram: two shapes joined
// by an arrow to a decision; Workshop: a board of stickies with a vote. Decorative. (The card never shows in Draw,
// whose dock is its own hint.)
import type { EditorMode } from '@livediagram/document';

const BRAND = 'var(--color-brand-500)';
const SOFT = 'color-mix(in srgb, var(--color-brand-500) 14%, transparent)';
const LINE = 'color-mix(in srgb, var(--color-brand-500) 55%, transparent)';

export function EmptyCanvasArt({ mode }: { mode: EditorMode }) {
  return (
    <svg aria-hidden viewBox="0 0 120 72" className="h-[72px] w-[120px]" fill="none">
      <rect x="1" y="1" width="118" height="70" rx="12" fill={SOFT} />
      {mode === 'workshop' ? <WorkshopScene /> : <DiagramScene />}
    </svg>
  );
}

function DiagramScene() {
  return (
    <g strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect
        x="14"
        y="16"
        width="30"
        height="18"
        rx="4"
        className="fill-white dark:fill-slate-900"
        stroke={BRAND}
      />
      <path d="M21 25h16" stroke={LINE} />
      <rect
        x="14"
        y="42"
        width="30"
        height="16"
        rx="4"
        className="fill-white dark:fill-slate-900"
        stroke={LINE}
      />
      <path d="M44 25h18" stroke={BRAND} />
      <path d="m58 21.5 4 3.5-4 3.5" stroke={BRAND} />
      <path
        d="M80 13 97 30 80 47 63 30Z"
        className="fill-white dark:fill-slate-900"
        stroke={BRAND}
      />
      <path d="M44 50h28c4 0 8-3 8-7v-2" stroke={LINE} strokeDasharray="3 3" />
      <circle cx="80" cy="30" r="3" fill={BRAND} />
    </g>
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
