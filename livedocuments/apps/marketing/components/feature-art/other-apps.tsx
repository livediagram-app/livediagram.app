// Feature illustrations for the work a document hands to the other liveworkspace apps, the Collaborate category's
// "Your other apps" cards: Ask AI in Tools answering from the document, Send to Plan turning picked words into a
// liveplanner card, Start a Call Here opening a livehuddle call, and Connect a File adding another app's file as a tab.
// Same stage, parts and 6s timeline as ./review (app/feature-art/canvas.css); every piece settles to its finished
// frame under reduced motion.

import {
  ALEX,
  CHECK_PATHS,
  Glyph,
  MUTED,
  Panel,
  Pill,
  SAM,
  Scene,
  TEXT,
  YOU,
  Avatar,
  at,
} from './canvas-parts';

// Each app's mark colour (packages/brand apps.ts, its 600), as the editor's chips and pickers show them.
const PLANNER = '#7c3aed';
const DIAGRAM = '#0284c7';
const DESIGN = '#e11d48';
const KNOWLEDGE = '#4d7c0f';
const HUDDLE = '#059669';

const PAGE = 'fill-white stroke-slate-200 dark:fill-slate-800 dark:stroke-slate-600';
const LINE = 'fill-slate-200 dark:fill-slate-600';
const PICKED = 'fill-amber-100 dark:fill-amber-500/25';

/** An app's mark: a small rounded square in its colour. */
function Mark({
  x,
  y,
  colour,
  size = 5.6,
}: {
  x: number;
  y: number;
  colour: string;
  size?: number;
}) {
  return <rect x={x} y={y} width={size} height={size} rx={size / 4} fill={colour} />;
}

/** Soft rows of writing. */
function Lines({
  x,
  y,
  w,
  count,
  gap = 6.5,
}: {
  x: number;
  y: number;
  w: number;
  count: number;
  gap?: number;
}) {
  return (
    <g className={LINE}>
      {Array.from({ length: count }, (_, i) => (
        <rect
          key={i}
          x={x}
          y={y + i * gap}
          width={i === count - 1 ? w * 0.6 : w}
          height="2"
          rx="1"
        />
      ))}
    </g>
  );
}

/** Ask AI: a question about the document, answered from its own words, each source a chip that opens it. */
export function AskAiArt() {
  return (
    <Scene>
      <rect className={PAGE} x="16" y="8" width="118" height="80" rx="2" strokeWidth="0.8" />
      <text className={TEXT} x="26" y="21" fontSize="6.6" fontWeight="700">
        Launch brief
      </text>
      <Lines x={26} y={28} w={96} count={3} />
      {/* The passage the answer cites, outlined once its source chip is pressed. */}
      <g className="fa-a-pop" style={at(2.6)}>
        <rect
          className="fill-sky-50 stroke-sky-400 dark:fill-sky-500/15 dark:stroke-sky-400"
          x="22"
          y="50"
          width="106"
          height="18"
          rx="2"
          strokeWidth="0.8"
        />
      </g>
      <text className={TEXT} x="26" y="57" fontSize="4.8" fontWeight="600">
        Open: pricing for teams
      </text>
      <Lines x={26} y={61} w={90} count={2} gap={5} />
      <Lines x={26} y={76} w={80} count={2} gap={5} />
      {/* The Ask AI panel, opened from Tools. */}
      <Panel x={146} y={8} w={140} h={80} />
      <text className={TEXT} x="156" y="20" fontSize="6" fontWeight="700">
        Ask AI
      </text>
      <g className="fa-a-pop" style={at(0.4)}>
        <rect
          className="fill-brand-100 dark:fill-brand-500/25"
          x="196"
          y="26"
          width="82"
          height="11"
          rx="5.5"
        />
        <text
          className="fill-brand-800 dark:fill-brand-100"
          x="201"
          y="33.4"
          fontSize="4.8"
          fontWeight="600"
        >
          What is still to be decided?
        </text>
      </g>
      <g className="fa-a-pop" style={at(1.2)}>
        <Lines x={156} y={44} w={118} count={3} gap={5.5} />
        <Pill x={156} y={62} w={46} label="Pricing" tone="sky" />
        <Pill x={206} y={62} w={46} label="Timeline" tone="slate" />
      </g>
      <text className={MUTED} x="156" y="82" fontSize="4.2">
        From this document&rsquo;s own words
      </text>
    </Scene>
  );
}

/** Send to Plan: picked words become a liveplanner card, and a chip on the words ticks once it is done. */
export function SendToPlanArt() {
  return (
    <Scene>
      <rect className={PAGE} x="16" y="8" width="132" height="80" rx="2" strokeWidth="0.8" />
      <text className={TEXT} x="26" y="21" fontSize="6.6" fontWeight="700">
        Meeting notes
      </text>
      <Lines x={26} y={28} w={110} count={2} />
      <rect className={PICKED} x="24" y="42" width="112" height="9" rx="1.5" />
      <text className={TEXT} x="26" y="48.4" fontSize="4.8" fontWeight="600">
        Sam to update the pricing page by Friday
      </text>
      <Lines x={26} y={58} w={110} count={3} />
      {/* The text toolbar's Send to Plan, pressed. */}
      <Pill x={74} y={30} w={56} label="Send to Plan" tone="brand" />
      {/* The chip left on the words: liveplanner's mark, ticked once the card is done. */}
      <g className="fa-a-pop" style={at(3.2)}>
        <circle cx="140" cy="46.5" r="5" fill={PLANNER} />
        <Glyph x={135.4} y={41.8} scale={0.92} className="stroke-white">
          {CHECK_PATHS}
        </Glyph>
      </g>
      {/* The plan's board, the new card landing in To Do with its assignee and due day. */}
      <Panel x={160} y={8} w={126} h={80} sunk />
      <Mark x={168} y={14} colour={PLANNER} />
      <text className={TEXT} x="177" y="19" fontSize="5" fontWeight="700">
        Launch Plan
      </text>
      {(
        [
          ['To Do', 168],
          ['Doing', 208],
          ['Done', 248],
        ] as const
      ).map(([name, x]) => (
        <text key={name} className={MUTED} x={x} y="31" fontSize="4.6" fontWeight="700">
          {name}
        </text>
      ))}
      <g className="fa-a-pop" style={at(1.2)}>
        <rect className={PAGE} x="166" y="35" width="38" height="26" rx="2" strokeWidth="0.7" />
        <text className={TEXT} x="169" y="42" fontSize="4" fontWeight="600">
          Update the
        </text>
        <text className={TEXT} x="169" y="47" fontSize="4" fontWeight="600">
          pricing page
        </text>
        <Avatar cx={173} cy={55} r={3.6} color={SAM} initials="S" />
        <text className={MUTED} x="186" y="56.4" fontSize="3.8">
          Fri
        </text>
      </g>
      <rect className={PAGE} x="206" y="35" width="38" height="14" rx="2" strokeWidth="0.7" />
      <rect className={LINE} x="210" y="41" width="26" height="2" rx="1" />
      <rect className={PAGE} x="246" y="35" width="34" height="14" rx="2" strokeWidth="0.7" />
      <rect className={LINE} x="250" y="41" width="22" height="2" rx="1" />
    </Scene>
  );
}

/** Start a Call Here: a livehuddle call about the document, joined from its In Call pill, wrapped up into a summary. */
export function CallHereArt() {
  return (
    <Scene>
      <rect className={PAGE} x="16" y="8" width="150" height="80" rx="2" strokeWidth="0.8" />
      <text className={TEXT} x="26" y="21" fontSize="6.6" fontWeight="700">
        Q3 Board Update
      </text>
      <Lines x={26} y={30} w={128} count={5} gap={8} />
      {/* The In Call pill everyone with the document open sees, with Join. */}
      <g className="fa-a-pop" style={at(0.4)}>
        <rect
          className="fill-emerald-100 dark:fill-emerald-500/25"
          x="178"
          y="10"
          width="62"
          height="13"
          rx="6.5"
        />
        <circle cx="186" cy="16.5" r="2" fill={HUDDLE} />
        <text
          className="fill-emerald-800 dark:fill-emerald-100"
          x="191"
          y="18.6"
          fontSize="5"
          fontWeight="700"
        >
          In Call · 3
        </text>
      </g>
      <Pill x={244} y={11} w={36} label="Join" tone="brand" />
      <g className="fa-a-pop" style={at(1)}>
        <Avatar cx={186} cy={36} r={6} color={YOU} initials="Y" />
        <Avatar cx={200} cy={36} r={6} color={ALEX} initials="A" />
        <Avatar cx={214} cy={36} r={6} color={SAM} initials="S" />
      </g>
      {/* Wrap Up: the summary to a knowledgebase, the actions to a plan. */}
      <g className="fa-a-pop" style={at(2.4)}>
        <Panel x={176} y={48} w={110} h={40} />
        <text className={TEXT} x="184" y="59" fontSize="5.2" fontWeight="700">
          Wrap Up
        </text>
        <Mark x={184} y={64} colour={KNOWLEDGE} size={5} />
        <text className={TEXT} x="192" y="68.2" fontSize="4.4">
          Summary to Team Wiki
        </text>
        <Mark x={184} y={74} colour={PLANNER} size={5} />
        <text className={TEXT} x="192" y="78.2" fontSize="4.4">
          3 actions to Launch Plan
        </text>
      </g>
    </Scene>
  );
}

/** Connect a File: a file from another app joins the tab bar, picked from your recent files across the apps. */
export function ConnectFileArt() {
  const files = [
    { name: 'Launch Plan', app: 'liveplanner', colour: PLANNER },
    { name: 'Architecture', app: 'livediagram', colour: DIAGRAM },
    { name: 'App Screens', app: 'livedesign', colour: DESIGN },
  ];
  return (
    <Scene>
      {/* The tab bar: two document tabs, then the connected one, then + and Connect a File. */}
      {(
        [
          ['Brief', 16, 40],
          ['Deck', 60, 36],
        ] as const
      ).map(([name, x, w]) => (
        <g key={name}>
          <rect className={PAGE} x={x} y={8} width={w} height={14} rx="4" strokeWidth="0.8" />
          <text className={TEXT} x={x + 8} y={17.4} fontSize="5.6" fontWeight="600">
            {name}
          </text>
        </g>
      ))}
      <g className="fa-a-pop" style={at(2.4)}>
        <rect
          className="fill-white stroke-violet-400 dark:fill-slate-800 dark:stroke-violet-400"
          x="100"
          y="8"
          width="62"
          height="14"
          rx="4"
          strokeWidth="0.9"
        />
        <Mark x={105} y={12.2} colour={PLANNER} />
        <text className={TEXT} x="114" y="17.4" fontSize="5.6" fontWeight="600">
          Launch Plan
        </text>
      </g>
      <text className={MUTED} x="170" y="18" fontSize="9" fontWeight="600">
        +
      </text>
      <rect
        className="fill-brand-100 dark:fill-brand-500/25"
        x="180"
        y="9"
        width="12"
        height="12"
        rx="3"
      />
      <Mark x={183} y={12} colour={DIAGRAM} size={3} />
      <Mark x={186.4} y={15.4} colour={PLANNER} size={3} />
      {/* The Connect a File window: recent files from every app, one picked. */}
      <Panel x={96} y={28} w={190} h={62} />
      <text className={TEXT} x="106" y="40" fontSize="5.6" fontWeight="700">
        Connect a File
      </text>
      <Pill x={224} y={32} w={54} label="Role: Editor" tone="slate" />
      {files.map((f, i) => (
        <g key={f.name}>
          {i === 0 ? (
            <rect
              className="fill-violet-50 dark:fill-violet-500/15 fa-a-pop"
              style={at(1.4)}
              x="102"
              y={45 + i * 14}
              width="178"
              height="12"
              rx="3"
            />
          ) : null}
          <Mark x={108} y={48 + i * 14} colour={f.colour} />
          <text className={TEXT} x="118" y={53 + i * 14} fontSize="5" fontWeight="600">
            {f.name}
          </text>
          <text className={MUTED} x="200" y={53 + i * 14} fontSize="4.4">
            {f.app}
          </text>
        </g>
      ))}
      <rect className={PAGE} x="16" y="28" width="72" height="62" rx="2" strokeWidth="0.8" />
      <Lines x={24} y={38} w={56} count={6} gap={7.5} />
    </Scene>
  );
}
