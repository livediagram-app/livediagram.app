// Exporting one Illustrate page (docs/specs/007-editor/illustrate-pages.md "Export"): the frame, its background and
// what reaches onto it live in @livediagram/document (illustrate-page-frame.ts), shared with an agent's previews.
export {
  PAGE_EXPORT_PAPER as EXPORT_PAPER,
  pageExportFrame,
  type PageExportFrame,
} from '@livediagram/document';
