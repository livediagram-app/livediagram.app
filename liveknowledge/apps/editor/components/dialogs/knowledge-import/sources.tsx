// The three Knowledgebase import sources as the Import dialog offers them
// (docs/specs/020-import-export/knowledgebase-import.md): each a choice beside the single-file formats, with what it
// takes. Notion and Confluence are named in plain text under a generic glyph: no other product's logo is drawn.
import { lucideBookOpen, lucideFolder, lucideLibrary } from '@liveworkspace/icons/lucide';
import { lucideGlyph } from '@liveknowledge/ui';
import type { ImportSource } from '@liveknowledge/knowledge-import';
import type { ComponentType } from 'react';

export type KnowledgeSource = {
  key: ImportSource;
  title: string;
  /** On its card. */
  description: string;
  fileTypes: readonly string[];
  /** Whether a folder can be chosen as well as a `.zip`. */
  folder: boolean;
  /** The drop area's line, for a mouse and for a touch screen. */
  drop: string;
  touch: string;
  /** How to get the file out of the other product. */
  hint: string;
  Icon: ComponentType<{ size?: number }>;
};

export const KNOWLEDGE_SOURCES: readonly KnowledgeSource[] = [
  {
    key: 'markdown-folder',
    title: 'Markdown Folder',
    description:
      'A folder of .md files and pictures, or a .zip of one. Folders become the page tree.',
    fileTypes: ['folder', '.zip'],
    folder: true,
    drop: 'Drop a Folder or a .zip Here',
    touch: 'Choose a Folder or a .zip',
    hint: 'A README.md or index.md becomes its folder’s page.',
    Icon: lucideGlyph(lucideFolder, 24),
  },
  {
    key: 'notion',
    title: 'Notion',
    description: 'A Notion export. Pages keep their nesting, and a database becomes a table.',
    fileTypes: ['.zip'],
    folder: false,
    drop: 'Drop a Notion Export Here',
    touch: 'Choose a Notion Export',
    hint: 'In Notion: Settings › Export, with the format Markdown & CSV.',
    Icon: lucideGlyph(lucideBookOpen, 24),
  },
  {
    key: 'confluence',
    title: 'Confluence',
    description: 'A space exported as HTML. Pages keep the order and nesting of the space.',
    fileTypes: ['.zip'],
    folder: false,
    drop: 'Drop a Confluence Export Here',
    touch: 'Choose a Confluence Export',
    hint: 'In Confluence: Space Settings › Export Space, with the format HTML.',
    Icon: lucideGlyph(lucideLibrary, 24),
  },
];

export const knowledgeSourceOf = (key: ImportSource): KnowledgeSource =>
  KNOWLEDGE_SOURCES.find((s) => s.key === key)!;
