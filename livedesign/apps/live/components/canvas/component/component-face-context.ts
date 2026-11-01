'use client';

// What an instance on the canvas reads (docs/specs/009-elements/components.md "How an instance draws"): the design's
// library, whether it has loaded, and the tab's look its main is drawn in. Provided once by the canvas host rather
// than threaded through every element.
import { createContext, useContext } from 'react';
import type { ComponentLookup, Tab } from '@livedesign/design';

export type ComponentFaceContextValue = {
  lookup: ComponentLookup;
  // Until the library's first load answers, an instance with no main shows Loading rather than Missing.
  loaded: boolean;
  tab: Pick<Tab, 'font' | 'finish' | 'theme'>;
  // The canvas's paper, which a hollow arrowhead takes.
  paper: string;
};

export const ComponentFaceContext = createContext<ComponentFaceContextValue | null>(null);

/** The instances' context, or null where nothing provides it (a renderer outside the editor). */
export function useComponentFaces(): ComponentFaceContextValue | null {
  return useContext(ComponentFaceContext);
}
