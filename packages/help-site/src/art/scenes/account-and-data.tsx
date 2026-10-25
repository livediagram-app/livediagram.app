import type { ReactNode } from 'react';
import { Arrow, Avatar, Label } from '../primitives';
import { Card, Chip, Stage } from '../parts';

// Account and Data: who you are and what is yours. A signed-in profile, your work synced to it, and every way to
// take it with you. The profile, the sync and the export row are the same in every product; the product hands in
// its own work (`documents`, drawn in the box x 222 to 352, y 26 to 136, usually three DocThumbs) and the four
// export formats it really offers.
export function AccountAndDataArt({
  documents,
  formats,
}: {
  documents: ReactNode;
  formats: readonly [string, string, string, string];
}) {
  return (
    <Stage>
      {/* The profile. */}
      <Card x={20} y={30} w={150} h={160} r={14}>
        <rect x={20} y={30} width={150} height={44} rx={14} className="fill-brand-100" />
        <rect x={20} y={60} width={150} height={14} className="fill-brand-100" />
        <Avatar cx={95} cy={76} r={20} initial="A" colour="brand" />
        <Label x={95} y={112} anchor="middle" size={12} weight={700} tone="strong">
          Alex Morgan
        </Label>
        <Label x={95} y={127} anchor="middle" size={9} tone="muted">
          alex@example.com
        </Label>
        <Chip x={52} y={142} label="✓ Signed in" tone="emerald" w={86} />
        <rect x={36} y={170} width={118} height={6} rx={3} className="fill-slate-100" />
      </Card>

      {/* Synced work. */}
      <Arrow from={[178, 104]} to={[214, 104]} dashed tone="muted" width={2} />
      {documents}
      <path
        d="M352 112 a10 10 0 0 1 19 -4 a7 7 0 1 1 3 13 h-21 a5 5 0 0 1 -1 -9 Z"
        className="fill-white stroke-brand-400"
        strokeWidth={1.5}
      />
      <path
        d="M364 118 v-7 m-3 3 l3 -3 3 3"
        className="fill-none stroke-brand-500"
        strokeWidth={1.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Export formats. */}
      <Label x={206} y={158} size={9} weight={700} tone="muted">
        EXPORT
      </Label>
      {formats.map((f, i) => (
        <Chip
          key={f}
          x={206 + i * 44}
          y={168}
          label={f}
          tone={i === 0 ? 'solid' : 'slate'}
          w={40}
          h={22}
          size={10}
        />
      ))}
    </Stage>
  );
}
