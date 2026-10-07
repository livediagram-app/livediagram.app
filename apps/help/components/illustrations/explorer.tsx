// Explorer-category illustrations (docs/specs/018-help/help-app.md): My documents
// as a folder tree, shared by the Explorer page, Folders and My documents articles.
// The other Explorer scenes live in explorer-structure.tsx, explorer-feeds.tsx and
// explorer-imports.tsx. Composed only from the shared primitives so the house style holds.

import { Scene, Label } from './primitives';
import { SidebarRow } from './explorer-parts';

// --- Scenes ------------------------------------------------------------------

/** My documents as a folder tree: its root folders, nested project folders, then root documents. */
export function MyDocumentsTree() {
  const row = (
    y: number,
    label: string,
    indent: number,
    opts: { glyph?: 'folder' | 'doc'; active?: boolean; open?: boolean } = {},
  ) => (
    <g key={`${label}-${y}`}>
      {opts.glyph !== 'doc' && (
        <path
          d={
            opts.open
              ? `M${52 + indent} ${y + 9} l4 4 l4 -4`
              : `M${54 + indent} ${y + 7} l4 4 l-4 4`
          }
          className="stroke-slate-400"
          strokeWidth={1.6}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      <SidebarRow
        x={64 + indent}
        y={y}
        w={300 - indent}
        label={label}
        indent={0}
        active={opts.active}
        glyph={opts.glyph ?? 'folder'}
      />
    </g>
  );
  return (
    <Scene w={420} h={240} bg="plain">
      <rect
        x={24}
        y={16}
        width={372}
        height={208}
        rx={10}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      <Label x={40} y={32} size={11} weight={700} tone="strong">
        My documents
      </Label>
      <line x1={24} y1={44} x2={396} y2={44} className="stroke-slate-200" strokeWidth={1.5} />
      {row(56, 'Projects', 0, { open: true })}
      {row(82, 'Acme Corp', 24, { open: true })}
      {row(108, 'Kickoff diagram', 48, { glyph: 'doc' })}
      {row(134, 'Architecture', 48, { glyph: 'doc', active: true })}
      {row(160, 'Archive', 0, {})}
      {row(186, 'Quick sketch', 0, { glyph: 'doc' })}
    </Scene>
  );
}
