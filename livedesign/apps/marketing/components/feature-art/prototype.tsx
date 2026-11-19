// The Logos section's clickable prototype card (docs/specs/007-editor/wireframe-pages.md "Clickable prototypes"):
// Prototype mode's bar over a phone screen, a press on the linked button, and the next screen sliding in. Same
// vocabulary as ./logo-more (page-kit's colours, the fa-e-* loops in app/feature-art/pages.css); under reduced motion
// it shows its finished frame.

import { Frame } from '@liveworkspace/marketing-site/components/feature-art/shared';
import { at, SKY } from '@liveworkspace/marketing-site/components/feature-art/page-kit';

const SCREEN = 'fill-white stroke-slate-300 dark:fill-slate-800 dark:stroke-slate-500';
const BLOCK = 'fill-slate-200 dark:fill-slate-600';

/** A phone frame with a screen's few blocks: a heading, a card or two and a button. */
function Phone({ x, title, button }: { x: number; title: number; button: boolean }) {
  return (
    <g>
      <rect className={SCREEN} x={x} y="20" width="50" height="72" rx="7" strokeWidth="1" />
      <rect className={BLOCK} x={x + 19} y="23.5" width="12" height="2" rx="1" />
      <rect className={BLOCK} x={x + 6} y="31" width={title} height="4" rx="1" />
      <rect className={BLOCK} x={x + 6} y="40" width="38" height="18" rx="2" />
      <rect className={BLOCK} x={x + 6} y="61" width="24" height="3" rx="1.5" />
      {button ? <rect x={x + 6} y="76" width="38" height="9" rx="4.5" fill={SKY} /> : null}
    </g>
  );
}

/** Click through the screens: Prototype mode playing a phone flow, the button pressed and Checkout sliding in. */
export function PrototypeArt() {
  return (
    <Frame canvas>
      <svg viewBox="0 0 300 96" className="absolute inset-0 h-full w-full">
        {/* The player's bar (apps/live/components/prototype/PrototypeBar.tsx): the play disc and Prototype,
            the screen's name and its place, the previous and next arrows, Copy Prototype Link, close. */}
        <rect
          className="fill-white stroke-slate-200 dark:fill-slate-900 dark:stroke-slate-700"
          x="14"
          y="3"
          width="272"
          height="14"
          rx="3"
          strokeWidth="0.8"
        />
        <circle className="fill-brand-700 dark:fill-brand-600" cx="22" cy="10" r="4" />
        <path d="M20.9 8.1v3.8l3-1.9z" fill="#ffffff" />
        <text
          x="29"
          y="12"
          fontSize="5.6"
          fontWeight="700"
          className="fill-slate-900 dark:fill-white"
        >
          Prototype
        </text>
        <rect
          className="fill-slate-200 dark:fill-slate-700"
          x="59"
          y="6.5"
          width="0.6"
          height="7"
        />
        <text
          x="64"
          y="12"
          fontSize="5.6"
          fontWeight="600"
          className="fill-slate-800 dark:fill-slate-100"
        >
          Cart
        </text>
        <text x="78" y="12" fontSize="5.6" className="fill-slate-600 dark:fill-slate-300">
          3 of 5
        </text>
        <path
          className="stroke-slate-600 dark:stroke-slate-300"
          d="M196 8l-2 2 2 2 M204 8l2 2-2 2"
          fill="none"
          strokeWidth="0.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <rect
          className="stroke-slate-200 dark:stroke-slate-700"
          x="212"
          y="5.5"
          width="60"
          height="9"
          rx="2"
          fill="none"
          strokeWidth="0.7"
        />
        <text
          x="242"
          y="11.6"
          fontSize="4.6"
          fontWeight="600"
          textAnchor="middle"
          className="fill-slate-700 dark:fill-slate-200"
        >
          Copy Prototype Link
        </text>
        <path
          className="stroke-slate-600 dark:stroke-slate-300"
          d="M277 8.2l3.6 3.6m0-3.6-3.6 3.6"
          fill="none"
          strokeWidth="0.8"
          strokeLinecap="round"
        />

        {/* The cart screen, its button lit as the press lands on it. */}
        <Phone x={70} title={26} button />
        <rect
          className="fa-e-pop fill-brand-500/20 stroke-brand-600 dark:stroke-brand-400"
          style={at(0.6)}
          x="74.5"
          y="74.5"
          width="41"
          height="12"
          rx="6"
          strokeWidth="1.2"
        />
        <g className="fa-e-pop" style={at(0.8)}>
          <circle className="fill-slate-900/20 dark:fill-white/25" cx="100" cy="81" r="5" />
          <circle className="fill-slate-900/60 dark:fill-white/70" cx="100" cy="81" r="2" />
        </g>

        {/* The link it follows, and the next screen sliding in. */}
        <path
          className="fa-e-in stroke-brand-500"
          style={at(1)}
          d="M126 56h36m-5-4 5 4-5 4"
          fill="none"
          strokeWidth="1"
          strokeDasharray="3 2"
        />
        <text
          x="144"
          y="50"
          fontSize="5.4"
          textAnchor="middle"
          className="fill-slate-500 dark:fill-slate-400"
        >
          Slide
        </text>
        <g className="fa-e-in" style={at(1.2)}>
          <Phone x={172} title={30} button />
        </g>
      </svg>
    </Frame>
  );
}
