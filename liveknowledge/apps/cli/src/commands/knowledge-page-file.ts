// One page as its file in a Markdown export of a knowledgebase (docs/specs/024-agents/knowledgebase-for-agents.md
// "CLI"; docs/specs/020-import-export/blueprints/knowledgebase-import.md "Markdown export"): its writing as
// Markdown, each link to another page a relative link to that page's file, and each picture where it sits in the
// writing. Pure: the files and the pictures' addresses are handed in.
import {
  articlesOf,
  articleToMarkdown,
  layOutPages,
  pagesOf,
  relativePagePath,
  withPageLinksAsFiles,
  zoneCanvasRect,
  zoneMemberIds,
  type Element,
  type Tab,
} from '@liveknowledge/document';

type Picture = { id: string; imageId: string; alt: string };

const pictureOf = (element: Element): Picture | null => {
  const { imageId, alt, name } = element as { imageId?: unknown; alt?: unknown; name?: unknown };
  if (element.type !== 'image' || typeof imageId !== 'string' || !imageId) return null;
  const said = typeof alt === 'string' && alt ? alt : typeof name === 'string' ? name : '';
  return { id: element.id, imageId, alt: said.replace(/[[\]\n]/g, ' ').trim() };
};

/** The pictures a page shows, each once, in the order its elements hold them. */
export function pagePictures(tab: Pick<Tab, 'elements'>): string[] {
  const ids = tab.elements.flatMap((e) => pictureOf(e)?.imageId ?? []);
  return [...new Set(ids)];
}

// The page's one article: the flow its first article page shows, else its first.
function flowOf(tab: Tab) {
  const flows = articlesOf(tab);
  const shown = pagesOf(tab).find((p) => p.kind === 'article' && p.flow && flows[p.flow]);
  return flows[shown?.flow ?? Object.keys(flows)[0] ?? ''];
}

/**
 * The page's file. `files` is every page's path from the export's root (`pageFilePaths`), `file` this page's, and
 * `pictureAt` where a picture was written (a path from the root) or its address when its bytes could not be read.
 * A zone's line gives way to the pictures standing in it; a picture in no zone follows the writing.
 */
export function pageFileMarkdown(
  tab: Tab,
  file: string,
  files: ReadonlyMap<string, string>,
  pictureAt: (imageId: string) => string,
): string {
  const flow = flowOf(tab);
  const hrefOf = (address: string) =>
    /^[a-z][a-z0-9+.-]*:/i.test(address) ? address : relativePagePath(file, address);
  const line = (p: Picture) => `![${p.alt}](${hrefOf(pictureAt(p.imageId))})`;
  const pictures = tab.elements.flatMap((e) => pictureOf(e) ?? []);
  const placed = new Set<string>();
  let markdown = '';
  if (flow) {
    const laid = layOutPages(pagesOf(tab));
    const inZone = new Map<string, Picture[]>();
    for (const block of flow.blocks) {
      if (block.type !== 'zone') continue;
      const rect = zoneCanvasRect(laid, block);
      const members = rect ? zoneMemberIds(tab.elements, rect) : new Set<string>();
      const held = pictures.filter((p) => members.has(p.id) && !placed.has(p.id));
      held.forEach((p) => placed.add(p.id));
      inZone.set(block.id, held);
    }
    markdown = articleToMarkdown(
      withPageLinksAsFiles(flow, (page) => {
        const to = files.get(page);
        return to === undefined ? undefined : relativePagePath(file, to);
      }),
    )
      .split('\n')
      .flatMap((text, i, lines) => {
        const zone = /^\[zone ([^\]\s]{1,64})\]$/.exec(text);
        // Every zone the writing holds was looked up above.
        if (zone) return inZone.get(zone[1]!)!.map(line);
        // The blank line after a zone that holds no picture goes with it.
        const before = /^\[zone ([^\]\s]{1,64})\]$/.exec(lines[i - 1] ?? '');
        return text === '' && before && !inZone.get(before[1]!)?.length ? [] : [text];
      })
      .join('\n');
  }
  const loose = pictures.filter((p) => !placed.has(p.id)).map(line);
  const body = [markdown.trimEnd(), ...(loose.length ? [loose.join('\n\n')] : [])]
    .filter(Boolean)
    .join('\n\n');
  return `${body}\n`;
}
