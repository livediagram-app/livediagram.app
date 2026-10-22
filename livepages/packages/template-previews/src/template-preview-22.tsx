import type { ReactElement } from 'react';
import type { TemplateKind } from '@livepages/templates';
import { pv } from './motion';

// Group 22: Games (docs/specs/012-collaboration/game-templates.md): Icebreaker Questions and Find Someone Who
// Bingo. Each draws its board's centrepiece (the Picker, the bingo card) and its hover story plays the moment the
// game is for: a hello landing, a full line of names.
// Static SVG preview tiles, one branch per TemplateKind; TemplatePreview chains the groups with ??.

const INK = 'rgb(71 85 105)';
const RULE = 'rgb(203 213 225)';
const PAPER = 'white';
const AMBER = 'rgb(253 230 138)';
const AMBER_INK = 'rgb(217 119 6)';
const SKY = 'rgb(224 242 254)';
const SKY_INK = 'rgb(3 105 161)';
const VIOLET = 'rgb(221 214 254)';

export function templatePreviewGroup22(kind: TemplateKind): ReactElement | null {
  switch (kind) {
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
