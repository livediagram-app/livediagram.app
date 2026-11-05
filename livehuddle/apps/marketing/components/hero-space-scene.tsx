// The Space feature scenes (docs/specs/019-marketing/marketing-site.md "Feature scenes"): a real Space in use, drawn
// once on the server. The room is the template drawn by the editor's renderer (public/hero/<id>-light.svg and
// -dark.svg); every character is Avatar mode's own sprite (@liveworkspace/avatar), its stills in one cached sprite
// sheet per scene (public/hero/<id>-cast.svg); app/hero-scenes/space.css does every move, so a scene ships no
// JavaScript. Under reduced motion the stylesheet shows the settled frame. Three Spaces play: the Team Pod's
// stand-up, the Virtual Office's walk to the meeting room and the All-Hands Hall's welcome (hero-space-cast.ts,
// hero-space-places.ts).

import type { CSSProperties, ReactNode } from 'react';
import { avatarBox } from '@liveworkspace/avatar/walk';
import { FONT } from './art-tokens';
import {
  CHEER_LIFTS,
  SPACE_AVATAR_SCALE,
  STRIDE_S,
  TEAM_POD,
  arrivalOf,
  castHref,
  legsOf,
  restOf,
  roomHref,
  stillId,
  type BoardActivity,
  type CastMember,
  type SpaceSceneSpec,
  type StillKey,
} from './hero-space-cast';
import { HALL, OFFICE } from './hero-space-places';

const BOX = avatarBox(SPACE_AVATAR_SCALE);
// The drawn figure's height above its feet (its 24 grid rows; five fewer seated, Avatar mode's drop and folded legs),
// for the bubbles.
const ROW = 2.5 * SPACE_AVATAR_SCALE;
const figureHeight = (member: CastMember) => (member.sits ? 19 : 24) * ROW;

const vars = (v: Record<string, string | number>) => v as CSSProperties;
const s = (seconds: number) => `${seconds.toFixed(2)}s`;

/** One still of the member's character from the sprite sheet, placed so its feet sit on the group's origin. */
function Still({ member, still, sheet }: { member: CastMember; still: StillKey; sheet: string }) {
  return (
    <use
      href={`${sheet}#${stillId(member, still)}`}
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
function Resting({ member, sheet }: { member: CastMember; sheet: string }) {
  const reaction = member.reaction;
  if (!reaction) return <Still sheet={sheet} member={member} still="stand" />;
  const at = vars({ '--r': s(reaction.at) });
  if (reaction.kind === 'cheer') {
    // Avatar mode's cheer: arms up, two hops, as a still per height (CHEER_LIFTS).
    return (
      <>
        <g className="hs-rest-cheer" style={at}>
          <Still sheet={sheet} member={member} still="stand" />
        </g>
        {CHEER_LIFTS.map((lift, i) => (
          <g key={lift} className={`hs-cheer-${i}`} style={at}>
            <Still sheet={sheet} member={member} still={`cheer-${i as 0 | 1 | 2}`} />
          </g>
        ))}
      </>
    );
  }
  // Avatar mode's wave: a raised hand crossing back and forth, two stills.
  return (
    <>
      <g className="hs-rest-wave" style={at}>
        <Still sheet={sheet} member={member} still="stand" />
      </g>
      <g className="hs-react-wave" style={at}>
        <g className="hs-stride-a">
          <Still sheet={sheet} member={member} still="wave-0" />
        </g>
        <g className="hs-stride-b">
          <Still sheet={sheet} member={member} still="wave-1" />
        </g>
      </g>
    </>
  );
}

/** One teammate: hidden until they set off, each straight leg of the walk a nested move, then at rest. */
function Walker({ member, sheet }: { member: CastMember; sheet: string }) {
  const legs = legsOf(member);
  const arrival = arrivalOf(member);
  const waiting = member.leaves !== undefined;
  let body: ReactNode = (
    <g>
      {waiting ? (
        <g className="hs-idle" style={vars({ '--d': s(member.leaves!) })}>
          <Still sheet={sheet} member={member} still="idle" />
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
            <Still sheet={sheet} member={member} still={`walk-${leg.facing}-0`} />
          </g>
          <g className="hs-stride-b">
            <Still sheet={sheet} member={member} still={`walk-${leg.facing}-1`} />
          </g>
        </g>
      ))}
      <g className="hs-stand" style={vars({ '--d': s(arrival) })}>
        <Resting member={member} sheet={sheet} />
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
  member,
  text,
  at,
  first,
}: {
  member: CastMember;
  text: string;
  at: number;
  first: boolean;
}) {
  const { x, y } = restOf(member);
  // Text runs about 7.2 px a character at 13 px; an emoji is about two.
  const width = Math.round([...text].length * 7.2 + 28);
  const height = 46;
  const top = y - figureHeight(member) - height - 14;
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

/** A teammate on the board from their laptop: a live cursor in their colour that writes the note. */
function RemoteCursor({ board }: { board: BoardActivity }) {
  // From off the notes' right edge to the start of the note, along it as it is written, then aside to rest.
  const target = board.stickies[board.note.sticky]!;
  const right = Math.max(...Object.values(board.stickies).map((p) => p.x)) + board.size;
  const start = { x: target.x + board.size * 0.1, y: target.y + board.size * 0.34 };
  return (
    <g
      className="hs-cursor"
      style={vars({
        '--x0': `${right + 40}px`,
        '--y0': `${target.y + 40}px`,
        '--x1': `${start.x}px`,
        '--y1': `${start.y}px`,
        '--x2': `${start.x + board.size * 0.68}px`,
        '--y2': `${start.y + 4}px`,
        '--x3': `${target.x + board.size * 0.48}px`,
        '--y3': `${target.y + board.size * 0.62}px`,
        '--d': s(board.note.at - 1.6),
      })}
    >
      <path
        d="M0 0L0 17L4.6 12.8L7.6 19.6L10.4 18.4L7.4 11.8L13.4 11.6Z"
        fill={board.remote.colour}
        stroke="#ffffff"
        strokeWidth={1.2}
        strokeLinejoin="round"
      />
      <g transform="translate(12 18)">
        <rect width={34} height={18} rx={9} fill={board.remote.colour} />
        <text
          x={17}
          y={12.5}
          fontFamily={FONT}
          fontSize={10}
          fontWeight={600}
          fill="#ffffff"
          textAnchor="middle"
        >
          {board.remote.name}
        </text>
      </g>
    </g>
  );
}

/** The notes coming alive: the remote teammate's note. */
function NotesActivity({ board }: { board: BoardActivity }) {
  const target = board.stickies[board.note.sticky]!;
  return (
    <g>
      <text
        x={target.x + board.size * 0.1}
        y={target.y + board.size * 0.42}
        fontFamily={FONT}
        fontSize={board.fontSize}
        className="hs-note"
        fill="#422006"
        style={vars({ '--d': s(board.note.at) })}
      >
        {board.note.text}
      </text>
      <RemoteCursor board={board} />
    </g>
  );
}

/** One Space in use, in its template's canvas coordinates (viewBoxOf(spec.stage)). */
export function SpaceScene({ spec }: { spec: SpaceSceneSpec }) {
  const { x, y, width, height } = spec.stage;
  const sheet = castHref(spec);
  // Further back first, so a nearer character stands in front.
  const cast = [...spec.cast].sort((a, b) => restOf(a).y - restOf(b).y);
  return (
    <g className="hs-scene">
      <image
        href={roomHref(spec, 'light')}
        x={x}
        y={y}
        width={width}
        height={height}
        className="dark:hidden"
      />
      <image
        href={roomHref(spec, 'dark')}
        x={x}
        y={y}
        width={width}
        height={height}
        className="hidden dark:inline"
      />
      {spec.board ? <NotesActivity board={spec.board} /> : null}
      {cast.map((member) => (
        <Walker key={member.name} member={member} sheet={sheet} />
      ))}
      {spec.speech.map((line, i) => (
        <Bubble
          key={`${line.who}-${line.at}`}
          member={spec.cast.find((m) => m.name === line.who)!}
          text={line.text}
          at={line.at}
          first={i === 0}
        />
      ))}
    </g>
  );
}

/** The Team Pod: the team walks in for the stand-up round the table. */
export function TeamPodScene() {
  return <SpaceScene spec={TEAM_POD} />;
}

/** The Virtual Office: the team walks from their desks to the meeting room. */
export function OfficeScene() {
  return <SpaceScene spec={OFFICE} />;
}

/** The All-Hands Hall: the room sits facing the stage for the welcome. */
export function HallScene() {
  return <SpaceScene spec={HALL} />;
}
