import {
  lucideCircle,
  lucideCircleHelp,
  lucideFolder,
  lucidePanelsTopLeft,
  lucideShare2,
  lucideSlidersHorizontal,
  lucideSquarePlus,
  lucideUsers,
  lucideZap,
} from '@livediagram/icons/lucide';
import type { IconPrim } from '@livediagram/icons';
import type { SearchResultItem } from '@/lib/search';
import { DiagramIcon } from '@/components/primitives/explorer-icons';
import { Glyph, Prims } from '@livediagram/ui';

// The search panel's result-kind glyphs (docs/specs/008-canvas/canvas-and-palette.md Search panel), lifted
// out of SearchPanel: a compact icon per result kind so users can scan
// the list by shape without reading labels. The input's magnifier is the
// shared SearchIcon from @livediagram/ui.

// One glyph per result kind, the same ones the rest of the editor uses for that thing, so the
// list scans by shape without reading labels. A palette result ADDS (plus-in-a-box); a command DOES
// (a bolt); a setting opens Settings (its sliders).
const KIND_PRIMS: Partial<Record<SearchResultItem['kind'], readonly IconPrim[]>> = {
  shared: lucideShare2,
  team: lucideUsers,
  folder: lucideFolder,
  tab: lucidePanelsTopLeft,
  palette: lucideSquarePlus,
  command: lucideZap,
  setting: lucideSlidersHorizontal,
  help: lucideCircleHelp,
};

export function SearchResultIcon({ item }: { item: SearchResultItem }) {
  if (item.kind === 'diagram') return <DiagramIcon size={13} />;
  return (
    <Glyph size={13} units={24}>
      <Prims prims={KIND_PRIMS[item.kind] ?? lucideCircle} />
    </Glyph>
  );
}
