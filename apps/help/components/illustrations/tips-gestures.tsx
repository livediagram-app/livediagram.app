// Tips-and-tricks scenes (Duplicating Elements): gestures the shared files do
// not draw. Composed from the shared primitives so the house style holds.

import { Scene, Shape, Arrow, SelectionBox, Cursor, Label } from './primitives';

/** Shift-drag duplicate: the original stays put while a translucent ghost of
 *  the copy, its connecting arrow included, follows the pointer. */
export function ShiftDragDuplicate() {
  return (
    <Scene w={420} h={210}>
      <Shape x={40} y={36} w={92} h={46} label="Source" />
      <Shape x={40} y={128} w={92} h={46} accent label="Step" />
      <Arrow from={[86, 82]} to={[86, 128]} />
      <SelectionBox x={40} y={128} w={92} h={46} />
      {/* The ghost of the copy, with its own arrow from Source. */}
      <g opacity={0.45}>
        <Shape x={250} y={128} w={92} h={46} accent label="Step" />
        <Arrow from={[132, 59]} to={[250, 140]} kind="curved" dashed />
      </g>
      <Cursor x={300} y={160} />
      {/* The held Shift key, as the hint bar shows it. */}
      <rect
        x={292}
        y={28}
        width={44}
        height={22}
        rx={5}
        className="fill-white stroke-slate-300"
        strokeWidth={1.5}
      />
      <Label x={314} y={40} anchor="middle" size={10} weight={700} tone="strong">
        Shift
      </Label>
    </Scene>
  );
}
