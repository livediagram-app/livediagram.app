// `export <knowledgebase> <dir>` (docs/specs/024-agents/knowledgebase-for-agents.md "CLI"): a knowledgebase as a
// folder of Markdown to keep beside a repository. One file a page, a page's subpages in a folder of its name
// (`pageFilePaths`), links between pages relative, pictures as files under `pictures/` where the api hands their
// bytes and as their addresses where it does not.
//
// Streamed: the page tree is one read (no page's writing), then each page is read, written and let go before the
// next, so the export holds one page at a time however large the knowledgebase is. A picture is fetched once, the
// first time a page shows it.
import {
  knowledgePath,
  resolveDocument,
  tabPath,
  type VerbContext,
} from '@liveknowledge/agent-verbs';
import { isKnowledgePageRow, type KnowledgePagesResponse } from '@liveknowledge/api-schema';
import { pageFilePaths, type Tab } from '@liveknowledge/document';
import type { CliIo } from '@liveworkspace/cli-kit/io';
import { withoutTrailingSlashes } from '@liveworkspace/api-schema/url-slashes';
import { patiently } from './export';
import { pageFileMarkdown, pagePictures } from './knowledge-page-file';

export type KnowledgeExportInput = { doc: string; dir: string };

export const PICTURES_FOLDER = 'pictures';

const EXTENSIONS: Readonly<Record<string, string>> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'image/avif': 'avif',
};

const folderOf = (path: string) => path.split('/').slice(0, -1).join('/');

export async function exportKnowledgebase(
  io: CliIo,
  ctx: VerbContext,
  input: KnowledgeExportInput,
): Promise<{ paths: string[]; documents: number; exit: number }> {
  const root = withoutTrailingSlashes(input.dir);
  const resolved = await resolveDocument(ctx.api, input.doc, ctx.host, ctx.log);
  if (resolved.shareCode) ctx.useShareCode(resolved.shareCode);
  const listed = await patiently(ctx, () =>
    ctx.api.json<KnowledgePagesResponse>(knowledgePath(resolved.id, 'pages')),
  );
  // A connected file in the tree is another app's, with no writing here: it is not exported.
  const pages = listed.pages.filter(isKnowledgePageRow);
  const files = pageFilePaths(
    pages.map((p) => ({ id: p.tab, name: p.title, ...(p.parent ? { parent: p.parent } : {}) })),
  );
  ctx.log(`export ${pages.length} pages as Markdown`);
  const paths: string[] = [];
  const made = new Set<string>();
  const mkdir = async (folder: string) => {
    if (made.has(folder)) return;
    made.add(folder);
    await io.files.mkdir(folder ? `${root}/${folder}` : root);
  };
  await mkdir('');

  // Where each picture was written, or its address when the api would not hand its bytes: fetched once.
  const pictures = new Map<string, string>();
  const pictureFile = async (imageId: string): Promise<string> => {
    const address = `${ctx.host}/api/images/${encodeURIComponent(imageId)}`;
    try {
      const res = await patiently(ctx, () =>
        ctx.api.fetch(`/images/${encodeURIComponent(imageId)}`),
      );
      const type = (res.headers.get('Content-Type') ?? '').split(';')[0]!.trim().toLowerCase();
      const extension = EXTENSIONS[type];
      if (!res.ok || !extension) {
        ctx.notice(
          `picture ${imageId} could not be read (HTTP ${res.status}): its address is written`,
        );
        return address;
      }
      const file = `${PICTURES_FOLDER}/${imageId.replace(/[^\w.-]/g, '-')}.${extension}`;
      await mkdir(PICTURES_FOLDER);
      await io.files.writeBytes(`${root}/${file}`, new Uint8Array(await res.arrayBuffer()));
      paths.push(`${root}/${file}`);
      return file;
    } catch (error) {
      ctx.notice(`picture ${imageId} could not be read (${String(error)}): its address is written`);
      return address;
    }
  };

  for (const row of pages) {
    const file = files.get(row.tab)!;
    const { tab } = await patiently(ctx, () =>
      ctx.api.json<{ tab: Tab }>(tabPath(resolved.id, row.tab)),
    );
    for (const imageId of pagePictures(tab))
      if (!pictures.has(imageId)) pictures.set(imageId, await pictureFile(imageId));
    await mkdir(folderOf(file));
    await io.files.write(
      `${root}/${file}`,
      pageFileMarkdown(tab, file, files, (imageId) => pictures.get(imageId)!),
    );
    paths.push(`${root}/${file}`);
  }
  return { paths, documents: 1, exit: 0 };
}
