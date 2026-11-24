// Feature illustrations for the links between a plan and the other liveworkspace apps: Send to Plan
// (liveworkspace/docs/specs/004-index/send-to-plan.md), View As Diagram (docs/specs/026-plan/view-as-diagram.md) and
// Live Data (liveworkspace/docs/specs/004-index/live-data.md). Each app keeps its own accent, as the site switcher
// shows it. Motion reuses the canvas card timeline (fa-a-* in app/feature-art/canvas.css), which settles to the
// finished frame under reduced motion.
import { MUTED, Panel, Pill, RULE, Scene, TEXT, at, from } from './canvas-parts';
import { PlanCard, SM, TM } from './plan-parts';
import { siteOfApp } from '@liveworkspace/sites';

// The apps' accents, as the site switcher shows them (packages/sites).
export const APP_ACCENT = {
  livediagram: siteOfApp('livediagram').accent,
  liveplanner: siteOfApp('liveplanner').accent,
  livedocuments: siteOfApp('livedocuments').accent,
  livehuddle: siteOfApp('livehuddle').accent,
  liveknowledge: siteOfApp('liveknowledge').accent,
} as const;
export type AppName = keyof typeof APP_ACCENT;

/** An app's mark: a rounded square in its accent with its initial, and its name beside it when asked. */
export function AppMark({
  x,
  y,
  app,
  named = false,
}: {
  x: number;
  y: number;
  app: AppName;
  named?: boolean;
}) {
  return (
    <g>
      <rect x={x} y={y} width="9" height="9" rx="2.5" fill={APP_ACCENT[app]} />
      <text x={x + 4.5} y={y + 6.6} fontSize="5.6" fontWeight="800" fill="#fff" textAnchor="middle">
        {app.slice(4, 5).toUpperCase()}
      </text>
      {named ? (
        <text className={TEXT} x={x + 13} y={y + 7} fontSize="6.2" fontWeight="700">
          {app}
        </text>
      ) : null}
    </g>
  );
}

/** Send to Plan: a retro's sticky becomes a card on the plan's board, and the sticky wears the card's status. */
export function SendToPlanArt() {
  return (
    <Scene>
      <Panel x={10} y={8} w={120} h={80} />
      <AppMark x={18} y={15} app="livediagram" named />
      <rect x={24} y={30} width={62} height={36} rx="2" fill="#fde68a" />
      <text x={29} y={42} fontSize="6" fontWeight="600" fill="#78350f">
        Fix the slow
      </text>
      <text x={29} y={50} fontSize="6" fontWeight="600" fill="#78350f">
        sign-in page
      </text>
      <Pill x={78} y={14} w={46} label="Send to Plan" tone="brand" />
      <g className="fa-a-pop" style={at(1.6)}>
        <Pill x={24} y={71} w={54} label="In Progress" tone="green" />
      </g>
      <path
        className="fa-a-in stroke-(--art-arrow)"
        style={at(0.5)}
        d="M132 48h22"
        strokeWidth="1"
        strokeDasharray="2 2"
      />
      <Panel x={156} y={8} w={134} h={80} />
      <AppMark x={164} y={15} app="liveplanner" named />
      <text className={MUTED} x={164} y={36} fontSize="5.4" fontWeight="700">
        To Do
      </text>
      <text className={MUTED} x={226} y={36} fontSize="5.4" fontWeight="700">
        In Progress
      </text>
      <PlanCard x={164} y={40} w={56} title="Release notes" id="LP-41" who={TM} />
      <g className="fa-a-move" style={from(-62, 0, 0.8)}>
        <PlanCard x={226} y={40} w={56} title="Fix slow sign-in" id="LP-42" type="bug" who={SM} />
      </g>
      <g className="fa-a-pop" style={at(1.2)}>
        <path className={RULE} d="M226 66h56" strokeWidth="0.6" />
        <text className={MUTED} x={226} y={74} fontSize="5">
          Sent from
        </text>
        <text className={TEXT} x={226} y={82} fontSize="5.4" fontWeight="600">
          Retro · sticky
        </text>
      </g>
    </Scene>
  );
}

/** View As Diagram: a board's cards drawn as boxes in lanes, Blocked By as arrows, the critical path in amber. */
export function ViewAsDiagramArt() {
  const lanes = ['To Do', 'In Progress', 'Done'];
  const boxes = [
    { x: 196, y: 22, label: 'LP-7', crit: true },
    { x: 238, y: 22, label: 'LP-9', crit: true },
    { x: 154, y: 22, label: 'LP-3', crit: true },
    { x: 154, y: 58, label: 'LP-4' },
    { x: 238, y: 58, label: 'LP-12' },
  ];
  return (
    <Scene>
      <Panel x={10} y={8} w={112} h={80} />
      <text className={TEXT} x={18} y={21} fontSize="6.4" fontWeight="700">
        View As Diagram
      </text>
      <text className={MUTED} x={18} y={34} fontSize="5.4">
        40 cards in 3 lanes
      </text>
      <text className={MUTED} x={18} y={44} fontSize="5.4">
        22 Blocked By arrows
      </text>
      <text className={MUTED} x={18} y={54} fontSize="5.4">
        Critical path of 3 cards
      </text>
      <rect x={18} y={66} width={96} height={14} rx="4" className="fill-brand-600" />
      <text x={66} y={75.4} fontSize="6" fontWeight="700" fill="#fff" textAnchor="middle">
        Make Diagram
      </text>
      <g className="fa-a-pop" style={at(0.4)}>
        <Panel x={132} y={8} w={158} h={80} />
        {lanes.map((lane, i) => (
          <g key={lane}>
            <rect
              x={140 + i * 46}
              y={14}
              width={42}
              height={70}
              rx="3"
              className="fill-slate-50 stroke-slate-200 dark:fill-slate-900/60 dark:stroke-slate-700"
              strokeWidth="0.6"
            />
            <text className={MUTED} x={144 + i * 46} y={84 - 3} fontSize="4.8" fontWeight="700">
              {lane}
            </text>
          </g>
        ))}
        <path
          className="fa-a-in"
          style={at(0.9)}
          d="M180 29h14M222 29h14"
          stroke="#f59e0b"
          strokeWidth="1.4"
          fill="none"
        />
        <path
          className="fa-a-in stroke-(--art-arrow)"
          style={at(1.1)}
          d="M167 36v20M222 65h14"
          strokeWidth="0.9"
          fill="none"
        />
        {boxes.map((b, i) => (
          <g key={b.label} className="fa-a-pop" style={at(0.6 + i * 0.12)}>
            <rect
              x={b.x - 12}
              y={b.y}
              width={36}
              height={14}
              rx="3"
              className="fill-(--art-ink-fill)"
              stroke={b.crit ? '#f59e0b' : undefined}
              strokeWidth={b.crit ? 1.3 : 0.8}
            />
            {b.crit ? null : (
              <rect
                x={b.x - 12}
                y={b.y}
                width={36}
                height={14}
                rx="3"
                fill="none"
                className="stroke-(--art-ink-stroke)"
                strokeWidth="0.8"
              />
            )}
            <text
              className="fill-(--art-ink-text)"
              x={b.x + 6}
              y={b.y + 9.4}
              fontSize="5.6"
              fontWeight="700"
              textAnchor="middle"
            >
              {b.label}
            </text>
          </g>
        ))}
      </g>
    </Scene>
  );
}

/** Live Data: a status report's chart reads a board's cards by column from the plan and grows as a card moves. */
export function LiveDataArt() {
  const bars = [
    { label: 'To Do', h: 30 },
    { label: 'Doing', h: 20 },
    { label: 'Done', h: 34, grows: true },
  ];
  return (
    <Scene>
      <Panel x={10} y={8} w={116} h={80} />
      <AppMark x={18} y={15} app="liveplanner" named />
      {[
        ['To Do', '9'],
        ['In Progress', '6'],
        ['Done', '11'],
      ].map(([col, n], i) => (
        <g key={col}>
          <text className={TEXT} x={18} y={40 + i * 14} fontSize="6" fontWeight="600">
            {col}
          </text>
          <text className={MUTED} x={114} y={40 + i * 14} fontSize="6" textAnchor="end">
            {n} cards
          </text>
          <path className={RULE} d={`M18 ${44 + i * 14}h96`} strokeWidth="0.5" />
        </g>
      ))}
      <path
        className="fa-a-in stroke-(--art-arrow)"
        style={at(0.4)}
        d="M128 48h18"
        strokeWidth="1"
        strokeDasharray="2 2"
      />
      <Panel x={148} y={8} w={142} h={80} />
      <AppMark x={156} y={15} app="livedocuments" named />
      <Pill x={244} y={14} w={38} label="Live" tone="green" />
      <text className={MUTED} x={156} y={36} fontSize="5.4">
        Board Counts · by column
      </text>
      <path className={RULE} d="M162 80h112" strokeWidth="0.6" />
      {bars.map((b, i) => (
        <g key={b.label}>
          <rect
            x={170 + i * 34}
            y={80 - b.h}
            width={20}
            height={b.h}
            rx="2"
            fill={APP_ACCENT.livedocuments}
            fillOpacity={b.grows ? 1 : 0.55}
          />
          {b.grows ? (
            <g className="fa-a-pop" style={at(1.2)}>
              <Pill x={166 + i * 34} y={80 - b.h - 14} w={28} label="+1" tone="green" />
            </g>
          ) : null}
          <text className={MUTED} x={180 + i * 34} y={87} fontSize="4.6" textAnchor="middle">
            {b.label}
          </text>
        </g>
      ))}
    </Scene>
  );
}
