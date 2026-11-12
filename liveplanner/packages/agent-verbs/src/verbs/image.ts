// `image add` (docs/specs/015-api/cli.md "Pictures"): a picture uploaded for a plan's cards, from a file or a public
// https URL, as the MCP's upload_image does; `item set` then places its id on an Image field or attachments.
import { z } from 'zod';
import { sizeText } from '@liveworkspace/agent-verbs/images/gallery';
import { defineVerb, VerbRefusal } from '../define';
import { uploadForPlan } from '../images/plan-upload';
import { projectOf } from './shared';

export const imageAdd = defineVerb({
  id: 'image.add',
  summary: 'Upload a picture for a plan’s cards',
  description:
    'Uploads a PNG, JPEG, WebP or GIF (at most 10 MB; never SVG) from a file, or from a public https URL the CLI ' +
    'fetches, into your image gallery for a plan, and prints its id. Place it on a card with item set ' +
    '(--fields Designs=<id>, or attachments=<id>). Needs an Editor or a Participant of the plan.',
  behaviour: 'write',
  input: z.object({
    project: z.string().describe('A name, id prefix or liveplanner URL'),
    source: z.string().describe('A file path, or a public https URL'),
    name: z
      .string()
      .optional()
      .describe('The name the gallery lists it by (default: the file name)'),
  }),
  output: z.object({
    id: z.string(),
    name: z.string(),
    width: z.number(),
    height: z.number(),
    size: z.number(),
    uploadedAt: z.string(),
    deduped: z.boolean(),
  }),
  run: async (ctx, { project, source, name }) => {
    const { id: projectId } = await projectOf(ctx, project);
    if (/^https?:\/\//i.test(source))
      return uploadForPlan(ctx.api, projectId, { url: source, name }, 'cli');
    if (!ctx.readBytes)
      throw new VerbRefusal({
        status: 400,
        code: 'usage',
        message: 'this front door reads no files',
        hint: 'give a public https URL instead',
      });
    const bytes = await ctx.readBytes(source);
    const fileName = name ?? source.split(/[\\/]/).pop()!;
    return uploadForPlan(ctx.api, projectId, { bytes, name: fileName }, 'cli');
  },
  text: (i) => [
    `${i.deduped ? 'already in the gallery' : 'uploaded'} ${i.id} ${i.width}x${i.height} ${sizeText(i.size)} ${JSON.stringify(i.name)}`,
  ],
  quiet: (i) => [i.id],
  cli: {
    positionals: ['project', 'source'],
    examples: [
      'liveplanner image add "Sprint 14" design.png',
      'liveplanner image add 3f9c https://example.com/mock.png --name Mock',
    ],
    prints: 'the image: id, pixels, size, name',
  },
});
