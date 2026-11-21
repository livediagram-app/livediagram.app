import {
  SEARCH_GLYPHS,
  SearchPanelArt as Scene,
} from '@liveworkspace/help-site/art/scenes/search-panel';

// Search Panel: the shared scene (liveworkspace/docs/specs/017-help/help-centre.md "Category art"). "deploy" finds a
// page of this Knowledgebase first, then another Knowledgebase, a command and a help guide.
export function SearchPanelArt() {
  return (
    <Scene
      query="deploy"
      groups={[
        {
          heading: 'THIS KNOWLEDGEBASE',
          rows: [{ glyph: SEARCH_GLYPHS.document, title: 'Deploying', where: 'Engineering' }],
        },
        {
          heading: 'KNOWLEDGEBASES',
          rows: [{ glyph: SEARCH_GLYPHS.document, title: 'Platform Runbook', where: 'Team Space' }],
        },
        {
          heading: 'COMMANDS',
          rows: [{ glyph: SEARCH_GLYPHS.tab, title: 'New Page', where: 'Command' }],
        },
        {
          heading: 'HELP',
          rows: [{ glyph: SEARCH_GLYPHS.help, title: 'Linking Pages', where: 'Help Centre' }],
        },
      ]}
    />
  );
}
