// `image ls` (docs/specs/015-api/cli.md "Commands", docs/specs/009-elements/images.md "Agents"): the caller's image
// gallery, so an image element's imageId= names a picture the user uploaded. The listing is the MCP's list_images'.
import { z } from 'zod';
import type { ImageSummary } from '@livepages/api-schema';
import { defineVerb } from '../define';
import { IMAGE_LIST_DEFAULT_LIMIT, IMAGE_LIST_MAX_LIMIT, galleryListing } from '../images/gallery';
import { columns } from './shared';

const KIB = 1024;

// A size as people read it: bytes, KB or MB.
export function sizeText(bytes: number): string {
  if (bytes < KIB) return `${bytes} B`;
  if (bytes < KIB * KIB) return `${Math.round(bytes / KIB)} KB`;
  return `${(bytes / (KIB * KIB)).toFixed(1)} MB`;
}

export const imageLs = defineVerb({
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
    const { images } = await ctx.api.json<{ images?: ImageSummary[] }>('/images');
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
      : ['no images; upload them in the editor']),
    ...(more > 0 ? [`… ${more} more; --limit ${images.length + more}, or narrow the name`] : []),
  ],
  quiet: ({ images }) => images.map((i) => i.id),
  cli: {
    positionals: ['query'],
    examples: ['livepages image ls', 'livepages image ls screenshot --limit 5'],
    prints: 'one image a line: id, pixels, size, name',
  },
});
