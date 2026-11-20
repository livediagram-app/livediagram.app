import {
  SEARCH_GLYPHS,
  SearchPanelArt as Scene,
} from '@liveworkspace/help-site/art/scenes/search-panel';

// Search Panel: the shared scene (liveworkspace/docs/specs/017-help/help-centre.md "Category art"). "lounge" finds a space, a
// tab, a sticky note on its floor and a help guide.
export function SearchPanelArt() {
  return (
    <Scene
      query="lounge"
      groups={[
        {
          heading: 'SPACES',
          rows: [
            { glyph: SEARCH_GLYPHS.document, title: 'Lounge and Kitchen', where: 'Team Space' },
          ],
        },
        {
          heading: 'TABS',
          rows: [{ glyph: SEARCH_GLYPHS.tab, title: 'Lounge', where: 'Our Office' }],
        },
        {
          heading: 'ELEMENTS',
          rows: [{ glyph: SEARCH_GLYPHS.sticky, title: 'Lounge rules', where: 'Sticky note' }],
        },
        {
          heading: 'HELP',
          rows: [{ glyph: SEARCH_GLYPHS.help, title: 'Virtual Office', where: 'Help Centre' }],
        },
      ]}
    />
  );
}
