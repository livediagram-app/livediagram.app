'use client';

// The person's element indicator style (docs/specs/008-canvas/element-indicators.md), for every
// element's indicators far below the preferences. A context like CanvasZoomContext: a change
// re-renders only the elements that carry an indicator. Outside a provider it is Corner.

import { createContext, useContext, type ReactNode } from 'react';
import type { ElementIndicatorStyle } from '@/lib/element-indicator-style';

const ElementIndicatorStyleContext = createContext<ElementIndicatorStyle>('corner');

export function ElementIndicatorStyleProvider({
  style,
  children,
}: {
  style: ElementIndicatorStyle;
  children: ReactNode;
}) {
  return (
    <ElementIndicatorStyleContext.Provider value={style}>
      {children}
    </ElementIndicatorStyleContext.Provider>
  );
}

export function useElementIndicatorStyle(): ElementIndicatorStyle {
  return useContext(ElementIndicatorStyleContext);
}
