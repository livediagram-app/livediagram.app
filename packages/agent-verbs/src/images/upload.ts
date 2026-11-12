// Adding a picture to the user's gallery from an agent (docs/specs/009-elements/images.md "Agents", the media service's
// liveworkspace/docs/specs/006-media/media.md "Uploaded by a tool"): the MCP's upload_image and the CLI's `image add`.
// The bytes arrive as base64 (or a data: URL), as a file the CLI reads, or from a public https URL fetched through
// api-kit's SSRF-safe fetch. Whatever their source they are judged by their own first bytes, never a declared type:
// only the formats the media service stores pass (PNG, JPEG, WebP, GIF; never SVG), at most MAX_IMAGE_BYTES, with a
// size their header gives. The upload is the api's own (`POST /api/images`, raw bytes), as the caller, naming the
// tool that sent it so the gallery can say Made by AI.

import type { ApiClient } from '@liveworkspace/api-client';
import { ApiError } from '@liveworkspace/api-client';
import {
  fetchPublicBytes,
  type PublicFetchOptions,
  type PublicFetchRefusal,
} from '@liveworkspace/api-kit/public-fetch';
import {
  ACCEPTED_IMAGE_TYPES,
  imageDimensions,
  MAX_IMAGE_BYTES,
  MAX_IMAGE_MB,
  ORIGINAL_NAME_MAX,
  sniffImageType,
  type AcceptedImageType,
  type ImageSource,
} from '@liveworkspace/media';
import { VerbRefusal } from '../define';
import { imageName, sizeText, type GalleryImage, type GalleryUpload } from './gallery';

// What the refusals name, so the MCP and the CLI each say their own words for the same steps.
export type UploadWords = {
  // The tool, or command, that lists the gallery and removes from it.
  list: string;
  remove: string;
};

const FORMATS = 'PNG, JPEG, WebP or GIF';

const refuse = (status: number, code: string, message: string, hint: string): never => {
  throw new VerbRefusal({ status, code, message, hint });
};

const tooLarge = (size: string): never =>
  refuse(
    413,
    'file_too_large',
    `That picture is ${size}; the gallery takes files up to ${MAX_IMAGE_MB} MB.`,
    'make it smaller (fewer pixels, or JPEG or WebP for a photo) and upload it again',
  );

// The bytes of a picture sent as base64, or as a data: URL. The cap is prepareImage's, on the decoded bytes: the MCP
// transport already bounds the text (MCP_MAX_REQUEST_BYTES, 15 MiB, so at most about 11.8 MB decoded), and decoding
// it (about 50 ms at the cap) costs less than counting its characters first did (about 190 to 390 ms).
export function decodeImageData(data: string): Uint8Array {
  const dataUrl = /^data:([^,]*),/i.exec(data);
  if (dataUrl && !/;base64$/i.test(dataUrl[1]!)) {
    refuse(
      400,
      'invalid_data',
      'data is a data: URL that is not base64.',
      'send the picture as base64, or as a data:image/png;base64,... URL',
    );
  }
  const text = dataUrl ? data.slice(dataUrl[0].length) : data;
  try {
    return fromBase64(text);
  } catch {
    return refuse(
      400,
      'invalid_data',
      'data is not valid base64.',
      'send the file’s bytes as standard base64 (A-Z, a-z, 0-9, + and /)',
    );
  }
}

type WithFromBase64 = { fromBase64?: (text: string) => Uint8Array };

// The runtime's own decoder where it has one (one pass, no intermediate string), else atob's binary string.
function fromBase64(text: string): Uint8Array {
  const native = (Uint8Array as unknown as WithFromBase64).fromBase64;
  if (native) return native(text);
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// SVG and other XML: text that opens with a tag, after any whitespace (the decoder drops a byte-order mark).
const looksLikeMarkup = (bytes: Uint8Array) =>
  /^\s*</.test(new TextDecoder().decode(bytes.subarray(0, 256)));

export type PreparedImage = {
  bytes: Uint8Array;
  contentType: AcceptedImageType;
  width: number;
  height: number;
  name: string | null;
};

// A picture ready to upload: its bytes judged by themselves, never by a declared type.
export function prepareImage(bytes: Uint8Array, name: string | null): PreparedImage {
  if (bytes.byteLength === 0) {
    refuse(400, 'empty_file', 'That picture is empty (0 bytes).', 'send the file’s bytes');
  }
  if (bytes.byteLength > MAX_IMAGE_BYTES) tooLarge(sizeText(bytes.byteLength));
  const contentType = sniffImageType(bytes.subarray(0, 16));
  if (!contentType) {
    refuse(
      415,
      'unsupported_type',
      looksLikeMarkup(bytes)
        ? `That is SVG or other markup, which the gallery never stores (it can carry a script). Send a ${FORMATS}.`
        : `That is not a picture the gallery takes: it takes ${FORMATS} (${ACCEPTED_IMAGE_TYPES.join(', ')}).`,
      looksLikeMarkup(bytes)
        ? 'render the SVG to a PNG first'
        : 'convert it to PNG, JPEG, WebP or GIF',
    );
  }
  const size = imageDimensions(bytes, contentType!);
  if (!size) {
    refuse(
      415,
      'unreadable_image',
      `That ${contentType!.slice('image/'.length).toUpperCase()} has no size its header gives, so it looks damaged.`,
      'export the picture again and upload that',
    );
  }
  const cut = name?.trim() ? Array.from(name.trim()).slice(0, ORIGINAL_NAME_MAX).join('') : null;
  return { bytes, contentType: contentType!, width: size!.width, height: size!.height, name: cut };
}

// The file name a URL ends in, for a picture that comes with none: its last path segment, decoded when it decodes.
export function nameFromUrl(url: string): string | null {
  const last = new URL(url).pathname.split('/').filter(Boolean).pop();
  if (!last) return null;
  try {
    return decodeURIComponent(last);
  } catch {
    return last;
  }
}

const URL_WORDS: Record<PublicFetchRefusal, string> = {
  invalid_url:
    'is not a URL the server can fetch (an absolute https URL, with no user name or password)',
  not_https: 'is not https on port 443; only https URLs are fetched',
  private_address:
    'points at a private, loopback, link-local or internal address, which the server never fetches',
  unresolved: 'names a host that does not resolve',
  too_many_redirects: 'redirects more than 3 times',
  http_status: 'did not answer with the picture',
  too_large: `is more than ${MAX_IMAGE_MB} MB`,
  timeout: 'took too long to answer (10 seconds)',
  unreachable: 'could not be reached',
};

// The bytes at a public https URL, through api-kit's SSRF-safe fetch, at most one byte past the cap.
export async function fetchImageUrl(
  url: string,
  options: Omit<PublicFetchOptions, 'maxBytes'> = {},
): Promise<{ bytes: Uint8Array; url: string }> {
  const got = await fetchPublicBytes(url, {
    ...options,
    maxBytes: MAX_IMAGE_BYTES,
    headers: { Accept: ACCEPTED_IMAGE_TYPES.join(', '), ...options.headers },
  });
  if (got.ok) return { bytes: got.bytes, url: got.url };
  const status = got.status ? ` (${got.status})` : '';
  return refuse(
    got.reason === 'too_large' ? 413 : 400,
    `url_${got.reason}`,
    `The URL ${JSON.stringify(got.url)} ${URL_WORDS[got.reason]}${status}.`,
    'give a public https URL of the picture itself, or send its bytes as data',
  );
}

export type UploadedImage = GalleryImage & { deduped: boolean };

// The gallery's answer to a full gallery: which cap, the cap, and where the owner stands.
type GalleryFull = { reason?: string; limit?: number; current?: number };

function galleryFullWords(err: ApiError, words: UploadWords): string {
  let full: GalleryFull = {};
  try {
    full = JSON.parse(err.body) as GalleryFull;
  } catch {
    // A body that is not JSON: the numbers are left out.
  }
  const holds =
    full.reason === 'bytes' && full.limit !== undefined && full.current !== undefined
      ? `it holds ${sizeText(full.current)} of its ${sizeText(full.limit)}`
      : full.limit !== undefined && full.current !== undefined
        ? `it holds ${full.current} of its ${full.limit} images`
        : 'it holds as much as it may';
  // One place that both lists and removes (liveplanner's Explorer Image Gallery) is named once.
  const where =
    words.list === words.remove ? words.remove : `${words.remove} (${words.list} lists them)`;
  return `The image gallery is full: ${holds}. Remove pictures it no longer needs with ${where}, then upload again.`;
}

// The api's upload route: the gallery's own, or one that also records the picture for an item (liveplanner's
// `/images?p={planId}`, docs/specs/015-api/mcp-server.md §4.5b there).
export const GALLERY_UPLOAD_PATH = '/images';

// Upload a prepared picture to the caller's gallery as `source`: its new image, or the one the gallery already had
// with those bytes (`deduped`). A refusal the caller can act on is a VerbRefusal in words.
export async function uploadToGallery(
  api: ApiClient,
  image: PreparedImage,
  source: ImageSource,
  words: UploadWords,
  path: string = GALLERY_UPLOAD_PATH,
): Promise<UploadedImage> {
  const headers: Record<string, string> = {
    'Content-Type': image.contentType,
    'X-Image-Width': String(image.width),
    'X-Image-Height': String(image.height),
    'X-Image-Source': source,
  };
  if (image.name) headers['X-Image-Original-Name'] = encodeURIComponent(image.name);
  let answer: { image: GalleryUpload; deduped: boolean };
  try {
    answer = await api.json(path, {
      method: 'POST',
      headers,
      // The DOM types take only an ArrayBuffer-backed view as a body; these bytes are never shared memory.
      body: image.bytes as Uint8Array<ArrayBuffer>,
    });
  } catch (err) {
    // A full gallery, as the api passes the service's answer on (403 in some products, the service's own 409 in
    // others).
    if (err instanceof ApiError && err.code === 'gallery_full') {
      refuse(
        err.status,
        'gallery_full',
        galleryFullWords(err, words),
        `run ${words.list} to choose`,
      );
    }
    if (err instanceof ApiError && err.status === 413) tooLarge(sizeText(image.bytes.byteLength));
    if (err instanceof ApiError && err.status === 503) {
      refuse(
        503,
        'images_unavailable',
        'Images are not available on this server.',
        'try again later',
      );
    }
    throw err;
  }
  const { image: stored, deduped } = answer;
  return {
    id: stored.id,
    name: imageName(stored),
    width: stored.width,
    height: stored.height,
    size: stored.byteSize,
    uploadedAt: new Date(stored.createdAt).toISOString(),
    deduped,
  };
}

// Where a picture comes from: base64 text (the MCP's data), a public https URL, or bytes already read (the CLI's
// file).
export type ImageFrom =
  | { data?: string | undefined; url?: string | undefined; name?: string | undefined }
  | { bytes: Uint8Array; name: string | null };

// The User-Agent a URL fetch names itself by.
export const IMAGE_FETCH_USER_AGENT = 'liveworkspace-images/1.0 (+https://www.liveworkspace.app)';

// Add one picture to the caller's gallery, from wherever it comes: upload_image and `image add`.
export async function addImage(
  api: ApiClient,
  from: ImageFrom,
  {
    source,
    words,
    fetch: fetchOptions = {},
    path = GALLERY_UPLOAD_PATH,
  }: {
    source: ImageSource;
    words: UploadWords;
    fetch?: Omit<PublicFetchOptions, 'maxBytes'>;
    // The upload route, when not the gallery's own (GALLERY_UPLOAD_PATH).
    path?: string;
  },
): Promise<UploadedImage> {
  if ('bytes' in from)
    return uploadToGallery(api, prepareImage(from.bytes, from.name), source, words, path);
  const { data, url, name } = from;
  if ((data === undefined) === (url === undefined)) {
    refuse(
      400,
      'invalid_input',
      'Give the picture as data (base64) or as url, one of the two.',
      'send data, or url, not both',
    );
  }
  if (url !== undefined) {
    const fetched = await fetchImageUrl(url, {
      ...fetchOptions,
      headers: { 'User-Agent': IMAGE_FETCH_USER_AGENT, ...fetchOptions.headers },
    });
    return uploadToGallery(
      api,
      prepareImage(fetched.bytes, name ?? nameFromUrl(fetched.url)),
      source,
      words,
      path,
    );
  }
  return uploadToGallery(
    api,
    prepareImage(decodeImageData(data!), name ?? null),
    source,
    words,
    path,
  );
}
