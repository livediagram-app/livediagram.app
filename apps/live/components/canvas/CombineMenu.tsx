'use client';

// Combine (docs/specs/007-editor/logo-pages.md "Combine"): the four operations as tiles, and the
// multi-selection toolbar's Combine button that opens them. The selection menu's Combine section
// shows the same tiles (MultiSelectionContextMenu).
import { useState } from 'react';
import { HoverCard, Glyph } from '@livediagram/ui';
import { PortalMenu } from '@/components/primitives/PortalMenu';
import { MenuTile, MenuTileGrid } from '@/components/primitives/MenuTiles';
import { TOOLBAR_BTN, TOOLBAR_BTN_ON } from '@/components/canvas/toolbar-buttons';
import type { CombineOp } from '@/lib/combine/combine';

const COMBINE_CHOICES: readonly { op: CombineOp; label: string }[] = [
  { op: 'unite', label: 'Unite' },
  { op: 'subtract', label: 'Subtract' },
  { op: 'intersect', label: 'Intersect' },
  { op: 'exclude', label: 'Exclude' },
];

/** The four operations as a two-by-two grid of tiles. */
export function CombineTiles({ onCombine }: { onCombine: (op: CombineOp) => void }) {
  return (
    <MenuTileGrid cols={2}>
      {COMBINE_CHOICES.map((c) => (
        <MenuTile
          key={c.op}
          label={c.label}
          icon={<CombineOpGlyph op={c.op} />}
          onClick={() => onCombine(c.op)}
        />
      ))}
    </MenuTileGrid>
  );
}

export function CombineMenuButton({ onCombine }: { onCombine: (op: CombineOp) => void }) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  return (
    <>
      <HoverCard title="Combine" description="Make one shape of these: unite, subtract and more.">
        <button
          ref={setAnchor}
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label="Combine shapes"
          aria-haspopup="menu"
          aria-expanded={open}
          className={open ? TOOLBAR_BTN_ON : TOOLBAR_BTN}
        >
          <CombineOpGlyph op="unite" size={14} />
        </button>
      </HoverCard>
      {open ? (
        <PortalMenu anchor={anchor} placement="below" onClose={() => setOpen(false)}>
          <CombineTiles
            onCombine={(op) => {
              setOpen(false);
              onCombine(op);
            }}
          />
        </PortalMenu>
      ) : null}
    </>
  );
}

// Two overlapping squares, the part each operation keeps filled.
export function CombineOpGlyph({ op, size = 20 }: { op: CombineOp; size?: number }) {
  const a = 'M2.5 2.5h7v7h-7z';
  const b = 'M6.5 6.5h7v7h-7z';
  const overlap = 'M6.5 6.5h3v3h-3z';
  const fill = 'currentColor';
  return (
    <Glyph size={size} units={16}>
      {op === 'unite' ? <path d={`${a} ${b}`} fill={fill} fillOpacity={0.35} /> : null}
      {op === 'subtract' ? (
        <path d={`${a} ${overlap}`} fill={fill} fillOpacity={0.35} fillRule="evenodd" />
      ) : null}
      {op === 'intersect' ? <path d={overlap} fill={fill} fillOpacity={0.6} /> : null}
      {op === 'exclude' ? (
        <path d={`${a} ${b}`} fill={fill} fillOpacity={0.35} fillRule="evenodd" />
      ) : null}
      <path d={a} />
      <path d={b} strokeDasharray={op === 'subtract' ? '1.5 1.5' : undefined} />
    </Glyph>
  );
}
