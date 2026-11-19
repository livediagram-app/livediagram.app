// Feature illustrations for what a plan reaches beyond itself: the calendar feed
// (docs/specs/026-plan/calendar-feed.md), connected files, embeds, the plan's share password and the Google Drive copy.
// Motion reuses the canvas card timeline (fa-a-* in app/feature-art/canvas.css), which settles to the finished frame
// under reduced motion.
import {
  Avatar,
  Bar,
  CLOCK_PATHS,
  Glyph,
  LINK_PATHS,
  LOCK_PATHS,
  MUTED,
  Panel,
  Pill,
  RULE,
  SAM,
  Scene,
  TEXT,
  at,
  from,
} from './canvas-parts';

/** Dates in your calendar: the plan's due cards in a week of the calendar app, beside the meetings already there. */
export function CalendarFeedArt() {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  const cards = [
    { day: 1, y: 30, label: 'Copy due' },
    { day: 3, y: 44, label: 'Release' },
  ];
  const meetings = [
    { day: 0, y: 52, label: 'Stand-up' },
    { day: 2, y: 30, label: 'Review' },
    { day: 4, y: 58, label: '1:1' },
  ];
  return (
    <Scene>
      <Panel x={10} y={6} w={280} h={84} />
      <Glyph x={18} y={12} className="stroke-brand-500">
        {CLOCK_PATHS}
      </Glyph>
      <text className={TEXT} x={32} y={19} fontSize="6.6" fontWeight="700">
        Your calendar
      </text>
      <g transform="translate(206 11)">
        <rect width="76" height="11" rx="5.5" className="fill-brand-100 dark:fill-brand-500/25" />
        <circle cx="7" cy="5.5" r="2.4" className="fill-brand-500" />
        <text
          x="13"
          y="7.8"
          fontSize="5.8"
          fontWeight="600"
          className="fill-brand-700 dark:fill-brand-200"
        >
          Launch plan feed
        </text>
      </g>
      {days.map((d, i) => (
        <g key={d}>
          <text className={MUTED} x={20 + i * 54} y={30} fontSize="5.4" fontWeight="600">
            {d}
          </text>
          {i ? <path className={RULE} d={`M${16 + i * 54} 25v60`} strokeWidth="0.6" /> : null}
        </g>
      ))}
      {meetings.map((m) => (
        <g key={m.label}>
          <rect
            x={19 + m.day * 54}
            y={m.y + 5}
            width={48}
            height={13}
            rx="2.5"
            className="fill-slate-100 dark:fill-slate-700/70"
          />
          <text className={MUTED} x={23 + m.day * 54} y={m.y + 13.6} fontSize="5.4">
            {m.label}
          </text>
        </g>
      ))}
      {cards.map((c, i) => (
        <g key={c.label} className="fa-a-pop" style={at(0.4 + i * 0.3)}>
          <rect
            x={19 + c.day * 54}
            y={c.y + 5}
            width={48}
            height={13}
            rx="2.5"
            className="fill-brand-500/15 stroke-brand-500"
            strokeWidth="0.7"
          />
          <text
            className="fill-brand-700 dark:fill-brand-200"
            x={23 + c.day * 54}
            y={c.y + 13.6}
            fontSize="5.4"
            fontWeight="600"
          >
            {c.label}
          </text>
        </g>
      ))}
    </Scene>
  );
}

/** Files from your other apps: the plan's tab bar holds a connected file, its preview open with a way into it. */
export function ConnectedFilesArt() {
  const tabs = [
    { name: 'Roadmap', colour: '#8b5cf6', w: 50 },
    { name: 'Budget', colour: '#10b981', w: 44 },
    { name: 'Architecture', colour: '#0ea5e9', w: 66, connected: true },
  ];
  let x = 14;
  return (
    <Scene>
      {tabs.map((t) => {
        const at0 = x;
        x += t.w + 4;
        return (
          <g key={t.name}>
            <rect
              x={at0}
              y={8}
              width={t.w}
              height={14}
              rx="4"
              className={
                t.connected
                  ? 'fill-white stroke-sky-400 dark:fill-slate-800 dark:stroke-sky-400'
                  : 'fill-white stroke-slate-200 dark:fill-slate-800 dark:stroke-slate-700'
              }
              strokeWidth="0.8"
            />
            {t.connected ? (
              <Glyph x={at0 + 4} y={10.2} scale={0.95} className="stroke-sky-500">
                {LINK_PATHS}
              </Glyph>
            ) : (
              <rect x={at0 + 5} y={12.5} width="5" height="5" rx="1.2" fill={t.colour} />
            )}
            <text className={TEXT} x={at0 + 15} y={17.4} fontSize="5.8" fontWeight="600">
              {t.name}
            </text>
          </g>
        );
      })}
      <g className="fa-a-pop" style={at(0.4)}>
        <Panel x={14} y={28} w={272} h={60} />
        <rect
          x={22}
          y={35}
          width={120}
          height={46}
          rx="4"
          className="fill-(--art-paper) stroke-slate-200 dark:stroke-slate-700"
          strokeWidth="0.6"
        />
        {[
          [32, 44],
          [72, 44],
          [52, 62],
        ].map(([bx, by]) => (
          <rect
            key={`${bx}-${by}`}
            x={bx}
            y={by}
            width="30"
            height="11"
            rx="2"
            className="fill-(--art-ink-fill) stroke-(--art-ink-stroke)"
            strokeWidth="0.7"
          />
        ))}
        <path
          d="M47 55v7M87 55c0 4-10 4-12 7"
          fill="none"
          className="stroke-(--art-arrow)"
          strokeWidth="0.7"
        />
        <text className={TEXT} x={152} y={46} fontSize="7" fontWeight="700">
          Architecture
        </text>
        <text className={MUTED} x={152} y={56} fontSize="5.8">
          Connected file, by Jordan
        </text>
        <rect x={152} y={64} width={62} height={13} rx="6.5" className="fill-sky-600" />
        <text x={183} y={72.6} fontSize="6" fontWeight="700" textAnchor="middle" fill="#fff">
          Open
        </text>
      </g>
    </Scene>
  );
}

/** Embed a live board: a wiki page with the board inside it, still live, a teammate's card moving across. */
export function EmbedBoardArt() {
  return (
    <Scene>
      <Panel x={14} y={6} w={272} h={84} />
      <text className={TEXT} x={24} y={20} fontSize="7" fontWeight="700">
        Team wiki · Launch
      </text>
      <Bar x={24} y={27} w={110} />
      <Bar x={24} y={33} w={84} />
      <rect
        x={24}
        y={41}
        width={252}
        height={43}
        rx="4"
        className="fill-slate-50 stroke-brand-300 dark:fill-slate-900/60 dark:stroke-brand-500/50"
        strokeWidth="0.8"
      />
      {['To Do', 'In Progress', 'Done'].map((col, i) => (
        <g key={col}>
          <text className={MUTED} x={32 + i * 82} y={51} fontSize="5.2" fontWeight="700">
            {col}
          </text>
          <rect
            x={30 + i * 82}
            y={55}
            width={74}
            height={11}
            rx="2.5"
            className="fill-white stroke-slate-200 dark:fill-slate-700 dark:stroke-slate-600"
            strokeWidth="0.6"
          />
          <Bar x={34 + i * 82} y={59} w={34 + i * 6} />
        </g>
      ))}
      <g className="fa-a-move" style={from(-82, 0, 0.6)}>
        <rect
          x={194}
          y={69}
          width={74}
          height={11}
          rx="2.5"
          className="fill-white stroke-emerald-400 dark:fill-slate-700"
          strokeWidth="0.8"
        />
        <Bar x={198} y={73} w={40} />
        <Avatar cx={260} cy={74.5} r={3.6} color={SAM} initials="S" />
      </g>
      <Pill x={234} y={10} w={42} label="Live" tone="green" />
    </Scene>
  );
}

/** A password on the plan: someone arriving by a share link is asked for it before the plan opens. */
export function SharePasswordArt() {
  return (
    <Scene>
      <Panel x={14} y={8} w={124} h={80} />
      <text className={TEXT} x={24} y={22} fontSize="6.8" fontWeight="700">
        Share
      </text>
      <text className={MUTED} x={24} y={36} fontSize="5.2" fontWeight="700" letterSpacing="0.5">
        PASSWORD
      </text>
      <rect
        x={24}
        y={40}
        width={104}
        height={14}
        rx="4"
        className="fill-slate-50 stroke-slate-200 dark:fill-slate-900/60 dark:stroke-slate-700"
        strokeWidth="0.6"
      />
      <Glyph x={28} y={42} scale={0.95}>
        {LOCK_PATHS}
      </Glyph>
      <text className={TEXT} x={40} y={49.6} fontSize="6" fontWeight="600">
        Password Set
      </text>
      <Pill x={24} y={62} w={40} label="Replace" />
      <Pill x={68} y={62} w={40} label="Remove" />
      <path
        className="fa-a-in stroke-(--art-arrow)"
        style={at(0.3)}
        d="M142 48h20"
        strokeWidth="1"
        strokeDasharray="2 2"
      />
      <g className="fa-a-pop" style={at(0.5)}>
        <Panel x={166} y={14} w={120} h={68} />
        <circle cx={226} cy={30} r="8" className="fill-brand-100 dark:fill-brand-500/25" />
        <Glyph x={221} y={25} className="stroke-brand-600 dark:stroke-brand-300">
          {LOCK_PATHS}
        </Glyph>
        <text className={TEXT} x={226} y={48} fontSize="6.2" fontWeight="700" textAnchor="middle">
          This plan has a password
        </text>
        <rect
          x={178}
          y={54}
          width={96}
          height={12}
          rx="3"
          className="fill-slate-50 stroke-slate-200 dark:fill-slate-900/60 dark:stroke-slate-700"
          strokeWidth="0.6"
        />
        <text className={MUTED} x={183} y={62.2} fontSize="6" letterSpacing="1.5">
          ••••••
        </text>
        <rect x={178} y={69} width={96} height={9} rx="4.5" className="fill-brand-600" />
        <text x={226} y={75.4} fontSize="5.4" fontWeight="700" textAnchor="middle" fill="#fff">
          Open Plan
        </text>
      </g>
    </Scene>
  );
}

/** A copy in your Google Drive: the plans kept as files in Drive's liveworkspace folder, each synced. */
export function DriveCopyArt() {
  const files = ['Launch plan.liveplanner', 'Hiring.liveplanner', 'Budget 2027.liveplanner'];
  return (
    <Scene>
      <Panel x={14} y={6} w={272} h={84} />
      <text className={MUTED} x={24} y={20} fontSize="6.2" fontWeight="600">
        My Drive ›{' '}
      </text>
      <text className={TEXT} x={58} y={20} fontSize="6.4" fontWeight="700">
        liveworkspace
      </text>
      <path className={RULE} d="M22 25.5h256" strokeWidth="0.8" />
      {files.map((f, i) => {
        const y = 30 + i * 18;
        return (
          <g key={f}>
            <rect x={24} y={y + 2} width="10" height="12" rx="1.5" className="fill-brand-500/80" />
            <text className={TEXT} x={40} y={y + 10.5} fontSize="6.2" fontWeight="600">
              {f}
            </text>
            <g className="fa-a-pop" style={at(0.4 + i * 0.25)}>
              <Pill x={238} y={y + 2.5} w={38} label="Synced" tone="green" />
            </g>
          </g>
        );
      })}
    </Scene>
  );
}
