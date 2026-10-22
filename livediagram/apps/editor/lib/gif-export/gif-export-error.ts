// The animated GIF export's failures (docs/specs/020-import-export/animated-gif-export.md "Errors"), each one line in
// the panel.
export type GifExportErrorCode = 'page-missing' | 'tainted' | 'failed';

export class GifExportError extends Error {
  readonly code: GifExportErrorCode;
  constructor(code: GifExportErrorCode) {
    super(`gif-export ${code}`);
    this.code = code;
  }
}
