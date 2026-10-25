// Feature illustrations for Forms beyond the build (docs/specs/030-forms/forms.md): a form that runs to
// several pages under a cover in the tab's style, and new answers finding you through the Inbox and
// email.

import {
  PANEL,
  SHADOW,
  Scene,
  TEXT_BODY,
  TEXT_MUTED,
  TEXT_STRONG,
} from '@liveworkspace/marketing-site/components/feature-art/canvas-marks';
import { Pill } from './mode-parts';
import { Frame } from '@liveworkspace/marketing-site/components/feature-art/shared';

const ACCENT = '#7c3aed';

// A form in pages: the cover band, section two of three with its progress bar, a question only shown
// for a Yes before, and Back and Next.
export function FormSectionsArt() {
  return (
    <Frame canvas>
      <Scene>
        <g className={SHADOW}>
          <rect className={PANEL} x="60" y="4" width="180" height="88" rx="5" strokeWidth="0.8" />
        </g>
        <defs>
          <linearGradient id="fa-form-cover" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#c4b5fd" />
            <stop offset="1" stopColor="#f9a8d4" />
          </linearGradient>
        </defs>
        <path d="M60 9 a5 5 0 0 1 5 -5 h170 a5 5 0 0 1 5 5 v9 h-180z" fill="url(#fa-form-cover)" />
        <text className={TEXT_STRONG} x="70" y="30" fontSize="7.4" fontWeight="800">
          Team offsite RSVP
        </text>
        {/* Progress: section 2 of 3. */}
        <rect
          className="fill-slate-100 dark:fill-slate-700"
          x="70"
          y="36"
          width="160"
          height="3"
          rx="1.5"
        />
        <rect x="70" y="36" width="107" height="3" rx="1.5" fill={ACCENT} />
        <text className={TEXT_MUTED} x="230" y="33" fontSize="4.8" textAnchor="end">
          2 of 3
        </text>
        <text className={TEXT_STRONG} x="70" y="52" fontSize="6.2" fontWeight="700">
          Dietary needs
        </text>
        <Pill x={124} y={46} text="Shown when: Coming? is Yes" tone="violet" />
        {['Vegetarian', 'Vegan', 'None'].map((o, i) => (
          <g key={o}>
            <circle
              cx={74 + i * 46}
              cy="63"
              r="3"
              fill="none"
              className="stroke-slate-300 dark:stroke-slate-500"
              strokeWidth="0.9"
            />
            {i === 0 ? <circle cx="74" cy="63" r="1.6" fill={ACCENT} /> : null}
            <text className={TEXT_BODY} x={80 + i * 46} y="65" fontSize="5.4">
              {o}
            </text>
          </g>
        ))}
        <text className={TEXT_BODY} x="70" y="84" fontSize="5.6" fontWeight="600">
          Back
        </text>
        <g className="fa-d-ring">
          <rect x="204" y="76" width="28" height="11" rx="2.5" fill={ACCENT} />
        </g>
        <text x="218" y="83.6" fontSize="5.6" fontWeight="700" fill="#fff" textAnchor="middle">
          Next
        </text>
      </Scene>
    </Frame>
  );
}

// New answers finding you: the Explorer's Inbox listing a form with three new responses, and the
// email the owner gets, at most one every fifteen minutes.
export function FormAlertsArt() {
  return (
    <Frame canvas>
      <Scene>
        <g className={SHADOW}>
          <rect className={PANEL} x="10" y="8" width="140" height="80" rx="5" strokeWidth="0.8" />
        </g>
        <text className={TEXT_STRONG} x="18" y="20" fontSize="6.4" fontWeight="700">
          Inbox
        </text>
        {[
          { title: 'Bug Report', sub: 'Form · 3 new responses', fresh: true },
          { title: 'Event RSVP', sub: 'Form · 1 new response', fresh: true },
          { title: 'Hero copy', sub: 'Comment from Jo', fresh: false },
        ].map((r, i) => (
          <g key={r.title}>
            <rect
              x="18"
              y={27 + i * 19}
              width="8"
              height="10"
              rx="1.5"
              fill={i === 2 ? '#94a3b8' : ACCENT}
              fillOpacity="0.85"
            />
            <text className={TEXT_STRONG} x="31" y={32 + i * 19} fontSize="5.8" fontWeight="600">
              {r.title}
            </text>
            <text className={TEXT_MUTED} x="31" y={39 + i * 19} fontSize="4.8">
              {r.sub}
            </text>
            {r.fresh ? <Pill x={118} y={28 + i * 19} text="New" tone="brand" /> : null}
          </g>
        ))}
        {/* The email. */}
        <g className="fa-d-land">
          <g className={SHADOW}>
            <rect
              className={PANEL}
              x="162"
              y="18"
              width="126"
              height="60"
              rx="5"
              strokeWidth="0.8"
            />
          </g>
          <path
            className="stroke-slate-400"
            d="M170 26 h14 v10 h-14z M170 26 l7 5.4 l7 -5.4"
            strokeWidth="0.9"
            fill="none"
          />
          <text className={TEXT_STRONG} x="190" y="33" fontSize="5.8" fontWeight="700">
            3 new answers to Bug Report
          </text>
          <text className={TEXT_BODY} x="170" y="50" fontSize="5.2">
            Each is a card on your Triage board.
          </text>
          <rect className="fill-brand-700" x="170" y="58" width="52" height="12" rx="2.5" />
          <text x="196" y="66" fontSize="5.4" fontWeight="700" fill="#fff" textAnchor="middle">
            Open the board
          </text>
        </g>
      </Scene>
    </Frame>
  );
}
