// The page tree a folder of files makes (docs/specs/020-import-export/blueprints/knowledgebase-import.md "Folder
// trees"), shared by Markdown Folder and Notion: a page sits under the page that owns its folder, a folder nobody
// owns gets an empty page of its own name, and folders that only wrap the whole archive are not pages at all.

import type { DraftPage } from './draft';
import { baseOf, compareNames, dirOf, keyOf } from './paths';

export type FolderPage = Omit<DraftPage, 'parentId'> & {
  /** The folder this page is the page of (a `README.md`'s folder, a Notion page's own folder), or null. */
  owns: string | null;
  /** What its siblings sort it by. */
  sortName: string;
};

/** The folder a page sits in, as far as the tree goes: its own folder's parent when it owns one. */
const homeOf = (page: FolderPage): string => dirOf(page.owns ?? page.path);

/** The folders that wrap everything and are nobody's page: `Export-1234/`, or the zipped folder itself. */
function wrapperOf(pages: FolderPage[]): string {
  let root = '';
  for (;;) {
    let next: string | null = null;
    for (const page of pages) {
      const rest = (page.owns ?? page.path).slice(root.length);
      const slash = rest.indexOf('/');
      // A page in this very folder, or the page that owns it: it is no wrapper.
      if (slash === -1) return root;
      const segment = rest.slice(0, slash + 1);
      if (next !== null && next !== segment) return root;
      next = segment;
    }
    if (next === null) return root;
    root = `${root}${next}`;
  }
}

export function folderDrafts(
  pages: FolderPage[],
  titleOfFolder: (name: string) => string,
): DraftPage[] {
  const owners = new Map<string, FolderPage>();
  for (const page of pages) if (page.owns !== null) owners.set(keyOf(page.owns), page);
  const wrapper = wrapperOf(pages).slice(0, -1);
  const folders = new Map<string, FolderPage>();
  // The id of the page for `dir`, making an empty one for a folder nobody owns; null at the top.
  const pageFor = (dir: string): string | null => {
    if (dir === '' || dir === wrapper) return null;
    const key = keyOf(dir);
    const owner = owners.get(key) ?? folders.get(key);
    if (owner) return owner.id;
    const name = baseOf(dir);
    const made: FolderPage = {
      id: `folder:${key}`,
      title: titleOfFolder(name),
      path: `${dir}/`,
      paths: [],
      markdown: '',
      attached: [],
      warnings: [],
      owns: dir,
      sortName: name,
    };
    folders.set(key, made);
    return made.id;
  };
  const drafts = pages.map((page) => ({ page, parentId: pageFor(homeOf(page)) }));
  // A made folder may sit in another folder nobody owns: `pageFor` makes those as it is asked.
  for (const folder of folders.values()) {
    drafts.push({ page: folder, parentId: pageFor(homeOf(folder)) });
  }
  return drafts
    .toSorted((a, b) => compareNames(a.page.sortName, b.page.sortName))
    .map(({ page: { owns: _owns, sortName: _sortName, ...draft }, parentId }) => ({
      ...draft,
      parentId,
    }));
}
