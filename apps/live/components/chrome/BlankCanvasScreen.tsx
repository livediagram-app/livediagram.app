'use client';

import {
  DARK_CANVAS_BACKGROUND_COLOR,
  DARK_CANVAS_PATTERN_COLOR,
  DEFAULT_BACKGROUND_COLOR,
  DEFAULT_PATTERN_COLOR,
} from '@livediagram/document';
import { tabBackgroundStyle } from '@/lib/canvas-backgrounds';

// The quiet opening screen (docs/specs/007-editor/new-document-route.md): the marketing hero's
// launch window grows into a full-screen blank canvas, and /new?blank=1&welcome=1 holds exactly
// that canvas, the Default scheme's paper and dots, until the editor is ready, in place of the
// "Creating your document" screen. So the growth, the create and the editor's load read as one
// surface. Light and dark are both drawn and the appearance class picks one, so it needs no state.
const ORIGIN = { x: 0, y: 0 };
const LIGHT = tabBackgroundStyle('grid', ORIGIN, DEFAULT_BACKGROUND_COLOR, DEFAULT_PATTERN_COLOR);
const DARK = tabBackgroundStyle(
  'grid',
  ORIGIN,
  DARK_CANVAS_BACKGROUND_COLOR,
  DARK_CANVAS_PATTERN_COLOR,
);

export function BlankCanvasScreen() {
  return (
    <div aria-busy="true" className="fixed inset-0">
      <span className="sr-only" role="status">
        Creating your document
      </span>
      <div aria-hidden className="absolute inset-0 dark:hidden" style={LIGHT} />
      <div aria-hidden className="absolute inset-0 hidden dark:block" style={DARK} />
    </div>
  );
}
