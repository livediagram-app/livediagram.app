// Feature illustrations: working together live, continued (docs/specs/019-marketing/marketing-site.md "Feature
// category pages"): where the whole room is (the Collaborators modal,
// docs/specs/012-collaboration/collaborator-enhancements.md) and running a session in the plan (the shared timer
// and dot vote, docs/specs/012-collaboration/session-tools.md). The first is drawn in ./together's canvas parts
// on the shared 6s timeline; the second in the board's own parts (./plan-parts) on the Plan cards' 7s loop.
// Every piece settles to its finished frame under reduced motion.

import { MONO } from '@liveworkspace/marketing-site/components/feature-art/shared';
import {
  AWAY,
  Avatar as PresenceAvatar,
  JORDAN,
  MUTED as CHROME_MUTED,
  Panel,
  Pill as ChromePill,
  Pointer,
  RULE,
  SAM,
  Scene,
  TEXT,
  Tab,
  YOU as ME,
  at as atCanvas,
  from,
} from './canvas-parts';
import { Cursor, INK, MUTED, Pill, SURFACE, Stage, TEAMMATE, WELL, YOU, at } from './mode-parts';
import { ColumnHead, PlanCard } from './plan-parts';

const ONLINE = '#10b981';

// One person's row in Collaborators: their avatar, name and badges, and the status line under it.
function RosterRow({
  y,
  color,
  initials,
  name,
  detail,
  status,
  highlight = false,
}: {
  y: number;
  color: string;
  initials: string;
  name: string;
  detail: string;
  status: string;
  highlight?: boolean;
}) {
  return (
    <g>
      {highlight ? (
        <rect
          className="fill-brand-50 dark:fill-brand-500/15"
          x="125"
          y={y - 6.5}
          width="158"
          height="13"
          rx="4"
        />
      ) : null}
      <PresenceAvatar cx={135} cy={y} r={4.6} color={color} initials={initials} />
      <text className={TEXT} x="144" y={y - 0.6} fontSize="6" fontWeight="700">
        {name}
      </text>
      <circle cx="145.4" cy={y + 4} r="1.4" fill={status} />
      <text className={CHROME_MUTED} x="148.6" y={y + 5.6} fontSize="4.8" fontWeight="500">
        {detail}
      </text>
    </g>
  );
}

// A tab's heading in Collaborators: its accent and name.
function RosterTab({ y, color, name }: { y: number; color: string; name: string }) {
  return (
    <g>
      <rect x="129" y={y - 5.4} width="2" height="7" rx="1" fill={color} />
      <text className={TEXT} x="134" y={y} fontSize="6" fontWeight="700">
        {name}
      </text>
    </g>
  );
}

/** Collaborators: click an avatar on a tab and see everyone in the plan, by the tab they are on. */
export function CollaboratorsArt() {
  return (
    <Scene>
      {/* The tab bar: the Board tab, its presence stack, and your pointer clicking Jordan. */}
      <Panel x={12} y={30} w={98} h={28} />
      <Tab x={16} w={40} name="Board" color={ME} y={36} />
      <PresenceAvatar cx={70} cy={44} r={5.5} color={ME} initials="TM" />
      <PresenceAvatar cx={82} cy={44} r={5.5} color={JORDAN} initials="JR" />
      <circle
        className="fa-a-in stroke-brand-500"
        style={atCanvas(0.9)}
        cx="82"
        cy="44"
        r="8"
        fill="none"
        strokeWidth="1.2"
      />
      <Pointer x={86} y={48} color={ME} className="fa-a-move" style={from(-40, 26, 0)} />

      {/* The modal: the room, grouped by tab, with Go to Tab on every tab but yours. */}
      <g className="fa-a-pop" style={atCanvas(1)}>
        <Panel x={120} y={5} w={168} h={86} />
        <text className={TEXT} x="129" y="16.5" fontSize="7.2" fontWeight="800">
          Collaborators
        </text>
        <text
          className={CHROME_MUTED}
          x="280"
          y="16.5"
          fontSize="5"
          fontWeight="600"
          textAnchor="end"
        >
          3 people across 2 tabs
        </text>
        <path className={RULE} d="M120 22.5 H288" strokeWidth="1" />

        <RosterTab y={31} color={ME} name="Board" />
        <ChromePill x={238} y={23.5} w={44} label="You're Here" tone="brand" />
        <RosterRow
          y={41}
          color={JORDAN}
          initials="JR"
          name="Jordan · Editor"
          detail="Online · Active just now"
          status={ONLINE}
          highlight
        />
        <RosterRow
          y={55}
          color={ME}
          initials="TM"
          name="Taylor · You"
          detail="Online"
          status={ONLINE}
        />

        <RosterTab y={69} color={SAM} name="Budget" />
        <ChromePill x={238} y={61.5} w={44} label="Go to Tab" tone="solid" />
        <RosterRow
          y={80}
          color={SAM}
          initials="SM"
          name="Sam · Participant"
          detail="Away · Active 6m ago"
          status={AWAY}
        />
      </g>
    </Scene>
  );
}

// A dot on a card, cast in the vote.
function Dot({ cx, cy }: { cx: number; cy: number }) {
  return <circle cx={cx} cy={cy} r="2.3" fill={YOU} />;
}

/** Session tools: a retro column collecting dots, the Vote panel's tally, and the shared timer ticking. */
export function SessionToolsArt() {
  const cards = [
    { y: 23, title: 'Shorter standups', id: 'Idea · #14', dots: 3 },
    { y: 46, title: 'Fewer hand-offs', id: 'Idea · #15', dots: 1 },
    { y: 69, title: 'Clearer specs', id: 'Note · #16', dots: 1 },
  ] as const;
  return (
    <Stage>
      {/* The retro column, its cards gathering dots; Jordan casts one more as you watch. */}
      <rect className={WELL} x={10} y={8} width="120" height="84" rx="4" strokeWidth="0.8" />
      <ColumnHead x={16} y={17.5} name="To improve" count="3" />
      {cards.map((c, i) => (
        <g key={c.title}>
          <PlanCard
            x={16}
            y={c.y}
            w={108}
            title={c.title}
            id={c.id}
            type={i === 2 ? 'note' : 'idea'}
          />
          {Array.from({ length: c.dots }, (_, d) => (
            <Dot key={d} cx={117 - d * 6} cy={c.y + 9.5} />
          ))}
        </g>
      ))}
      <g className="fa-f-in" style={at(0.9)}>
        <Dot cx={111} cy={55.5} />
      </g>
      <g transform="translate(110 57)">
        <g className="fa-f-in" style={at(0.4)}>
          <Cursor colour={TEAMMATE} name="Jordan" />
        </g>
      </g>

      {/* The Vote panel: your dots left, and how far through the room the vote is. */}
      <rect className={SURFACE} x={142} y={8} width="146" height="50" rx="5" strokeWidth="0.8" />
      <text className={INK} x={150} y={20} fontSize="7" fontWeight="800" fill="#1e293b">
        Dot vote
      </text>
      <Pill x={240} y={13.5} text="3 dots each" tone="violet" w={42} />
      {[0, 1, 2].map((d) => (
        <circle
          key={d}
          cx={153 + d * 7}
          cy={31}
          r="2.4"
          fill={d < 2 ? YOU : 'none'}
          stroke={YOU}
          strokeWidth="0.9"
        />
      ))}
      <text className={MUTED} x={174} y={33} fontSize="5.6" fontWeight="600" fill="#64748b">
        2 of 3 dots left
      </text>
      <rect
        className="fill-slate-100 dark:fill-slate-700"
        x={150}
        y={40}
        width="130"
        height="3.6"
        rx="1.8"
        fill="#f1f5f9"
      />
      <g className="fa-f-grow-x" style={at(0.3)}>
        <rect x={150} y={40} width="94" height="3.6" rx="1.8" fill={YOU} />
      </g>
      <text className={MUTED} x={150} y={52} fontSize="5.2" fontWeight="500" fill="#64748b">
        1 person hasn’t voted yet
      </text>

      {/* The bottom bar's session strip: the timer's clock, ticking for everyone, and the lit Vote button. */}
      <rect className={SURFACE} x={176} y={66} width="112" height="22" rx="6" strokeWidth="0.8" />
      <g
        className="stroke-slate-500 dark:stroke-slate-400"
        fill="none"
        strokeWidth="1"
        strokeLinecap="round"
      >
        <circle cx={188} cy={77} r="4.2" />
        <path d="M188 74.6 V77 l1.7 1.1" />
      </g>
      <text
        className={INK}
        x={196}
        y={79.6}
        fontSize="7.4"
        fontWeight="700"
        fontFamily={MONO}
        fill="#1e293b"
      >
        04:12
      </text>
      <rect x={236} y={70} width="48" height="14" rx="4" fill={YOU} />
      {[0, 1].map((d) => (
        <circle key={d} cx={243 + d * 5.4} cy={77} r="1.9" fill="#fff" />
      ))}
      <text x={256} y={79.3} fontSize="6.2" fontWeight="700" fill="#fff">
        2 left
      </text>
    </Stage>
  );
}
