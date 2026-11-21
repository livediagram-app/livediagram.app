// The Automations screen as a feature card draws it (liveworkspace/docs/specs/018-automations/automations.md; the
// screen is packages/automations-ui's, the same in every app): its title and New Rule, the Rules tab open beside
// Audit Trail, Templates and Connections, and three rules as the Rules list's rows show them
// (packages/automations-ui/src/RuleRow.tsx): the switch, the name, the sentence and when it last ran. Each app passes
// its own templates as the rules and draws in its brand. The rows come in on the shared card keyframes (each app's
// app/feature-art/canvas.css), which settle under reduced motion.

import type { CSSProperties } from 'react';
import { Frame } from './shared';

export interface AutomationsArtRule {
  name: string;
  sentence: string;
  last: string;
}

const PANEL = 'fill-white stroke-slate-200 dark:fill-slate-900 dark:stroke-slate-700';
const RULE = 'stroke-slate-100 dark:stroke-slate-800';
const STRONG = 'fill-slate-800 dark:fill-slate-100';
const BODY = 'fill-slate-600 dark:fill-slate-300';
const SUBTLE = 'fill-slate-500 dark:fill-slate-400';
const TABS = ['Audit Trail', 'Templates', 'Connections'] as const;

const at = (seconds: number) => ({ '--d': `${seconds}s` }) as CSSProperties;

/** The Automations screen on its Rules tab, `rules` its rows (three fit), every one on. */
export function AutomationsArt({ rules }: { rules: readonly AutomationsArtRule[] }) {
  return (
    <Frame canvas>
      <svg viewBox="0 0 300 96" className="absolute inset-0 h-full w-full">
        <rect x={14} y={3} width={272} height={90} rx={6} strokeWidth={0.8} className={PANEL} />
        <text x={24} y={13.6} fontSize={7} fontWeight={700} className={STRONG}>
          Automations
        </text>
        <rect x={244} y={7} width={32} height={9} rx={2.5} className="fill-brand-600" />
        <text
          x={260}
          y={13.2}
          fontSize={5.2}
          fontWeight={600}
          textAnchor="middle"
          className="fill-white"
        >
          New Rule
        </text>
        <text
          x={24}
          y={24.6}
          fontSize={5}
          fontWeight={700}
          className="fill-brand-700 dark:fill-brand-300"
        >
          {`Rules · ${rules.length}`}
        </text>
        <path d="M23 27.4 H46" strokeWidth={1} className="stroke-brand-600" />
        {TABS.map((tab, i) => (
          <text key={tab} x={58 + i * 34} y={24.6} fontSize={5} className={SUBTLE}>
            {tab}
          </text>
        ))}
        {rules.slice(0, 3).map((r, i) => {
          const y = 29 + i * 21;
          return (
            <g key={r.name} className="fa-a-in" style={at(0.2 + i * 0.25)}>
              <path d={`M14 ${y} H286`} strokeWidth={0.8} className={RULE} />
              <rect x={24} y={y + 7} width={12} height={7} rx={3.5} className="fill-brand-600" />
              <circle cx={32.4} cy={y + 10.5} r={2.6} className="fill-white" />
              <text x={44} y={y + 9} fontSize={6.2} fontWeight={700} className={STRONG}>
                {r.name}
              </text>
              <text x={44} y={y + 15.6} fontSize={4.8} className={BODY}>
                {r.sentence}
              </text>
              <text x={276} y={y + 9} fontSize={4.4} textAnchor="end" className={SUBTLE}>
                Last Run
              </text>
              <text
                x={276}
                y={y + 15.6}
                fontSize={4.8}
                fontWeight={600}
                textAnchor="end"
                className={BODY}
              >
                {r.last}
              </text>
            </g>
          );
        })}
      </svg>
    </Frame>
  );
}
