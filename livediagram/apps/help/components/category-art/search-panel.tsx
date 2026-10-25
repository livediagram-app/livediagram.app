import {
  SEARCH_GLYPHS,
  SearchPanelArt as Scene,
} from '@liveworkspace/help-site/art/scenes/search-panel';

// Search Panel: the shared scene (docs/specs/018-help/help-pages.md "Category art"). "roadmap" finds a canvas, a
// tab, a sticky note on a canvas and a help guide.
export function SearchPanelArt() {
  return (
    <Scene
      query="roadmap"
      groups={[
        {
          heading: 'CANVASES',
          rows: [{ glyph: SEARCH_GLYPHS.document, title: 'Product Roadmap', where: 'Team Space' }],
        },
        {
          heading: 'TABS',
          rows: [{ glyph: SEARCH_GLYPHS.tab, title: 'Roadmap Q3', where: 'Launch plan' }],
        },
        {
          heading: 'ELEMENTS',
          rows: [{ glyph: SEARCH_GLYPHS.sticky, title: 'Roadmap review', where: 'Sticky note' }],
        },
        {
          heading: 'HELP',
          rows: [
            { glyph: SEARCH_GLYPHS.help, title: 'Timelines and Roadmaps', where: 'Help Centre' },
          ],
        },
      ]}
    />
  );
}
