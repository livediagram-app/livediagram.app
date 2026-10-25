import { Cursor, Label, SelectionBox } from '@liveworkspace/help-site/art/primitives';
import { Card, Stage } from '@liveworkspace/help-site/art/parts';
import { MiniWireframe } from '@liveworkspace/help-site/art/work';

// Canvas: a design's pages side by side on the canvas. A logo artboard with its construction circle and the mark
// selected (its rotate handle above it), a phone wireframe beside it, and the undo and zoom controls in their corners.
export function CanvasArt() {
  return (
    <Stage>
      {/* The logo artboard. */}
      <Label x={34} y={24} size={8.5} weight={600} tone="muted">
        1024 x 1024 · Logo
      </Label>
      <Card x={34} y={32} w={140} h={140} r={4}>
        <circle
          cx={104}
          cy={102}
          r={50}
          className="fill-none stroke-sky-300"
          strokeWidth={1}
          strokeDasharray="4 4"
        />
        <path
          d="M104 32 V172 M34 102 H174"
          className="fill-none stroke-sky-200"
          strokeWidth={0.8}
        />
        <path d="M104 68 L138 128 H70 Z" className="fill-brand-500" />
        <circle cx={104} cy={106} r={12} className="fill-white help-art-as-drawn" />
        <Label x={104} y={160} anchor="middle" size={10} weight={800} tone="strong">
          PEAK
        </Label>
      </Card>
      <SelectionBox x={66} y={64} w={76} h={68} />
      {/* The rotate handle. */}
      <line x1={104} y1={64} x2={104} y2={52} className="stroke-brand-500" strokeWidth={1.2} />
      <circle cx={104} cy={50} r={3.5} className="fill-white stroke-brand-500" strokeWidth={1.4} />
      <Cursor x={136} y={124} colour="brand" />

      {/* The phone wireframe. */}
      <Label x={206} y={24} size={8.5} weight={600} tone="muted">
        iPhone · Wireframe
      </Label>
      <rect x={206} y={32} width={84} height={160} rx={14} className="fill-slate-800" />
      <MiniWireframe x={210} y={36} w={76} h={152} />

      {/* A sticky note beside the screens. */}
      <rect
        x={306}
        y={44}
        width={74}
        height={56}
        rx={3}
        className="fill-amber-100 stroke-amber-300"
        strokeWidth={1}
      />
      <Label x={314} y={60} size={8.5} weight={600} className="fill-amber-800 dark:fill-amber-200">
        Try the mark
      </Label>
      <Label x={314} y={73} size={8.5} weight={600} className="fill-amber-800 dark:fill-amber-200">
        on the splash
      </Label>

      {/* Undo and zoom. */}
      <Card x={14} y={184} w={56} h={24} r={8}>
        <path
          d="M30 192 l-4 4 4 4 M26 196 h8 a4 4 0 0 1 0 8 h-2"
          className="fill-none stroke-slate-500"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M54 192 l4 4 -4 4 M58 196 h-8 a4 4 0 0 0 0 8 h2"
          className="fill-none stroke-slate-400"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Card>
      <Card x={298} y={184} w={88} h={24} r={8}>
        <Label x={312} y={196.5} anchor="middle" size={13} weight={600} tone="body">
          −
        </Label>
        <Label x={342} y={196.5} anchor="middle" size={10} weight={700} tone="strong">
          100%
        </Label>
        <Label x={372} y={196.5} anchor="middle" size={13} weight={600} tone="body">
          +
        </Label>
      </Card>
    </Stage>
  );
}
