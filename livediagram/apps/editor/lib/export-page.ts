// Exporting one page (docs/specs/007-editor/pages-mode.md "Export"): the frame, its background and
// what reaches onto it live in @livediagram/document (page-frame.ts), shared with an agent's previews.
export {
  PAGE_EXPORT_PAPER as EXPORT_PAPER,
  pageExportFrame,
  type PageExportFrame,
} from '@livediagram/document';
