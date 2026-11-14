'use client';

// The element menu's Type section (docs/specs/009-elements/office.md "A piece's type"): a placed Door, Rug, Corridor or
// Meeting Table changes its type in place, one tile per type with its palette card's glyph and name. The element menu
// and the selection menu both render it, and only an Editor's (EditorContextMenuHost hands a Participant or a Viewer
// its own short menu).

import { pieceTypeFits, pieceVariant, type Element, type ShapeElement } from '@livehuddle/document';
import { HoverCard } from '@liveworkspace/ui';
import { MenuAccordionSection } from '@liveworkspace/workbench/components/primitives/PortalMenu';
import { MenuTile, MenuTileGrid } from '@liveworkspace/workbench/components/primitives/MenuTiles';
import { TypeMenuGlyph } from '@/components/palette/context-menu-icons';
import { pieceTypeChoices } from './piece-type-tiles';

const HINT: Record<string, string> = {
  door: 'It stays on its wall, keeping its angle and colour.',
  rug: 'It keeps its colour and where it lies; each type has its own size.',
  corridor: 'It keeps its turn and where it stands; each shape has its own size.',
  'meeting-table': 'It keeps its facing and where it stands. A Long Table seats sixteen.',
};

export function PieceTypeMenuSection({
  target,
  elements,
  sectionProps,
  onSetType,
}: {
  // The piece whose type the tiles show; in the selection menu, the one right-clicked.
  target: ShapeElement;
  // The tab's elements: the walls a Door stands on, so a type too wide for its wall is offered disabled.
  elements: readonly Element[];
  sectionProps: (id: string) => { open: boolean; onToggle: () => void };
  onSetType: (kind: string, type: string) => void;
}) {
  const choices = pieceTypeChoices(target.shape);
  if (choices.length === 0) return null;
  const current = pieceVariant(target);
  return (
    <MenuAccordionSection title="Type" icon={<TypeMenuGlyph />} {...sectionProps('piece-type')}>
      {/* Two columns while every name fits on one line (Double Door, T-Junction), three for the eight rugs. */}
      <MenuTileGrid cols={choices.length > 4 ? 3 : 2}>
        {choices.map((c) => {
          const fits = pieceTypeFits(target, c.type, elements);
          const tile = (
            <MenuTile
              key={c.type}
              icon={c.icon}
              label={c.label}
              active={current === c.type}
              disabled={!fits}
              onClick={() => onSetType(target.shape, c.type)}
            />
          );
          return fits ? (
            tile
          ) : (
            // A Door wider than the wall it stands on would stick out past the wall's end.
            <HoverCard
              key={c.type}
              block
              pressWithText
              className="[&>button]:w-full"
              title="Too Wide for This Wall"
              description={`A ${c.label} is wider than the wall this door stands on. Move the door to a longer wall first.`}
            >
              {tile}
            </HoverCard>
          );
        })}
      </MenuTileGrid>
      <p className="px-2 pb-1.5 pt-1 text-[10px] leading-snug text-slate-500 dark:text-slate-400">
        {HINT[target.shape]}
      </p>
    </MenuAccordionSection>
  );
}
