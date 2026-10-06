// `tab render` and `graph render` (docs/specs/015-api/blueprints/cli.md "Previews", CLI30): a tab as the api draws
// it (render.svg), or a graph or Mermaid file laid out as the api would lay it out, written as SVG or PNG.

import { graphOfSource, tabOf, tabPath, type VerbContext } from '@livediagram/agent-verbs';
import { lintGraph } from '@livediagram/diagram-lint';
import { renderElementsToSvg } from '@livediagram/document';
import { resolveIconExportArt, resolveStickerArt } from '@livediagram/icons/resolve';
import type { CliIo } from '../io';
import { CliError } from '../output/cli-error';
import { EXIT } from '../output/exit-codes';
import { pictureLine, writePicture } from '../render/png';

type PictureFlags = { png?: string; svg?: string };

// Exactly one of --png and --svg: where to write, and as what.
function targetOf(flags: PictureFlags): { path: string; format: 'png' | 'svg' } {
  if ((flags.png === undefined) === (flags.svg === undefined))
    throw new CliError({
      exit: EXIT.usage,
      code: 'usage',
      message: 'give --png <file> or --svg <file>, one of them',
    });
  return flags.png !== undefined
    ? { path: flags.png, format: 'png' }
    : { path: flags.svg!, format: 'svg' };
}

export async function renderTab(
  io: CliIo,
  ctx: VerbContext,
  input: { doc: string; tab?: string } & PictureFlags,
): Promise<{ lines: string[] }> {
  const target = targetOf(input);
  const { document, tab } = await tabOf(ctx, input.doc, input.tab);
  const { body } = await ctx.api.text(`${tabPath(document.id, tab.id)}/render.svg`);
  return { lines: [pictureLine(await writePicture(io, target.path, body, target.format))] };
}

export async function renderGraph(
  io: CliIo,
  readInput: (path: string) => Promise<string>,
  input: { file: string } & PictureFlags,
  log: (line: string) => void,
): Promise<{ lines: string[] }> {
  const target = targetOf(input);
  const named = input.file === '-' ? 'stdin' : input.file;
  const graph = graphOfSource(await readInput(input.file), named);
  const { elements } = lintGraph(graph, {
    log: (fingerprint, fields) => log(`${fingerprint} ${JSON.stringify(fields)}`),
  });
  const svg = renderElementsToSvg(
    { id: 'graph', name: named, elements },
    { resolveIconArt: resolveIconExportArt, resolveStickerArt },
  );
  return { lines: [pictureLine(await writePicture(io, target.path, svg, target.format))] };
}
