// Images (docs/specs/009-elements/images.md): one row of the gallery list.

// One row returned by `GET /api/images` (the gallery list) + the
// inner shape of the `POST /api/images` response (`{ image, deduped }`).
// The bytes themselves are fetched separately via
// `GET /api/images/<id>?d=<documentId>` (owner or share-code gated).
export type ImageSummary = {
  id: string;
  contentType: string;
  byteSize: number;
  width: number;
  height: number;
  originalName?: string;
  createdAt: number;
};
