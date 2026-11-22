import type { HelpHomeLayout, HomeSection } from '@liveworkspace/help-site/lib/home';

// liveknowledge's help home (liveworkspace/docs/specs/017-help/help-centre.md "Home layout rules"): which categories
// each section shows, in order, and the popular topics under the search. The shared suite (help-site.test.ts) holds
// it to the catalogue: every category in exactly one section, every popular topic and step a real article.

/** The category sections between the hero and the closing band, top to bottom. Knowledgebase leads: it is what the
 *  app is for. */
const sections: HomeSection[] = [
  {
    id: 'editor-guides',
    eyebrow: 'Editor Guides',
    heading: 'Everything in a Knowledgebase',
    lede: 'In-depth guides to pages, trust, search, Ask, AI Knowledge and Automations, then the parts every liveworkspace app shares.',
    categories: [
      'knowledgebase',
      'collaboration',
      'explorer',
      'tools',
      'search-panel',
      'user-interface',
    ],
  },
  {
    id: 'account',
    eyebrow: 'Your Account',
    heading: 'Your account and your data',
    lede: 'Who you are to liveknowledge, where your work lives, and the promises that cover it.',
    categories: ['account-and-data', 'privacy-and-security', 'policies'],
  },
];

/** Start Here: the walkthrough's category, its steps by path, and the two cards beside it. Developers stands here,
 *  not in a section of its own: giving an agent the Knowledgebase is one of the first things a team does with it. */
const startHere = {
  walkthrough: 'getting-started',
  steps: [
    'getting-started/your-first-knowledgebase',
    'getting-started/describe-to-set-up',
    'knowledgebase/the-page-tree',
    'knowledgebase/owners-and-verifying',
  ],
  beside: ['about', 'developers'],
} as const;

/** The closing band: the category beside the Contact route. */
const stillStuck = { category: 'troubleshooting', contact: 'contact' } as const;

/** The chips under the hero's search: the articles most readers come for, by `categorySlug/slug`. */
const popular: HelpHomeLayout['popular'] = [
  { label: 'Your first Knowledgebase', path: 'getting-started/your-first-knowledgebase' },
  { label: 'The page tree', path: 'knowledgebase/the-page-tree' },
  { label: 'Verifying a page', path: 'knowledgebase/owners-and-verifying' },
  { label: 'Ask', path: 'knowledgebase/ask' },
  { label: 'Connecting an agent', path: 'knowledgebase/connecting-an-agent' },
  { label: 'Importing', path: 'knowledgebase/import-a-markdown-folder' },
];

export const HOME: HelpHomeLayout = { sections, startHere, stillStuck, popular };
