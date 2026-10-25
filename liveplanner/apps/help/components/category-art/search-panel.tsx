import {
  SEARCH_GLYPHS,
  SearchPanelArt as Scene,
} from '@liveworkspace/help-site/art/scenes/search-panel';

// A card on a board, as its result row shows it: a white card with a coloured tag.
const CARD = (
  <>
    <rect
      x={-6}
      y={-4.5}
      width={12}
      height={9}
      rx={1.5}
      className="fill-white stroke-current"
      strokeWidth={1.2}
    />
    <rect x={-3.5} y={-2} width={5} height={2} rx={1} className="fill-amber-400" />
  </>
);

// Search Panel: the shared scene (docs/specs/018-help/help-pages.md "Category art"). "roadmap" finds a plan, its
// Roadmap tab, a card (its number, its title and its board's tab) and the Boards guide, in the order the panel
// groups them (Plans, Tabs, Cards, Help).
export function SearchPanelArt() {
  return (
    <Scene
      query="roadmap"
      groups={[
        {
          heading: 'PLANS',
          rows: [{ glyph: SEARCH_GLYPHS.document, title: 'Product Roadmap', where: 'Team Space' }],
        },
        {
          heading: 'TABS',
          rows: [{ glyph: SEARCH_GLYPHS.tab, title: 'Roadmap', where: 'Product Roadmap' }],
        },
        {
          heading: 'CARDS',
          rows: [{ glyph: CARD, title: '#12 Roadmap review', where: 'Roadmap' }],
        },
        {
          heading: 'HELP',
          rows: [{ glyph: SEARCH_GLYPHS.help, title: 'Boards', where: 'Help Centre' }],
        },
      ]}
    />
  );
}
