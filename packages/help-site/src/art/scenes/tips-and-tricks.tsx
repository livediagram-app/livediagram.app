import { Label } from '../primitives';
import { Card, Kbd, Sparkle, Stage } from '../parts';

/** A row in the open command palette: its name as the editor lists it, its key if it has one. */
export type TipCommand = { name: string; keys?: string };

/** A key and what it does, with where it works (it reads "Press <key>" when left out). */
export type TipShortcut = { key: string; name: string; where?: string };

// Tips and Tricks: working at the speed of the keyboard. The command palette open on ⌘K, and three keys that do
// a job without touching the mouse. The palette and the keycaps are the same in every product; the product hands
// in three of its own commands (the first one highlighted) and three of its own keys, checked against its Keyboard
// Shortcuts and Command Palette articles.
export function TipsAndTricksArt({
  commands,
  shortcuts,
}: {
  commands: readonly [TipCommand, TipCommand, TipCommand];
  shortcuts: readonly [TipShortcut, TipShortcut, TipShortcut];
}) {
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
        {commands.map((c, i) => {
          const y = 50 + i * 24;
          const active = i === 0;
          return (
            <g key={c.name}>
              {active && (
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
                weight={active ? 700 : 500}
                tone={active ? 'accent' : 'body'}
              >
                {c.name}
              </Label>
              {c.keys && (
                <>
                  <rect
                    x={326}
                    y={y + 4}
                    width={40}
                    height={14}
                    rx={4}
                    className="fill-slate-100"
                  />
                  <Label x={346} y={y + 11.5} anchor="middle" size={8.5} weight={700} tone="body">
                    {c.keys}
                  </Label>
                </>
              )}
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

      {/* Keys that do a job on their own. */}
      {shortcuts.map((s, i) => {
        const x = 40 + i * 116;
        return (
          <g key={s.key}>
            <Kbd x={x} y={148} w={38} h={38} label={s.key} />
            <Label x={x + 48} y={163} size={10.5} weight={700} tone="strong">
              {s.name}
            </Label>
            <Label x={x + 48} y={177} size={9} tone="muted">
              {s.where ?? `Press ${s.key}`}
            </Label>
          </g>
        );
      })}
    </Stage>
  );
}
