import { Arrow, Label } from '@/components/illustrations/primitives';
import { Card, Chip, Stage } from './parts';

const LINES: { text: string; tone: string }[] = [
  { text: '$ pnpm deploy', tone: 'fill-slate-100' },
  { text: '✓ api      ready', tone: 'fill-emerald-300' },
  { text: '✓ live     ready', tone: 'fill-emerald-300' },
  { text: '✓ router   ready', tone: 'fill-emerald-300' },
  { text: '→ diagrams.acme.dev', tone: 'fill-sky-300' },
];

// Self-Hosting: your own copy, on your own infrastructure. A server rack, the terminal that deployed to it,
// and the editor answering at your own domain.
export function SelfHostingArt() {
  return (
    <Stage>
      {/* The rack. */}
      <Card x={26} y={40} w={92} h={142} r={10}>
        {[0, 1, 2, 3].map((i) => {
          const y = 52 + i * 31;
          return (
            <g key={i}>
              <rect
                x={36}
                y={y}
                width={72}
                height={24}
                rx={5}
                className="fill-slate-100 stroke-slate-200"
                strokeWidth={1}
              />
              <circle
                cx={46}
                cy={y + 12}
                r={3}
                className={i === 3 ? 'fill-amber-400' : 'fill-emerald-400'}
              />
              <circle cx={56} cy={y + 12} r={3} className="fill-brand-300" />
              {[0, 1, 2, 3].map((k) => (
                <rect
                  key={k}
                  x={72 + k * 8}
                  y={y + 7}
                  width={4}
                  height={10}
                  rx={1}
                  className="fill-slate-300"
                />
              ))}
            </g>
          );
        })}
      </Card>
      <Arrow from={[122, 112]} to={[150, 112]} dashed tone="muted" width={2} />

      {/* The terminal, as drawn in both appearances. */}
      <g className="help-art-as-drawn">
        <rect
          x={156}
          y={30}
          width={220}
          height={124}
          rx={12}
          className="fill-slate-900/[0.08]"
          transform="translate(2 6)"
        />
        <rect x={156} y={30} width={220} height={124} rx={12} className="fill-slate-900" />
        <circle cx={170} cy={44} r={3} className="fill-rose-400" />
        <circle cx={180} cy={44} r={3} className="fill-amber-400" />
        <circle cx={190} cy={44} r={3} className="fill-emerald-400" />
        <Label x={266} y={44.5} anchor="middle" size={8.5} weight={600} className="fill-slate-400">
          ~/liveplanner
        </Label>
        {LINES.map((l, i) => (
          <text
            key={l.text}
            x={170}
            y={70 + i * 17}
            fontSize={10}
            dominantBaseline="middle"
            className={l.tone}
            style={{
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              whiteSpace: 'pre',
            }}
          >
            {l.text}
          </text>
        ))}
      </g>

      <Chip x={156} y={170} label="MIT licensed" tone="violet" h={22} size={9.5} />
      <Chip x={248} y={170} label="Every feature included" tone="emerald" h={22} size={9.5} />
    </Stage>
  );
}
