// How the apps' Workers talk to liveworkspace's media service (liveworkspace/docs/specs/006-media/media.md "The API"):
// where it lives, the headers it reads, and the shapes it takes and gives. Every route is for an app's
// own Worker, never a browser: a browser asks its app, which checks who may see what and fetches the
// bytes from here.

import type { MediaApp } from './apps';

// The service's API on liveworkspace.app.
export const MEDIA_API_PATH = '/api/media';
export const MEDIA_API_URL = `https://www.liveworkspace.app${MEDIA_API_PATH}`;

// Each request names its app here and carries that app's key as `Authorization: Bearer <key>`.
export const MEDIA_APP_HEADER = 'X-Media-App';

// An upload's headers. The body is the file's raw bytes, with its Content-Type.
export const IMAGE_WIDTH_HEADER = 'X-Image-Width';
export const IMAGE_HEIGHT_HEADER = 'X-Image-Height';
// The file's own name, percent-encoded (a header is Latin-1 only). Optional.
export const IMAGE_NAME_HEADER = 'X-Image-Original-Name';
// The hex SHA-256 of the file as picked. When the owner already has those bytes, the service answers
// with that image without reading the body. An app sends it only for the owner's own editor: a bare
// hash would otherwise let anyone acting for the owner probe their gallery (liveworkspace/docs/specs/006-media/media.md
// "Uploads").
export const IMAGE_SHA256_HEADER = 'X-Image-Sha256';

// The bytes route names the image's owner in this response header, so an app can apply its own rule
// ("the image's owner owns this document") from the one request that fetched the bytes.
export const MEDIA_OWNER_HEADER = 'X-Media-Owner';

// One image as the gallery lists it. The owner and the hash stay in the service.
export type MediaImage = {
  id: string;
  contentType: string;
  byteSize: number;
  width: number;
  height: number;
  originalName?: string;
  createdAt: number;
  // The app it was uploaded in.
  app: MediaApp;
};

export type MediaListResponse = { images: MediaImage[] };
export type MediaUploadResponse = { image: MediaImage; deduped: boolean };
// `GET /app/images/<id>`: the image and whose it is.
export type MediaImageResponse = { image: MediaImage; owner: string };

// Which documents, in which apps, place each of the owner's images. An image no document places is
// absent.
export type MediaUsage = Record<string, { app: MediaApp; document: string }[]>;
export type MediaUsageResponse = { usage: MediaUsage };

// `POST /app/refs`: the images each listed document places now, replacing what the service held for
// it. An empty list means the document places none, or is gone. `complete` says every document the
// app holds has now been sent at least once, which the unused-image sweep waits for.
export type MediaRefsSync = {
  documents: { document: string; images: string[] }[];
  complete?: boolean;
};

// `POST /app/owners/merge`: a guest signed up. Their images move to the account, except those whose
// bytes the account already holds, which stay on the guest (the app keeps serving them by id).
export type MediaMergeRequest = { from: string; to: string };
export type MediaMergeResponse = { moved: string[]; kept: string[] };

// The errors the service answers with, as `{ error }`.
export type MediaError =
  | 'unauthorized'
  | 'not_found'
  | 'forbidden'
  | 'invalid_owner'
  | 'invalid_body'
  | 'invalid_dimensions'
  | 'missing_length'
  | 'file_too_large'
  | 'unsupported_type'
  | 'malformed_jpeg'
  | 'gallery_full'
  | 'upload_conflict'
  | 'media_unavailable';

// A full gallery (403): which cap, the cap, and where the owner stands.
export type MediaGalleryFull = {
  error: 'gallery_full';
  reason: 'count' | 'bytes';
  limit: number;
  current: number;
};
