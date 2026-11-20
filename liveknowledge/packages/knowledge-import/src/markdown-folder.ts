// Markdown Folder (docs/specs/020-import-export/knowledgebase-import.md): a folder, or a `.zip`, of `.md` files and
// pictures. The folders make the tree, `README.md` or `index.md` is its folder's own page, and a title is the first
// `#` heading, else the file's name. A file beside a folder of its own name (`deploys.md`, `deploys/`) is that
// folder's page when the folder has no `README.md` or `index.md` of its own: the shape a knowledgebase is exported
// in (`pageFilePaths`, @liveknowledge/document), so an export imports as the tree it was.

import type { ReadContext, SourceReader } from './draft';
import { folderDrafts, wrapperFolder, type FolderPage } from './folder-tree';
import { readPageSource, titleOfMarkdown } from './page-source';
import { baseOf, dirOf, extOf, keyOf, stemOf } from './paths';

const isPage = (path: string): boolean => ['md', 'markdown'].includes(extOf(path));
const isFolderPage = (path: string): boolean => /^(?:readme|index)$/i.test(stemOf(path));

// The folders that hold a file, and those with a page of their own inside them.
function foldersOf(paths: Iterable<string>): { folders: Set<string>; owned: Set<string> } {
  const folders = new Set<string>();
  const owned = new Set<string>();
  for (const path of paths) {
    for (let dir = dirOf(path); dir !== ''; dir = dirOf(dir)) folders.add(keyOf(dir));
    if (isPage(path) && isFolderPage(path)) owned.add(keyOf(dirOf(path)));
  }
  return { folders, owned };
}

async function read(context: ReadContext) {
  const found: {
    file: { path: string };
    heading: string | null;
    markdown: string;
    owns: string | null;
  }[] = [];
  const { folders, owned } = foldersOf([...context.listing.files.values()].map((f) => f.path));
  for (const file of context.listing.files.values()) {
    if (!isPage(file.path)) continue;
    const source = await readPageSource(file, context);
    if (source === null) continue;
    const { title, markdown } = titleOfMarkdown(source);
    const dir = dirOf(file.path);
    const beside = dir === '' ? stemOf(file.path) : `${dir}/${stemOf(file.path)}`;
    const owns = isFolderPage(file.path)
      ? dir
      : folders.has(keyOf(beside)) && !owned.has(keyOf(beside))
        ? beside
        : null;
    found.push({ file, heading: title, markdown, owns });
  }
  // The top folder: the archive's root, or the folder a zip wraps everything in. A folder picked and a zip of that
  // folder read the same way (knowledgebase-import.md "The top folder's own page").
  const top = keyOf(wrapperFolder(found.map(({ file, owns }) => ({ path: file.path, owns }))));
  const pages: FolderPage[] = found.map(({ file, heading, markdown, owns }) => {
    const isTop = owns !== null && keyOf(owns) === top;
    // A folder's page with no heading is named after its folder; the top one keeps its file's name.
    const name = owns !== null && !isTop ? baseOf(owns) : stemOf(file.path);
    return {
      id: keyOf(file.path),
      title: heading ?? name,
      path: file.path,
      paths: [file.path],
      markdown,
      attached: [],
      warnings: [],
      owns,
      // The page of the top folder leads its siblings (folderDrafts).
      sortName: name,
    };
  });
  return folderDrafts(pages, (folder) => folder);
}

export const markdownFolderReader: SourceReader = { isPage, read };
