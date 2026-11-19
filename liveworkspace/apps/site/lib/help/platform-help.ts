// The Explorer's help articles on liveworkspace.app (liveworkspace/docs/specs/010-site/site.md "Help"): the articles of
// All Apps' help (the one help centre, liveworkspace/docs/specs/017-help/help-centre.md) that speak of the Explorer in
// no app, where it mixes every app's work and an app's articles would speak of its kind alone. Names and addresses
// only, so the Explorer's bundle never carries the articles' text. The Help button, the sign-in banner and Search
// read it.

export type ExplorerArticle = {
  /** Its id in Search: the old platform page's slug under /help/explorer ('' for the overview). */
  slug: string;
  /** The article's path in the help centre, `<categorySlug>/<slug>` (or a category landing's slug). */
  path: string;
  /** Its name in Search. */
  title: string;
  description: string;
};

export const EXPLORER_ARTICLES: readonly ExplorerArticle[] = [
  {
    slug: '',
    path: 'explorer',
    title: 'The Explorer',
    description:
      'Every app’s work in one library: Home, My Work, Recent, Shared With Me, the Inbox, the Trash and Search.',
  },
  {
    slug: 'folders',
    path: 'explorer/folders',
    title: 'Folders',
    description:
      'Organise work from every app in folders that nest, move items between them, and see what a folder holds across apps.',
  },
  {
    slug: 'teams',
    path: 'collaboration/teams',
    title: 'Teams',
    description:
      'Work with a team in a library of its own, from every app, with roles, invites and one place for shared work.',
  },
  {
    slug: 'sharing',
    path: 'collaboration/sharing',
    title: 'Sharing Across Apps',
    description:
      'Share any item with a link, choose what people can do, and find what others shared with you.',
  },
  {
    slug: 'signing-in',
    path: 'account-and-data/signing-in',
    title: 'Guest or Account',
    description:
      'What you can do without signing in, what an account adds, and what the sign-in reminder is for.',
  },
];

/** A platform Explorer article's address in the help centre on liveworkspace.app, by its Search id (`slug`), with
 *  the trailing slash the help serves. An unknown id is the overview. */
export const explorerArticlePath = (slug: string) => {
  const article = EXPLORER_ARTICLES.find((a) => a.slug === slug) ?? EXPLORER_ARTICLES[0]!;
  return `/help/${article.path}/`;
};

/** The article each Explorer view's Help button opens, in All Apps' help on liveworkspace.app (the one help centre,
 *  liveworkspace/docs/specs/017-help/help-centre.md): the same Explorer articles each app's help has
 *  (lib/explorer/host.ts VIEW_HELP), since the overview's old sections are gone. The Invites view has none. */
const VIEW_ARTICLE: Record<string, string> = {
  home: '/help/explorer/home/',
  all: '/help/explorer/personal-space/',
  recent: '/help/explorer/recent/',
  shared: '/help/explorer/shared-with-you/',
  inbox: '/help/explorer/activity/',
  trash: '/help/account-and-data/trash/',
  search: '/help/explorer/filters/',
  folder: '/help/explorer/folders/',
  team: '/help/explorer/team-spaces/',
};

/** The path of the article a view's Help button opens, or undefined for a view with none. */
export const explorerViewArticlePath = (kind: string): string | undefined => VIEW_ARTICLE[kind];

/** The article the sign-in banner's Learn more opens. */
export const SIGN_IN_ARTICLE_PATH = explorerArticlePath('signing-in');
