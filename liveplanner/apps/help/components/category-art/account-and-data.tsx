import { Arrow, Avatar, Label } from '@/components/illustrations/primitives';
import { Card, Chip, DocThumb, Stage } from './parts';

const FORMATS = ['PNG', 'SVG', 'PDF', 'JSON'];

// Account and Data: who you are and what is yours. A signed-in profile, your projects synced to it, and every
// way to take them with you.
export function AccountAndDataArt() {
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

      {/* Synced projects. */}
      <Arrow from={[178, 104]} to={[214, 104]} dashed tone="muted" width={2} />
      <DocThumb x={226} y={28} w={56} h={68} accent="violet" />
      <DocThumb x={294} y={28} w={56} h={68} lines />
      <DocThumb x={260} y={58} w={60} h={74} accent="brand" />
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
      {FORMATS.map((f, i) => (
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
