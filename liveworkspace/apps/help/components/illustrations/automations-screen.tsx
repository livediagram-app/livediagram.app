// The Automations screen (liveworkspace/docs/specs/018-automations/automations.md; its blueprint ui.md "The screen"),
// as the shared Automations article shows it: the screen's title and New Rule, its four tabs (Rules · n, Audit Trail,
// Templates, Connections) with the Runs today meter, and the Rules list's rows, each with its switch, its name, its
// sentence and when it last ran. The screen is the platform's, the same in every app, so one drawing serves each
// app's help; the rows are the app's own templates, passed in. Composed from the shared primitives.

import { Button, Dialog, Label } from '@liveworkspace/help-site/art/primitives';

export interface AutomationsScreenRule {
  name: string;
  sentence: string;
  last: string;
  on?: boolean;
}

const W = 420;
const H = 232;
const X = 18;
const Y = 12;
const DW = W - 36;
const TABS = ['Audit Trail', 'Templates', 'Connections'] as const;

/** A rule's on and off switch, drawn as the screen draws it. */
function Switch({ x, y, on }: { x: number; y: number; on: boolean }) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={24}
        height={14}
        rx={7}
        className={on ? 'fill-brand-600' : 'fill-slate-200'}
      />
      <circle cx={on ? x + 17 : x + 7} cy={y + 7} r={5} className="fill-white help-art-as-drawn" />
    </g>
  );
}

/** The Automations screen with `rules` in its Rules list. */
export function AutomationsScreen({ rules }: { rules: readonly AutomationsScreenRule[] }) {
  const tabY = Y + 44;
  const rowY = tabY + 34;
  return (
    <Dialog x={X} y={Y} w={DW} h={H - 24} sceneW={W} sceneH={H}>
      <Label x={X + 16} y={Y + 20} size={13} weight={700} tone="strong">
        Automations
      </Label>
      <Button x={X + DW - 92} y={Y + 9} w={78} h={22} label="New Rule" variant="primary" />

      {/* The tabs: Rules · n open, its underline at the bar's foot; Runs today at the right. */}
      <Label x={X + 16} y={tabY} size={10} weight={700} tone="accent">
        {`Rules · ${rules.length}`}
      </Label>
      <rect x={X + 14} y={tabY + 10} width={46} height={2} rx={1} className="fill-brand-600" />
      {TABS.map((tab, i) => (
        <Label key={tab} x={X + 76 + i * 66} y={tabY} size={10} weight={500} tone="muted">
          {tab}
        </Label>
      ))}
      <Label x={X + DW - 16} y={tabY} size={8.5} weight={500} tone="muted" anchor="end">
        Runs today 6
      </Label>
      <line
        x1={X}
        y1={tabY + 12}
        x2={X + DW}
        y2={tabY + 12}
        className="stroke-slate-100"
        strokeWidth={0.75}
      />

      {rules.map((rule, i) => {
        const y = rowY + i * 42;
        return (
          <g key={rule.name}>
            <rect
              x={X + 12}
              y={y}
              width={DW - 24}
              height={36}
              rx={8}
              className="fill-white stroke-slate-200"
              strokeWidth={0.75}
            />
            <Switch x={X + 22} y={y + 11} on={rule.on ?? true} />
            <Label x={X + 56} y={y + 12} size={10} weight={700} tone="strong">
              {rule.name}
            </Label>
            <Label x={X + 56} y={y + 25} size={8.5} tone="body">
              {rule.sentence}
            </Label>
            <Label x={X + DW - 24} y={y + 12} size={8} tone="muted" anchor="end">
              Last Run
            </Label>
            <Label x={X + DW - 24} y={y + 25} size={8.5} weight={600} tone="body" anchor="end">
              {rule.last}
            </Label>
          </g>
        );
      })}
    </Dialog>
  );
}
