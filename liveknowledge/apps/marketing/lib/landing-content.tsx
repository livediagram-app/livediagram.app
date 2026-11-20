import type { ReactNode } from 'react';

import {
  AgentsArt,
  AskArt,
  ImportExportArt,
  PagesArt,
  TrustArt,
  WorkspaceArt,
} from '@/components/FeatureArt';

/**
 * A feature section of the landing page (docs/specs/019-marketing/marketing-site.md "Feature sections"): one
 * thing liveknowledge does, told as a story beat with its own art. Pure data plus its drawing; every sentence is
 * something a visitor can do today (the spec's golden rule), and lib/product-claims.test.ts keeps out what the
 * fork brought and liveknowledge cut.
 */
export type LandingSection = {
  /** The section's anchor on the landing page (`/#import`). */
  id: string;
  /** The plain name shown beside the section's icon. */
  label: string;
  /** The headline, in Title Case. */
  title: string;
  /** Two or three plain sentences. */
  description: string;
  /** Three short points, each ticked. */
  points: [string, string, string];
  art: ReactNode;
};

/**
 * The sections in the order the page tells them: what a knowledgebase is made of, why it can be trusted, how a
 * person and then an agent gets an answer from it, how a team's existing pages arrive, and where it sits.
 */
export const LANDING_SECTIONS: LandingSection[] = [
  {
    id: 'pages',
    label: 'Pages',
    title: 'Pages That Stay Organised',
    description:
      'A knowledgebase is a tree of pages, so a how-to lives under the team it belongs to and is found there again. Each page is one continuous page of writing, with tables, contents, footnotes, pictures, charts and drawings in the text. Type [[ to link to another page, and every page lists the pages that link to it.',
    points: [
      'A page tree with subpages',
      'Links that follow a page when it is renamed',
      'Linked From at the foot of every page',
    ],
    art: <PagesArt />,
  },
  {
    id: 'trust',
    label: 'Verification',
    title: 'Trust Built Into Every Page',
    description:
      'Every page has an owner, and says who verified it and when. A review comes due after 30, 90, 180 or 365 days, and the page reads Review Due until its owner checks it again. People see this on the page, and agents receive it with every passage.',
    points: [
      'An owner for every page',
      'Verified, with a name and a date',
      'Reviews that come due',
    ],
    art: <TrustArt />,
  },
  {
    id: 'ask',
    label: 'Ask',
    title: 'Ask, With Sources',
    description:
      'Ask a question in plain words and get an answer written only from your pages, each claim numbered to the passage it came from and to the person who verified it. When the pages do not cover something, Ask says so and offers to start that page: it does not guess. Ask runs on your team’s own Claude or OpenAI key, and search needs no key at all.',
    points: [
      'A citation on every claim',
      'It says what the pages do not cover',
      'Your own Claude or OpenAI key',
    ],
    art: <AskArt />,
  },
  {
    id: 'agents',
    label: 'Agents',
    title: 'The Knowledgebase Your Agents Read',
    description:
      'An MCP server and a command line give your agents the pages your team reads, as pages and passages. Every passage arrives with how far to trust it: verified or not, when, and whether its review is due. An agent’s edit lands as a suggestion for a person to accept, and a question no page answered is kept so someone can write that page.',
    points: [
      'An MCP server and a CLI',
      'Trust fields on every passage',
      'Suggested edits a person accepts',
    ],
    art: <AgentsArt />,
  },
  {
    id: 'import',
    label: 'Import and Export',
    title: 'Bring Everything With You',
    description:
      'In the editor’s Import dialog, bring in a folder of Markdown, a Notion export or a Confluence space export. The folders become the page tree, links between pages become page links, and you see what was found before anything is imported. Export a page to Markdown, PDF or Word whenever you like.',
    points: [
      'Markdown folders, Notion and Confluence',
      'A review before anything is imported',
      'Markdown, PDF and Word out',
    ],
    art: <ImportExportArt />,
  },
  {
    id: 'workspace',
    label: 'liveworkspace',
    title: 'Part of liveworkspace',
    description:
      'Embed a diagram from livediagram, a board from liveplanner, a document from livedocuments, a design from livedesign or a Space from livehuddle, and the page shows it as it is now. One account opens every app, and a knowledgebase is shared like everything else, with Editor, Participant and Viewer roles. Keep one Offline in your browser, or mirror it to Google Drive.',
    points: [
      'Live embeds from five apps',
      'Editor, Participant and Viewer roles',
      'Offline and the Google Drive mirror',
    ],
    art: <WorkspaceArt />,
  },
];

/** Section ids, in order, for the sitemap-free anchors and the tests. */
export const LANDING_SECTION_IDS = LANDING_SECTIONS.map((s) => s.id);

export function getLandingSection(id: string): LandingSection | undefined {
  return LANDING_SECTIONS.find((s) => s.id === id);
}
