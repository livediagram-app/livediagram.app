// The user's image gallery for agents (docs/specs/015-api/mcp-server.md §4.5b, docs/specs/009-elements/images.md
// "Agents"): list_images, and the check every element-writing tool runs so an imageId names a picture the caller may
// place. Pictures reach the gallery through the editor; no tool uploads.
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ImageSummary } from '@livediagram/api-schema';
import {
  CONTACT_SHEET_MAX,
  galleryListing,
  imagesPlacedIn,
  unknownImageIssue,
  type GalleryImage,
} from '@livediagram/agent-verbs';
import { mcpListImages } from '@livediagram/agent-verbs/mcp';
import type { Element, Tab } from '@livediagram/document';
import { ApiError, apiJson } from './api';
import type { Env } from './env';
import { imageResult } from './image-result';
import { registerTool } from './tool-annotations';
import { errorResult, requireToken, textResult } from './tool-helpers';

export const IMAGES_UNAVAILABLE =
  'Images are not available on this livediagram server (it has no image storage).';

// The contact sheet's grid: four pictures a row, each fitted into its cell above a caption.
const SHEET_COLUMNS = 4;
const CELL_WIDTH = 320;
const CELL_HEIGHT = 220;
const CAPTION_HEIGHT = 44;
const GAP = 24;
const CAPTION_MAX = 40;
// resvg decodes each embedded picture at full size: measured at about 0.65 s a megapixel (a 2880x1800 screenshot,
// 3.4 s; twelve, 14.9 s on an M-series laptop, docs/specs/015-api/mcp-server.md §4.5b). The sheet draws pictures in
// order until they would pass this many pixels (three full-screen retina screenshots, about 10 s); the rest keep a
// captioned placeholder and are never fetched.
export const CONTACT_SHEET_MAX_PIXELS = 16_000_000;

// The caller's gallery, or null when this server keeps no images (a self-host without R2 answers 503).
async function readGallery(env: Env, token: string): Promise<ImageSummary[] | null> {
  try {
    return (await apiJson<{ images?: ImageSummary[] }>(env, token, '/images')).images ?? [];
  } catch (err) {
    if (err instanceof ApiError && err.status === 503) return null;
    throw err;
  }
}

// Why a tool's input cannot be written for the pictures it places, or null. Reads the gallery only when the input
// places a picture, once for the whole call.
export async function imageIdIssue(
  env: Env,
  token: string,
  input: unknown,
): Promise<string | null> {
  const placed = imagesPlacedIn(input);
  if (placed.length === 0) return null;
  const gallery = await readGallery(env, token);
  if (!gallery) return IMAGES_UNAVAILABLE;
  return unknownImageIssue(placed, new Set(gallery.map((i) => i.id)));
}

const caption = (n: number, name: string, drawn: boolean) => {
  const text = `${n}. ${name}`;
  const cut = text.length > CAPTION_MAX ? `${text.slice(0, CAPTION_MAX - 1)}…` : text;
  return drawn ? cut : `${cut}\n(too large to draw here)`;
};

// The listed pictures on a throwaway tab, in a grid, each captioned with its place and name: drawn by the preview,
// which embeds each picture with the caller's token as it does any tab's.
export function contactSheetTab(images: readonly GalleryImage[]): Tab {
  let pixels = 0;
  const elements: Element[] = images.slice(0, CONTACT_SHEET_MAX).flatMap((image, i) => {
    const size = image.width * image.height;
    const drawn = pixels + size <= CONTACT_SHEET_MAX_PIXELS;
    if (drawn) pixels += size;
    const x = (i % SHEET_COLUMNS) * (CELL_WIDTH + GAP);
    const y = Math.floor(i / SHEET_COLUMNS) * (CELL_HEIGHT + CAPTION_HEIGHT + GAP);
    return [
      {
        id: `picture-${i + 1}`,
        type: 'image',
        x,
        y,
        width: CELL_WIDTH,
        height: CELL_HEIGHT,
        imageId: drawn ? image.id : null,
        naturalWidth: image.width,
        naturalHeight: image.height,
        objectFit: 'contain',
      },
      {
        id: `caption-${i + 1}`,
        type: 'text',
        x,
        y: y + CELL_HEIGHT + 6,
        width: CELL_WIDTH,
        height: CAPTION_HEIGHT - 6,
        label: caption(i + 1, image.name, drawn),
        textSize: 'sm',
        textAlignX: 'left',
      },
    ] satisfies Element[];
  });
  return { id: 'contact-sheet', name: 'Images', elements };
}

export function registerImageTools(server: McpServer, env: Env): void {
  registerTool(server, env, mcpListImages, async (args, extra) => {
    const token = requireToken(extra);
    const gallery = await readGallery(env, token);
    if (!gallery) return errorResult(IMAGES_UNAVAILABLE);
    const listing = galleryListing(gallery, { query: args.query, limit: args.limit });
    if (!args.image || listing.images.length === 0) return textResult(listing);
    return imageResult(listing, contactSheetTab(listing.images), { env, token });
  });
}
