// Feature illustrations for sharing and access (docs/specs/019-marketing/marketing-site.md "Feature
// category pages"), the Collaborate category's last cards: editor, participant and view-only links,
// teams, a link's expiry and revoking one. Same stage and 6s timeline as ./together, from which it was
// split; every piece settles to its finished frame under reduced motion.

import {
  ALEX,
  Avatar,
  CLOCK_PATHS,
  FOLDER_PATHS,
  Glyph,
  JORDAN,
  LINK_PATHS,
  LOCK_PATHS,
  MUTED,
  PEOPLE_PATHS,
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

/* ───────────────────────── Sharing and access ───────────────────────── */

/** Editor, participant or view-only links: three passes side by side, one copied to send. */
export function ShareLinksArt() {
  // One row per pass: its role, its link and what it lets the holder do, on a single line.
  const row = (
    y: number,
    label: string,
    url: string,
    role: string,
    tone: 'sky' | 'amber' | 'slate',
  ) => (
    <g>
      <rect
        className="fill-slate-50 stroke-slate-200 dark:fill-slate-900 dark:stroke-slate-700"
        x="50"
        y={y}
        width="200"
        height="18"
        rx="5"
        strokeWidth="1"
      />
      <text className={TEXT} x="58" y={y + 11.6} fontSize="7" fontWeight="700">
        {label}
      </text>
      <text
        className={MUTED}
        x="110"
        y={y + 11.4}
        fontSize="6"
        fontFamily="ui-monospace, monospace"
      >
        {url}
      </text>
      <Pill x={204} y={y + 3.5} w={40} label={role} tone={tone} />
    </g>
  );
  return (
    <Scene>
      <Panel x={40} y={6} w={220} h={84} />
      <Glyph x={50} y={13} className="stroke-sky-600 dark:stroke-sky-300">
        {LINK_PATHS}
      </Glyph>
      <text className={TEXT} x="63" y="20.5" fontSize="8" fontWeight="700">
        Share
      </text>
      <g className="fa-a-out" style={at(0.9)}>
        <Pill x={214} y={12} w={36} label="Copy" tone="solid" />
      </g>
      <g className="fa-a-late" style={at(0.9)}>
        <Pill x={210} y={12} w={40} label="Copied" tone="green" />
      </g>
      {row(28, 'Editors', 'liveplanner.app/d/9fk2', 'Can edit', 'sky')}
      {row(48, 'Participants', 'liveplanner.app/d/m3wd', 'Can add', 'amber')}
      {row(68, 'Viewers', 'liveplanner.app/d/qp7x', 'Can view', 'slate')}
      <Pointer x={232} y={19} color={YOU} className="fa-a-move" style={from(24, 46, 0)} />
    </Scene>
  );
}

/** Teams: a shared space with its people and roles, a new member joining, and its shared folder. */
export function TeamsArt() {
  const member = (
    y: number,
    color: string,
    initials: string,
    name: string,
    role: string,
    tone: 'sky' | 'slate' | 'amber',
  ) => (
    <g>
      <Avatar cx={32} cy={y} r={5.5} color={color} initials={initials} />
      <text className={TEXT} x="41" y={y + 2.4} fontSize="7" fontWeight="600">
        {name}
      </text>
      <Pill x={126} y={y - 5.5} w={38} label={role} tone={tone} />
    </g>
  );
  return (
    <Scene>
      <Panel x={20} y={6} w={154} h={84} />
      <Glyph x={28} y={13} className="stroke-sky-600 dark:stroke-sky-300">
        {PEOPLE_PATHS}
      </Glyph>
      <text className={TEXT} x="41" y="20.5" fontSize="8" fontWeight="700">
        Design team
      </text>
      <text className={MUTED} x="164" y="20.5" fontSize="6.5" fontWeight="600" textAnchor="end">
        3 people
      </text>
      <path className={RULE} d="M20 28.5 H 174" strokeWidth="1" />
      {member(40, YOU, 'TM', 'You', 'Admin', 'sky')}
      {member(57, JORDAN, 'JR', 'Jordan', 'Member', 'slate')}
      <g className="fa-a-pop" style={at(0.9)}>
        {member(74, ALEX, 'A', 'Alex', 'Invited', 'amber')}
      </g>
      {/* The team's shared folder, everyone's to open. */}
      <Panel x={186} y={18} w={100} h={60} />
      <Glyph
        x={196}
        y={26}
        className="fill-sky-100 stroke-sky-600 dark:fill-sky-500/20 dark:stroke-sky-300"
        scale={2.2}
      >
        {FOLDER_PATHS}
      </Glyph>
      <text className={TEXT} x="226" y="40" fontSize="7.5" fontWeight="700">
        Design
      </text>
      <text className={MUTED} x="226" y="49" fontSize="6.5">
        12 documents
      </text>
      <Avatar cx={198} cy={64} r={4.5} color={YOU} initials="TM" />
      <Avatar cx={206} cy={64} r={4.5} color={JORDAN} initials="JR" />
      <g className="fa-a-pop" style={at(0.9)}>
        <Avatar cx={214} cy={64} r={4.5} color={ALEX} initials="A" />
      </g>
    </Scene>
  );
}

/** Links that expire on their own: one counting down its days, one lapsed and extended. */
export function ExpiryArt() {
  return (
    <Scene>
      <Panel x={40} y={6} w={220} h={84} />
      <Glyph x={50} y={13} className="stroke-sky-600 dark:stroke-sky-300">
        {CLOCK_PATHS}
      </Glyph>
      <text className={TEXT} x="63" y="20.5" fontSize="8" fontWeight="700">
        Link expiry
      </text>
      <rect
        className="fill-slate-50 stroke-slate-200 dark:fill-slate-900 dark:stroke-slate-700"
        x="50"
        y="30"
        width="200"
        height="24"
        rx="5"
        strokeWidth="1"
      />
      <text className={TEXT} x="58" y="44.6" fontSize="7" fontFamily="ui-monospace, monospace">
        /d/9fk2
      </text>
      {/* The days left, draining round a ring. */}
      <circle
        className="stroke-sky-100 dark:stroke-sky-500/25"
        cx="196"
        cy="42"
        r="5"
        fill="none"
        strokeWidth="2"
      />
      <circle
        className="fa-a-drain stroke-sky-500"
        cx="196"
        cy="42"
        r="5"
        fill="none"
        strokeWidth="2"
        strokeDasharray="31.4"
        transform="rotate(-90 196 42)"
      />
      <text
        className="fill-sky-700 dark:fill-sky-200"
        x="205"
        y="44.4"
        fontSize="6.5"
        fontWeight="700"
      >
        6 days left
      </text>
      <rect
        className="fill-slate-50 stroke-slate-200 dark:fill-slate-900 dark:stroke-slate-700"
        x="50"
        y="60"
        width="200"
        height="24"
        rx="5"
        strokeWidth="1"
      />
      <g className="fa-a-out" style={at(0.8)}>
        <text
          className={MUTED}
          x="58"
          y="74.6"
          fontSize="7"
          fontFamily="ui-monospace, monospace"
          textDecoration="line-through"
        >
          /d/qp7x
        </text>
        <Pill x={208} y={66.5} w={36} label="Expired" tone="red" />
      </g>
      <g className="fa-a-late" style={at(0.8)}>
        <text className={TEXT} x="58" y="74.6" fontSize="7" fontFamily="ui-monospace, monospace">
          /d/qp7x
        </text>
        <Pill x={202} y={66.5} w={42} label="+30 days" tone="green" />
      </g>
      <Pointer x={226} y={72} color={YOU} className="fa-a-move" style={from(20, 20, 0)} />
    </Scene>
  );
}

/** Stop sharing on demand: switch the link off and the document is yours again. */
export function RevokeArt() {
  return (
    <Scene>
      <Panel x={50} y={10} w={200} h={76} />
      <Glyph x={60} y={17} className="stroke-sky-600 dark:stroke-sky-300">
        {LINK_PATHS}
      </Glyph>
      <text className={TEXT} x="73" y="24.5" fontSize="8" fontWeight="700">
        Share link
      </text>
      {/* The switch: on, then off. */}
      <g className="fa-a-out" style={at(0.6)}>
        <rect className="fill-sky-500" x="220" y="16" width="20" height="11" rx="5.5" />
        <circle cx="234.5" cy="21.5" r="4" fill="#fff" />
      </g>
      <g className="fa-a-late" style={at(0.6)}>
        <rect
          className="fill-slate-300 dark:fill-slate-600"
          x="220"
          y="16"
          width="20"
          height="11"
          rx="5.5"
        />
        <circle cx="225.5" cy="21.5" r="4" fill="#fff" />
      </g>
      <path className={RULE} d="M50 34.5 H 250" strokeWidth="1" />
      <rect
        className="fill-slate-50 stroke-slate-200 dark:fill-slate-900 dark:stroke-slate-700"
        x="60"
        y="42"
        width="180"
        height="18"
        rx="4"
        strokeWidth="1"
      />
      <g className="fa-a-out" style={at(0.6)}>
        <text className={TEXT} x="68" y="53.6" fontSize="7" fontFamily="ui-monospace, monospace">
          liveplanner.app/d/9fk2
        </text>
        <Pill x={60} y={67} w={38} label="Shared" tone="green" />
      </g>
      <g className="fa-a-late" style={at(0.6)}>
        <text
          className={MUTED}
          x="68"
          y="53.6"
          fontSize="7"
          fontFamily="ui-monospace, monospace"
          textDecoration="line-through"
        >
          liveplanner.app/d/9fk2
        </text>
        <rect
          className="fill-slate-100 dark:fill-slate-700"
          x="60"
          y="67"
          width="42"
          height="11"
          rx="5.5"
        />
        <Glyph x={63} y={67.4} className="stroke-slate-600 dark:stroke-slate-300" scale={0.9}>
          {LOCK_PATHS}
        </Glyph>
        <text
          className="fill-slate-600 dark:fill-slate-300"
          x="74"
          y="74.6"
          fontSize="6.5"
          fontWeight="600"
        >
          Private
        </text>
        <text className={MUTED} x="110" y="74.6" fontSize="6.5">
          Only you can open it
        </text>
      </g>
      <Pointer x={232} y={23} color={YOU} className="fa-a-move" style={from(-24, 44, 0)} />
    </Scene>
  );
}
