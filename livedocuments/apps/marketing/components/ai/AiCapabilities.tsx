import {
  lucideFileText,
  lucideLayoutGrid,
  lucidePresentation,
  lucideSearch,
  lucideShare2,
  lucideUndo2,
} from '@liveworkspace/icons/lucide';
import { lucideGlyph } from '@livedocuments/ui';
import {
  AiCapabilityGrid,
  type AiCapability,
} from '@liveworkspace/marketing-site/components/ai/AiCapabilityGrid';

// What it can do (docs/specs/019-marketing/build-with-ai.md "The page" 5): the MCP's tools in plain words. Every
// card maps to a shipped tool (docs/specs/015-api/mcp-server.md §4); a new tool earns a card here only once it ships.
const CAPABILITIES: readonly AiCapability[] = [
  {
    icon: lucideGlyph(lucideFileText, 20),
    title: 'Articles',
    body: 'Written up in Markdown and flowed onto pages, then read back and revised whenever you ask.',
  },
  {
    icon: lucideGlyph(lucidePresentation, 20),
    title: 'Slides and posters',
    body: 'Decks from ready-made slide layouts and infographics from page layouts, all on pages you can polish by hand.',
  },
  {
    icon: lucideGlyph(lucideLayoutGrid, 20),
    title: 'Templates',
    body: 'Starts a document from any template in the library, from a resume to a launch keynote, then fills it in.',
  },
  {
    icon: lucideGlyph(lucideSearch, 20),
    title: 'Find and read',
    body: 'Searches your documents and your teams’, and reads any tab back as an outline and a picture.',
  },
  {
    icon: lucideGlyph(lucideShare2, 20),
    title: 'Share links',
    body: 'Turns a document into a link for your team, at the level of access you ask for.',
  },
  {
    icon: lucideGlyph(lucideUndo2, 20),
    title: 'Live, and undoable',
    body: 'Changes land on an open document as they happen, outlined so you can see them, with Undo one click away.',
  },
];

export function AiCapabilities() {
  return <AiCapabilityGrid items={CAPABILITIES} />;
}
