import type { ReactNode } from 'react';
import { Label } from '../primitives';
import { Card, Stage } from '../parts';

// Tools: the editor's helpers. The appearance switch set to Dark and the Zen mode switch, down the left, are the
// same in every product; the product hands in its own helper (`children`), drawn across the top left (a card in
// x 22 to 222, y 22 to 100) and down the right (x 236 to 390), from what its Tools articles really cover.
export function ToolsArt({ children }: { children: ReactNode }) {
  return (
    <Stage>
      {children}

      {/* Appearance. */}
      <Card x={22} y={116} w={200} h={36} r={10}>
        <rect x={30} y={123} width={60} height={22} rx={6} className="fill-transparent" />
        <circle cx={42} cy={134} r={4} className="fill-amber-400" />
        <path
          d="M42 126 v2 M42 140 v2 M34 134 h2 M48 134 h2 M36.5 128.5 l1.4 1.4 M46.1 138.1 l1.4 1.4 M36.5 139.5 l1.4 -1.4 M46.1 129.9 l1.4 -1.4"
          className="stroke-amber-400"
          strokeWidth={1.3}
          strokeLinecap="round"
        />
        <Label x={54} y={134.5} size={9.5} weight={500} tone="body">
          Light
        </Label>
        <rect
          x={92}
          y={122}
          width={64}
          height={24}
          rx={7}
          className="fill-slate-800 help-art-as-drawn"
        />
        <path
          d="M108 128 a6 6 0 1 0 6 8.5 a5 5 0 0 1 -6 -8.5 Z"
          className="fill-brand-200 help-art-as-drawn"
        />
        <Label x={120} y={134.5} size={9.5} weight={700} className="fill-white help-art-as-drawn">
          Dark
        </Label>
        <Label x={170} y={134.5} size={9.5} weight={500} tone="body">
          System
        </Label>
      </Card>

      {/* Zen mode. */}
      <Card x={22} y={166} w={130} h={36} r={10}>
        <path
          d="M34 184 c4 -6 14 -6 18 0 c-4 6 -14 6 -18 0 Z"
          className="fill-none stroke-slate-500"
          strokeWidth={1.4}
        />
        <path
          d="M33 192 l20 -16"
          className="stroke-slate-500"
          strokeWidth={1.4}
          strokeLinecap="round"
        />
        <Label x={62} y={184.5} size={9.5} weight={600} tone="body">
          Zen mode
        </Label>
        <rect x={112} y={177} width={30} height={16} rx={8} className="fill-brand-500" />
        <circle cx={134} cy={185} r={6} className="fill-white help-art-as-drawn" />
      </Card>
    </Stage>
  );
}
