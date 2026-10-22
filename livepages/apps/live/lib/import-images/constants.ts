// Every number the import image pipeline uses (docs/specs/020-import-export/import-image-pipeline.md).
// Provenance and safe ranges: docs/specs/020-import-export/blueprints/import-image-pipeline.md.

export const IMPORT_IMAGE_MAX_EDGE_PX = 2048;
export const IMPORT_IMAGE_WEBP_QUALITY = 0.85;
export const IMPORT_IMAGE_JPEG_QUALITY = 0.85;
export const IMPORT_IMAGE_SVG_RASTER_SCALE = 2;
export const IMPORT_IMAGE_SVG_DEFAULT_EDGE_PX = 1024;
export const IMPORT_IMAGE_MAX_SOURCE_BYTES = 50 * 1024 * 1024;
export const IMPORT_IMAGE_CONCURRENCY = 3;
export const OFFLINE_IMPORT_EMBED_BUDGET_CHARS = 8 * 1024 * 1024;
