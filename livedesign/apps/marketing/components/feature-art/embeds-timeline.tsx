// Feature illustrations: embeds on the canvas and the Timeline feed, split from ./structure.

import { HAIRLINE, PANEL, SHADOW, Scene, TEXT_BODY, TEXT_MUTED, TEXT_STRONG } from './canvas-marks';
import { Frame } from './shared';

// The Explorer's Timeline (docs/specs/013-workspace/timeline.md): a day of activity on a spine,
// each event with who did it and what, colour saying what happened; the newest is marked New.
export function TimelineFeedArt() {
  const rows = [
    {
      who: 'AK',
      color: '#8b5cf6',
      kind: '#16a34a',
      verb: 'commented on',
      doc: 'Bloom brand',
      time: 'now',
      fresh: true,
    },
    {
      who: 'SM',
      color: '#0ea5e9',
      kind: '#f59e0b',
      verb: 'assigned you',
      doc: 'Checkout flow',
      time: '11:02',
    },
    {
      who: 'JR',
      color: '#ec4899',
      kind: '#0ea5e9',
      verb: 'edited',
      doc: 'Onboarding screens',
      time: '09:24',
    },
  ];
  return (
    <Frame>
      <Scene>
        <g className={SHADOW}>
          <rect className={PANEL} x="24" y="7" width="252" height="82" rx="6" strokeWidth="0.8" />
        </g>
        <text className={TEXT_STRONG} x="34" y="20" fontSize="7" fontWeight="700">
          Today
        </text>
        <rect className="fill-brand-500" x="58" y="13.6" width="28" height="9" rx="4.5" />
        <text x="72" y="19.8" fontSize="5.4" fontWeight="700" fill="#fff" textAnchor="middle">
          3 new
        </text>
        <path className={HAIRLINE} d="M43 29 V83" strokeWidth="1" />
        {rows.map((r, i) => {
          const y = 34 + i * 18;
          return (
            <g
              key={r.doc}
              className={r.fresh ? 'fa-d-land' : undefined}
              style={r.fresh ? { animationDelay: '0.1s' } : undefined}
            >
              <circle
                cx="43"
                cy={y + 5}
                r="3"
                fill={r.kind}
                className="stroke-white dark:stroke-slate-900"
                strokeWidth="1.2"
              />
              <rect
                className={
                  r.fresh
                    ? 'fill-brand-50 stroke-brand-200 dark:fill-brand-500/10 dark:stroke-brand-500/40'
                    : 'fill-slate-50 stroke-slate-100 dark:fill-slate-800/60 dark:stroke-slate-800'
                }
                x="52"
                y={y - 2.5}
                width="214"
                height="15"
                rx="3.5"
                strokeWidth="0.7"
              />
              <circle cx="61" cy={y + 5} r="5.2" fill={r.color} />
              <text
                x="61"
                y={y + 6.8}
                fontSize="4.4"
                fontWeight="700"
                fill="#fff"
                textAnchor="middle"
              >
                {r.who}
              </text>
              <text className={TEXT_BODY} x="71" y={y + 7.2} fontSize="6.4">
                {r.verb}{' '}
                <tspan className={TEXT_STRONG} fontWeight="600">
                  {r.doc}
                </tspan>
              </text>
              {r.fresh ? (
                <g>
                  <rect
                    className="fill-brand-500"
                    x="240"
                    y={y + 0.5}
                    width="20"
                    height="9"
                    rx="4.5"
                  />
                  <text
                    x="250"
                    y={y + 6.6}
                    fontSize="5.2"
                    fontWeight="700"
                    fill="#fff"
                    textAnchor="middle"
                  >
                    New
                  </text>
                </g>
              ) : (
                <text className={TEXT_MUTED} x="260" y={y + 7} fontSize="5.6" textAnchor="end">
                  {r.time}
                </text>
              )}
            </g>
          );
        })}
      </Scene>
    </Frame>
  );
}
