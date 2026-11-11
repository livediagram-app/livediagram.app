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
  // The tool that uploaded it (`mcp`, an AI assistant; `cli`), absent for a person's own upload
  // (liveworkspace/docs/specs/006-media/media.md "Uploaded by a tool").
  source?: 'mcp' | 'cli';
};
