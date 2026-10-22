// The Q&A board's help scene (docs/specs/018-help/help-app.md, drawing docs/specs/012-collaboration/qa-board.md): the spotlight
// with the facilitator's Done and Done, next over a ranked queue, the top row
// marked Most wanted, a vote of your own filled in, heat bars measuring each
// row against the top, and the composer with its Anonymous switch.

import { Scene, Label } from './primitives';
import { CollabCard } from './palette-collaborate';

const ROWS: { text: string; votes: number; mine?: boolean }[] = [
  { text: 'How do we measure success?', votes: 9, mine: true },
  { text: 'Who owns the rollout?', votes: 5 },
  { text: 'Can we pilot it first?', votes: 2 },
];

export function QaBoardCard() {
  const x = 90;
  const y = 10;
  const w = 240;
  const max = ROWS[0]!.votes;
  return (
    <Scene w={420} h={318}>
      <CollabCard x={x} y={y} w={w} h={298} title="Questions for the panel" aside="4 NOTES">
        {/* The spotlight, with the facilitator's two buttons. */}
        <rect
          x={x + 12}
          y={y + 38}
          width={w - 24}
          height={70}
          rx={10}
          className="fill-brand-50 stroke-brand-400"
          strokeWidth={1.5}
        />
        <circle cx={x + 24} cy={y + 50} r={3} className="fill-brand-500" />
        <Label x={x + 32} y={y + 51} size={10} weight={700} tone="accent">
          NOW DISCUSSING
        </Label>
        <Label x={x + 22} y={y + 69} size={11} weight={700} tone="strong">
          What does launch look like?
        </Label>
        <rect
          x={x + w - 142}
          y={y + 80}
          width={44}
          height={20}
          rx={6}
          className="fill-white stroke-brand-300"
          strokeWidth={1.2}
        />
        <Label x={x + w - 120} y={y + 90.5} anchor="middle" size={10} weight={600} tone="accent">
          Done
        </Label>
        <rect x={x + w - 92} y={y + 80} width={76} height={20} rx={6} className="fill-brand-500" />
        <Label x={x + w - 54} y={y + 90.5} anchor="middle" size={10} weight={600} tone="onAccent">
          Done, next →
        </Label>
        {ROWS.map((r, i) => {
          const ry = y + 118 + i * 42;
          const top = i === 0;
          return (
            <g key={r.text}>
              <rect
                x={x + 12}
                y={ry}
                width={w - 24}
                height={36}
                rx={9}
                className={
                  top ? 'fill-brand-50 stroke-brand-200' : 'fill-slate-50 stroke-slate-200'
                }
                strokeWidth={1.2}
              />
              <rect
                x={x + 18}
                y={ry + 5}
                width={24}
                height={26}
                rx={7}
                className={r.mine ? 'fill-brand-500' : 'fill-white stroke-slate-300'}
                strokeWidth={1.2}
              />
              <path
                d={`M ${x + 26} ${ry + 14} l 4 -4 l 4 4`}
                fill="none"
                strokeWidth={1.5}
                strokeLinecap="round"
                className={r.mine ? 'stroke-white help-art-as-drawn' : 'stroke-slate-500'}
              />
              <Label
                x={x + 30}
                y={ry + 24}
                anchor="middle"
                size={10}
                weight={700}
                tone={r.mine ? 'onAccent' : 'body'}
              >
                {String(r.votes)}
              </Label>
              {top ? (
                <Label x={x + 50} y={ry + 11} size={10} weight={700} tone="accent">
                  MOST WANTED
                </Label>
              ) : null}
              <Label x={x + 50} y={ry + (top ? 25 : 18)} size={10} weight={600} tone="body">
                {r.text}
              </Label>
              {/* The heat bar: this row's share of the top row's votes. */}
              <rect
                x={x + 12}
                y={ry + 34}
                width={((w - 24) * r.votes) / max}
                height={2}
                rx={1}
                className="fill-brand-400"
              />
            </g>
          );
        })}
        {/* The composer at the foot: the field and its send button, the Anonymous switch under it. */}
        <rect
          x={x + 12}
          y={y + 244}
          width={w - 24}
          height={26}
          rx={13}
          className="fill-white stroke-slate-200"
          strokeWidth={1.2}
        />
        <Label x={x + 24} y={y + 257.5} size={10} tone="muted">
          Add a note…
        </Label>
        <circle cx={x + w - 26} cy={y + 257} r={9} className="fill-brand-500" />
        <path
          d={`M${x + w - 26} ${y + 261.5} V${y + 253} M${x + w - 29.5} ${y + 256} L${x + w - 26} ${y + 252.5} L${x + w - 22.5} ${y + 256}`}
          className="fill-none stroke-white"
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <rect x={x + 14} y={y + 276} width={22} height={14} rx={7} className="fill-slate-200" />
        <circle cx={x + 21} cy={y + 283} r={5} className="fill-white" />
        <Label x={x + 42} y={y + 283.5} size={10} tone="muted">
          As you
        </Label>
      </CollabCard>
    </Scene>
  );
}
