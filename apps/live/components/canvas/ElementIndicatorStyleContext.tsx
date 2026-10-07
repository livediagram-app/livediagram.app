'use client';

// The person's element indicator style (docs/specs/008-canvas/element-indicators.md), for every
// element's indicators far below the preferences. A context like CanvasZoomContext: a change
// re-renders only the elements that carry an indicator. Outside a provider it is Top.

import { createContext, useContext, type ReactNode } from 'react';
import type { ElementIndicatorStyle } from '@/lib/element-indicator-style';

const ElementIndicatorStyleContext = createContext<ElementIndicatorStyle>('top');

// Surfaces that never draw indicators whatever the person chose (an embed,
// docs/specs/008-canvas/element-indicators.md "Unchanged"): they are editor chrome. Set above the
// canvas, so the style provider inside it reads Off.
const ElementIndicatorsSuppressedContext = createContext(false);

export function SuppressElementIndicators({
  when,
  children,
}: {
  when: boolean;
  children: ReactNode;
}) {
  return (
    <ElementIndicatorsSuppressedContext.Provider value={when}>
      {children}
    </ElementIndicatorsSuppressedContext.Provider>
  );
}

export function ElementIndicatorStyleProvider({
  style,
  children,
}: {
  style: ElementIndicatorStyle;
  children: ReactNode;
}) {
  const suppressed = useContext(ElementIndicatorsSuppressedContext);
  return (
    <ElementIndicatorStyleContext.Provider value={suppressed ? 'off' : style}>
      {children}
    </ElementIndicatorStyleContext.Provider>
  );
}

export function useElementIndicatorStyle(): ElementIndicatorStyle {
  return useContext(ElementIndicatorStyleContext);
}
