import { Label } from '@liveworkspace/help-site/art/primitives';
import { Card, Shadow } from '@liveworkspace/help-site/art/parts';
import { ToolsArt as Scene } from '@liveworkspace/help-site/art/scenes/tools';

// The Automations screen's rules, each with its switch: what a Knowledgebase runs on its own.
const RULES = [
  { name: 'Review Due to Slack', when: 'Review Due', on: true },
  { name: 'Check an Agent’s Edit', when: 'Agent Made Changes', on: true },
  { name: 'Unanswered Questions', when: 'Unanswered Question', on: false },
];

// Tools: the shared scene (liveworkspace/docs/specs/017-help/help-centre.md "Category art"), with liveknowledge's
// helper: a rule (When Review Due, then Post to Slack) across the top left, and the Rules list down the right. A
// Knowledgebase has no Zen mode, so the switch is left out.
export function ToolsArt() {
  return (
    <Scene zen={false}>
      {/* The rule: its trigger, then its step. */}
      <Card x={22} y={22} w={200} h={78} r={12}>
        <Label x={34} y={38} size={10.5} weight={700} tone="strong">
          When Review Due
        </Label>
        <rect x={32} y={48} width={180} height={18} rx={5} className="fill-amber-100" />
        <circle cx={42} cy={57} r={3.2} className="fill-amber-500" />
        <Label x={50} y={57.5} size={8.5} weight={600} tone="body">
          Deploying · verified 90 days ago
        </Label>
        <path d="M42 68 v8" className="stroke-slate-300" strokeWidth={1.4} />
        <rect x={32} y={76} width={180} height={18} rx={5} className="fill-brand-500" />
        <Label x={42} y={85.5} size={8.5} weight={700} tone="onAccent">
          Then Post to Slack
        </Label>
      </Card>

      {/* The Rules list. */}
      <Shadow x={236} y={18} w={154} h={176} r={8} />
      <rect
        x={236}
        y={18}
        width={154}
        height={176}
        rx={8}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      <Label x={250} y={38} size={11} weight={800} tone="strong">
        Rules
      </Label>
      {RULES.map((rule, i) => {
        const y = 52 + i * 46;
        return (
          <g key={rule.name}>
            <rect
              x={246}
              y={y}
              width={134}
              height={38}
              rx={6}
              className="fill-slate-50 stroke-slate-200"
              strokeWidth={1}
            />
            <rect
              x={254}
              y={y + 13}
              width={18}
              height={11}
              rx={5.5}
              className={rule.on ? 'fill-brand-500' : 'fill-slate-300'}
            />
            <circle cx={rule.on ? 266.5 : 259.5} cy={y + 18.5} r={3.8} className="fill-white" />
            <Label x={280} y={y + 14} size={8.5} weight={700} tone="strong">
              {rule.name}
            </Label>
            <Label x={280} y={y + 26} size={7.5} weight={500} tone="muted">
              {`When ${rule.when}`}
            </Label>
          </g>
        );
      })}
    </Scene>
  );
}
