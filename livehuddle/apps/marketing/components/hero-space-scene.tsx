// The landing hero's Space (docs/specs/019-marketing/marketing-site.md "Hero"): the real Team Pod with five
// teammates walking in and gathering round the table, drawn once on the server. The room is the template drawn by
// the editor's renderer (public/hero/team-pod-*.svg); every character is Avatar mode's own sprite
// (@liveworkspace/avatar), its stills in one cached sprite sheet (public/hero/team-cast.svg); app/hero-scenes/space.css does every move, so the scene
// ships no JavaScript. Under reduced motion the stylesheet shows the settled frame.

import type { CSSProperties, ReactNode } from 'react';
import { avatarBox } from '@liveworkspace/avatar/walk';
import { FONT } from './art-tokens';
import {
  BOARD,
  CAST,
  CAST_SHEET_HREF,
  CHEER_LIFTS,
  NOTE,
  REMOTE,
  SPACE_AVATAR_SCALE,
  SPACE_ROOM_HREF,
  SPACE_STAGE,
  SPEECH,
  STRIDE_S,
  VOTES,
  arrivalOf,
  legsOf,
  restOf,
  stillId,
  type CastMember,
  type StillKey,
} from './hero-space-cast';

const BOX = avatarBox(SPACE_AVATAR_SCALE);
// The drawn figure's height above its feet (its 24 grid rows), for the bubbles.
const FIGURE_HEIGHT = 24 * 2.5 * SPACE_AVATAR_SCALE;

const vars = (v: Record<string, string | number>) => v as CSSProperties;
const s = (seconds: number) => `${seconds.toFixed(2)}s`;

/** One still of the member's character from the sprite sheet, placed so its feet sit on the group's origin. */
function Still({ member, still }: { member: CastMember; still: StillKey }) {
  return (
    <use
      href={`${CAST_SHEET_HREF}#${stillId(member, still)}`}
      x={-BOX.offsetX}
      y={-BOX.offsetY}
      width={BOX.width}
      height={BOX.height}
    />
  );
}

/** The name under a character, as the canvas labels one: a small pill in the person's colour. */
function NameChip({ member }: { member: CastMember }) {
  const width = member.name.length * 7 + 22;
  return (
    <g transform={`translate(${-width / 2} 10)`}>
      <rect width={width} height={20} rx={10} className="hs-chip-card" />
      <circle cx={10} cy={10} r={4} fill={member.colour} />
      <text
        x={18}
        y={14.5}
        fontFamily={FONT}
        fontSize={12}
        fontWeight={600}
        className="hs-chip-text"
      >
        {member.name}
      </text>
    </g>
  );
}

/** The character once it has stopped, and its reaction on the room's loop. */
function Resting({ member }: { member: CastMember }) {
  const reaction = member.reaction;
  if (!reaction) return <Still member={member} still="stand" />;
  const at = vars({ '--r': s(reaction.at) });
  if (reaction.kind === 'cheer') {
    // Avatar mode's cheer: arms up, two hops, as a still per height (CHEER_LIFTS).
    return (
      <>
        <g className="hs-rest-cheer" style={at}>
          <Still member={member} still="stand" />
        </g>
        {CHEER_LIFTS.map((lift, i) => (
          <g key={lift} className={`hs-cheer-${i}`} style={at}>
            <Still member={member} still={`cheer-${i as 0 | 1 | 2}`} />
          </g>
        ))}
      </>
    );
  }
  // Avatar mode's wave: a raised hand crossing back and forth, two stills.
  return (
    <>
      <g className="hs-rest-wave" style={at}>
        <Still member={member} still="stand" />
      </g>
      <g className="hs-react-wave" style={at}>
        <g className="hs-stride-a">
          <Still member={member} still="wave-0" />
        </g>
        <g className="hs-stride-b">
          <Still member={member} still="wave-1" />
        </g>
      </g>
    </>
  );
}

/** One teammate: hidden until they set off, each straight leg of the walk a nested move, then at rest. */
function Walker({ member }: { member: CastMember }) {
  const legs = legsOf(member);
  const arrival = arrivalOf(member);
  const waiting = member.leaves !== undefined;
  let body: ReactNode = (
    <g>
      {waiting ? (
        <g className="hs-idle" style={vars({ '--d': s(member.leaves!) })}>
          <Still member={member} still="idle" />
        </g>
      ) : null}
      {legs.map((leg) => (
        <g
          key={`${leg.start}`}
          className="hs-walk"
          style={vars({
            '--d': s(leg.start),
            '--t': s(leg.duration),
            '--n': Math.max(1, Math.round(leg.duration / (STRIDE_S * 2))),
          })}
        >
          <g className="hs-stride-a">
            <Still member={member} still={`walk-${leg.facing}-0`} />
          </g>
          <g className="hs-stride-b">
            <Still member={member} still={`walk-${leg.facing}-1`} />
          </g>
        </g>
      ))}
      <g className="hs-stand" style={vars({ '--d': s(arrival) })}>
        <Resting member={member} />
      </g>
      <g className={waiting ? undefined : 'hs-arrive'} style={vars({ '--d': s(member.start) })}>
        <NameChip member={member} />
      </g>
    </g>
  );
  for (const leg of [...legs].reverse()) {
    body = (
      <g
        className="hs-leg"
        style={vars({
          '--d': s(leg.start),
          '--t': s(leg.duration),
          '--dx': `${leg.dx}px`,
          '--dy': `${leg.dy}px`,
        })}
      >
        {body}
      </g>
    );
  }
  return <g transform={`translate(${member.from.x} ${member.from.y})`}>{body}</g>;
}

/** A speech bubble over its speaker's head, in the editor's bubble look: a white card edged in their colour. */
function Bubble({
  who,
  text,
  at,
  first,
}: {
  who: string;
  text: string;
  at: number;
  first: boolean;
}) {
  const member = CAST.find((m) => m.name === who)!;
  const { x, y } = restOf(member);
  // Text runs about 7.2 px a character at 13 px; an emoji is about two.
  const width = Math.round([...text].length * 7.2 + 28);
  const height = 46;
  const top = y - FIGURE_HEIGHT - height - 14;
  // The place is the outer group's; the inner one rises in and drifts off (a CSS transform would replace it).
  return (
    <g transform={`translate(${x - width / 2} ${top})`}>
      <g className={`hs-say${first ? ' hs-say-first' : ''}`} style={vars({ '--d': s(at) })}>
        <rect width={width} height={height} rx={14} className="hs-card" stroke={member.colour} />
        <path
          d={`M${width / 2 - 7} ${height - 1.5}L${width / 2} ${height + 7}L${width / 2 + 7} ${height - 1.5}`}
          className="hs-card"
          stroke={member.colour}
        />
        <text x={14} y={21} fontFamily={FONT} fontSize={13} className="hs-card-text">
          {text}
        </text>
        <text x={14} y={36} fontFamily={FONT} fontSize={10} fontWeight={600} fill={member.colour}>
          {member.name}
        </text>
      </g>
    </g>
  );
}

/** A teammate on the board from their laptop: a live cursor in their colour that writes the note into Wins. */
function RemoteCursor() {
  // From off the board's right edge to the start of the note, along it as it is written, then aside to rest.
  const start = { x: BOARD.wins.x + 14, y: BOARD.wins.y + 50 };
  return (
    <g
      className="hs-cursor"
      style={vars({
        '--x0': `${BOARD.questions.x + BOARD.size + 40}px`,
        '--y0': `${BOARD.questions.y + 40}px`,
        '--x1': `${start.x}px`,
        '--y1': `${start.y}px`,
        '--x2': `${start.x + 100}px`,
        '--y2': `${start.y + 4}px`,
        '--x3': `${BOARD.questions.x + 70}px`,
        '--y3': `${BOARD.questions.y + 90}px`,
        '--d': s(NOTE.at - 1.6),
      })}
    >
      <path
        d="M0 0L0 17L4.6 12.8L7.6 19.6L10.4 18.4L7.4 11.8L13.4 11.6Z"
        fill={REMOTE.colour}
        stroke="#ffffff"
        strokeWidth={1.2}
        strokeLinejoin="round"
      />
      <g transform="translate(12 18)">
        <rect width={34} height={18} rx={9} fill={REMOTE.colour} />
        <text
          x={17}
          y={12.5}
          fontFamily={FONT}
          fontSize={10}
          fontWeight={600}
          fill="#ffffff"
          textAnchor="middle"
        >
          {REMOTE.name}
        </text>
      </g>
    </g>
  );
}

/** The Team Board coming alive: Kit's note in Wins, then the room's dot votes. */
function BoardActivity() {
  const wins = BOARD.wins;
  return (
    <g>
      <text
        x={wins.x + 14}
        y={wins.y + 62}
        fontFamily={FONT}
        fontSize={15}
        className="hs-note"
        fill="#422006"
        style={vars({ '--d': s(NOTE.at) })}
      >
        {NOTE.text}
      </text>
      {VOTES.map((vote) => {
        const sticky = BOARD[vote.sticky] as { x: number; y: number };
        return (
          <circle
            key={`${vote.sticky}-${vote.dx}`}
            cx={sticky.x + 22 + vote.dx * 26}
            cy={sticky.y + BOARD.size - 22}
            r={9}
            fill={vote.colour}
            stroke="#ffffff"
            strokeWidth={2}
            className="hs-vote"
            style={vars({ '--d': s(vote.at) })}
          />
        );
      })}
      <RemoteCursor />
    </g>
  );
}

/** The whole scene, in the Team Pod's canvas coordinates (SPACE_VIEWBOX). */
export function SpaceScene() {
  const { x, y, width, height } = SPACE_STAGE;
  // Further back first, so a nearer character stands in front.
  const cast = [...CAST].sort((a, b) => restOf(a).y - restOf(b).y);
  return (
    <g className="hs-scene">
      <image
        href={SPACE_ROOM_HREF.light}
        x={x}
        y={y}
        width={width}
        height={height}
        className="dark:hidden"
      />
      <image
        href={SPACE_ROOM_HREF.dark}
        x={x}
        y={y}
        width={width}
        height={height}
        className="hidden dark:inline"
      />
      <BoardActivity />
      {cast.map((member) => (
        <Walker key={member.name} member={member} />
      ))}
      {SPEECH.map((line, i) => (
        <Bubble key={line.who} {...line} first={i === 0} />
      ))}
    </g>
  );
}
