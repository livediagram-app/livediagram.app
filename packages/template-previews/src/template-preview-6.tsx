import type { ReactElement } from 'react';
import type { TemplateKind } from '@livediagram/templates';

// Group 6 (plan 0002 new templates). STUB: replaced by the real drawings in Phase 2.
export function templatePreviewGroup6(kind: TemplateKind): ReactElement | null {
  switch (kind) {
    case 'start-stop-continue':
    case 'mad-sad-glad':
    case 'four-ls':
    case 'sailboat':
      return (
        <svg width="76" height="46" viewBox="0 0 80 50" aria-hidden>
          <rect x="4" y="4" width="72" height="42" rx="3" fill="white" stroke="rgb(148 163 184)" />
        </svg>
      );
    default:
      return null;
  }
}
