import {
  SEARCH_GLYPHS,
  SearchPanelArt as Scene,
} from '@liveworkspace/help-site/art/scenes/search-panel';

// A sofa from above, the result row's glyph: its seat and its back and arms.
const SOFA_GLYPH = (
  <g className="fill-none stroke-current" strokeWidth={1.3} strokeLinejoin="round">
    <path d="M-6 -4 h12 v8 h-12 Z" />
    <path d="M-6 -1 h12 M-3 -1 v5 M3 -1 v5" />
  </g>
);

// Search Panel: the shared scene (liveworkspace/docs/specs/017-help/help-centre.md "Category art"). "lounge" finds a space, a
// tab, a sofa on its floor and a help guide.
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
          rows: [{ glyph: SOFA_GLYPH, title: 'Lounge Sofa', where: 'Seats' }],
        },
        {
          heading: 'HELP',
          rows: [{ glyph: SEARCH_GLYPHS.help, title: 'Virtual Office', where: 'Help Centre' }],
        },
      ]}
    />
  );
}
