'use client';

// The active tab's canvas style as the viewer's canvas draws it (resolveViewBackdrop), for what covers the canvas
// (CanvasCover): the canvas paints a static pattern on `main`, which a cover inherits, but an animated one is a layer of
// its own that a cover would hide, so the cover draws it again from here. Provided by the editor above both the canvas
// and the tab-filling pages (a form, a dashboard), which are not inside the canvas's own tree.
import { createContext, useContext } from 'react';
import type { TabPattern } from './TabPatternLayer';

export const CanvasPatternContext = createContext<TabPattern | null>(null);

export const useCanvasPattern = () => useContext(CanvasPatternContext);
