import {
  SEARCH_GLYPHS,
  SearchPanelArt as Scene,
} from '@liveworkspace/help-site/art/scenes/search-panel';

// Search Panel: the shared scene (docs/specs/018-help/help-pages.md "Category art"). "roadmap" finds a document, a
// tab of its deck, a sticky note on a page and the Timeline guide.
export function SearchPanelArt() {
  return (
    <Scene
      query="roadmap"
      groups={[
        {
          heading: 'DOCUMENTS',
          rows: [{ glyph: SEARCH_GLYPHS.document, title: 'Product Roadmap', where: 'Team Space' }],
        },
        {
          heading: 'TABS',
          rows: [{ glyph: SEARCH_GLYPHS.tab, title: 'Roadmap Q3', where: 'Launch deck' }],
        },
        {
          heading: 'ELEMENTS',
          rows: [{ glyph: SEARCH_GLYPHS.sticky, title: 'Roadmap review', where: 'Sticky note' }],
        },
        {
          heading: 'HELP',
          rows: [{ glyph: SEARCH_GLYPHS.help, title: 'Timeline', where: 'Help Centre' }],
        },
      ]}
    />
  );
}
