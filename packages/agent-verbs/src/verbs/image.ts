// `image ls|add|rm` (docs/specs/015-api/cli.md "Commands", docs/specs/009-elements/images.md "Agents"): the caller's
// image gallery, so an image element's imageId= names a picture the user uploaded; a picture added to it, from a file
// or a public https URL; pictures removed from it, never a placed one unless forced. Each is its MCP tool's
// (list_images, upload_image, delete_image), over the same shared code.
import { z } from 'zod';
import { defineVerb, VerbRefusal } from '../define';
import {
  IMAGE_LIST_DEFAULT_LIMIT,
  IMAGE_LIST_MAX_LIMIT,
  galleryListing,
  sizeText,
  type GalleryUpload,
} from '../images/gallery';
import { IMAGE_REMOVE_MAX, removeFromGallery, usedInText } from '../images/remove';
import { addImage, type UploadWords } from '../images/upload';
import { columns, moreLine } from '../listing';
import type { AgentProduct } from '../product';

export { sizeText };

export function createImageVerbs({ cli }: Pick<AgentProduct, 'cli'>) {
  const imageLs = defineVerb({
    id: 'image.ls',
    summary: 'The image gallery',
    description:
      'Lists the pictures uploaded to the account, newest first: id, size in pixels and bytes, and name. An image element takes the id as imageId.',
    behaviour: 'read',
    input: z.object({
      query: z.string().optional().describe('Only images whose name holds this text'),
      limit: z.coerce
        .number()
        .int()
        .min(1)
        .max(IMAGE_LIST_MAX_LIMIT)
        .default(IMAGE_LIST_DEFAULT_LIMIT)
        .describe('At most this many'),
    }),
    output: z.object({
      images: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          width: z.number(),
          height: z.number(),
          size: z.number(),
          uploadedAt: z.string(),
        }),
      ),
      more: z.number(),
    }),
    listKey: 'images',
    run: async (ctx, { query, limit }) => {
      const { images } = await ctx.api.json<{ images?: GalleryUpload[] }>('/images');
      return galleryListing(images ?? [], { query, limit });
    },
    text: ({ images, more }) => [
      ...(images.length
        ? columns(
            images.map((i) => [
              i.id,
              `${i.width}x${i.height}`,
              sizeText(i.size),
              JSON.stringify(i.name),
            ]),
          )
        : [`no images; upload them in the editor, or with ${cli} image add`]),
      ...(more > 0 ? [moreLine(images.length, more, IMAGE_LIST_MAX_LIMIT, 'narrow the name')] : []),
    ],
    quiet: ({ images }) => images.map((i) => i.id),
    cli: {
      positionals: ['query'],
      examples: [`${cli} image ls`, `${cli} image ls screenshot --limit 5`],
      prints: 'one image a line: id, pixels, size, name',
    },
  });

  const words: UploadWords = { list: `${cli} image ls`, remove: `${cli} image rm` };
  const listedImage = z.object({
    id: z.string(),
    name: z.string(),
    width: z.number(),
    height: z.number(),
    size: z.number(),
    uploadedAt: z.string(),
  });

  const imageAdd = defineVerb({
    id: 'image.add',
    summary: 'Upload a picture to the gallery',
    description: `Uploads a PNG, JPEG, WebP or GIF (at most 10 MB; never SVG) from a file, or from a public https URL the CLI fetches, to the account's image gallery, and prints its id for an image element's imageId. The same bytes again print the image the gallery already holds.`,
    behaviour: 'write',
    input: z.object({
      source: z.string().describe('A file path, or a public https URL'),
      name: z
        .string()
        .optional()
        .describe('The name the gallery lists it by (default: the file name)'),
    }),
    output: listedImage.extend({ deduped: z.boolean() }),
    run: async (ctx, { source, name }) => {
      if (/^https?:\/\//i.test(source)) {
        return addImage(ctx.api, { url: source, name }, { source: 'cli', words });
      }
      if (!ctx.readBytes) {
        throw new VerbRefusal({
          status: 400,
          code: 'usage',
          message: 'this front door reads no files',
          hint: 'give a public https URL instead',
        });
      }
      const bytes = await ctx.readBytes(source);
      const fileName = name ?? source.split(/[\\/]/).pop()!;
      return addImage(ctx.api, { bytes, name: fileName }, { source: 'cli', words });
    },
    text: (i) => [
      `${i.deduped ? 'already in the gallery' : 'uploaded'} ${i.id} ${i.width}x${i.height} ${sizeText(i.size)} ${JSON.stringify(i.name)}`,
    ],
    quiet: (i) => [i.id],
    cli: {
      positionals: ['source'],
      examples: [
        `${cli} image add chart.png`,
        `${cli} image add https://example.com/logo.png --name Logo`,
      ],
      prints: 'the image: id, pixels, size, name',
    },
  });

  const imageRm = defineVerb({
    id: 'image.rm',
    summary: 'Remove pictures from the gallery',
    description: `Removes up to ${IMAGE_REMOVE_MAX} of the account's own pictures from its image gallery, by id. A picture still placed on an item is kept and named with where it is used, unless --force, which removes it anyway and leaves those elements showing a broken picture. There is no Trash for pictures.`,
    behaviour: 'destructive',
    input: z.object({
      ids: z.array(z.string()).min(1).max(IMAGE_REMOVE_MAX).describe('Image ids, from image ls'),
      force: z.boolean().optional().describe('Remove a picture even while items place it'),
    }),
    output: z.object({
      results: z.array(
        z.object({
          id: z.string(),
          outcome: z.enum(['deleted', 'in_use', 'not_found']),
          name: z.string().optional(),
          usedIn: z
            .array(z.object({ id: z.string(), name: z.string(), app: z.string() }))
            .optional(),
        }),
      ),
      deleted: z.number(),
      kept: z.number(),
    }),
    listKey: 'results',
    run: async (ctx, { ids, force }) => removeFromGallery(ctx.api, ids, { force: force === true }),
    text: ({ results }) =>
      results.map((r) =>
        r.outcome === 'deleted'
          ? `deleted ${r.id}${r.usedIn ? ` (it was used in ${usedInText(r.usedIn)})` : ''}`
          : r.outcome === 'in_use'
            ? `kept ${r.id}: used in ${usedInText(r.usedIn!)}; --force removes it`
            : `not found ${r.id}: not in your gallery`,
      ),
    quiet: ({ results }) => results.filter((r) => r.outcome === 'deleted').map((r) => r.id),
    exitCode: ({ kept }) => (kept > 0 ? 1 : 0),
    cli: {
      positionals: ['...ids'],
      examples: [`${cli} image rm 3f9c2a1e`, `${cli} image rm 3f9c2a1e 77ab01de --force`],
      prints: 'one line per id: deleted, kept (in use) or not found',
    },
  });

  return { imageLs, imageAdd, imageRm };
}
