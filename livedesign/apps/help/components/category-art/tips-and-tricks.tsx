import { Label } from '@/components/illustrations/primitives';
import { Card, Kbd, Sparkle, Stage } from './parts';

const COMMANDS: { name: string; keys: string; active?: boolean }[] = [
  { name: 'Zoom to fit', keys: '⇧ 1', active: true },
  { name: 'Next editor mode', keys: '⇧ D' },
  { name: 'Zen mode', keys: 'Z' },
];

const SHORTCUTS: { key: string; name: string }[] = [
  { key: 'R', name: 'Square' },
  { key: 'T', name: 'Text' },
  { key: 'N', name: 'Sticky note' },
];

// Tips and Tricks: working at the speed of the keyboard. The command palette open on ⌘K, and the single-key
// shortcuts that drop a shape without touching the palette.
export function TipsAndTricksArt() {
  return (
    <Stage>
      <Card x={110} y={14} w={270} h={112} r={12}>
        <path
          d="M124 26 l6 5 -6 5"
          className="fill-none stroke-brand-500"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Label x={138} y={31.5} size={10.5} weight={500} tone="muted">
          Run a command…
        </Label>
        <line x1={110} y1={44} x2={380} y2={44} className="stroke-slate-200" strokeWidth={1} />
        {COMMANDS.map((c, i) => {
          const y = 50 + i * 24;
          return (
            <g key={c.name}>
              {c.active && (
                <rect
                  x={116}
                  y={y}
                  width={258}
                  height={22}
                  rx={6}
                  className="fill-brand-50 stroke-brand-200"
                  strokeWidth={1}
                />
              )}
              <Label
                x={128}
                y={y + 11.5}
                size={10}
                weight={c.active ? 700 : 500}
                tone={c.active ? 'accent' : 'body'}
              >
                {c.name}
              </Label>
              <rect x={326} y={y + 4} width={40} height={14} rx={4} className="fill-slate-100" />
              <Label x={346} y={y + 11.5} anchor="middle" size={8.5} weight={700} tone="body">
                {c.keys}
              </Label>
            </g>
          );
        })}
      </Card>

      {/* ⌘ + K, pressed. */}
      <Kbd x={24} y={30} w={34} h={34} label="⌘" active />
      <Label x={68} y={48} anchor="middle" size={14} weight={700} tone="muted">
        +
      </Label>
      <Kbd x={78} y={30} w={34} h={34} label="K" active />
      <Sparkle cx={36} cy={86} r={9} className="fill-amber-400" />
      <Sparkle cx={56} cy={100} r={4.5} className="fill-amber-300" />

      {/* Single-key shortcuts. */}
      {SHORTCUTS.map((s, i) => {
        const x = 40 + i * 116;
        return (
          <g key={s.key}>
            <Kbd x={x} y={148} w={38} h={38} label={s.key} />
            <Label x={x + 48} y={163} size={10.5} weight={700} tone="strong">
              {s.name}
            </Label>
            <Label x={x + 48} y={177} size={9} tone="muted">
              {`Press ${s.key}`}
            </Label>
          </g>
        );
      })}
    </Stage>
  );
}
