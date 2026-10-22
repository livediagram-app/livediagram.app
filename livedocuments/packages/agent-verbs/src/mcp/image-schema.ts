// list_images' input and output shapes (docs/specs/015-api/mcp-server.md §4.5b): the caller's image gallery, so an
// image element's imageId names a picture the user uploaded.
import { z } from 'zod';
import { CONTACT_SHEET_MAX, IMAGE_LIST_MAX_LIMIT } from '../images/gallery';

export const listImagesShape = {
  query: z.string().optional().describe('Only images whose name holds this text.'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(IMAGE_LIST_MAX_LIMIT)
    .optional()
    .describe('At most this many (default 20).'),
  image: z
    .boolean()
    .optional()
    .describe(
      `Also attach a contact sheet: one picture of the listed images (the first ${CONTACT_SHEET_MAX}), each above its place and name.`,
    ),
};

export const listImagesOutput = {
  images: z
    .array(
      z.object({
        id: z.string().describe('What an image element’s imageId takes.'),
        name: z.string().describe('The uploaded file’s name.'),
        width: z.number().describe('Its width in pixels.'),
        height: z.number().describe('Its height in pixels.'),
        size: z.number().describe('Its size in bytes.'),
        uploadedAt: z.string().describe('When it was uploaded, ISO 8601.'),
      }),
    )
    .describe('Newest first.'),
  more: z.number().describe('How many more match beyond the limit.'),
};
