// The MCP's gallery writers (docs/specs/015-api/mcp-server.md §4.5c and §4.5d): upload_image adds a picture to the
// user's image gallery, delete_image removes pictures from it. The gallery is the person's across every app, so the
// words are the same in each; each product lists them beside its list_images, and each MCP's handlers are thin wiring
// over ../images/upload.ts and ../images/remove.ts.

import { MAX_IMAGE_MB } from '@liveworkspace/media';
import { IMAGE_REMOVE_MAX } from '../images/remove';
import {
  deleteImageOutput,
  deleteImageShape,
  uploadImageOutput,
  uploadImageShape,
} from './image-schema';
import { mcpTool } from './tool';

export const mcpUploadImage = mcpTool('upload_image', {
  behaviour: 'write',
  // A url is fetched from the open web.
  openWorld: true,
  title: 'Upload an image',
  description:
    `Add a picture to the user’s image gallery (the one list_images lists, shared by every app they use), so an ` +
    'image element can show it: its bytes as base64 in data (a data: URL works too), or a public https URL in url ' +
    `for the server to fetch. PNG, JPEG, WebP or GIF, up to ${MAX_IMAGE_MB} MB; SVG is refused (render it to PNG ` +
    'first). Answers the new image’s id, which an image element’s imageId takes, with its name, width, height and ' +
    'size; the same bytes again answer the image the gallery already holds (deduped). The gallery shows a picture ' +
    'uploaded here as Made by AI. A full gallery is refused, saying how full; delete_image makes room.',
  inputSchema: uploadImageShape,
  outputSchema: uploadImageOutput,
});

export const mcpDeleteImage = mcpTool('delete_image', {
  behaviour: 'destructive',
  idempotent: true,
  title: 'Delete images from the gallery',
  description:
    `Remove pictures from the user’s own image gallery, by id from list_images (1 to ${IMAGE_REMOVE_MAX} a call). ` +
    'A picture still placed on any of the user’s items is kept and answered in_use, naming the items that use it; ' +
    'force true removes it anyway, and every element that places it then shows a broken picture until someone ' +
    'picks another. Answers each id’s outcome: deleted, in_use, or not_found (not in the user’s gallery: ' +
    'another person’s, or already gone). There is no Trash for pictures: a removed one is gone for good. Confirm ' +
    'with the user first.',
  inputSchema: deleteImageShape,
  outputSchema: deleteImageOutput,
});
