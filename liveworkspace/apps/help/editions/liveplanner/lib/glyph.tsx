// The feature and article icons' frame (featureIcons.tsx, articleIcons.tsx): a 24-unit outline glyph at w-6 h-6.

import { Glyph as UiGlyph } from '@liveplanner/ui';
import type { ReactNode } from 'react';

export function Glyph({ children }: { children: ReactNode }) {
  return (
    <UiGlyph size={24} units={24} className="h-6 w-6">
      {children}
    </UiGlyph>
  );
}
