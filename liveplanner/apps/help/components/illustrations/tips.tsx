// Tips-and-tricks illustrations (docs/specs/018-help/help-app.md): keyboard shortcuts and their toggle,
// the palette strip as a quick-add launchpad, and Zen mode. Format-painter and theme scenes are reused
// from canvas.tsx, not redrawn. Composed only from the shared primitives.

import { Scene, Panel, Label, TextBar } from '@liveworkspace/help-site/art/primitives';

/** Settings › Keyboard: the Keyboard Shortcuts switch, turned off, above the
 *  All Shortcuts reference it gates. */
export function ShortcutsToggle() {
  return (
    <Scene w={420} h={200} bg="plain">
      <Panel x={86} y={28} w={248} h={144} title="KEYBOARD">
        <Label x={102} y={72} size={10} weight={600} tone="strong">
          Keyboard Shortcuts
        </Label>
        <TextBar x={102} y={88} w={150} tone="faint" />
        {/* Toggle switch, set off */}
        <rect x={284} y={62} width={36} height={20} rx={10} className="fill-slate-200" />
        <circle cx={294} cy={72} r={7} className="fill-white help-art-as-drawn" />
        <line x1={102} y1={112} x2={318} y2={112} className="stroke-slate-200" strokeWidth={1.5} />
        <Label x={102} y={132} size={10} weight={600} tone="strong">
          All Shortcuts
        </Label>
        <TextBar x={102} y={148} w={120} tone="faint" />
      </Panel>
    </Scene>
  );
}
