// Markdown Folder (docs/specs/020-import-export/knowledgebase-import.md): a folder, or a `.zip`, of `.md` files and
// pictures. The folders make the tree, `README.md` or `index.md` is its folder's own page, and a title is the first
// `#` heading, else the file's name.

import type { ReadContext, SourceReader } from './draft';
import { folderDrafts, type FolderPage } from './folder-tree';
import { readPageSource, titleOfMarkdown } from './page-source';
import { baseOf, dirOf, extOf, keyOf, stemOf } from './paths';

const isPage = (path: string): boolean => ['md', 'markdown'].includes(extOf(path));
const isFolderPage = (path: string): boolean => /^(?:readme|index)$/i.test(stemOf(path));

async function read(context: ReadContext) {
  const pages: FolderPage[] = [];
  for (const file of context.listing.files.values()) {
    if (!isPage(file.path)) continue;
    const source = await readPageSource(file, context);
    if (source === null) continue;
    const { title, markdown } = titleOfMarkdown(source);
    const dir = dirOf(file.path);
    const owns = isFolderPage(file.path) ? dir : null;
    // A folder's page with no heading is named after its folder; the top one keeps its file's name.
    const name = owns ? baseOf(owns) : stemOf(file.path);
    pages.push({
      id: keyOf(file.path),
      title: title ?? name,
      path: file.path,
      paths: [file.path],
      markdown,
      attached: [],
      warnings: [],
      owns,
      // The page of the top folder leads its siblings.
      sortName: owns === '' ? '' : name,
    });
  }
  return folderDrafts(pages, (folder) => folder);
}

export const markdownFolderReader: SourceReader = { isPage, read };
