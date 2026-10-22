// `tab render` (docs/specs/015-api/blueprints/cli.md "Previews", CLI30): a tab as the api draws it (render.svg),
// written as SVG or PNG.

import { tabOf, tabPath, type VerbContext } from '@livedesign/agent-verbs';
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
