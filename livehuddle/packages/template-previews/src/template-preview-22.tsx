import type { ReactElement } from 'react';
import type { TemplateKind } from '@livediagram/templates';
import { pv } from '@liveworkspace/template-previews/motion';

// Group 22: Quizzes & Games (docs/specs/012-collaboration/quiz-and-game-templates.md): Pub Quiz, Icebreaker
// Questions, Two Truths and a Lie, Would You Rather and Find Someone Who Bingo. Each draws its board's centrepiece
// (the quiz discs, the Picker, the statement stickies, the A-or-B cards, the bingo card) and its hover story plays
// the moment the game is for: a right answer turning green, a hello landing, the lie crossed out, the room's votes
// growing, a full line of names.
// Static SVG preview tiles, one branch per TemplateKind; TemplatePreview chains the groups with ??.

const INK = 'rgb(71 85 105)';
const RULE = 'rgb(203 213 225)';
const PAPER = 'white';
const GREEN = 'rgb(22 163 74)';
const AMBER = 'rgb(253 230 138)';
const AMBER_INK = 'rgb(217 119 6)';
const SKY = 'rgb(224 242 254)';
const SKY_INK = 'rgb(3 105 161)';
const PINK = 'rgb(252 231 243)';
const PINK_INK = 'rgb(190 24 93)';
const VIOLET = 'rgb(221 214 254)';
const RED = 'rgb(220 38 38)';

// A quiz card in miniature: the disc with its four answers on a ring around it.
function QuizDisc({ cx, cy }: { cx: number; cy: number }) {
  return (
    <>
      <circle cx={cx} cy={cy} r="3.6" fill={PAPER} stroke={INK} strokeWidth="0.6" />
      {[
        [0, -6],
        [6, 0],
        [0, 6],
        [-6, 0],
      ].map(([dx, dy]) => (
        <rect
          key={`${dx},${dy}`}
          x={cx + dx! - 2}
          y={cy + dy! - 1}
          width="4"
          height="2"
          rx="1"
          fill={PAPER}
          stroke={RULE}
          strokeWidth="0.5"
        />
      ))}
    </>
  );
}

export function templatePreviewGroup22(kind: TemplateKind): ReactElement | null {
  switch (kind) {
    case 'pub-quiz':
      // Three rounds of three quiz discs beside the scoreboard. Hover story: right answers turn green.
      return (
        <svg width="80" height="50" viewBox="0 0 80 50" aria-hidden>
          <rect
            x="3"
            y="5"
            width="20"
            height="18"
            rx="1.2"
            fill={PAPER}
            stroke={RULE}
            strokeWidth="0.6"
          />
          <rect x="3" y="5" width="20" height="3.6" rx="1.2" fill={AMBER} />
          {[12, 15.5, 19].map((y) => (
            <rect key={y} x="5" y={y} width="9" height="1.2" rx="0.6" fill={RULE} />
          ))}
          <rect x="3" y="28" width="20" height="9" rx="1.2" fill={AMBER} />
          <rect
            x="3"
            y="28"
            width="20"
            height="9"
            rx="1.2"
            fill="rgb(241 245 249)"
            opacity="0.92"
          />
          <circle cx="13" cy="32.5" r="1.6" fill={AMBER_INK} />
          {[10, 25, 40].map((cy, r) =>
            [36, 52, 68].map((cx, i) => (
              <g key={`${r}-${i}`}>
                <QuizDisc cx={cx} cy={cy} />
                <rect
                  className="pv-new"
                  style={pv({ '--pv-at': `${400 + (r * 3 + i) * 120}ms` })}
                  opacity="0"
                  x={cx + ((r + i) % 2 === 0 ? 4 : -8)}
                  y={cy - 1}
                  width="4"
                  height="2"
                  rx="1"
                  fill={GREEN}
                />
              </g>
            )),
          )}
        </svg>
      );
    case 'icebreaker-questions':
      // The two Pickers (the question, then the person) beside the hello wall. Hover story: a hello lands.
      return (
        <svg width="80" height="50" viewBox="0 0 80 50" aria-hidden>
          {[
            { y: 6, fill: SKY },
            { y: 17, fill: VIOLET },
            { y: 28, fill: AMBER },
            { y: 39, fill: 'rgb(220 252 231)' },
          ].map((s) => (
            <rect key={s.y} x="3" y={s.y} width="14" height="7" rx="1" fill={s.fill} />
          ))}
          <rect
            x="22"
            y="6"
            width="30"
            height="16"
            rx="2"
            fill={PAPER}
            stroke={INK}
            strokeWidth="0.6"
          />
          <rect x="26" y="12" width="22" height="2" rx="1" fill={INK} />
          <rect x="31" y="16" width="12" height="1.2" rx="0.6" fill={RULE} />
          <rect
            x="22"
            y="26"
            width="30"
            height="12"
            rx="2"
            fill={PAPER}
            stroke={INK}
            strokeWidth="0.6"
          />
          <circle cx="30" cy="32" r="2.4" fill="rgb(124 58 237)" />
          <rect x="34" y="31" width="12" height="2" rx="1" fill={INK} />
          <rect x="22" y="41" width="10" height="6" rx="1.2" fill={SKY_INK} />
          <rect x="57" y="8" width="10" height="10" fill="rgb(186 230 253)" />
          <rect x="68" y="11" width="10" height="10" fill="rgb(254 205 211)" />
          <rect
            className="pv-arrive"
            style={pv({ '--pv-at': '500ms', '--pv-from-x': '-14px', '--pv-from-y': '-6px' })}
            opacity="0"
            x="62"
            y="25"
            width="10"
            height="10"
            fill={AMBER}
          />
        </svg>
      );
    case 'two-truths-and-a-lie':
      // A row per player: their disc, three statement stickies and the poll. Hover story: the lie is crossed out.
      return (
        <svg width="80" height="50" viewBox="0 0 80 50" aria-hidden>
          {[
            { y: 4, disc: 'rgb(124 58 237)', note: VIOLET },
            { y: 19, disc: 'rgb(8 145 178)', note: 'rgb(186 230 253)' },
            { y: 34, disc: 'rgb(219 39 119)', note: 'rgb(254 205 211)' },
          ].map((p, r) => (
            <g key={p.y}>
              <circle cx="7" cy={p.y + 6} r="3.4" fill={p.disc} />
              {[14, 28, 42].map((x) => (
                <rect key={x} x={x} y={p.y} width="12" height="12" fill={p.note} />
              ))}
              <rect
                x="58"
                y={p.y + 2}
                width="18"
                height="8"
                rx="1.6"
                fill={PAPER}
                stroke={INK}
                strokeWidth="0.6"
              />
              <rect x="62" y={p.y + 5.4} width="10" height="1.2" rx="0.6" fill={INK} />
              {r === 0 ? (
                <path
                  className="pv-new"
                  style={pv({ '--pv-at': '600ms' })}
                  opacity="0"
                  d="M 45 7 L 51 13 M 51 7 L 45 13"
                  stroke={RED}
                  strokeWidth="1.2"
                  strokeLinecap="round"
                />
              ) : null}
            </g>
          ))}
        </svg>
      );
    case 'would-you-rather':
      // A-or-B cards in two columns, each with its poll. Hover story: the room's votes grow under each side.
      return (
        <svg width="80" height="50" viewBox="0 0 80 50" aria-hidden>
          {[0, 1].map((col) =>
            [5, 19, 33].map((y, r) => {
              const x = 3 + col * 39;
              return (
                <g key={`${col}-${y}`}>
                  <rect
                    x={x}
                    y={y}
                    width="14"
                    height="9"
                    rx="1.4"
                    fill={SKY}
                    stroke={SKY_INK}
                    strokeWidth="0.5"
                  />
                  <circle cx={x + 17} cy={y + 4.5} r="2" fill={INK} />
                  <rect
                    x={x + 20}
                    y={y}
                    width="14"
                    height="9"
                    rx="1.4"
                    fill={PINK}
                    stroke={PINK_INK}
                    strokeWidth="0.5"
                  />
                  <rect
                    className="pv-grow-x"
                    style={pv({ '--pv-at': `${400 + (col * 3 + r) * 110}ms` })}
                    x={x}
                    y={y + 10.5}
                    width={6 + ((col + r) % 3) * 3}
                    height="1.4"
                    rx="0.7"
                    fill={SKY_INK}
                  />
                  <rect
                    className="pv-grow-x"
                    style={pv({ '--pv-at': `${450 + (col * 3 + r) * 110}ms` })}
                    x={x + 20}
                    y={y + 10.5}
                    width={12 - ((col + r) % 3) * 3}
                    height="1.4"
                    rx="0.7"
                    fill={PINK_INK}
                  />
                </g>
              );
            }),
          )}
        </svg>
      );
    case 'people-bingo':
      // The 4 x 4 card beside the kit. Hover story: name stickies fill a diagonal, a full line.
      return (
        <svg width="80" height="50" viewBox="0 0 80 50" aria-hidden>
          {[0, 1, 2, 3].map((r) =>
            [0, 1, 2, 3].map((c) => (
              <rect
                key={`${r}-${c}`}
                x={10 + c * 10.5}
                y={4 + r * 10.5}
                width="9.5"
                height="9.5"
                rx="1.2"
                fill={(r + c) % 2 === 0 ? 'rgb(254 243 199)' : SKY}
                stroke={(r + c) % 2 === 0 ? AMBER_INK : 'rgb(2 132 199)'}
                strokeWidth="0.4"
              />
            )),
          )}
          {[0, 1, 2, 3].map((i) => (
            <rect
              key={i}
              className="pv-new"
              style={pv({ '--pv-at': `${400 + i * 200}ms` })}
              opacity="0"
              x={12 + i * 10.5}
              y={8 + i * 10.5}
              width="6"
              height="4"
              fill={AMBER}
              stroke={AMBER_INK}
              strokeWidth="0.3"
            />
          ))}
          <rect x="56" y="6" width="14" height="9" rx="1.6" fill={SKY_INK} />
          <rect x="56" y="18" width="14" height="9" rx="1.6" fill="rgb(234 88 12)" />
          <rect x="56" y="31" width="18" height="2" rx="1" fill={RULE} />
          <rect x="56" y="36" width="14" height="2" rx="1" fill={RULE} />
        </svg>
      );
    default:
      return null;
  }
}
