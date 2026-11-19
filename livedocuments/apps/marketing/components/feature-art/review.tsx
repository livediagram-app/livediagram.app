// Feature illustrations for looking back and signing off (docs/specs/019-marketing/marketing-site.md "Feature
// category pages"), the Collaborate category's Review & history cards: Version History with its restore, a request
// for approval answered from its banner, a walkthrough played back over the document, and a Live Embed of another
// app's file on a page. Same stage, parts and 6s timeline as ./together and ./sharing (app/feature-art/canvas.css);
// every piece settles to its finished frame under reduced motion.

import {
  ALEX,
  CLOCK_PATHS,
  Glyph,
  MUTED,
  Panel,
  Pill,
  Pointer,
  RULE,
  Scene,
  TEXT,
  YOU,
  at,
  from,
} from './canvas-parts';

/** Soft rows of writing on a page or panel. */
function Lines({
  x,
  y,
  w,
  count,
  gap = 6,
}: {
  x: number;
  y: number;
  w: number;
  count: number;
  gap?: number;
}) {
  return (
    <g className="fill-slate-200 dark:fill-slate-600">
      {Array.from({ length: count }, (_, i) => (
        <rect
          key={i}
          x={x}
          y={y + i * gap}
          width={i === count - 1 && count > 1 ? w * 0.6 : w}
          height="2"
          rx="1"
        />
      ))}
    </g>
  );
}

/** Version History: a tab's earlier versions in the rail, the picked one's changes outlined, restored in one press. */
export function VersionHistoryArt() {
  const row = (y: number, name: string, when: string, picked = false) => (
    <g>
      {picked ? (
        <rect
          className="fill-sky-50 stroke-sky-300 dark:fill-sky-500/15 dark:stroke-sky-500/50"
          x="186"
          y={y - 7}
          width="96"
          height="12"
          rx="3"
          strokeWidth="0.8"
        />
      ) : null}
      <text className={TEXT} x="191" y={y + 1} fontSize="6.2" fontWeight={picked ? 700 : 600}>
        {name}
      </text>
      <text className={MUTED} x="278" y={y + 1} fontSize="5.4" textAnchor="end">
        {when}
      </text>
    </g>
  );
  return (
    <Scene>
      <Panel x={10} y={6} w={280} h={84} />
      <Glyph x={18} y={12} className="stroke-sky-600 dark:stroke-sky-300">
        {CLOCK_PATHS}
      </Glyph>
      <text className={TEXT} x="31" y="19.5" fontSize="8" fontWeight="700">
        Version History
      </text>
      <Pill x={128} y={11.5} w={48} label="Show Changes" tone="green" />
      <path className={RULE} d="M10 27.5 H 290" strokeWidth="1" />
      {/* The picked version, read-only, its changes since outlined: amber changed, red dashed removed. */}
      <Panel x={18} y={33} w={160} h={51} sunk />
      <Lines x={26} y={40} w={70} count={3} />
      <rect
        className="fill-white stroke-amber-500 dark:fill-slate-800"
        x="104"
        y="38"
        width="66"
        height="18"
        rx="3"
        strokeWidth="1.2"
      />
      <Lines x={110} y={44} w={50} count={2} />
      <rect
        className="fill-none stroke-rose-500"
        x="26"
        y="60"
        width="70"
        height="12"
        rx="3"
        strokeWidth="1.1"
        strokeDasharray="3 2"
      />
      <Lines x={32} y={64} w={50} count={1} />
      <g className="fa-a-out" style={at(0.9)}>
        <Pill x={104} y={64} w={68} label="Restore This Version" tone="solid" />
      </g>
      <g className="fa-a-late" style={at(0.9)}>
        <Pill x={110} y={64} w={62} label="Restored · Undo" tone="green" />
      </g>
      {/* The rail: Now, then the earlier versions, newest first. */}
      {row(37, 'Now', 'Today')}
      {row(50, 'Sent to client', '14:05')}
      {row(63, 'Before an AI edit', '11:20', true)}
      {row(76, 'Automatic', 'Yesterday')}
      <Pointer x={150} y={70} color={YOU} className="fa-a-move" style={from(40, -6, 0)} />
    </Scene>
  );
}

/** Request Approval: the approver's banner with its note and due day, answered with Approve, and the banner saying so. */
export function ApprovalArt() {
  return (
    <Scene>
      <Panel x={10} y={6} w={280} h={84} />
      {/* The document's bar: its name and the Awaiting pill the approval puts beside it. */}
      <text className={TEXT} x="20" y="18.5" fontSize="7.4" fontWeight="700">
        Q3 Plan
      </text>
      <g className="fa-a-out" style={at(0.9)}>
        <Pill x={52} y={10.5} w={52} label="Awaiting 1 of 2" tone="amber" />
      </g>
      <g className="fa-a-late" style={at(0.9)}>
        <Pill x={52} y={10.5} w={38} label="Approved" tone="green" />
      </g>
      {/* The banner across the top of the document (packages/explorer/src/approvals/ApprovalBanner.tsx): the
          document-check disc, who asked and by when, the note, and Request Changes and Approve on the right. */}
      <rect
        className="fill-amber-50 stroke-amber-200 dark:fill-amber-500/10 dark:stroke-amber-500/30"
        x="10.5"
        y="26"
        width="279"
        height="24"
        strokeWidth="0.8"
      />
      <circle className="fill-amber-100 dark:fill-amber-500/20" cx="24" cy="38" r="6" />
      <Glyph x={19} y={33} className="stroke-amber-700 dark:stroke-amber-200">
        <rect x="1.8" y="0.8" width="6.4" height="8.4" rx="1" />
        <path d="M3.4 5.2 l1.2 1.2 l2.2 -2.4" />
      </Glyph>
      <g className="fa-a-out" style={at(0.9)}>
        <text className="fill-amber-950 dark:fill-amber-100" x="35" y="36" fontSize="5.2">
          <tspan fontWeight="700">Ada Okafor</tspan> asked you to approve this document by{' '}
          <tspan fontWeight="700">20 Nov</tspan>.
        </text>
        <text className="fill-amber-900/80 dark:fill-amber-100/80" x="35" y="44" fontSize="4.8">
          Check the hiring numbers on page 2.
        </text>
        <Pill x={184} y={32.5} w={60} label="Request Changes" tone="slate" />
        <Pill x={248} y={32.5} w={36} label="Approve" tone="brand" />
      </g>
      <g className="fa-a-late" style={at(0.9)}>
        <text
          className="fill-amber-950 dark:fill-amber-100"
          x="35"
          y="40"
          fontSize="5.8"
          fontWeight="600"
        >
          You approved this. Everyone has approved.
        </text>
        <Pill x={254} y={32.5} w={30} label="Close" tone="slate" />
      </g>
      {/* The document under the banner: its page 2, the numbers the note points at. */}
      <rect
        className="fill-white stroke-slate-200 dark:fill-slate-800 dark:stroke-slate-600"
        x="74"
        y="55"
        width="152"
        height="31"
        rx="1.5"
        strokeWidth="0.8"
      />
      <text className={TEXT} x="84" y="66" fontSize="6.2" fontWeight="700">
        Hiring plan
      </text>
      <Lines x={84} y={71} w={70} count={2} gap={5} />
      {[
        ['Engineering', '6'],
        ['Design', '2'],
      ].map(([team, n], i) => (
        <g key={team}>
          <text className={MUTED} x="164" y={66 + i * 8} fontSize="5">
            {team}
          </text>
          <text
            className={TEXT}
            x="214"
            y={66 + i * 8}
            fontSize="5"
            fontWeight="700"
            textAnchor="end"
          >
            {n}
          </text>
        </g>
      ))}
      <Pointer x={266} y={40} color={YOU} className="fa-a-move" style={from(-60, 30, 0)} />
    </Scene>
  );
}

/** Walkthroughs: a recorded tour played back over the document (packages/walkthrough/src/ui/Player.tsx): the
 *  presenter's pointer moving as it was recorded, their camera bubble in its corner, and the player's bar with
 *  Pause, the walkthrough's name and time, the scrubber with its marks, the speed and Close. */
export function WalkthroughArt() {
  return (
    <Scene>
      {/* The document as it is now, on the canvas: the page the tour is walking through. */}
      <rect
        className="fill-white stroke-slate-200 dark:fill-slate-800 dark:stroke-slate-600"
        x="22"
        y="6"
        width="168"
        height="56"
        rx="2"
        strokeWidth="0.8"
      />
      <text className={TEXT} x="32" y="19" fontSize="7" fontWeight="700">
        Launch plan
      </text>
      <Lines x={32} y={25} w={146} count={2} gap={5} />
      {[
        ['Beta', '3 Mar', 'fill-sky-50 stroke-sky-300 dark:fill-sky-500/15 dark:stroke-sky-500/50'],
        [
          'Launch',
          '14 Apr',
          'fill-amber-50 stroke-amber-300 dark:fill-amber-500/15 dark:stroke-amber-500/50',
        ],
      ].map(([name, when, tone], i) => (
        <g key={name}>
          <rect
            className={tone}
            x={32 + i * 74}
            y="38"
            width="68"
            height="17"
            rx="3"
            strokeWidth="0.8"
          />
          <text className={TEXT} x={38 + i * 74} y="48.6" fontSize="5.8" fontWeight="700">
            {name}
          </text>
          <text className={MUTED} x={94 + i * 74} y="48.6" fontSize="5" textAnchor="end">
            {when}
          </text>
        </g>
      ))}
      {/* The presenter's pointer, moving as it was recorded, coming to rest between Launch and its date. */}
      <Pointer
        x={137}
        y={44}
        color={ALEX}
        name="Alex"
        className="fa-a-move"
        style={from(-70, -2, 0)}
      />
      {/* The camera bubble in its corner, the presenter speaking. */}
      <circle
        className="stroke-white dark:stroke-slate-800"
        cx="244"
        cy="32"
        r="24"
        fill="#fde68a"
        strokeWidth="2"
      />
      <clipPath id="walkthrough-bubble">
        <circle cx="244" cy="32" r="23" />
      </clipPath>
      <g clipPath="url(#walkthrough-bubble)">
        <rect x="220" y="8" width="48" height="48" fill="#fcd34d" />
        <rect x="220" y="8" width="16" height="48" fill="#fbbf24" fillOpacity="0.5" />
        <path d="M226 58 c2 -11 9 -15 18 -15 s16 4 18 15 z" fill={ALEX} />
        <path d="M240.5 40 h7 v5 h-7 z" fill="#d6a283" />
        <ellipse cx="244" cy="31" rx="8" ry="9.5" fill="#e8b896" />
        <path
          d="M235.6 29.5 c0 -8 3.6 -11.5 8.4 -11.5 s8.6 3.5 8.6 11.5 c-1.6 -4.4 -4.6 -6 -8.6 -6 s-6.8 1.6 -8.4 6 z"
          fill="#3f2a1d"
        />
        <path
          d="M241 35.6 q3 2 6 0"
          fill="none"
          stroke="#9a5b45"
          strokeWidth="0.8"
          strokeLinecap="round"
        />
      </g>
      {/* The player's bar. */}
      <Panel x={30} y={67} w={240} h={22} />
      <circle className="fill-brand-700" cx="42" cy="78" r="7" />
      <g fill="#ffffff">
        <rect x="39.4" y="75" width="1.8" height="6" rx="0.5" />
        <rect x="42.8" y="75" width="1.8" height="6" rx="0.5" />
      </g>
      <text className={TEXT} x="55" y="75.6" fontSize="5" fontWeight="600">
        Launch plan, start to finish
      </text>
      <text className={MUTED} x="222" y="75.6" fontSize="4.6" textAnchor="end">
        1:12 / 3:40
      </text>
      <rect
        className="fill-slate-200 dark:fill-slate-700"
        x="55"
        y="80.6"
        width="167"
        height="1.8"
        rx="0.9"
      />
      <rect className="fill-brand-600" x="55" y="80.6" width="55" height="1.8" rx="0.9" />
      {/* Marks on the scrubber: a tab change, then the points the presenter flagged. */}
      <rect
        className="fill-slate-500 dark:fill-slate-300"
        x="94"
        y="79.3"
        width="0.8"
        height="4.4"
        rx="0.4"
      />
      <rect className="fill-brand-400" x="140" y="79.3" width="0.8" height="4.4" rx="0.4" />
      <rect className="fill-brand-400" x="184" y="79.3" width="0.8" height="4.4" rx="0.4" />
      <text className={TEXT} x="238" y="80.2" fontSize="5.2" fontWeight="700" textAnchor="middle">
        1.5x
      </text>
      <path
        className="stroke-slate-400 dark:stroke-slate-500"
        d="M257 75.6 l4.8 4.8 M261.8 75.6 l-4.8 4.8"
        strokeWidth="0.9"
        strokeLinecap="round"
      />
    </Scene>
  );
}

/** Live Embed: a liveplanner plan on an article page, live and read-only, with the name chip the shared face draws
 *  bottom left (packages/workbench/src/components/live-embed/LiveEmbedView.tsx NameChip: the app's mark, the file's
 *  name and Live), a new card arriving as it changes in its own app. */
export function LiveEmbedArt() {
  const SKY_CARD = 'fill-sky-50 stroke-sky-300 dark:fill-sky-500/15 dark:stroke-sky-500/50';
  const AMBER_CARD =
    'fill-amber-50 stroke-amber-300 dark:fill-amber-500/15 dark:stroke-amber-500/50';
  const GREEN_CARD =
    'fill-emerald-50 stroke-emerald-300 dark:fill-emerald-500/15 dark:stroke-emerald-500/50';
  const card = (x: number, y: number, tone: string, label: string) => (
    <g>
      <rect className={tone} x={x} y={y} width="40" height="10" rx="2" strokeWidth="0.7" />
      <text className={TEXT} x={x + 3.5} y={y + 6.6} fontSize="4.4" fontWeight="600">
        {label}
      </text>
    </g>
  );
  const columns: [string, number][] = [
    ['Now', 128],
    ['Next', 172],
    ['Later', 216],
  ];
  return (
    <Scene>
      {/* The article page the embed sits in. */}
      <rect
        className="fill-white stroke-slate-200 dark:fill-slate-800 dark:stroke-slate-600"
        x="22"
        y="6"
        width="256"
        height="84"
        rx="2"
        strokeWidth="0.8"
      />
      <text className={TEXT} x="34" y="20" fontSize="7" fontWeight="700">
        Quarterly update
      </text>
      <Lines x={34} y={27} w={74} count={4} gap={6.5} />
      <text className={TEXT} x="34" y="61" fontSize="5.6" fontWeight="700">
        What ships next
      </text>
      <Lines x={34} y={66} w={74} count={3} gap={6.5} />
      {/* The Live Embed: the plan as it is in liveplanner, framed on the page. */}
      <Panel x={120} y={14} w={146} h={68} sunk />
      {columns.map(([name, x]) => (
        <text key={name} className={MUTED} x={x} y="25" fontSize="5" fontWeight="700">
          {name}
        </text>
      ))}
      {card(128, 29, SKY_CARD, 'Offline sync')}
      {card(128, 42, SKY_CARD, 'Dark mode')}
      {card(172, 29, AMBER_CARD, 'Templates')}
      {card(216, 29, GREEN_CARD, 'Public API')}
      {/* A card added in its own app arrives here too. */}
      <g className="fa-a-pop" style={at(0.9)}>
        {card(172, 42, AMBER_CARD, 'Approvals')}
      </g>
      {/* The name chip: liveplanner's mark, the plan's name and Live. */}
      <rect
        className="fill-white/90 dark:fill-slate-900/85"
        x="124"
        y="68"
        width="72"
        height="10"
        rx="5"
      />
      <rect x="127" y="70.2" width="5.6" height="5.6" rx="1.4" fill="#7c3aed" />
      <text className={TEXT} x="135.5" y="74.6" fontSize="4.6" fontWeight="700">
        Q3 Roadmap
      </text>
      <circle cx="168" cy="73" r="1.2" fill="#10b981" />
      <text
        className="fill-emerald-700 dark:fill-emerald-300"
        x="170.5"
        y="74.6"
        fontSize="3.8"
        fontWeight="700"
        letterSpacing="0.5"
      >
        LIVE
      </text>
    </Scene>
  );
}
