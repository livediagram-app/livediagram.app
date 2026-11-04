// Animating Elements in a Space (docs/specs/028-animation/element-animations.md, docs/specs/018-help/help-app.md):
// what a meeting board animates, a sticky note fluttering and a frame pulsing, drawn from the shared primitives.
// livediagram's figure (@liveworkspace/help-site's ElementAnimation) shows an arrow's flow, which a Space has no
// tools to draw.
import { Label, Scene, TextBar } from '@liveworkspace/help-site/art/primitives';

/** A sticky note with Flutter (its bottom edge lifting, motion ticks beside it) and a frame with Pulse (rings
 *  following its outline). */
export function SpaceAnimation() {
  const note = { x: 58, y: 64, w: 96, h: 84 };
  const frame = { x: 236, y: 70, w: 116, h: 72 };
  return (
    <Scene w={400} h={240}>
      {/* Flutter: the note's bottom edge curls up as if in a breeze, and its shadow follows. */}
      <path
        d={`M${note.x} ${note.y} h${note.w} v${note.h - 10} q-${note.w / 2} 22 -${note.w} 6 z`}
        className="fill-slate-900/10"
        transform="translate(3 4)"
      />
      <path
        d={`M${note.x} ${note.y} h${note.w} v${note.h - 10} q-${note.w / 2} 22 -${note.w} 6 z`}
        className="fill-amber-100"
      />
      <TextBar x={note.x + 14} y={note.y + 22} w={60} />
      <TextBar x={note.x + 14} y={note.y + 36} w={48} tone="faint" />
      {[0, 1, 2].map((i) => (
        <path
          key={i}
          d={`M${note.x + note.w + 10} ${note.y + 52 + i * 12} q8 -4 16 0`}
          className="fill-none stroke-brand-300"
          strokeWidth={2}
          strokeLinecap="round"
        />
      ))}
      <Label x={note.x + note.w / 2} y={186} anchor="middle" size={11} tone="muted">
        Sticky: Flutter
      </Label>

      {/* Pulse: rings the shape of the frame's outline, spreading out. */}
      <rect
        x={frame.x - 14}
        y={frame.y - 14}
        width={frame.w + 28}
        height={frame.h + 28}
        rx={18}
        className="fill-none stroke-brand-100"
        strokeWidth={2}
      />
      <rect
        x={frame.x - 7}
        y={frame.y - 7}
        width={frame.w + 14}
        height={frame.h + 14}
        rx={13}
        className="fill-none stroke-brand-200"
        strokeWidth={2}
      />
      <rect
        x={frame.x}
        y={frame.y}
        width={frame.w}
        height={frame.h}
        rx={8}
        className="fill-white stroke-brand-400"
        strokeWidth={2}
      />
      <Label x={frame.x + 12} y={frame.y + 20} size={11} weight={700} tone="strong">
        Agenda
      </Label>
      <TextBar x={frame.x + 12} y={frame.y + 36} w={70} tone="faint" />
      <TextBar x={frame.x + 12} y={frame.y + 48} w={54} tone="faint" />
      <Label x={frame.x + frame.w / 2} y={186} anchor="middle" size={11} tone="muted">
        Shape: Pulse
      </Label>
    </Scene>
  );
}
