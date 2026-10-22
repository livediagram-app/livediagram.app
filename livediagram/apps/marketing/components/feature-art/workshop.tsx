// The Workshop mode card's art (docs/specs/012-collaboration/workshop-mode.md): the tab's mode
// menu with Workshop picked, a retro's stickies taking dot votes, and the Session strip of Timer,
// Vote and Poll that comes with the mode. Drawn from ./features-parts on the 300 by 96 stage, moving
// with the shared fa-pop and features' fa-b-* loops, which settle to the finished frame under
// reduced motion.

import { EDITOR_MODES, editorModeLabel } from '@livediagram/document';

import { PANEL, PanelShadow, STRONG, SUBTLE, VoteSticky } from './features-parts';
import { Frame } from './shared';

// sky-700: white text on it reads at AA, where sky-500 does not.
const PICKED = '#0369a1';
const VIEW = '0 0 300 96';
// The editor's own modes, in its order (Workshop after Draw), so the menu never drifts from the app.
const MODES = EDITOR_MODES.map(editorModeLabel);
const ROW = 14.4;

/** The tab's mode menu, Workshop picked; the stickies and the Session strip it brings. */
export function WorkshopModeArt() {
  return (
    <Frame canvas>
      <svg viewBox={VIEW} className="absolute inset-0 h-full w-full">
        {/* The mode menu: the four modes, Workshop picked. */}
        <PanelShadow x={14} y={10} w={84} h={76} r={6} />
        <rect className={PANEL} x="14" y="10" width="84" height="76" rx="6" strokeWidth="1" />
        {MODES.map((name, i) => {
          const y = 13 + i * ROW;
          const picked = name === 'Workshop';
          return (
            <g key={name} className={picked ? 'fa-pop' : undefined}>
              {picked ? <rect x="17" y={y} width="78" height="12.4" rx="3" fill={PICKED} /> : null}
              <text
                className={picked ? undefined : SUBTLE}
                x="24"
                y={y + 8.4}
                fontSize="6.4"
                fontWeight={picked ? 700 : 500}
                fill={picked ? '#ffffff' : '#64748b'}
              >
                {name}
              </text>
            </g>
          );
        })}

        {/* The session on the canvas: a retro's notes taking votes. */}
        <VoteSticky x={116} fill="#bbf7d0" ink="#14532d" label="Keep" votes={3} i={0} />
        <VoteSticky x={168} fill="#fde68a" ink="#78350f" label="Try" votes={4} i={1} />
        <VoteSticky x={220} fill="#fbcfe8" ink="#831843" label="Ask" votes={1} i={2} />

        {/* The Session strip: Timer, Vote and Poll, in Workshop only. */}
        <PanelShadow x={116} y={63} w={148} h={22} r={11} />
        <rect className={PANEL} x="116" y="63" width="148" height="22" rx="11" strokeWidth="1" />
        <g
          className="stroke-slate-500 dark:stroke-slate-400"
          fill="none"
          strokeWidth="1"
          transform="translate(129 74)"
        >
          <circle r="3.4" />
          <path d="M0 -1.7 V0 L1.2 0.9" strokeLinecap="round" />
        </g>
        <text className={STRONG} x="136" y="76.3" fontSize="6.4" fontWeight="700">
          05:00
        </text>
        <rect
          className="fill-slate-200 dark:fill-slate-700"
          x="162"
          y="68"
          width="0.8"
          height="12"
        />
        <g className="fa-b-hold" style={{ animationDelay: '0.4s' }}>
          <rect x="168" y="67" width="40" height="14" rx="7" fill={PICKED} />
          <text x="188" y="76.3" textAnchor="middle" fontSize="6.4" fontWeight="700" fill="#ffffff">
            Vote
          </text>
        </g>
        <text className={SUBTLE} x="232" y="76.3" textAnchor="middle" fontSize="6.4" fill="#64748b">
          Poll
        </text>
      </svg>
    </Frame>
  );
}
