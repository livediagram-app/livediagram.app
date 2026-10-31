// What a PowerPoint export writes (docs/specs/020-import-export/blueprints/office-export.md "Domain and naming"): a
// deck of slides, each a background, shapes in paint order and notes. Everything is already in the file's units
// (EMU, points) and colours, so the writer only spells it out.

import type { OoxmlColour } from './ooxml-colour';

/** A box on the slide, in EMU. */
export type EmuRect = { x: number; y: number; cx: number; cy: number };

export type PptxRun = {
  text: string;
  sizePt: number;
  colour: OoxmlColour | null;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  font?: string;
};

export type PptxAlign = 'l' | 'ctr' | 'r';

export type PptxParagraph = { align: PptxAlign; runs: PptxRun[]; lineHeightPt: number };

export type PptxTextBody = {
  anchor: 't' | 'ctr' | 'b';
  /** Left, top, right, bottom insets, EMU. */
  insets: [number, number, number, number];
  paragraphs: PptxParagraph[];
};

export type PptxLine = { colour: OoxmlColour; widthEmu: number; dash?: 'dash' | 'sysDot' };

/** A native shape: a text box (`txBox`, no fill or line of its own) or a preset geometry with its text. */
export type PptxShape = {
  kind: 'shape';
  name: string;
  box: EmuRect;
  /** Clockwise, degrees. */
  rotation: number;
  txBox: boolean;
  /** A preset geometry's name, or `custom` for `polygon`. */
  geometry: string;
  /** A preset's first adjust value (a rounded rectangle's corner), when it has one. */
  adjust?: number;
  /** A custom outline: an SVG path (absolute M, L, C and Z) in a 0..100 box stretched over the shape's. */
  outline?: string;
  fill: OoxmlColour | null;
  line: PptxLine | null;
  body: PptxTextBody | null;
};

export type PptxPicture = { kind: 'picture'; name: string; box: EmuRect; png: Uint8Array };

export type PptxItem = PptxShape | PptxPicture;

export type PptxBackground =
  { kind: 'solid'; colour: OoxmlColour } | { kind: 'picture'; image: Uint8Array };

export type PptxSlide = {
  background: PptxBackground | null;
  items: PptxItem[];
  notes?: string;
  hidden?: boolean;
};

export type PptxDeck = { title: string; cx: number; cy: number; slides: PptxSlide[] };
