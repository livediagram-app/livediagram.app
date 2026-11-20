// Undo and Redo on a livedesign page (liveworkspace/docs/specs/017-help/help-centre.md): the change being stepped
// back or put back on a phone screen, the keys that do it, and the Undo / Redo card in the corner controls.

import { Label, Scene } from '@liveworkspace/help-site/art/primitives';
import { CornerControls, DesignPage } from './editor-chrome';
import { PhoneScreen } from './design-content';

function Keycap({ x, y, keys }: { x: number; y: number; keys: string }) {
  const w = keys.length * 7 + 14;
  return (
    <g>
      <rect x={x} y={y + 1.5} width={w} height={20} rx={5} className="fill-slate-200" />
      <rect
        x={x}
        y={y}
        width={w}
        height={20}
        rx={5}
        className="fill-white stroke-slate-300"
        strokeWidth={0.75}
      />
      <Label x={x + w / 2} y={y + 10.5} size={10} weight={600} anchor="middle" tone="strong">
        {keys}
      </Label>
    </g>
  );
}

function StepScene({ redo }: { redo: boolean }) {
  return (
    <Scene w={420} h={220}>
      <DesignPage x={60} y={34} w={124} h={160} size="iPhone · Wireframe" bare>
        <PhoneScreen
          x={68}
          y={42}
          w={108}
          h={146}
          variant="product"
          cta="Add to Cart"
          frame={false}
        />
      </DesignPage>
      {/* The badge the step adds or takes away. */}
      <g opacity={redo ? 1 : 0.35}>
        <rect
          x={140}
          y={60}
          width={34}
          height={14}
          rx={7}
          className={redo ? 'fill-amber-400' : 'fill-none stroke-amber-500'}
          strokeWidth={1}
          strokeDasharray={redo ? undefined : '3 2'}
        />
        <Label
          x={157}
          y={67.5}
          size={8}
          weight={700}
          anchor="middle"
          className={redo ? 'fill-slate-800 help-art-as-drawn' : 'fill-amber-600'}
        >
          Sale
        </Label>
      </g>
      <Keycap x={236} y={70} keys={redo ? '⌘ ⇧ Z' : '⌘ Z'} />
      <Label x={236} y={104} size={10} tone="body">
        {redo ? 'Redo puts the Sale badge back' : 'Undo takes the Sale badge away'}
      </Label>
      <CornerControls right={410} y={182} level="60%" />
      <rect
        x={redo ? 266.5 : 244}
        y={182}
        width={22.5}
        height={22}
        rx={6}
        fill="none"
        className="stroke-brand-500"
        strokeWidth={1.25}
      />
    </Scene>
  );
}

/** Undo: the badge just added fades away, ⌘ Z, and Undo pressed in the corner. */
export function UndoStep() {
  return <StepScene redo={false} />;
}

/** Redo: the badge comes back, ⌘ ⇧ Z, and Redo pressed in the corner. */
export function RedoStep() {
  return <StepScene redo />;
}
