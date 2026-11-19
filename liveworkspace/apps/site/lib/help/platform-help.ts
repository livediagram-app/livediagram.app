// The Explorer's help articles on liveworkspace.app (liveworkspace/docs/specs/010-site/site.md "Help"): the platform's own,
// for the Explorer in no app, where it mixes every app's work and an app's articles would speak of its kind alone.
// This file holds only names and addresses, so the Explorer's bundle never carries the articles' text
// (components/help/explorer-articles.tsx). The Help button, the sign-in banner and Search read it.

export type ExplorerArticle = {
  /** The path under /help/explorer ('' for the overview). */
  slug: string;
  /** Its heading, and its name in Search. */
  title: string;
  description: string;
};

export const EXPLORER_ARTICLES: readonly ExplorerArticle[] = [
  {
    slug: '',
    title: 'The Explorer',
    description:
      'Every app’s work in one library: Home, My Work, Recent, Shared With Me, the Inbox, the Trash and Search.',
  },
  {
    slug: 'folders',
    title: 'Folders',
    description:
      'Organise work from every app in folders that nest, and see what a folder holds across apps.',
  },
  {
    slug: 'teams',
    title: 'Teams',
    description:
      'Work with a team in a library of its own, from every app, with roles, invites and one place for shared work.',
  },
  {
    slug: 'moving',
    title: 'Moving Work',
    description:
      'Move an item between folders, My Work and a team: from its menu, by dragging, and how to undo it.',
  },
  {
    slug: 'sharing',
    title: 'Sharing Across Apps',
    description:
      'Share any item with a link, choose what people can do, and find what others shared with you.',
  },
  {
    slug: 'signing-in',
    title: 'Guest or Account',
    description:
      'What you can do without signing in, what an account adds, and what the sign-in reminder is for.',
  },
];

/** A platform Explorer article's address on liveworkspace.app, without a trailing slash as the site's pages are. */
export const explorerArticlePath = (slug: string) => `/help/explorer${slug ? `/${slug}` : ''}`;

/** The article each Explorer view's Help button opens: a folder and a team have their own, every other view a
 *  section of the overview. The Invites view has none. */
const VIEW_ARTICLE: Record<string, string> = {
  home: `${explorerArticlePath('')}#home`,
  all: `${explorerArticlePath('')}#my-work`,
  recent: `${explorerArticlePath('')}#recent`,
  shared: `${explorerArticlePath('')}#shared-with-me`,
  inbox: `${explorerArticlePath('')}#inbox`,
  trash: `${explorerArticlePath('')}#trash`,
  search: `${explorerArticlePath('')}#search`,
  folder: explorerArticlePath('folders'),
  team: explorerArticlePath('teams'),
};

/** The path of the article a view's Help button opens, or undefined for a view with none. */
export const explorerViewArticlePath = (kind: string): string | undefined => VIEW_ARTICLE[kind];

/** The article the sign-in banner's Learn more opens. */
export const SIGN_IN_ARTICLE_PATH = explorerArticlePath('signing-in');
