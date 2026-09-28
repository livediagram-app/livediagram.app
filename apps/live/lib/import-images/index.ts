// The import image pipeline's public surface for importers
// (docs/specs/020-import-export/import-image-pipeline.md). The browser wiring
// (`./browser`) is imported lazily by the caller so its DOM code stays out of
// the editor's first bundle.

export { attachImportImages } from './attach';
export {
  describeImportImageReport,
  emptyImportImageReport,
  importImagePlaceholderCount,
  importImageReportTotal,
  type ImportImageReportCopy,
} from './report';
export {
  IMPORT_IMAGE_FAILURES,
  type DisplayHint,
  type ImportImageFailure,
  type ImportImageOutcome,
  type ImportImageProgress,
  type ImportImageReport,
  type ImportImageRequest,
  type ImportImageSession,
  type ImportImageSource,
} from './types';
