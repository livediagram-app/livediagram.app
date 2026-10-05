import type { ReactElement } from 'react';
import type { TemplateKind } from '@livediagram/templates';
import { pv } from './motion';
import { FILL_BOX } from './story-parts';
import {
  BLUE,
  BOARD,
  Board,
  GREEN,
  INK,
  NOTE,
  NOTE_EDGE,
  ORANGE,
  RED,
  Stick,
  VIOLET,
  pen,
} from './sketch-preview-parts';

// Group 11: the Draw templates (docs/specs/007-editor/templates-by-mode.md "Draw templates"),
// drawn as the whiteboard tile is: the off-white board with marker lines in its stock colours.
// Static SVG preview tiles, one branch per TemplateKind; TemplatePreview chains the groups with ??.

export function templatePreviewGroup11(kind: TemplateKind): ReactElement | null {
  switch (kind) {
    case 'sketchnote':
      // Visual notes from a talk: a banner title, the big idea in a blue cloud, three framed areas
      // and a red takeaway banner. Hover story: the arrows are drawn out from the cloud, then the
      // lightbulb lights up.
      return (
        <svg width="72" height="40" viewBox="0 0 80 44" aria-hidden>
          <Board />
          <path
            d="M28 6.5 L52 6 L52.3 11.8 L28 12 Z M28 7.5 L25 8 L26.2 10 L25 12.6 L28 12.4 M52.2 7.5 L55 8 L53.8 10 L55 12.6 L52.2 12.4"
            {...pen(INK, 0.9)}
          />
          <path d="M32 9.2 C34 8 36 10 38 9 S42 8 44 9.4 S47 9 48 9" {...pen(INK, 0.9)} />
          <path
            d="M33 23 Q32.5 18.5 36.5 19 Q38.5 15.5 42.5 17.5 Q46.5 16.5 47 20.5 Q50 23 46.8 26 Q45.5 30 41 28.5 Q37 30.5 35 27.5 Q31 26.5 33 23 Z"
            {...pen(BLUE, 1)}
          />
          <path d="M36 22.5 L44 22.3 M37 25 L43 25" {...pen(BLUE, 0.8)} />
          <path d="M7 15 L23 14.8 L23.2 32.5 L7 32.6 Z" {...pen(INK, 0.9)} />
          <path
            d="M9.5 19 L10.5 20 L12 18 M14 19.2 L21 19 M9.5 24 L10.5 25 L12 23 M14 24.2 L20 24 M9.5 29 L10.5 30 L12 28 M14 29.2 L21 29"
            {...pen(GREEN, 0.7)}
          />
          <path
            d="M57 14.8 L73 15 L72.8 23.6 L57 23.4 Z M57 26.4 L73 26.2 L73.2 34.6 L57 34.6 Z"
            {...pen(INK, 0.9)}
          />
          <path d="M59.5 18.5 L70 18.4 M59.5 21 L67 21" {...pen(VIOLET, 0.7)} />
          <path d="M59.5 29.5 L70 29.4 M59.5 32 L66 32" {...pen(ORANGE, 0.7)} />
          <path d="M18 37 L62 36.8 L62 40 L18 40.2 Z" {...pen(RED, 0.9)} />
          {[
            { d: 'M32.5 23.5 Q28 23 24 22', at: 500 },
            { d: 'M47 20 Q52 18 56 19', at: 750 },
            { d: 'M46.5 26.5 Q52 28.5 56 29.5', at: 1000 },
          ].map(({ d, at }) => (
            <path
              key={d}
              className="pv-draw"
              pathLength="1"
              strokeDasharray="0 1"
              d={d}
              {...pen(BLUE, 0.9)}
              style={pv({ '--pv-at': `${at}ms`, '--pv-dur': '500ms' })}
            />
          ))}
          <g className="pv-new" opacity="0" style={{ ...pv({ '--pv-at': '1500ms' }), ...FILL_BOX }}>
            <circle cx="28" cy="33" r="2.4" {...pen(ORANGE, 0.8)} />
            <path
              d="M27 35.4 L29 35.4 M25 30.5 L24 29.5 M31 30.5 L32 29.5 M28 29.6 L28 28.4"
              {...pen(ORANGE, 0.7)}
            />
          </g>
        </svg>
      );
    case 'rich-picture':
      // A rich picture: stick-figure stakeholders round the system's blue cloud, a speech bubble,
      // red crossed swords where they clash and a violet eye watching. Hover story: a new voice
      // speaks up and the clash flares.
      return (
        <svg width="72" height="40" viewBox="0 0 80 44" aria-hidden>
          <Board />
          <path
            d="M31 23 Q30.5 18 35 18.5 Q37.5 14.5 42 16.5 Q46.5 15.5 47.5 19.5 Q51 22.5 47.5 26 Q46 30 41 28.5 Q36.5 30.5 34.5 27.5 Q30 26.5 31 23 Z"
            {...pen(BLUE, 1)}
          />
          <path d="M35 22.5 L44 22.3 M36.5 25 L42.5 25" {...pen(BLUE, 0.8)} />
          <Stick x={11} y={12} />
          <Stick x={64} y={13} />
          <Stick x={13} y={30} />
          <Stick x={58} y={30} />
          <path
            d="M15 6.5 L27 6.3 Q28.5 6.4 28.5 8 L28.5 10.5 Q28.4 12 27 12 L19 12 L14 14 L16.5 12 L15 12 Q13.6 11.9 13.6 10.5 L13.6 8 Q13.7 6.5 15 6.5 Z"
            {...pen(INK, 0.7)}
          />
          <path d="M16.5 9.2 L26 9.1" {...pen(INK, 0.6)} />
          <g style={{ ...pv({ '--pv-at': '1300ms' }), ...FILL_BOX }} className="pv-pulse">
            <path
              d="M53 18 L59 24 M59 18 L53 24 M52.6 21.5 L54.4 19.5 M57.6 19.5 L59.4 21.5"
              {...pen(RED, 0.9)}
            />
          </g>
          <path d="M60 7 Q64.5 3.5 69 7 Q64.5 10.5 60 7 Z" {...pen(VIOLET, 0.8)} />
          <circle cx="64.5" cy="7" r="1.2" fill={VIOLET} />
          <g className="pv-new" opacity="0" style={{ ...pv({ '--pv-at': '700ms' }), ...FILL_BOX }}>
            <path
              d="M22 31.5 L34 31.3 Q35.5 31.4 35.5 33 L35.5 35.5 Q35.4 37 34 37 L22 37 Q20.6 36.9 20.6 35.5 L20.6 35 L17.5 34 L20.6 33.2 L20.6 33 Q20.7 31.5 22 31.5 Z"
              fill={BOARD}
              {...{ stroke: INK, strokeWidth: 0.7, strokeLinejoin: 'round' as const }}
            />
            <path d="M23 34.2 L33 34.1" {...pen(INK, 0.6)} />
          </g>
        </svg>
      );
    case 'comic-strip':
      // Six hand-drawn panels, each with a yellow caption, a stick figure and a speech bubble.
      // Hover story: the story plays out, each panel's line spoken in turn.
      return (
        <svg width="72" height="40" viewBox="0 0 80 44" aria-hidden>
          <Board />
          {[0, 1, 2, 3, 4, 5].map((i) => {
            const x = 6 + (i % 3) * 23.5;
            const y = 6 + Math.floor(i / 3) * 17.5;
            return (
              <g key={i}>
                <path
                  d={`M${x} ${y} L${x + 21} ${y - 0.2} L${x + 21.2} ${y + 15.5} L${x - 0.1} ${y + 15.6} Z`}
                  {...pen(INK, 0.9)}
                />
                <rect
                  x={x + 1.2}
                  y={y + 1.2}
                  width="7.5"
                  height="3"
                  fill={NOTE}
                  stroke={NOTE_EDGE}
                  strokeWidth="0.4"
                />
                <Stick x={x + 6} y={y + 6.5} c={i === 3 ? RED : INK} />
                <path
                  className="pv-new"
                  opacity="0"
                  d={`M${x + 11} ${y + 5.5} L${x + 19} ${y + 5.4} L${x + 19} ${y + 9.6} L${x + 12.5} ${y + 9.6} L${x + 9.5} ${y + 11.2} L${x + 11} ${y + 9.6} Z`}
                  fill={BOARD}
                  stroke={INK}
                  strokeWidth="0.6"
                  strokeLinejoin="round"
                  style={{ ...pv({ '--pv-at': `${400 + i * 280}ms` }), ...FILL_BOX }}
                />
              </g>
            );
          })}
        </svg>
      );
    case 'doodle-warmup':
      // The icebreaker: the rules on a sticky, six named frames (one portrait already drawn) and a
      // column of stars to vote with. Hover story: a second portrait is sketched, then a star lands
      // under it.
      return (
        <svg width="72" height="40" viewBox="0 0 80 44" aria-hidden>
          <Board />
          <rect
            x="6"
            y="7"
            width="12"
            height="12"
            fill={NOTE}
            stroke={NOTE_EDGE}
            strokeWidth="0.5"
          />
          <path d="M8 10 L15 10 M8 12.5 L16 12.5 M8 15 L14 15" {...pen(INK, 0.5)} />
          <circle cx="12" cy="29" r="4" {...pen(INK, 0.8)} />
          <path d="M12 29 L14 26.6 M11.2 24.4 L12.8 24.4" {...pen(RED, 0.8)} />
          {[0, 1, 2, 3, 4, 5].map((i) => {
            const x = 21 + (i % 3) * 14;
            const y = 6 + Math.floor(i / 3) * 17;
            return (
              <path
                key={i}
                d={`M${x} ${y} L${x + 12} ${y - 0.2} L${x + 12.2} ${y + 13} L${x - 0.1} ${y + 13.1} Z`}
                {...pen(INK, 0.8)}
              />
            );
          })}
          <circle cx="27" cy="12.5" r="3.6" {...pen(BLUE, 0.8)} />
          <path d="M25.4 13.6 Q27 15 28.6 13.6" {...pen(BLUE, 0.6)} />
          <path d="M23.6 10 Q27 6.6 30.4 10" {...pen(BLUE, 0.8)} />
          <circle
            className="pv-draw"
            pathLength="1"
            strokeDasharray="0 1"
            cx="41"
            cy="12.5"
            r="3.6"
            {...pen(VIOLET, 0.8)}
            style={pv({ '--pv-at': '400ms', '--pv-dur': '700ms' })}
          />
          <path
            className="pv-draw"
            pathLength="1"
            strokeDasharray="0 1"
            d="M39.4 13.6 Q41 15 42.6 13.6"
            {...pen(VIOLET, 0.6)}
            style={pv({ '--pv-at': '1000ms', '--pv-dur': '300ms' })}
          />
          <path d="M64 6.5 L74 6.3 L74.2 38 L64 38.1 Z" {...pen(ORANGE, 0.8)} />
          {[11, 18, 25].map((y) => (
            <path
              key={y}
              d={`M69 ${y - 2.5} L69.8 ${y - 0.6} L71.8 ${y - 0.5} L70.2 ${y + 0.7} L70.8 ${y + 2.6} L69 ${y + 1.5} L67.2 ${y + 2.6} L67.8 ${y + 0.7} L66.2 ${y - 0.5} L68.2 ${y - 0.6} Z`}
              fill="rgb(250 204 21)"
              stroke="rgb(202 138 4)"
              strokeWidth="0.4"
            />
          ))}
          <path
            className="pv-new"
            opacity="0"
            d="M41 18.5 L41.8 20.4 L43.8 20.5 L42.2 21.7 L42.8 23.6 L41 22.5 L39.2 23.6 L39.8 21.7 L38.2 20.5 L40.2 20.4 Z"
            fill="rgb(250 204 21)"
            stroke="rgb(202 138 4)"
            strokeWidth="0.4"
            style={{ ...pv({ '--pv-at': '1500ms' }), ...FILL_BOX }}
          />
        </svg>
      );
    default:
      return null;
  }
}
