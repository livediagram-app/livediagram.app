// The gallery tools' input and output shapes (docs/specs/015-api/mcp-server.md §4.5b to §4.5d): list_images, the
// caller's image gallery, so an image element's imageId names a picture the user uploaded; upload_image, a picture
// added to it; delete_image, pictures removed from it.
import { z } from 'zod';
import { CONTACT_SHEET_MAX, IMAGE_LIST_MAX_LIMIT } from '../images/gallery';
import { IMAGE_REMOVE_MAX } from '../images/remove';

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

// One picture as the gallery tools answer it.
const galleryImage = {
  id: z.string().describe('What an image element’s imageId takes.'),
  name: z.string().describe('The uploaded file’s name.'),
  width: z.number().describe('Its width in pixels.'),
  height: z.number().describe('Its height in pixels.'),
  size: z.number().describe('Its size in bytes.'),
  uploadedAt: z.string().describe('When it was uploaded, ISO 8601.'),
};

export const listImagesOutput = {
  images: z.array(z.object(galleryImage)).describe('Newest first.'),
  more: z.number().describe('How many more match beyond the limit.'),
};

export const uploadImageShape = {
  data: z
    .string()
    .optional()
    .describe(
      'The picture’s bytes as base64, or as a data: URL (data:image/png;base64,...). Give data or url, not both.',
    ),
  url: z
    .string()
    .optional()
    .describe(
      'A public https URL of the picture itself, which the server fetches (at most 3 redirects, 10 seconds). Give data or url, not both.',
    ),
  name: z
    .string()
    .optional()
    .describe(
      'The name the gallery lists it by, such as "Q3 revenue chart.png". Default: the URL’s file name.',
    ),
};

export const uploadImageOutput = {
  ...galleryImage,
  deduped: z
    .boolean()
    .describe(
      'true when the gallery already held these bytes: the answer is that image, unchanged.',
    ),
};

export const deleteImageShape = {
  imageIds: z
    .array(z.string())
    .min(1)
    .max(IMAGE_REMOVE_MAX)
    .describe(`The pictures to remove, by id from list_images (1 to ${IMAGE_REMOVE_MAX}).`),
  force: z
    .boolean()
    .optional()
    .describe(
      'true: remove a picture even while items place it; each of those elements then shows a broken picture. Default false: a placed picture is kept and reported in_use.',
    ),
};

const imageUse = z.object({
  id: z.string().describe('The item’s id.'),
  name: z.string().describe('The item’s name.'),
  app: z.string().describe('The app it is in.'),
});

export const deleteImageOutput = {
  results: z
    .array(
      z.object({
        id: z.string().describe('The image id asked for.'),
        outcome: z
          .enum(['deleted', 'in_use', 'not_found'])
          .describe(
            'deleted: gone from the gallery. in_use: kept, because the items in usedIn place it (force removes it). not_found: not in the user’s gallery (another person’s, or already gone).',
          ),
        name: z.string().optional().describe('The picture’s name.'),
        usedIn: z
          .array(imageUse)
          .optional()
          .describe(
            'The user’s items that place it: why it was kept, or, forced, what now shows it broken.',
          ),
      }),
    )
    .describe('One per id asked for, in order.'),
  deleted: z.number().describe('How many were removed.'),
  kept: z.number().describe('How many were not (in use, or not found).'),
};
