// The 3D View (docs/specs/008-canvas/3d-view.md, liveworkspace/docs/specs/017-help/help-centre.md): a room seen through the tilted
// camera while you walk, and the bottom-right cluster's Turn Left, Turn Right and 3D buttons
// (apps/editor/components/canvas/space-3d/Space3DButton.tsx).
//
// What it shows is lifted from the spec: the floor tilted back, the room's walls standing with its name on a sign over
// the doorway, the wall on your side faded so the room is open to you, a usable piece glowing, and your character
// standing upright in the middle.

import { Button, Label, Scene } from '@liveworkspace/help-site/art/primitives';
import { PixelCharacter } from './pixel-character';

/** A quarter-turn arrow, curling left (`dir` -1) or right (1), centred on the origin. */
function TurnGlyph({ dir }: { dir: -1 | 1 }) {
  return (
    <g transform={dir === -1 ? 'scale(-1 1)' : undefined}>
      <path
        d="M-5 2a5 5 0 1 0 1.5-5.5"
        className="stroke-slate-600"
        strokeWidth={1.6}
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M-4.5 -7.5v4h4"
        className="stroke-slate-600"
        strokeWidth={1.6}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  );
}

/** A room in the 3D View: its floor tilted back, its back and side walls standing, the doorway in the back wall with
 *  the room's name over it, the near wall faded, a Notice Board glowing under the pointer, and your character. Below
 *  it, Turn Left, Turn Right and the lit 3D button. */
export function Space3DScene() {
  // The floor: a trapezoid, its far edge (top) narrower than its near edge (bottom).
  const far = { y: 78, l: 118, r: 302 };
  const near = { y: 190, l: 34, r: 386 };
  const wallH = 42;
  const door = { l: 192, r: 228 };
  return (
    <Scene w={420} h={250} bg="none">
      {/* The floor, with a few boards running away from you. */}
      <path
        d={`M${far.l} ${far.y}H${far.r}L${near.r} ${near.y}H${near.l}Z`}
        className="fill-amber-100 stroke-amber-300"
        strokeWidth={1}
      />
      {[0.25, 0.5, 0.75].map((t) => (
        <path
          key={t}
          d={`M${far.l + (far.r - far.l) * t} ${far.y}L${near.l + (near.r - near.l) * t} ${near.y}`}
          className="stroke-amber-200"
          strokeWidth={1}
        />
      ))}

      {/* The side walls, standing up from the floor's edges. */}
      <path
        d={`M${far.l} ${far.y}V${far.y - wallH}L${near.l} ${near.y - wallH - 26}V${near.y}Z`}
        className="fill-slate-100 stroke-slate-300"
        strokeWidth={1.2}
      />
      <path
        d={`M${far.r} ${far.y}V${far.y - wallH}L${near.r} ${near.y - wallH - 26}V${near.y}Z`}
        className="fill-slate-100 stroke-slate-300"
        strokeWidth={1.2}
      />

      {/* The back wall, with the doorway cut in it. */}
      <path
        d={`M${far.l} ${far.y}V${far.y - wallH}H${far.r}V${far.y}H${door.r}V${far.y - 30}H${door.l}V${far.y}Z`}
        className="fill-white stroke-slate-300"
        strokeWidth={1.2}
      />
      <path
        d={`M${door.l} ${far.y}V${far.y - 30}H${door.r}V${far.y}`}
        className="stroke-amber-800"
        strokeWidth={2.5}
        fill="none"
      />
      {/* The room's name, on a sign over the doorway. */}
      <rect
        x={door.l - 14}
        y={far.y - wallH + 2}
        width={door.r - door.l + 28}
        height={10}
        rx={2}
        className="fill-slate-700"
      />
      <Label
        x={(door.l + door.r) / 2}
        y={far.y - wallH + 7.5}
        size={7}
        weight={700}
        anchor="middle"
        tone="onAccent"
      >
        Meeting Room
      </Label>

      {/* A Notice Board hung on the back wall, glowing because it has a control of its own. */}
      <rect
        x={128}
        y={far.y - 36}
        width={42}
        height={26}
        rx={3}
        className="fill-none stroke-brand-300"
        strokeWidth={5}
        opacity={0.6}
      />
      <rect
        x={128}
        y={far.y - 36}
        width={42}
        height={26}
        rx={2}
        className="fill-amber-200 stroke-amber-700"
        strokeWidth={1.5}
      />
      <rect x={134} y={far.y - 32} width={12} height={9} className="fill-amber-50" />
      <rect x={151} y={far.y - 30} width={12} height={9} className="fill-emerald-100" />

      {/* A table standing on the floor, and your character upright in the middle. */}
      <path d="M244 128h56l8 20h-72z" className="fill-amber-700" />
      <path d="M240 148v16M304 148v16" className="stroke-amber-800" strokeWidth={3} />
      <PixelCharacter fx={204} fy={172} px={3} />

      {/* The near wall, faded so it never hides you or the room. */}
      <path
        d={`M${near.l} ${near.y}V${near.y - 20}H${near.r}V${near.y}Z`}
        className="fill-slate-200 stroke-slate-300"
        strokeWidth={1}
        strokeDasharray="4 3"
        opacity={0.35}
      />

      {/* The bottom-right cluster while 3D is on: Turn Left, Turn Right, then the lit 3D switch. */}
      <Button x={260} y={210} w={30} h={28} />
      <g transform="translate(275 225)">
        <TurnGlyph dir={-1} />
      </g>
      <Button x={296} y={210} w={30} h={28} />
      <g transform="translate(311 225)">
        <TurnGlyph dir={1} />
      </g>
      <Button x={332} y={210} w={54} h={28} label="3D" variant="primary" />
      <Label x={256} y={224} size={10} weight={600} tone="muted" anchor="end">
        [ and ] turn
      </Label>
    </Scene>
  );
}
