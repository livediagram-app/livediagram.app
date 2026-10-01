// Why a draw.io import was refused, and what the person importing is told
// (docs/specs/020-import-export/blueprints/drawio-import.md "Refusals").

export type DrawioRefusalReason =
  | 'too-large'
  | 'not-xml'
  | 'not-drawio'
  | 'no-pages'
  | 'png-without-diagram'
  | 'svg-without-diagram'
  | 'page-unreadable'
  | 'library'
  | 'not-library'
  | 'empty-library'
  | 'unreadable';

export class DrawioRefused extends Error {
  readonly reason: DrawioRefusalReason;
  readonly detail: string | undefined;
  constructor(reason: DrawioRefusalReason, detail?: string) {
    super(`draw.io import refused: ${reason}`);
    this.name = 'DrawioRefused';
    this.reason = reason;
    this.detail = detail;
  }
}

export function refusalMessage(reason: DrawioRefusalReason, detail?: string): string {
  switch (reason) {
    case 'too-large':
      return 'This file is too large to import (the limit is 50 MB).';
    case 'not-xml':
      return "This isn't a draw.io file: it isn't a .drawio, a .drawio.png, a .drawio.svg or a draw.io JSON export.";
    case 'not-drawio':
      return "This XML isn't a draw.io diagram (expected an mxfile or mxGraphModel).";
    case 'no-pages':
      return 'This draw.io file has no pages.';
    case 'png-without-diagram':
      return "This PNG has no draw.io diagram inside. In draw.io, export as PNG with 'Include a copy of my diagram' ticked.";
    case 'svg-without-diagram':
      return "This SVG has no draw.io diagram inside. In draw.io, export as SVG with 'Include a copy of my diagram' ticked.";
    case 'page-unreadable':
      return `Page '${detail ?? ''}' couldn't be decoded.`;
    case 'library':
      return "This is a draw.io shape library. Import it from the Explorer's Import from draw.io to add it to My shapes.";
    case 'not-library':
      return "This isn't a draw.io library (expected an mxlibrary holding a list of shapes).";
    case 'empty-library':
      return "None of this library's shapes could be read.";
    case 'unreadable':
      return "Couldn't read this draw.io file.";
  }
}
