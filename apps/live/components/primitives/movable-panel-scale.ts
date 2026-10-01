import type { CSSProperties } from 'react';
import { toSurfacePx } from '@/lib/ui-scale';
import type { MovablePanelProps } from './MovablePanel.types';

// A scaled panel (docs/specs/007-editor/ui-scale.md) is zoomed at its root, so
// its corner class's insets would scale with it and a 150% panel would sit
// 24px from the edge instead of 16px. While scaled, restate the same sides
// inline in surface px so the panel stays its design distance from the
// corner. Desktop insets only: a phone is never scaled. 'top-right-stacked'
// takes its top from the panel above it, so only its right side is restated.
export function cornerInsetStyle(
  corner: MovablePanelProps['defaultCorner'],
  scale: number,
): CSSProperties {
  if (scale === 1) return {};
  const gap = toSurfacePx(16, scale);
  switch (corner) {
    case 'top-right':
      return { top: gap, right: gap };
    case 'top-right-stacked':
      return { right: gap };
    case 'top-banner': {
      const banner = toSurfacePx(12, scale);
      return { top: banner, left: banner, right: banner };
    }
    case 'bottom-left':
      return { bottom: gap, left: gap };
    case 'bottom-right':
      return { bottom: gap, right: gap };
    case 'top-left':
      return { top: gap, left: gap };
  }
}
