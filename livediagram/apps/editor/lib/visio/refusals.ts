// Why a Visio import was refused, and what the person importing is told
// (docs/specs/020-import-export/visio-import.md "Inputs").

export type VisioRefusalReason =
  | 'too-large'
  | 'too-large-unpacked'
  | 'vsd'
  | 'vdx'
  | 'not-visio'
  | 'damaged'
  | 'no-pages'
  | 'unreadable';

export class VisioRefused extends Error {
  readonly reason: VisioRefusalReason;
  constructor(reason: VisioRefusalReason) {
    super(`Visio import refused: ${reason}`);
    this.name = 'VisioRefused';
    this.reason = reason;
  }
}

export function visioRefusalMessage(reason: VisioRefusalReason): string {
  switch (reason) {
    case 'too-large':
      return 'This file is too large to import (the limit is 50 MB).';
    case 'too-large-unpacked':
      return 'This file unpacks to more than an import can read.';
    case 'vsd':
      return 'This is an older Visio drawing (.vsd). Open it in Visio and save it as a .vsdx, then import that.';
    case 'vdx':
      return 'This is a Visio 2010 XML drawing (.vdx). Save it as a .vsdx in Visio, or export it from Lucidchart as Visio (VSDX).';
    case 'not-visio':
      return "This isn't a Visio file. Pick a .vsdx, saved from Visio or exported from Lucidchart (File, Export, Visio (VSDX)).";
    case 'damaged':
      return "This .vsdx couldn't be read: the file looks damaged.";
    case 'no-pages':
      return 'This Visio file has no pages.';
    case 'unreadable':
      return "Couldn't read this Visio file.";
  }
}
